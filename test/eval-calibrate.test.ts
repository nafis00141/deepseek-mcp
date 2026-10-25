import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDir } from "../eval/lib/fixture.ts";
import { BAND_HIGH, BAND_LOW, MAX_ROUNDS, MIN_RUNS, bandOf, calibrate, frozenProblem, loadBands, loadCalibration, taskSetHash } from "../eval/lib/calibration.ts";
import { compareRuns } from "../eval/compare.ts";
import type { CompareOpts } from "../eval/compare.ts";
import { MAX_FALSE_KEEP, chanceCheck, renderChance } from "../eval/chance.ts";
import type { Band } from "../eval/lib/calibration.ts";
import type { RunRecord } from "../eval/run.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-cal-")));
after(() => removeDir(root));

const put = (file: string, text: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

/** An eval dir with dev tasks; hard ones carry a tier and an axis. */
function mkEvalDir(name: string, tasks: Record<string, "hard" | "regression">): string {
  const dir = path.join(root, name);
  for (const [id, tier] of Object.entries(tasks)) {
    put(path.join(dir, "tasks", id, "task.json"), JSON.stringify({ id, family: "code", split: "dev", title: id, ...(tier === "hard" ? { tier, axis: "long-context" } : {}), steps: [], checks: [], expect: { gate: "done" } }));
    put(path.join(dir, "tasks", id, "repo", "a.txt"), `fixture of ${id}\n`);
  }
  return dir;
}

interface RunSpec {
  arm?: string | null;
  purpose?: string | null;
  hash?: string;
  /** task id -> one boolean per repeat: did the hidden checks pass */
  tasks: Record<string, boolean[]>;
  tier?: Record<string, "hard" | "regression">;
}

function mkRun(id: string, s: RunSpec): string {
  const runDir = path.join(root, "runs", id);
  put(path.join(runDir, "manifest.json"), JSON.stringify({ settings: {}, k: 5, server_hash: s.hash ?? "same-code", arm: s.arm === undefined ? "baseline" : s.arm, purpose: s.purpose === undefined ? "comparison" : s.purpose }));
  for (const [task, passes] of Object.entries(s.tasks)) {
    passes.forEach((pass, i) => {
      const rec: RunRecord = {
        complete: true, status: "ok", task, k: i + 1, family: "code", tier: s.tier?.[task] ?? "hard", ...(s.tier?.[task] === "regression" ? {} : { axis: "long-context" }), split: "dev", expect: { gate: "done" }, gate_status: "done",
        steps: [{ step: 1, role: "impl", job_id: "aaaaaaaa", status: "done", infra: false }],
        checks: [{ name: "hidden", type: "x", pass, detail: "", compliance: false }],
        usage: { requests: 1, prompt: 1000, completion: 500, reasoning: 0, cache_hit: 0, cost: 0.01, capped: false }, wall_s: 5,
      };
      put(path.join(runDir, task, String(i + 1), "checks.json"), JSON.stringify(rec));
    });
  }
  return runDir;
}

const times = (n: number, pass: boolean): boolean[] => Array.from({ length: n }, () => pass);
const rate = (passes: number, of: number): boolean[] => [...times(passes, true), ...times(of - passes, false)];

describe("bands", () => {
  it("20-80% inclusive is calibrated; above is ceiling, below is floor", () => {
    assert.deepEqual([BAND_LOW, BAND_HIGH, MIN_RUNS, MAX_ROUNDS], [0.2, 0.8, 10, 3]);
    assert.deepEqual([0.2, 0.5, 0.8].map(bandOf), ["calibrated", "calibrated", "calibrated"]);
    assert.deepEqual([0.81, 0.9, 1].map(bandOf), ["ceiling", "ceiling", "ceiling"]);
    assert.deepEqual([0.19, 0.1, 0].map(bandOf), ["floor", "floor", "floor"]);
  });
});

describe("calibrate", () => {
  const cal = (id: string, tasks: Record<string, boolean[]>, over: Partial<RunSpec> = {}): string => mkRun(id, { arm: "baseline", purpose: "calibration", tasks, ...over });

  it("bands each hard task over the pooled runs, writes calibration.json and freezes the set; regression tasks are ignored", () => {
    const evalDir = mkEvalDir("e1", { mid: "hard", top: "hard", low: "hard", old: "regression" });
    const a = cal("c1a", { mid: rate(3, 5), top: rate(5, 5), low: rate(0, 5), old: rate(5, 5) });
    const b = cal("c1b", { mid: rate(2, 5), top: rate(4, 5), low: rate(1, 5), old: rate(5, 5) });
    const f = calibrate({ evalDir, runDirs: [a, b], now: () => new Date("2026-10-26T00:00:00Z") });
    assert.deepEqual(Object.fromEntries(Object.entries(f.tasks).map(([k, v]) => [k, [v.band, v.pass_rate, v.runs]])), { low: ["floor", 0.1, 10], mid: ["calibrated", 0.5, 10], top: ["ceiling", 0.9, 10] });
    assert.equal(f.rounds.length, 1);
    assert.deepEqual(f.rounds[0]?.run_ids, ["c1a", "c1b"]);
    const frozen = JSON.parse(fs.readFileSync(path.join(evalDir, "frozen.json"), "utf8")) as { task_set_hash: string; tasks: string[]; round: number };
    assert.deepEqual([frozen.tasks, frozen.round], [["low", "mid", "top"], 1]);
    assert.equal(frozen.task_set_hash, taskSetHash(evalDir).hash);
    assert.deepEqual([...loadBands(evalDir)], [["low", "floor"], ["mid", "calibrated"], ["top", "ceiling"]] satisfies [string, Band][]);
    assert.equal(frozenProblem(evalDir), null);
    put(path.join(evalDir, "tasks", "mid", "repo", "a.txt"), "retuned\n");
    assert.match(frozenProblem(evalDir) ?? "", /changed after calibration/);
  });

  it("refuses runs that are not baseline calibration runs, and changes nothing", () => {
    const evalDir = mkEvalDir("e2", { mid: "hard" });
    const good = cal("c2good", { mid: rate(5, 10) });
    const cand = cal("c2cand", { mid: rate(5, 10) }, { arm: "candidate" });
    const cmp = cal("c2cmp", { mid: rate(5, 10) }, { purpose: "comparison" });
    const old = cal("c2old", { mid: rate(5, 10) }, { arm: null, purpose: null });
    assert.throws(() => calibrate({ evalDir, runDirs: [good, cand] }), /c2cand: calibration uses baseline runs only \(arm is "candidate"\)/);
    assert.throws(() => calibrate({ evalDir, runDirs: [good, cmp] }), /c2cmp: only --purpose calibration runs/);
    assert.throws(() => calibrate({ evalDir, runDirs: [old] }), /arm is null/);
    assert.ok(!fs.existsSync(path.join(evalDir, "calibration.json")));
    assert.ok(!fs.existsSync(path.join(evalDir, "frozen.json")));
  });

  it("needs at least 10 runs per hard task", () => {
    const evalDir = mkEvalDir("e3", { mid: "hard", few: "hard" });
    const r = cal("c3", { mid: rate(5, 10), few: rate(3, 9) });
    assert.throws(() => calibrate({ evalDir, runDirs: [r] }), /at least 10 baseline runs; too few for: few \(9\)/);
    assert.throws(() => calibrate({ evalDir: mkEvalDir("e3b", { only: "regression" }), runDirs: [r] }), /no hard dev tasks/);
    assert.throws(() => calibrate({ evalDir, runDirs: [] }), /at least one/);
  });

  it("allows 3 rounds; a retune round must say what structure changed; a 4th is refused", () => {
    const evalDir = mkEvalDir("e4", { mid: "hard" });
    const r = cal("c4", { mid: rate(9, 10) });
    calibrate({ evalDir, runDirs: [r] });
    assert.throws(() => calibrate({ evalDir, runDirs: [r] }), /needs --note/);
    put(path.join(evalDir, "tasks", "mid", "repo", "a.txt"), "bigger repo\n");
    const second = calibrate({ evalDir, runDirs: [r], note: "added 6 distractor files" });
    assert.equal(second.rounds[1]?.note, "added 6 distractor files");
    calibrate({ evalDir, runDirs: [r], note: "trimmed the long file" });
    assert.equal(loadCalibration(evalDir)?.rounds.length, 3);
    assert.throws(() => calibrate({ evalDir, runDirs: [r], note: "again" }), /limited to 3 rounds/);
    assert.equal(loadCalibration(evalDir)?.rounds.length, 3);
    assert.notEqual(second.rounds[0]?.task_set_hash, second.rounds[1]?.task_set_hash);
  });

});

describe("compare: bands and provenance", () => {
  const opts = (over: Partial<CompareOpts> = {}): CompareOpts => ({ minNet: 2, delta: 0.4, ...over });
  const base = (id: string, tasks: Record<string, boolean[]>, over: Partial<RunSpec> = {}): string => mkRun(id, { tasks, ...over });

  it("a gain on a ceiling task and a loss on a floor task are shown but not counted", () => {
    const b = base("t6b1", { up: rate(1, 5), cap: rate(1, 5), floor: rate(5, 5), norm: rate(1, 5) });
    const c = base("t6c1", { up: rate(5, 5), cap: rate(5, 5), floor: rate(0, 5), norm: rate(5, 5) }, { purpose: "comparison", arm: "candidate" });
    const bands = new Map<string, Band>([["cap", "ceiling"], ["floor", "floor"]]);
    const r = compareRuns([b], c, opts({ bands }));
    assert.deepEqual([r.gains, r.losses, r.net], [2, 0, 2], "up and norm count; cap (ceiling gain) and floor (floor loss) do not");
    assert.deepEqual(r.dev.map((d) => [d.task, d.verdict, d.counted, d.band]), [["cap", "gain", false, "ceiling"], ["floor", "loss", false, "floor"], ["norm", "gain", true, null], ["up", "gain", true, null]]);
    assert.equal(r.decision, "KEEP");
    assert.match(r.reasons.join("|"), /not counted: cap \(gain on a ceiling task\), floor \(loss on a floor task\)/);
  });

  it("a ceiling task that falls still counts as a loss, and a floor task that rises still counts as a gain", () => {
    const bands = new Map<string, Band>([["cap", "ceiling"], ["floor", "floor"]]);
    const fall = compareRuns([base("t6b2", { cap: rate(5, 5), x: rate(2, 5) })], base("t6c2", { cap: rate(0, 5), x: rate(2, 5) }), opts({ bands }));
    assert.deepEqual([fall.gains, fall.losses, fall.net, fall.decision], [0, 1, -1, "REJECT"]);
    const rise = compareRuns([base("t6b3", { floor: rate(0, 5), y: rate(2, 5) })], base("t6c3", { floor: rate(5, 5), y: rate(2, 5) }), opts({ bands }));
    assert.deepEqual([rise.gains, rise.losses, rise.net], [1, 0, 1]);
  });

  it("KEEP needs the net over tasks authored before any result was seen to reach the minimum too", () => {
    const b = base("t6b4", { a: rate(0, 5), b: rate(0, 5), c: rate(0, 5) });
    const c = base("t6c4", { a: rate(5, 5), b: rate(5, 5), c: rate(0, 5) });
    const all = compareRuns([b], c, opts());
    assert.deepEqual([all.net, all.net_clean, all.decision], [2, 2, "KEEP"]);
    const tainted = compareRuns([b], c, opts({ afterResult: new Set(["a", "b"]) }));
    assert.deepEqual([tainted.net, tainted.net_clean, tainted.decision], [2, 0, "INCONCLUSIVE"]);
    assert.match(tainted.reasons.join("|"), /only with tasks authored after a result was seen; without them it is 0/);
    assert.equal(tainted.dev.filter((d) => d.after_result).length, 2);
    const one = compareRuns([b], c, opts({ afterResult: new Set(["a"]) }));
    assert.deepEqual([one.net, one.net_clean, one.decision], [2, 1, "INCONCLUSIVE"]);
  });

  it("refuses a calibration-purpose run as a baseline, and the report shows band, net and the clean net", () => {
    const cal = base("t6cal", { a: rate(0, 5) }, { arm: "baseline", purpose: "calibration" });
    const c = base("t6c5", { a: rate(5, 5) });
    assert.throws(() => compareRuns([cal], c, opts()), /t6cal is a calibration run and cannot be a comparison baseline/);
    assert.doesNotThrow(() => compareRuns([base("t6ok", { a: rate(0, 5) })], c, opts()));
  });

  it("with a tier filter only that tier is compared", () => {
    const tier = { h: "hard", r: "regression" } as const;
    const b = base("t6b6", { h: rate(0, 5), r: rate(0, 5) }, { tier });
    const c = base("t6c6", { h: rate(5, 5), r: rate(5, 5) }, { tier });
    assert.deepEqual(compareRuns([b], c, opts({ tier: "hard" })).dev.map((d) => d.task), ["h"]);
    assert.equal(compareRuns([b], c, opts()).dev.length, 2);
  });
});

describe("chance check", () => {
  const o: Omit<CompareOpts, "devOnly"> = { minNet: 2, delta: 0.4 };
  const tasks = (...rates: number[]): Record<string, boolean[]> => Object.fromEntries(rates.map((n, i) => [`t${i}`, rate(n, 5)]));

  it("identical-looking baselines never reach KEEP by chance", () => {
    const dirs = ["a", "b", "c"].map((x) => mkRun(`ch1${x}`, { tasks: tasks(3, 2, 4, 3) }));
    const r = chanceCheck(dirs, o);
    assert.deepEqual([r.pairs.length, r.keeps, r.rate, r.ok], [6, 0, 0, true]);
    assert.deepEqual(r.problems, []);
    assert.match(renderChance(r), /KEEP by chance in 0 of 6 pair\(s\): 0% \(limit 10%\)\. The tier is usable\./);
  });

  it("baselines that differ widely on enough tasks KEEP by chance in one direction, and the tier is not usable", () => {
    const lo = mkRun("ch2lo", { tasks: tasks(0, 0, 0) });
    const hi = mkRun("ch2hi", { tasks: tasks(5, 5, 5) });
    const r = chanceCheck([lo, hi], o);
    assert.deepEqual(r.pairs.map((p) => [p.baseline, p.candidate, p.decision]), [["ch2lo", "ch2hi", "KEEP"], ["ch2hi", "ch2lo", "REJECT"]]);
    assert.deepEqual([r.keeps, r.rate, r.ok], [1, 0.5, false]);
    assert.ok(r.rate > MAX_FALSE_KEEP);
    assert.match(r.problems.join("|"), /rate is coarse/);
  });

  it("uses the bands: a ceiling task cannot be a chance gain", () => {
    const lo = mkRun("ch3lo", { tasks: tasks(0, 0, 0) });
    const hi = mkRun("ch3hi", { tasks: tasks(5, 5, 5) });
    const bands = new Map<string, Band>([["t0", "ceiling"], ["t1", "ceiling"], ["t2", "ceiling"]]);
    assert.equal(chanceCheck([lo, hi], { ...o, bands }).keeps, 0);
  });

  it("refuses runs that are not comparison baselines of identical code", () => {
    const good = mkRun("ch4ok", { tasks: tasks(3) });
    assert.throws(() => chanceCheck([good, mkRun("ch4cal", { purpose: "calibration", tasks: tasks(3) })], o), /needs baseline runs made with --purpose comparison/);
    assert.throws(() => chanceCheck([good, mkRun("ch4cand", { arm: "candidate", tasks: tasks(3) })], o), /needs baseline runs/);
    assert.throws(() => chanceCheck([good, mkRun("ch4hash", { hash: "other-code", tasks: tasks(3) })], o), /different server code/);
    const single = chanceCheck([good], o);
    assert.deepEqual([single.ok, single.pairs.length], [false, 0]);
    assert.match(single.problems.join("|"), /fewer than two baseline runs/);
  });
});
