import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CFG, cleanup, finalDone, mkTask, resetRepo, script, tmp, toolCall } from "./helpers.ts";
import { capsFor, runAgent } from "../src/engine.ts";
import { makeVerifier } from "../src/gates.ts";
import { ROLES } from "../src/roles.ts";
import { classifyDenied, summarizeArgs, tracePath, traceSink } from "../src/trace.ts";
import type { TraceEvent } from "../src/types.ts";

after(cleanup);
beforeEach(resetRepo);

const logPath = () => path.join(tmp, "trace-agent.log");
const caps = (t = mkTask({ allowedPaths: ["src/**"], testCommand: "echo ok" })) => capsFor("impl", ROLES.impl, t);
const collect = () => {
  const events: TraceEvent[] = [];
  return { events, sink: (e: TraceEvent) => void events.push(e) };
};
const types = (events: TraceEvent[]) => events.map((e) => e.type);

describe("trace events from the agent loop", () => {
  it("records turns with usage (reasoning as a subset, null when absent) and tool calls", async () => {
    const { events, sink } = collect();
    script.push(
      { ...toolCall("write_file", { path: "src/a2.js", content: "SECRET-BODY\n" }), usage: { prompt_tokens: 100, completion_tokens: 40, prompt_cache_hit_tokens: 60, completion_tokens_details: { reasoning_tokens: 25 } }, delayMs: 15 },
      finalDone,
    );
    const out = await runAgent({ prompt: "go", caps: caps(), logPath: logPath(), trace: sink });
    assert.deepEqual(types(events), ["turn", "tool", "turn"]);
    const [t1, tool, t2] = events as [Extract<TraceEvent, { type: "turn" }>, Extract<TraceEvent, { type: "tool" }>, Extract<TraceEvent, { type: "turn" }>];
    assert.deepEqual([t1.n, t1.prompt_tokens, t1.completion_tokens, t1.reasoning_tokens, t1.cache_hit_tokens, t1.tool_calls], [1, 100, 40, 25, 60, 1]);
    assert.ok(t1.ms >= 10, "elapsed ms is measured");
    assert.deepEqual([t2.reasoning_tokens, t2.cache_hit_tokens], [null, null]);
    assert.deepEqual([tool.name, tool.ok, tool.denied], ["write_file", true, false]);
    assert.deepEqual(tool.args, { path: "src/a2.js", content_chars: 12 });
    assert.ok(!JSON.stringify(events).includes("SECRET-BODY"), "file contents never reach the trace");
    assert.deepEqual([out.usage.input, out.usage.output, out.usage.reasoning, out.usage.cacheHit], [110, 45, 25, 60]);
  });

  it("flags a refused write as denied:'write' and a refused read as denied:'read'", async () => {
    const { events, sink } = collect();
    script.push(toolCall("write_file", { path: "src/../package.json", content: "x" }), toolCall("read_file", { path: ".env" }), toolCall("read_file", { path: "../outside.txt" }), finalDone);
    await runAgent({ prompt: "go", caps: caps(), logPath: logPath(), trace: sink });
    const tools = events.filter((e): e is Extract<TraceEvent, { type: "tool" }> => e.type === "tool");
    assert.deepEqual(tools.map((t) => [t.name, t.ok, t.denied]), [["write_file", false, "write"], ["read_file", false, "read"], ["read_file", false, "read"]]);
  });

  it("records a repair with its reason", async () => {
    const { events, sink } = collect();
    script.push(finalDone, finalDone);
    const task = mkTask({ allowedPaths: ["src/**"], testCommand: "node -e \"process.exit(1)\"" });
    await runAgent({ prompt: "go", caps: caps(task), logPath: logPath(), verify: makeVerifier("code", task)!, trace: sink });
    const repairs = events.filter((e): e is Extract<TraceEvent, { type: "repair" }> => e.type === "repair");
    assert.equal(repairs.length, CFG.maxRepairs);
    assert.deepEqual([repairs[0]?.n, repairs[0]?.turn], [1, 1]);
    assert.match(repairs[0]?.why ?? "", /tests failed/);
  });

  it("records a tool call cut off by max_tokens, and a truncated final answer", async () => {
    const { events, sink } = collect();
    script.push(
      { message: { role: "assistant", content: null, tool_calls: [{ id: "c9", type: "function", function: { name: "list_dir", arguments: "{" } }] }, finish_reason: "length" },
      { message: { role: "assistant", content: "partial answer" }, finish_reason: "length" },
    );
    await runAgent({ prompt: "go", caps: caps(), logPath: logPath(), trace: sink });
    assert.deepEqual(events.filter((e) => e.type === "truncated"), [{ type: "truncated", turn: 1, kind: "tool_call" }, { type: "truncated", turn: 2, kind: "final" }]);
    assert.ok(!events.some((e) => e.type === "tool"), "the cut-off call was not run");
  });

  it("records an API retry with its status", async () => {
    const { events, sink } = collect();
    script.push({ status: 500 }, finalDone);
    await runAgent({ prompt: "go", caps: caps(), logPath: logPath(), trace: sink });
    const retry = events.find((e): e is Extract<TraceEvent, { type: "api_retry" }> => e.type === "api_retry");
    assert.deepEqual([retry?.attempt, retry?.status], [1, 500]);
    assert.deepEqual(types(events), ["api_retry", "turn"]);
  });
});

describe("trace file", () => {
  it("appends timestamped JSON lines under specs/.jobs, and never throws when it cannot write", () => {
    fs.mkdirSync(CFG.jobs, { recursive: true });
    const sink = traceSink("aaaaaaaa");
    sink({ type: "repair", n: 1, turn: 2, why: "x" });
    sink({ type: "job_end", state: "done", elapsed_ms: 5, turns: 2 });
    const lines = fs.readFileSync(tracePath("aaaaaaaa"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    assert.deepEqual(lines.map((l) => l.type), ["repair", "job_end"]);
    assert.ok(lines.every((l) => !Number.isNaN(Date.parse(String(l.ts)))));
    const broken = traceSink("../no/such/dir/bbbbbbbb");
    assert.doesNotThrow(() => broken({ type: "job_end", state: "failed", elapsed_ms: 1, turns: null }));
  });

  it("never contains the API key", async () => {
    CFG.key = "sk-LEAKCHECK-0123456789";
    fs.mkdirSync(CFG.jobs, { recursive: true });
    script.push(toolCall("read_file", { path: "package.json" }), finalDone);
    await runAgent({ prompt: "go", caps: caps(), logPath: logPath(), trace: traceSink("cccccccc") });
    const all = [tracePath("cccccccc"), logPath()].map((f) => fs.readFileSync(f, "utf8")).join("\n");
    assert.ok(all.length > 0 && !all.includes("LEAKCHECK"));
    CFG.key = "test-key";
  });
});

describe("helpers", () => {
  it("summarizes args from a whitelist", () => {
    assert.deepEqual(summarizeArgs("edit_file", { path: "a", old: "xx", new: "yyy" }), { path: "a", old_chars: 2, new_chars: 3 });
    assert.deepEqual(summarizeArgs("grep", { pattern: "secret", path: "." }), { pattern_chars: 6, path: ".", max: undefined });
    assert.deepEqual(summarizeArgs("mystery", { a: 1, b: 2 }), { keys: ["a", "b"] });
  });

  it("classifies denied errors by tool kind", () => {
    assert.equal(classifyDenied("edit_file", "not permitted to edit x; allowed: src/**"), "write");
    assert.equal(classifyDenied("write_file", "this role is read-only"), "write");
    assert.equal(classifyDenied("read_file", "not permitted to read .env"), "read");
    assert.equal(classifyDenied("list_dir", "path escapes the repo: ../x"), "read");
    assert.equal(classifyDenied("edit_file", "`old` not found - read the file again"), false);
    assert.equal(classifyDenied("read_file", undefined), false);
  });
});
