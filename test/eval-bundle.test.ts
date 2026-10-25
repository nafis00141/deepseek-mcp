import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildBundle, compactTrace } from "../eval/bundle.ts";
import { compareRuns } from "../eval/compare.ts";
import { removeDir } from "../eval/lib/fixture.ts";
import { forbiddenTerms, lintPatch } from "../eval/patch-lint.ts";
import type { RunRecord } from "../eval/run.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-bundle-")));
after(() => removeDir(root));

const put = (rel: string, content: string): void => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

function record(task: string, k: number, split: "dev" | "heldout", pass: boolean, checkName: string): RunRecord {
  return {
    complete: true, status: "ok", task, k, family: "code", split, expect: { gate: "done" }, gate_status: "done",
    steps: [{ step: 1, role: "impl", job_id: "aaaaaaaa", status: "done", infra: false }],
    checks: [{ name: checkName, type: "node_test", pass, detail: pass ? "ok" : `${checkName} detail`, compliance: false }],
    usage: { requests: 1, prompt: 1000, completion: 500, reasoning: 100, cache_hit: 0, cost: 0.01, capped: false }, wall_s: 5,
  };
}

const trace = [
  { type: "job_start", role: "impl", effort: "high", prompt_chars: 900 },
  { type: "turn", n: 1, finish_reason: "tool_calls", prompt_tokens: 100, completion_tokens: 20, reasoning_tokens: null, tool_calls: 1 },
  { type: "tool", name: "write_file", args: { path: "package.json", content_chars: 9 }, ok: false, denied: "write", error: "not permitted to write package.json" },
  { type: "repair", n: 1, turn: 2, why: "tests failed" },
  { type: "gate", status: "done", reasons: [] },
].map((e) => JSON.stringify(e)).join("\n");

function mkRun(id: string): string {
  const dir = path.join(root, id);
  const w = (rel: string, c: string): void => put(`${id}/${rel}`, c);
  w("manifest.json", JSON.stringify({ settings: {}, k: 1 }));
  for (const [task, split, pass, check, base] of [["dev-bad", "dev", false, "hidden-tests", ""], ["dev-good", "dev", true, "hidden-tests", ""], ["secret-task", "heldout", false, "secret-check", "heldout-private/"], ["leaky-task", "heldout", false, "leaky-check", ""]] as const) {
    w(`${base}${task}/1/checks.json`, JSON.stringify(record(task, 1, split, pass, check)));
    w(`${base}${task}/1/step1.final.txt`, `FINAL TEXT OF ${task}`);
    w(`${base}${task}/1/step1.trace.jsonl`, trace);
    w(`${base}${task}/1/step1.diff.patch`, `diff --git a/x b/x\n+DIFF OF ${task}\n`);
  }
  return dir;
}

describe("reviewer bundle", () => {
  const bundle = buildBundle(mkRun("run-bundle"));

  it("contains the failing dev run: failing check, final text, compact trace and diff", () => {
    assert.match(bundle, /dev-bad#1/);
    assert.match(bundle, /hidden-tests detail/);
    assert.match(bundle, /FINAL TEXT OF dev-bad/);
    assert.match(bundle, /DENIED\(write\)/);
    assert.match(bundle, /REPAIR 1: tests failed/);
    assert.match(bundle, /DIFF OF dev-bad/);
    assert.match(bundle, /src\/roles\.ts/);
    assert.ok(!bundle.includes("### dev-good#1"), "passing runs are not itemised");
  });

  it("never carries a held-out task, wherever its record sits, only the aggregate row", () => {
    for (const secret of ["secret-task", "secret-check", "leaky-task", "leaky-check", "FINAL TEXT OF secret", "FINAL TEXT OF leaky", "DIFF OF secret", "DIFF OF leaky"]) assert.ok(!bundle.includes(secret), secret);
    assert.match(bundle, /held-out \(aggregate only\)/);
  });
});

describe("compact trace", () => {
  it("one line per event that matters, capped", () => {
    const dir = path.join(root, "trace-only");
    put("trace-only/step1.trace.jsonl", trace);
    const lines = compactTrace(dir);
    assert.ok(lines.some((l) => l.includes("turn 1")) && lines.some((l) => l.includes("GATE done")));
    put("trace-only/step2.trace.jsonl", Array.from({ length: 200 }, () => trace.split("\n")[1]).join("\n"));
    assert.match(compactTrace(dir, 20).at(-1) ?? "", /more lines/);
  });
});

describe("patch lint", () => {
  const tasks = path.join(root, "lint-tasks");
  const held = path.join(root, "lint-heldout");
  const def = (id: string, split: string, instruction: string) => JSON.stringify({ id, family: "x", split, title: id, steps: [{ role: "impl", target: "t", instruction }], checks: [], expect: { gate: "done" } });
  put("lint-tasks/ship-it/task.json", def("ship-it", "dev", "make the express option double the price of every parcel under two kilos"));
  put("lint-tasks/ship-it/repo/src/shipping-rates.js", "x");
  put("lint-heldout/hidden-gem/task.json", def("hidden-gem", "heldout", "rename the quartz key everywhere it appears"));
  const forbidden = forbiddenTerms([tasks, held]);

  it("rejects a patch that names a task id, a fixture path or copied instruction text; prints no held-out term", () => {
    const patch = (line: string) => `--- a/src/roles.ts\n+++ b/src/roles.ts\n@@ -1 +1 @@\n+${line}\n`;
    assert.deepEqual(lintPatch(patch("handle the ship-it case"), forbidden).map((h) => h.kind), ["task id"]);
    assert.deepEqual(lintPatch(patch("check src/shipping-rates.js first"), forbidden).map((h) => h.kind), ["fixture path"]);
    assert.deepEqual(lintPatch(patch("make the express option double the price of every parcel"), forbidden).map((h) => h.kind), ["instruction text"]);
    const hg = lintPatch(patch("special case for hidden-gem"), forbidden);
    assert.deepEqual([hg[0]?.kind, hg[0]?.term], ["task id", "(held-out)"]);
  });

  it("accepts a general patch, and ignores removed and context lines of a diff", () => {
    const good = "--- a/src/roles.ts\n+++ b/src/roles.ts\n@@ -1,2 +1,2 @@\n-the ship-it case\n context ship-it\n+Treat the orchestrator's instruction as binding for every role.\n";
    assert.deepEqual(lintPatch(good, forbidden), []);
  });
});

describe("held-out look budget", () => {
  it("a spent budget downgrades KEEP to INCONCLUSIVE and hides the held-out guard", () => {
    const mk = (id: string, devPass: number, heldPass: number): string => {
      const w = (rel: string, c: string): void => put(`${id}/${rel}`, c);
      w("manifest.json", "{}");
      for (const task of ["t1", "t2"]) for (let k = 1; k <= 5; k++) w(`${task}/${k}/checks.json`, JSON.stringify(record(task, k, "dev", id.startsWith("cmpb") ? k <= (task === "t1" ? 0 : 5) : k <= devPass, "c")));
      for (let k = 1; k <= 5; k++) w(`heldout-private/h/${k}/checks.json`, JSON.stringify(record("h", k, "heldout", k <= heldPass, "c")));
      return path.join(root, id);
    };
    const base = mk("cmpb", 0, 5);
    // t1: 0% -> 100%, t2 baseline is 100% in both
    const cand = (() => {
      const dir = mk("cmpc", 5, 5);
      for (let k = 1; k <= 5; k++) put(`cmpc/t2/${k}/checks.json`, JSON.stringify(record("t2", k, "dev", true, "c")));
      return dir;
    })();
    for (let k = 1; k <= 5; k++) put(`cmpb/t2/${k}/checks.json`, JSON.stringify(record("t2", k, "dev", true, "c")));
    const open = compareRuns([base], cand, { minNet: 1, delta: 0.4, heldoutTol: 0.1 });
    assert.equal(open.decision, "KEEP");
    const spent = compareRuns([base], cand, { minNet: 1, delta: 0.4, heldoutTol: 0.1, ignoreHeldout: true });
    assert.deepEqual([spent.decision, spent.heldout], ["INCONCLUSIVE", null]);
    assert.match(spent.reasons.join(), /budget exhausted/);
  });
});
