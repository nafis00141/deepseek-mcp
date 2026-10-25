import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compareRuns, derivedTolerance, renderComparison, TOL_CAP, TOL_FLOOR } from "../eval/compare.ts";
import { removeDir } from "../eval/lib/fixture.ts";
import { scoreRun } from "../eval/score.ts";
import type { RunRecord } from "../eval/run.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-compare-")));
after(() => removeDir(root));

const put = (rel: string, content: string): void => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

/** A run folder. `dev` and `held` map task id -> how many of 5 runs pass; `hash` is the manifest's server hash. */
function mkRun(id: string, dev: Record<string, number>, held: Record<string, number>, hash = "same-code"): string {
  put(`${id}/manifest.json`, JSON.stringify({ server_hash: hash }));
  const add = (task: string, split: "dev" | "heldout", passes: number): void => {
    for (let k = 1; k <= 5; k++) {
      const rec: RunRecord = {
        complete: true, status: "ok", task, k, family: "code", split, expect: { gate: "done" }, gate_status: "done",
        steps: [{ step: 1, role: "impl", job_id: "aaaaaaaa", status: "done", infra: false }],
        checks: [{ name: "c", type: "x", pass: k <= passes, detail: "", compliance: false }],
        usage: { requests: 1, prompt: 100, completion: 50, reasoning: 0, cache_hit: 0, cost: 0, capped: false }, wall_s: 1,
      };
      put(`${id}/${split === "heldout" ? "private/heldout/" : ""}${task}/${k}/checks.json`, JSON.stringify(rec));
    }
  };
  for (const [t, p] of Object.entries(dev)) add(t, "dev", p);
  for (const [t, p] of Object.entries(held)) add(t, "heldout", p);
  return path.join(root, id);
}

const OPTS = { minNet: 1, delta: 0.4 };

describe("held-out guard: shared tasks", () => {
  it("pools only the held-out tasks both sides ran, and says how many were left out", () => {
    const base = mkRun("sh-base", { d1: 0, d2: 5 }, { h1: 5, h2: 5, h3: 0 });
    const cand = mkRun("sh-cand", { d1: 5, d2: 5 }, { h2: 5, h3: 0, h4: 5 });
    const c = compareRuns([base], cand, { ...OPTS, heldoutTol: 0.1 });
    assert.deepEqual([c.heldout?.shared_tasks, c.heldout?.base_only, c.heldout?.cand_only], [2, 1, 1]);
    // pooled over h2 and h3 only: baseline 5/10, candidate 5/10, so no change (h1 and h4 would have made it +/-)
    assert.equal(c.heldout?.delta, 0);
    assert.match(renderComparison(c), /2 task\(s\) common to both sides \(1 only in the baselines, 1 only in the candidate: not pooled\)/);
  });

  it("with no common held-out task the guard is not applied and the result cannot be KEEP", () => {
    const base = mkRun("none-base", { d1: 0, d2: 5 }, { h1: 5 });
    const cand = mkRun("none-cand", { d1: 5, d2: 5 }, { h9: 5 });
    const c = compareRuns([base], cand, { ...OPTS, heldoutTol: 0.1 });
    assert.equal(c.heldout, null);
    assert.match(c.heldout_problem ?? "", /share no held-out task/);
    assert.equal(c.decision, "INCONCLUSIVE");
    assert.match(c.reasons.join(), /cannot be KEEP/);
  });

  it("with a common set and an intact guard the same dev gain is KEEP", () => {
    const base = mkRun("ok-base", { d1: 0, d2: 5 }, { h1: 5, h2: 4 });
    const cand = mkRun("ok-cand", { d1: 5, d2: 5 }, { h1: 5, h2: 4 });
    assert.equal(compareRuns([base], cand, { ...OPTS, heldoutTol: 0.1 }).decision, "KEEP");
  });
});

describe("final decision statistic (paired over tasks)", () => {
  const FINAL = { minNet: 2, delta: 0.4, heldoutTol: 0.1, final: true };
  const heldSame = { h1: 5, h2: 5, h3: 5, h4: 5 };

  it("KEEP stands when many dev tasks improve and held-out is shown to be no worse", () => {
    const base = mkRun("fin-base1", { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }, heldSame);
    const cand = mkRun("fin-cand1", { a: 5, b: 5, c: 5, d: 5, e: 5, f: 5 }, heldSame);
    const c = compareRuns([base], cand, FINAL);
    assert.equal(c.decision, "KEEP");
    assert.deepEqual([c.final?.dev.n, c.final?.dev.mean_diff, c.final?.dev.significant], [6, 1, true]);
    assert.equal(c.final?.dev.p_improve, 0.016); // 1/64
    assert.equal(c.final?.heldout?.non_inferior, true);
    assert.match(renderComparison(c), /## Final statistic \(paired over tasks, one-sided, alpha 0.1\)/);
  });

  it("two gains among five dev tasks pass the plain rule but not the paired test (p = 0.25), so the final decision is INCONCLUSIVE", () => {
    const base = mkRun("fin-base2", { a: 0, b: 0, c: 5, d: 5, e: 5 }, heldSame);
    const cand = mkRun("fin-cand2", { a: 5, b: 5, c: 5, d: 5, e: 5 }, heldSame);
    assert.equal(compareRuns([base], cand, { ...FINAL, final: false }).decision, "KEEP");
    const c = compareRuns([base], cand, FINAL);
    assert.deepEqual([c.decision, c.final?.dev.p_improve, c.final?.dev.significant], ["INCONCLUSIVE", 0.25, false]);
    assert.match(c.reasons.join(), /final decision: the paired improvement test over 5 dev task\(s\) gives p=0.25/);
  });

  it("a single common held-out task cannot show non-inferiority, so a final KEEP is refused", () => {
    const dev0 = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
    const dev5 = { a: 5, b: 5, c: 5, d: 5, e: 5, f: 5 };
    const c = compareRuns([mkRun("fin-base3", dev0, { h1: 5 })], mkRun("fin-cand3", dev5, { h1: 5 }), FINAL);
    assert.equal(c.final?.heldout?.non_inferior, false);
    assert.equal(c.decision, "INCONCLUSIVE");
    assert.match(c.reasons.join(), /held-out non-inferiority is not shown/);
  });

  it("without held-out data the final decision says it could not be tested", () => {
    const c = compareRuns([mkRun("fin-base4", { a: 0, b: 0, c: 0, d: 0, e: 0 }, {})], mkRun("fin-cand4", { a: 5, b: 5, c: 5, d: 5, e: 5 }, {}), FINAL);
    assert.equal(c.final?.heldout, null);
    assert.equal(c.decision, "INCONCLUSIVE");
    assert.match(c.reasons.join(), /held-out non-inferiority could not be tested/);
  });

  it("a final run never turns a REJECT into anything else, and the field is empty when not asked for", () => {
    const base = mkRun("fin-base5", { a: 5, b: 5, c: 5 }, heldSame);
    const cand = mkRun("fin-cand5", { a: 0, b: 0, c: 5 }, heldSame);
    assert.equal(compareRuns([base], cand, FINAL).decision, "REJECT");
    assert.equal(compareRuns([base], cand, { minNet: 2, delta: 0.4, heldoutTol: 0.1 }).final, null);
  });
});

describe("held-out guard: tolerance from measured noise", () => {
  // four held-out tasks; run B differs from run A by 0.2 on two of them
  const A = { h1: 5, h2: 5, h3: 5, h4: 5 };
  const B = { h1: 4, h2: 5, h3: 5, h4: 4 };

  it("derives 1.5 x the standard error of the per-task gap between two baselines of identical code", () => {
    const a = mkRun("tol-a", { d: 5 }, A);
    const b = mkRun("tol-b", { d: 5 }, B);
    const d = derivedTolerance([scoreRun(a), scoreRun(b)]);
    // gaps 0.2, 0, 0, 0.2: mean 0.1, sample sd 0.1155, se 0.0577, tolerance 0.0866
    assert.ok(d && Math.abs(d.se - 0.0577) < 0.001 && Math.abs(d.tolerance - 0.0866) < 0.001, JSON.stringify(d));
    assert.deepEqual(d?.runs, ["tol-a", "tol-b"]);
    const cand = mkRun("tol-cand", { d: 5 }, A);
    const c = compareRuns([a, b], cand, OPTS);
    assert.deepEqual([c.heldout?.tolerance_source, c.heldout?.tolerance, c.heldout?.noise_se], ["derived", 0.087, 0.058]);
    assert.match(renderComparison(c), /derived from baselines tol-a and tol-b/);
  });

  it("is clamped between the floor and the cap", () => {
    const same = derivedTolerance([scoreRun(mkRun("cl-a", { d: 5 }, A)), scoreRun(mkRun("cl-b", { d: 5 }, A))]);
    assert.equal(same?.tolerance, TOL_FLOOR, "no noise at all still leaves the floor");
    const wild = derivedTolerance([scoreRun(mkRun("cl-c", { d: 5 }, { h1: 5, h2: 0, h3: 5, h4: 0 })), scoreRun(mkRun("cl-d", { d: 5 }, { h1: 0, h2: 5, h3: 0, h4: 5 }))]);
    assert.equal(wild?.tolerance, TOL_CAP, "huge noise is capped");
  });

  it("falls back to the default with one baseline, with baselines of different code, and with fewer than two common tasks; an explicit value wins", () => {
    const a = mkRun("fb-a", { d: 5 }, A);
    const b = mkRun("fb-b", { d: 5 }, B, "other-code");
    const cand = mkRun("fb-cand", { d: 5 }, A);
    assert.equal(compareRuns([a], cand, OPTS).heldout?.tolerance_source, "default");
    const mixed = compareRuns([a, b], cand, OPTS);
    assert.deepEqual([mixed.heldout?.tolerance_source, mixed.heldout?.tolerance], ["default", 0.1]);
    assert.equal(derivedTolerance([scoreRun(mkRun("fb-c", { d: 5 }, { h1: 5 })), scoreRun(mkRun("fb-d", { d: 5 }, { h1: 4 }))]), null, "one common task has no spread");
    const explicit = compareRuns([a, mkRun("fb-e", { d: 5 }, B)], cand, { ...OPTS, heldoutTol: 0.02 });
    assert.deepEqual([explicit.heldout?.tolerance_source, explicit.heldout?.tolerance], ["explicit", 0.02]);
  });

  it("uses the held-out split only: dev noise between the baselines does not widen the guard", () => {
    const a = mkRun("dv-a", { d1: 5, d2: 0, d3: 5 }, A);
    const b = mkRun("dv-b", { d1: 0, d2: 5, d3: 0 }, A);
    assert.equal(derivedTolerance([scoreRun(a), scoreRun(b)])?.tolerance, TOL_FLOOR);
  });

  it("the derived tolerance decides the guard: the same drop passes under a wide tolerance and fails under a narrow one", () => {
    const noisyA = mkRun("dd-a", { d1: 0, d2: 5 }, { h1: 5, h2: 5, h3: 5, h4: 5 });
    const noisyB = mkRun("dd-b", { d1: 0, d2: 5 }, { h1: 2, h2: 5, h3: 5, h4: 2 }); // wide noise: tolerance near the cap
    const calmA = mkRun("dd-c", { d1: 0, d2: 5 }, { h1: 5, h2: 5, h3: 5, h4: 5 });
    const calmB = mkRun("dd-d", { d1: 0, d2: 5 }, { h1: 5, h2: 5, h3: 5, h4: 5 });
    const cand = mkRun("dd-cand", { d1: 5, d2: 5 }, { h1: 5, h2: 4, h3: 4, h4: 4 }); // a drop of 0.15 on three tasks pooled: -0.1125
    const wide = compareRuns([noisyA, noisyB], cand, OPTS);
    const narrow = compareRuns([calmA, calmB], cand, OPTS);
    assert.ok(wide.heldout && wide.heldout.tolerance > 0.11, `wide tolerance ${wide.heldout?.tolerance}`);
    assert.equal(wide.heldout?.ok, true);
    assert.equal(narrow.heldout?.tolerance, TOL_FLOOR);
    assert.equal(narrow.heldout?.ok, false);
    assert.equal(narrow.decision, "REJECT");
  });
});
