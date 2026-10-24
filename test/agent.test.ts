import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { bodies, CFG, cleanup, exists, finalDone, mkTask, put, read, resetRepo, script, tmp, toolCall } from "./helpers.ts";
import { capsFor, requestBody, runAgent } from "../src/engine.ts";
import type { ToolSchema } from "../src/engine.ts";
import { makeVerifier, report } from "../src/gates.ts";
import { ROLES } from "../src/roles.ts";

after(cleanup);
beforeEach(resetRepo);

const logPath = () => path.join(tmp, "agent.log");
const implCaps = (t = mkTask({ allowedPaths: ["src/**", "tests/**"], testCommand: "echo ok" })) => capsFor("impl", ROLES.impl, t);
const seen = (i: number) => JSON.stringify(bodies.at(i));

describe("agent loop", () => {
  it("retries a 500, writes the file, and blocks a traversal attempt", async () => {
    const pkg = read("package.json");
    script.push({ status: 500 }, toolCall("write_file", { path: "src/feature.js", content: "export const x = 1;\n" }), toolCall("write_file", { path: "src/../package.json", content: "PWNED" }), finalDone);
    const out = await runAgent({ prompt: "go", caps: implCaps(), logPath: logPath() });
    assert.equal(out.exhausted, false);
    assert.equal(out.turns, 3);
    assert.ok(exists("src/feature.js"));
    assert.equal(read("package.json"), pkg);
  });

  it("stops when the signal is aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    assert.equal((await runAgent({ prompt: "go", caps: implCaps(), logPath: logPath(), signal: ac.signal })).aborted, true);
  });
});

describe("verifier", () => {
  const code = makeVerifier("code", mkTask({ allowedPaths: ["src/**"], testCommand: "node -e \"process.exit(0)\"" }))!;
  const review = makeVerifier("review", null)!;

  it("asks for the summary json, but does not repair a SPEC_GAP or a mid-sentence 'blocked'", async () => {
    assert.equal((await code("all done"))?.why, "no summary json");
    assert.equal(await code("SPEC_GAP: contradictory"), null);
    assert.equal((await code("Not blocked: all fine, no json"))?.why, "no summary json");
  });

  it("review output needs json with a verdict", async () => {
    assert.equal((await review("great code"))?.why, "no review json");
    assert.equal((await review('```json\n{"status":"done","did":[]}\n```'))?.why, "review json has no verdict");
    assert.equal(await review('```json\n{"verdict":"PASS","criteria":[],"findings":[]}\n```'), null);
  });
});

describe("repair loop", () => {
  const task = mkTask({ allowedPaths: ["src/**"], testCommand: "node scripts/chk.js", id: "02", rel: "x.md" });
  const setup = () => {
    put("scripts/chk.js", "process.exit(require('fs').existsSync('src/ok.txt') ? 0 : 1)");
    return { caps: implCaps(task), verify: makeVerifier("code", task)! };
  };

  it("feeds a failed self-check back once, then accepts the fix", async () => {
    const { caps, verify } = setup();
    script.push(toolCall("write_file", { path: "src/feature2.js", content: "1\n" }), finalDone, toolCall("write_file", { path: "src/ok.txt", content: "ok" }), finalDone);
    const out = await runAgent({ prompt: "go", caps, logPath: logPath(), verify });
    assert.equal(out.repairs.length, 1);
    assert.equal(out.turns, 4);
    assert.ok(seen(-2).includes("FAILED") && !seen(-3).includes("FAILED"), "failure output reached the model, and only after the check");
    assert.ok((out.repairs[0]?.why.length ?? 999) <= 160, "log line is short");
    assert.deepEqual(report({ summary: { status: "partial", did: ["a"], not_done: ["b"], notes: "n" }, repairs: out.repairs }), { status: "partial", did: ["a"], not_done: ["b"], notes: "n", repairs: [out.repairs[0]?.why] });
  });

  it("stops after MAX_REPAIRS and hands over", async () => {
    const { caps, verify } = setup();
    script.push(finalDone, finalDone, finalDone, finalDone);
    const out = await runAgent({ prompt: "go", caps, logPath: logPath(), verify });
    assert.equal(out.repairs.length, CFG.maxRepairs);
    assert.equal(out.turns, CFG.maxRepairs + 1);
  });
});

describe("thinking mode", () => {
  const tools = [{ type: "function", function: { name: "x", description: "", parameters: {} } }] satisfies ToolSchema[];

  it("is enabled with high effort by default; the request carries both and no temperature", () => {
    assert.deepEqual([CFG.thinking, CFG.effort], ["enabled", "high"]);
    const b = requestBody([], tools);
    assert.deepEqual([b.thinking, b.reasoning_effort, "temperature" in b], [{ type: "enabled" }, "high", false]);
    assert.ok(CFG.maxTokens >= 32000, "default token budget leaves room for reasoning");
  });

  it("disabled is sent explicitly, with temperature and no effort", () => {
    const off = requestBody([], [], { model: "m", maxTokens: 8000, thinking: "disabled", effort: "high", temperature: 0.2 });
    assert.deepEqual([off.thinking, off.temperature, "reasoning_effort" in off], [{ type: "disabled" }, 0.2, false]);
  });

  it("passes the effort value through, and sends no tool_choice without tools", () => {
    assert.equal(requestBody([], [], { model: "m", maxTokens: 1, thinking: "enabled", effort: "max" }).reasoning_effort, "max");
    assert.ok(!("tool_choice" in requestBody([], [])));
  });

  it("the live request to the mock has the thinking fields", async () => {
    script.push(finalDone);
    await runAgent({ prompt: "go", caps: implCaps(), logPath: logPath() });
    assert.ok(bodies.length > 0 && bodies.every((b) => b.thinking?.type === "enabled" && b.reasoning_effort === "high" && !("temperature" in b)));
  });

  it("a tool call cut off by max_tokens is not run; the model is told and its reasoning is passed back", async () => {
    script.push(
      { message: { role: "assistant", content: null, reasoning_content: "because", tool_calls: [{ id: "c9", type: "function", function: { name: "list_dir", arguments: "{" } }] }, finish_reason: "length" },
      { message: { role: "assistant", content: "done" } },
    );
    const out = await runAgent({ prompt: "go", caps: implCaps(), logPath: logPath() });
    assert.equal(out.finalText, "done");
    assert.ok(seen(-1).includes("cut off") && seen(-1).includes("because"));
  });
});
