import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDir } from "../eval/lib/fixture.ts";
import { compareRuns, renderComparison } from "../eval/compare.ts";
import { renderReport, scoreRun, writeScores } from "../eval/score.ts";
import type { RunRecord } from "../eval/run.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-score-")));
after(() => removeDir(root));

type Ev = Record<string, unknown>;
interface Spec {
  task: string;
  k: number;
  split?: "dev" | "heldout";
  family?: string;
  gate: string | null;
  expect?: string;
  checks: [name: string, pass: boolean, compliance?: boolean][];
  status?: RunRecord["status"];
  tokens?: [number, number];
  events?: Ev[];
}

function mkRun(id: string, specs: Spec[]): string {
  const runDir = path.join(root, id);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "manifest.json"), JSON.stringify({ settings: { DEEPSEEK_MODEL: "deepseek-flash" }, k: 2, server_hash: "abcdef0123456789", skipped: [{ id: "free-form", needs_role: "do" }] }));
  for (const s of specs) {
    const split = s.split ?? "dev";
    const dir = path.join(runDir, split === "heldout" ? "heldout-private" : ".", s.task, String(s.k));
    fs.mkdirSync(dir, { recursive: true });
    const status = s.status ?? "ok";
    const rec: RunRecord = {
      complete: status === "ok", status, task: s.task, k: s.k, family: s.family ?? "code", split, expect: { gate: s.expect ?? "done" }, gate_status: s.gate,
      steps: [{ step: 1, role: "impl", job_id: "aaaaaaaa", status: s.gate ?? "?", infra: false }],
      checks: s.checks.map(([name, pass, compliance]) => ({ name, type: "x", pass, detail: "", compliance: Boolean(compliance) })),
      usage: { requests: 1, prompt: s.tokens?.[0] ?? 1000, completion: s.tokens?.[1] ?? 500, reasoning: 200, cache_hit: 0, cost: 0.01, capped: status === "capped" }, wall_s: 10,
    };
    fs.writeFileSync(path.join(dir, "checks.json"), JSON.stringify(rec));
    if (s.events) fs.writeFileSync(path.join(dir, "step1.trace.jsonl"), s.events.map((e) => JSON.stringify(e)).join("\n") + "\n");
  }
  return runDir;
}

const turn = { type: "turn" };
const repair = { type: "repair", why: "tests failed" };

describe("scoring", () => {
  const runDir = mkRun("run-a", [
    { task: "t-fa", k: 1, gate: "done", checks: [["hidden-tests", false, true], ["one-commit", true]], events: [turn, turn] },
    { task: "t-ok", k: 1, gate: "done", checks: [["hidden-tests", true, true]], events: [turn, { type: "tool", denied: "write" }, { type: "tool", denied: "read" }, turn] },
    { task: "t-ok", k: 2, gate: "done", checks: [["hidden-tests", true, true]], events: [turn, repair, turn, repair, turn, { type: "api_retry" }] },
    { task: "t-flaky", k: 1, gate: "done", checks: [["c", true]], events: [turn] },
    { task: "t-flaky", k: 2, gate: "done", checks: [["c", false]], events: [turn] },
    { task: "t-fr", k: 1, gate: "failed", checks: [["c", true]], events: [turn] },
    { task: "t-refuse", k: 1, gate: "failed", expect: "failed", checks: [["blocked", true, true]], events: [turn] },
    { task: "t-capped", k: 1, gate: null, status: "capped", checks: [] },
    { task: "h-secret", k: 1, split: "heldout", family: "review", gate: "done", checks: [["verdict", false]], events: [turn] },
    { task: "h-fine", k: 1, split: "heldout", family: "review", gate: "done", checks: [["verdict", true]], events: [turn] },
  ]);
  const r = scoreRun(runDir);
  const row = (task: string, k: number) => r.rows.find((x) => x.task === task && x.k === k)!;

  it("separates gate acceptance from hidden correctness: false accepts and false rejects", () => {
    assert.deepEqual([row("t-fa", 1).gate_accepted, row("t-fa", 1).hidden_pass, row("t-fa", 1).false_accept], [true, false, true]);
    assert.deepEqual([row("t-fr", 1).gate_accepted, row("t-fr", 1).hidden_pass, row("t-fr", 1).false_reject, row("t-fr", 1).false_accept], [false, true, true, false]);
    // t-flaky#2 is one too: the gate said done while its check failed. Dev rows sort before held-out rows.
    assert.deepEqual(r.false_accepts.map((x) => `${x.task}#${x.k}`), ["t-fa#1", "t-flaky#2", "h-secret#1"]);
    assert.deepEqual(r.false_rejects.map((x) => x.task), ["t-fr"]);
  });

  it("a correct refusal (expected gate failed, gate failed, checks pass) is neither a false reject nor a false accept", () => {
    const x = row("t-refuse", 1);
    assert.deepEqual([x.gate_expected, x.gate_accepted, x.false_reject, x.false_accept, x.hidden_pass, x.first_try], [true, false, false, false, true, true]);
  });

  it("first try needs no repairs; repairs, turns, retries and refused calls come from the trace", () => {
    assert.deepEqual([row("t-ok", 1).first_try, row("t-ok", 1).repairs, row("t-ok", 1).turns, row("t-ok", 1).oos_writes, row("t-ok", 1).denied_reads], [true, 0, 2, 1, 1]);
    assert.deepEqual([row("t-ok", 2).first_try, row("t-ok", 2).repairs, row("t-ok", 2).turns, row("t-ok", 2).api_retries], [false, 2, 3, 1]);
  });

  it("instruction compliance is the share of flagged checks that pass; null when none are flagged", () => {
    assert.equal(row("t-fa", 1).compliance, 0);
    assert.equal(row("t-ok", 1).compliance, 1);
    assert.equal(row("t-flaky", 1).compliance, null);
  });

  it("tokens come from the proxy usage; reasoning is a subset, not added on", () => {
    assert.deepEqual([row("t-ok", 1).tokens_in, row("t-ok", 1).tokens_out, row("t-ok", 1).tokens_reasoning, row("t-ok", 1).tokens_total], [1000, 500, 200, 1500]);
  });

  it("repeats give mean, spread and a flaky flag", () => {
    const flaky = r.tasks.find((t) => t.task === "t-flaky")!;
    assert.deepEqual([flaky.runs, flaky.flaky, flaky.hidden_pass?.mean, flaky.hidden_pass?.min, flaky.hidden_pass?.max], [2, true, 0.5, 0, 1]);
    assert.equal(r.tasks.find((t) => t.task === "t-ok")!.flaky, false);
    assert.equal(r.tasks.find((t) => t.task === "t-ok")!.repairs?.mean, 1);
    assert.ok((r.tasks.find((t) => t.task === "t-ok")!.repairs?.sd ?? 0) > 0);
  });

  it("capped runs are excluded from scoring and listed", () => {
    assert.ok(!r.rows.some((x) => x.task === "t-capped"));
    assert.deepEqual(r.excluded.map((e) => [e.task, e.status]), [["t-capped", "capped"]]);
  });

  it("aggregates by split and family", () => {
    assert.equal(r.by_split.dev?.runs, 7);
    assert.equal(r.by_split.heldout?.runs, 2);
    assert.equal(r.by_split.heldout?.hidden_pass?.mean, 0.5);
    assert.equal(r.by_family.review?.runs, 2);
    assert.equal(r.overall.runs, 9);
  });
});

describe("compare", () => {
  /** n runs of one task; the first `pass` of them pass their single hidden check. */
  const runsOf = (task: string, n: number, pass: number, split: "dev" | "heldout" = "dev"): Spec[] =>
    Array.from({ length: n }, (_, i) => ({ task, k: i + 1, split, gate: "done", checks: [["c", i < pass, true]] as Spec["checks"], events: [turn] }));
  const mk = (id: string, a: number, b: number, h: number): string => mkRun(id, [...runsOf("task-a", 5, a), ...runsOf("task-b", 5, b), ...runsOf("held-1", 5, h, "heldout")]);
  const opts = { minNet: 2, delta: 0.4, heldoutTol: 0.1 };

  it("a gain on one task with nothing lost is INCONCLUSIVE at min-net 2, KEEP at min-net 1", () => {
    const base = mk("cmp-base", 0, 5, 5);
    const cand = mk("cmp-cand", 4, 5, 5);
    const c = compareRuns([base], cand, opts);
    assert.deepEqual([c.gains, c.losses, c.net, c.decision], [1, 0, 1, "INCONCLUSIVE"]);
    assert.equal(c.dev.find((d) => d.task === "task-a")?.delta, 0.8);
    assert.equal(compareRuns([base], cand, { ...opts, minNet: 1 }).decision, "KEEP");
  });

  it("REJECTs a held-out regression even when dev improves, and a dev loss with no gain", () => {
    const base = mk("cmp-base2", 0, 5, 5);
    const worseHeld = compareRuns([base], mk("cmp-cand2", 5, 5, 2), { ...opts, minNet: 1 });
    assert.equal(worseHeld.decision, "REJECT");
    assert.match(worseHeld.reasons.join(), /held-out hidden-pass fell/);
    const lost = compareRuns([base], mk("cmp-cand3", 0, 2, 5), opts);
    assert.deepEqual([lost.decision, lost.losses, lost.gains], ["REJECT", 1, 0]);
  });

  it("pools several baselines, reports the noise between them, and never itemises held-out tasks", () => {
    const b1 = mk("cmp-b1", 0, 5, 5);
    const b2 = mk("cmp-b2", 2, 5, 5);
    const c = compareRuns([b1, b2], mk("cmp-cand4", 4, 5, 5), opts);
    const a = c.dev.find((d) => d.task === "task-a")!;
    assert.deepEqual([a.base.runs, a.noise], [10, 0.4]);
    const text = renderComparison(c);
    assert.match(text, /Decision: /);
    assert.ok(!text.includes("held-1"), "held-out task names stay out of the comparison");
    assert.match(text, /held-out \(aggregate\)/);
  });
});

describe("report and files", () => {
  it("lists dev tasks, shows held-out only as an aggregate, and writes the private file", () => {
    const runDir = mkRun("run-b", [
      { task: "t-fa", k: 1, gate: "done", checks: [["hidden-tests", false, true]], events: [turn] },
      { task: "h-secret", k: 1, split: "heldout", family: "review", gate: "done", checks: [["planted-bug-found", false]], events: [turn] },
    ]);
    const r = writeScores(runDir);
    const report = fs.readFileSync(path.join(runDir, "report.md"), "utf8");
    assert.match(report, /t-fa/);
    assert.match(report, /1 more in held-out tasks, not itemised/);
    assert.ok(!report.includes("h-secret") && !report.includes("planted-bug-found"), "no held-out task name or check in the report");
    const visible = fs.readFileSync(path.join(runDir, "scores.json"), "utf8");
    assert.ok(!visible.includes("h-secret") && !visible.includes("planted-bug-found"));
    assert.ok(JSON.parse(visible).by_split.heldout.runs === 1, "held-out aggregate is still there");
    const priv = JSON.parse(fs.readFileSync(path.join(runDir, "heldout-private", "scores.json"), "utf8")) as { rows: { task: string }[] };
    assert.ok(priv.rows.some((x) => x.task === "h-secret"));
    assert.match(report, /Not applicable[\s\S]*free-form: needs role "do"/);
    assert.equal(`${renderReport(r)}\n`, report);
  });

  it("is deterministic: scoring the same folder twice gives identical files", () => {
    const runDir = path.join(root, "run-a");
    writeScores(runDir);
    const first = ["scores.json", "report.md", path.join("heldout-private", "scores.json")].map((f) => fs.readFileSync(path.join(runDir, f), "utf8"));
    writeScores(runDir);
    const second = ["scores.json", "report.md", path.join("heldout-private", "scores.json")].map((f) => fs.readFileSync(path.join(runDir, f), "utf8"));
    assert.deepEqual(second, first);
  });

  it("tolerates a missing trace and a malformed trace line", () => {
    const runDir = mkRun("run-c", [{ task: "t-x", k: 1, gate: "done", checks: [["c", true]] }]);
    const dir = path.join(runDir, "t-x", "1");
    fs.writeFileSync(path.join(dir, "step1.trace.jsonl"), 'not json\n{"type":"repair"}\n');
    const r = scoreRun(runDir);
    assert.deepEqual([r.rows[0]?.repairs, r.rows[0]?.trace_found], [1, true]);
    fs.rmSync(path.join(dir, "step1.trace.jsonl"));
    assert.equal(scoreRun(runDir).rows[0]?.trace_found, false);
  });
});
