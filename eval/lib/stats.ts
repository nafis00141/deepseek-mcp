/**
 * Small, dependency-free statistics for paired per-task comparisons.
 *
 * The unit is the task, not the run: repeats of one task are not independent, so the per-task difference in
 * hidden-pass mean (candidate minus baseline) is what gets tested.
 */

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const EPS = 1e-9;

/** Deterministic PRNG (mulberry32) so a Monte Carlo p-value is reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SignFlipOptions {
  alternative?: "greater" | "less";
  /** Enumerate all 2^n sign patterns up to this many non-zero differences; above it use a fixed-seed Monte Carlo. */
  maxExact?: number;
  samples?: number;
  seed?: number;
}

/**
 * Exact sign-flip (permutation) test of "the mean paired difference is zero": under that null each non-zero difference is
 * equally likely to carry either sign. Returns the one-sided p-value of the observed sum. Zero differences carry no
 * information and are dropped. An empty or all-zero sample gives p = 1.
 */
export function signFlipPValue(diffs: number[], opts: SignFlipOptions = {}): number {
  const { alternative = "greater", maxExact = 20, samples = 20000, seed = 1 } = opts;
  const d = diffs.filter((x) => Math.abs(x) > EPS);
  if (!d.length) return 1;
  const sign = alternative === "greater" ? 1 : -1;
  const observed = sign * d.reduce((a, b) => a + b, 0);
  const n = d.length;
  if (n <= maxExact) {
    let hits = 0;
    const total = 2 ** n;
    for (let mask = 0; mask < total; mask++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += mask & (1 << i) ? d[i]! : -d[i]!;
      if (sign * s >= observed - EPS) hits++;
    }
    return hits / total;
  }
  const rand = rng(seed);
  let hits = 0;
  for (let k = 0; k < samples; k++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += rand() < 0.5 ? d[i]! : -d[i]!;
    if (sign * s >= observed - EPS) hits++;
  }
  return (hits + 1) / (samples + 1); // add-one so the estimate is never exactly 0
}

export interface NonInferiority {
  mean_diff: number;
  margin: number;
  /** One-sided p-value for "the true mean difference is above -margin". */
  p: number;
  /** True when p <= alpha: the candidate is shown to be no worse than the margin allows. */
  non_inferior: boolean;
  alpha: number;
  n: number;
}

/**
 * Non-inferiority of a candidate against a baseline: test H0 "mean difference <= -margin" against H1 "mean difference > -margin"
 * by shifting every difference up by the margin and running the one-sided sign-flip test.
 */
export function nonInferiority(diffs: number[], margin: number, alpha = 0.1, opts: SignFlipOptions = {}): NonInferiority {
  const p = signFlipPValue(diffs.map((x) => x + margin), { ...opts, alternative: "greater" });
  return { mean_diff: mean(diffs), margin, p, non_inferior: p <= alpha, alpha, n: diffs.length };
}
