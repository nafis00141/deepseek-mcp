import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mean, nonInferiority, signFlipPValue } from "../eval/lib/stats.ts";

const near = (a: number, b: number, tol = 1e-9): void => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

describe("sign-flip test", () => {
  it("matches hand-computed exact values", () => {
    near(signFlipPValue([1, 1, 1, 1]), 1 / 16); // only the all-plus pattern reaches the observed sum
    near(signFlipPValue([1, 1, 1]), 1 / 8);
    near(signFlipPValue([1, -1]), 3 / 4); // sums are 0, 2, -2, 0 and the observed sum is 0
    near(signFlipPValue([2, 1, 1]), 1 / 8); // the observed 4 is reached by the all-plus pattern only; 2+1-1 = 2 is below it
    near(signFlipPValue([3, 1, -1]), 3 / 8); // observed 3; by hand the patterns give 3, 5, 1, 3, -3, -1, -5, -3, so three reach 3
  });

  it("is one in the all-zero and empty cases, and ignores zero differences", () => {
    assert.equal(signFlipPValue([]), 1);
    assert.equal(signFlipPValue([0, 0, 0]), 1);
    near(signFlipPValue([0, 1, 1, 1, 1, 0]), 1 / 16);
  });

  it("the 'less' alternative mirrors 'greater'", () => {
    near(signFlipPValue([-1, -1, -1, -1], { alternative: "less" }), 1 / 16);
    near(signFlipPValue([1, 1, 1, 1], { alternative: "less" }), 1);
  });

  it("ties between sums count as at least as extreme (floating point safe)", () => {
    // observed 0.1; by hand [1,-1,1] gives 1, -1, 3, 1, -1, -3, 1, -1, so four patterns reach it, two of them only by tying (0.1 - 0.1 + 0.1)
    near(signFlipPValue([0.1, -0.1, 0.1]), 4 / 8);
  });

  it("the Monte Carlo fallback is deterministic and close to the exact value", () => {
    const d = [0.4, 0.2, 0.6, -0.2, 0.4, 0.2, 0.0, 0.4, 0.2, -0.2, 0.6, 0.4];
    const exact = signFlipPValue(d);
    const mc1 = signFlipPValue(d, { maxExact: 0, samples: 40000 });
    const mc2 = signFlipPValue(d, { maxExact: 0, samples: 40000 });
    assert.equal(mc1, mc2);
    assert.ok(Math.abs(mc1 - exact) < 0.01, `${mc1} vs ${exact}`);
  });
});

describe("non-inferiority", () => {
  it("shows no-worse-than-margin when every task is at or above it, and not when the candidate is clearly worse", () => {
    const good = nonInferiority([0, 0, 0.2, 0, 0.2, 0, 0, 0, 0.2, 0], 0.1);
    assert.equal(good.non_inferior, true);
    assert.ok(good.p <= 0.1);
    const bad = nonInferiority([-0.4, -0.2, -0.4, -0.2, -0.4, 0, -0.2, -0.4], 0.1);
    assert.equal(bad.non_inferior, false);
    assert.ok(bad.mean_diff < -0.1);
  });

  it("the margin matters: the same small drop is acceptable under a wider margin and not under a narrow one", () => {
    const drop = [-0.1, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1];
    assert.equal(nonInferiority(drop, 0.2).non_inferior, true);
    assert.equal(nonInferiority(drop, 0.05).non_inferior, false);
    assert.equal(nonInferiority(drop, 0.1).p, 1, "exactly at the margin shifts every difference to zero, which gives no evidence");
  });

  it("reports the sample it used", () => {
    const r = nonInferiority([0.1, 0.2], 0.05);
    assert.deepEqual([r.n, r.alpha, r.margin], [2, 0.1, 0.05]);
    near(mean([0.1, 0.2]), 0.15);
    assert.equal(mean([]), 0);
  });
});
