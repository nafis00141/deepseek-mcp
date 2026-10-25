/**
 * Baseline vs candidate on paired per-task outcomes. Proposes a decision; a human approves every merge.
 *
 *   node eval/compare.ts --baseline baseline-1,baseline-2 --candidate candidate-1 [--min-net 2] [--delta 0.4] [--heldout-tol 0.1]
 *
 * Rule (spec AC-19), applied to the dev tasks:
 *   gain  = a task's hidden-pass mean rose by at least --delta; loss = it fell by at least --delta
 *   KEEP  needs (gains - losses) >= --min-net AND the pooled held-out hidden-pass mean not below baseline by more than --heldout-tol
 *   A ceiling task (hard, passes > 80% on the baseline) cannot count as a gain; a floor task (< 20%) cannot count as a loss.
 *   KEEP also needs the net over tasks not authored after a result was seen (`authored_after_result`) to reach --min-net.
 *   A calibration-purpose run is refused as a baseline.
 *   REJECT if the net is negative, the held-out guard fails, or tasks lost without any gain
 *   otherwise INCONCLUSIVE: the evidence points the right way but is too thin to act on
 * Held-out tasks are never itemised, only their pooled aggregate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LookResult } from "./lib/looks.ts";
import { spendLook } from "./lib/looks.ts";
import { frozenProblem, loadBands } from "./lib/calibration.ts";
import { CONTEXT_SETTINGS } from "./lib/proc.ts";
import { loadTasks } from "./lib/fixture.ts";
import { isPrivate } from "./lib/privacy.ts";
import { nonInferiority, signFlipPValue } from "./lib/stats.ts";
import type { Band } from "./lib/calibration.ts";
import type { Tier } from "./lib/types.ts";
import type { NonInferiority } from "./lib/stats.ts";
import { aggregate, scoreRun } from "./score.ts";
import type { Aggregate, RunRow, ScoreResult, Stat } from "./score.ts";

export interface CompareOpts {
  minNet: number;
  delta: number;
  /** An explicit held-out tolerance. When absent it is derived from baseline-to-baseline noise, else `defaultHeldoutTol`. */
  heldoutTol?: number;
  defaultHeldoutTol?: number;
  /** The held-out look budget for this candidate is spent: the held-out guard cannot be applied, so KEEP is off the table. */
  ignoreHeldout?: boolean;
  /** Where the held-out look budget stands after this comparison; shown in the report. */
  looks?: LookResult;
  /** A final decision: KEEP additionally needs a paired improvement test on dev and a non-inferiority test on held-out (FINAL_ALPHA). */
  final?: boolean;
  /** Difficulty bands of the hard dev tasks (calibration.json). A ceiling task cannot count as a gain, a floor task cannot count as a loss. */
  bands?: Map<string, Band>;
  /** Ids of tasks written after their author had seen a result for the family (`authored_after_result: true`). KEEP needs the net without them too. */
  afterResult?: Set<string>;
  /** Only compare dev tasks of this tier. */
  tier?: Tier;
  /** Dev tasks only: no held-out guard, no look budget. A screening verdict (and the chance check), never a real KEEP. */
  devOnly?: boolean;
  /** Only compare dev tasks whose axis is one of these / is none of these / whose id is one of these. */
  axes?: string[];
  excludeAxes?: string[];
  tasks?: string[];
}

/** The significance level of the final decision, one-sided. Fixed here and in eval/loop.md, before any final run. */
export const FINAL_ALPHA = 0.1;

export interface FinalStats {
  alpha: number;
  /** paired over dev tasks: is the mean per-task change above zero? */
  dev: { n: number; mean_diff: number; p_improve: number; significant: boolean };
  /** paired over shared held-out tasks: is the mean per-task change above minus the tolerance? null when the guard was not applied */
  heldout: NonInferiority | null;
}

export interface TaskDelta {
  task: string;
  family: string;
  tier: Tier;
  base: Aggregate;
  cand: Aggregate;
  delta: number;
  verdict: "gain" | "loss" | "same";
  /** calibration band of a hard task; null for a task that was not calibrated */
  band: Band | null;
  /** false when the verdict is shown but does not enter the net: a gain on a ceiling task, a loss on a floor task */
  counted: boolean;
  /** true when the task was authored after its author had seen a result for the family */
  after_result: boolean;
  /** largest gap between the individual baselines for this task: how far two identical-code runs already differ */
  noise: number | null;
}

export interface Comparison {
  baselines: string[];
  candidate: string;
  opts: CompareOpts;
  dev: TaskDelta[];
  gains: number;
  losses: number;
  net: number;
  /** the net again, over tasks not authored after a result was seen */
  net_clean: number;
  heldout: HeldoutGuard | null;
  /** Set when the guard could not be applied for a reason other than the look budget (for example no common held-out tasks). */
  heldout_problem: string | null;
  final: FinalStats | null;
  overall: { base: Aggregate; cand: Aggregate };
  token_ratio: number | null;
  /** mean cost per run, candidate over baseline, on the compared rows (the pricing file prices the proxy's usage); null when the baseline has no cost data */
  cost_ratio: number | null;
  /** share of dev runs excluded as incomplete (timeouts, infrastructure, caps) per side; a large gap makes a verdict unfair */
  exclusion: { base: number; cand: number; ok: boolean };
  /** set when the baseline and candidate manifests differ in a server setting other than the context settings, or in a task env */
  settings_problem: string | null;
  decision: "KEEP" | "REJECT" | "INCONCLUSIVE";
  reasons: string[];
}

export interface HeldoutGuard {
  base: Aggregate;
  cand: Aggregate;
  delta: number;
  ok: boolean;
  /** held-out tasks both sides ran (the only ones pooled), and how many were on one side only */
  shared_tasks: number;
  base_only: number;
  cand_only: number;
  tolerance: number;
  tolerance_source: "explicit" | "derived" | "default";
  /** standard error of the per-task gap between baselines of identical code, when it could be measured */
  noise_se: number | null;
  noise_runs: string[];
}

export const TOL_FLOOR = 0.05;
export const TOL_CAP = 0.15;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Per-task held-out hidden-pass mean of one scored run, over `only` tasks when given. */
function heldoutMeans(s: ScoreResult, only?: Set<string>): Map<string, number> {
  const m = new Map<string, number>();
  for (const [task, rows] of byTask(s.rows.filter((r) => r.split === "heldout"))) {
    if (only && !only.has(task)) continue;
    m.set(task, rows.reduce((a, r) => a + (r.hidden_pass ? 1 : 0), 0) / rows.length);
  }
  return m;
}

/**
 * The guard tolerance measured from noise: among the named baselines, take those that ran identical server code (equal
 * `server_hash` in their manifests), look at the held-out split only, and for every pair compute the standard error of the
 * mean per-task gap. The tolerance is 1.5 times the largest such error, kept between TOL_FLOOR and TOL_CAP. Null when fewer
 * than two baselines share a server hash or fewer than two tasks are common to a pair.
 */
export function derivedTolerance(bases: ScoreResult[], shared?: Set<string>): { tolerance: number; se: number; runs: string[] } | null {
  const byHash = new Map<string, ScoreResult[]>();
  for (const b of bases) {
    const h = (b.manifest as { server_hash?: string } | null)?.server_hash;
    if (h) byHash.set(h, [...(byHash.get(h) ?? []), b]);
  }
  let best: { se: number; runs: string[] } | null = null;
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = heldoutMeans(group[i]!, shared);
        const b = heldoutMeans(group[j]!, shared);
        const gaps = [...a.keys()].filter((t) => b.has(t)).map((t) => a.get(t)! - b.get(t)!);
        if (gaps.length < 2) continue;
        const mu = gaps.reduce((x, y) => x + y, 0) / gaps.length;
        const sd = Math.sqrt(gaps.reduce((x, y) => x + (y - mu) ** 2, 0) / (gaps.length - 1));
        const se = sd / Math.sqrt(gaps.length);
        if (!best || se > best.se) best = { se, runs: [group[i]!.run_id, group[j]!.run_id] };
      }
    }
  }
  return best ? { tolerance: clamp(1.5 * best.se, TOL_FLOOR, TOL_CAP), se: best.se, runs: best.runs } : null;
}

const mean = (s: Stat | null): number => s?.mean ?? 0;
const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const byTask = (rows: RunRow[]): Map<string, RunRow[]> => {
  const m = new Map<string, RunRow[]>();
  for (const r of rows) m.set(r.task, [...(m.get(r.task) ?? []), r]);
  return m;
};

export function compareRuns(baselineDirs: string[], candidateDir: string, opts: CompareOpts): Comparison {
  const bases = baselineDirs.map((d) => scoreRun(d));
  // A calibration run was used to choose the bands; as a comparison baseline it would be graded on the exam it wrote.
  for (const b of bases) {
    if ((b.manifest as { purpose?: string | null } | null)?.purpose === "calibration") throw new Error(`${b.run_id} is a calibration run and cannot be a comparison baseline: run a fresh baseline with --purpose comparison`);
  }
  const cand = scoreRun(candidateDir);
  const baseRows = bases.flatMap((b) => b.rows);
  // A filter that matches nothing would give an empty comparison and a quiet INCONCLUSIVE: refuse it instead.
  const seenRows = [...baseRows, ...cand.rows].filter((r) => !isPrivate(r.split));
  for (const [flag, wanted, have] of [["--axis", opts.axes, new Set(seenRows.map((r) => r.axis))], ["--exclude-axis", opts.excludeAxes, new Set(seenRows.map((r) => r.axis))], ["--tasks", opts.tasks, new Set(seenRows.map((r) => r.task))]] as const) {
    const missing = (wanted ?? []).filter((w) => !have.has(w));
    if (missing.length) throw new Error(`${flag}: no dev run has ${missing.join(", ")}`);
  }
  // Only dev drives gains and losses and only held-out is the regression guard; confirm and reserve rows belong to neither.
  const devOf = (rows: RunRow[]): RunRow[] =>
    rows.filter((r) => !isPrivate(r.split) && (!opts.tier || r.tier === opts.tier) && (!opts.axes || (r.axis !== null && opts.axes.includes(r.axis))) && !(r.axis !== null && opts.excludeAxes?.includes(r.axis)) && (!opts.tasks || opts.tasks.includes(r.task)));
  const heldOf = (rows: RunRow[]): RunRow[] => (opts.devOnly || opts.tier ? [] : rows.filter((r) => r.split === "heldout"));
  const bT = byTask(devOf(baseRows));
  const cT = byTask(devOf(cand.rows));
  const perBaseline = bases.map((b) => byTask(devOf(b.rows)));

  const dev: TaskDelta[] = [];
  for (const [task, brs] of [...bT.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const crs = cT.get(task);
    if (!crs) continue;
    const base = aggregate(brs);
    const c = aggregate(crs);
    const delta = r3(mean(c.hidden_pass) - mean(base.hidden_pass));
    const means = perBaseline.map((m) => (m.get(task)?.length ? mean(aggregate(m.get(task)!).hidden_pass) : null)).filter((x): x is number => x !== null);
    const verdict = delta >= opts.delta ? "gain" : delta <= -opts.delta ? "loss" : "same";
    const band = opts.bands?.get(task) ?? null;
    dev.push({
      task, family: brs[0]!.family, tier: brs[0]!.tier, base, cand: c, delta, verdict,
      band, counted: !((verdict === "gain" && band === "ceiling") || (verdict === "loss" && band === "floor")), after_result: opts.afterResult?.has(task) ?? false,
      noise: means.length > 1 ? r3(Math.max(...means) - Math.min(...means)) : null,
    });
  }
  const tally = (ds: TaskDelta[]): { gains: number; losses: number } => ({ gains: ds.filter((d) => d.counted && d.verdict === "gain").length, losses: ds.filter((d) => d.counted && d.verdict === "loss").length });
  const { gains, losses } = tally(dev);
  const net = gains - losses;
  const clean = tally(dev.filter((d) => !d.after_result));
  const net_clean = clean.gains - clean.losses;

  // Pool held-out rows only over the tasks both sides ran: after a rotation, or when tasks were added, old baselines and a new
  // candidate can cover different sets, and a pooled rate over different sets compares nothing.
  const hbAll = heldOf(baseRows);
  const hcAll = heldOf(cand.rows);
  const baseTasks = new Set(hbAll.map((r) => r.task));
  const candTasks = new Set(hcAll.map((r) => r.task));
  const sharedSet = new Set([...baseTasks].filter((t) => candTasks.has(t)));
  const hb = hbAll.filter((r) => sharedSet.has(r.task));
  const hc = hcAll.filter((r) => sharedSet.has(r.task));
  let heldout: HeldoutGuard | null = null;
  let heldout_problem: string | null = null;
  if (hbAll.length && hcAll.length && !sharedSet.size) heldout_problem = "the baselines and the candidate share no held-out task, so the held-out guard cannot be applied";
  if (hb.length && hc.length && !opts.ignoreHeldout) {
    const base = aggregate(hb);
    const c = aggregate(hc);
    const delta = r3(mean(c.hidden_pass) - mean(base.hidden_pass));
    const derived = opts.heldoutTol === undefined ? derivedTolerance(bases, sharedSet) : null;
    const tolerance = opts.heldoutTol ?? derived?.tolerance ?? opts.defaultHeldoutTol ?? 0.1;
    heldout = {
      base, cand: c, delta, ok: delta >= -tolerance, shared_tasks: sharedSet.size, base_only: baseTasks.size - sharedSet.size, cand_only: candTasks.size - sharedSet.size,
      tolerance: r3(tolerance), tolerance_source: opts.heldoutTol !== undefined ? "explicit" : derived ? "derived" : "default", noise_se: derived ? r3(derived.se) : null, noise_runs: derived?.runs ?? [],
    };
  }

  const reasons: string[] = [];
  let decision: Comparison["decision"];
  if (!dev.length) {
    decision = "INCONCLUSIVE";
    reasons.push("no dev task appears in both runs");
  } else if (net < 0 || (heldout && !heldout.ok) || (losses > 0 && gains === 0)) {
    decision = "REJECT";
    if (net < 0) reasons.push(`net ${net}: more dev tasks got worse than better`);
    if (losses > 0 && gains === 0) reasons.push(`${losses} dev task(s) got worse and none better`);
    if (heldout && !heldout.ok) reasons.push(`held-out hidden-pass fell by ${Math.abs(heldout.delta)} (tolerance ${heldout.tolerance}, ${heldout.tolerance_source})`);
  } else if (net >= opts.minNet && net_clean >= opts.minNet) {
    decision = "KEEP";
    reasons.push(`net ${net} >= ${opts.minNet}${net_clean !== net ? ` and ${net_clean} without tasks authored after a result` : ""} with ${opts.devOnly ? "no held-out guard (dev-only screening)" : "the held-out guard intact"}`);
  } else if (net >= opts.minNet) {
    decision = "INCONCLUSIVE";
    reasons.push(`net ${net} reaches ${opts.minNet} only with tasks authored after a result was seen; without them it is ${net_clean}`);
  } else {
    decision = "INCONCLUSIVE";
    reasons.push(net > 0 ? `net ${net} is below the required ${opts.minNet}: the direction is right but the dev set is too small to act on` : "no dev task changed by the required margin");
  }
  if (opts.ignoreHeldout) {
    reasons.push("held-out look budget exhausted: the held-out guard was not applied, so this cannot be KEEP");
    if (decision === "KEEP") decision = "INCONCLUSIVE";
  }
  if (heldout_problem) {
    reasons.push(`${heldout_problem}; this cannot be KEEP`);
    if (decision === "KEEP") decision = "INCONCLUSIVE";
  }
  // A side that loses more runs to timeouts or infrastructure than the other is flattered by it: refuse a verdict across a wide gap.
  const filtered = Boolean(opts.devOnly || opts.tier || opts.axes || opts.excludeAxes || opts.tasks);
  const keptTasks = new Set(devOf([...baseRows, ...cand.rows]).map((r) => r.task));
  const rate = (excluded: { task: string; split: string }[], rows: RunRow[]): number => {
    const ex = excluded.filter((e) => !isPrivate(e.split) && (!filtered || keptTasks.has(e.task))).length;
    const n = (filtered ? devOf(rows) : rows.filter((r) => !isPrivate(r.split))).length;
    return ex + n > 0 ? r3(ex / (ex + n)) : 0;
  };
  const exBase = rate(bases.flatMap((b) => b.excluded), baseRows);
  const exCand = rate(cand.excluded, cand.rows);
  const exclusion = { base: exBase, cand: exCand, ok: Math.abs(exBase - exCand) <= 0.1 };
  if (!exclusion.ok) {
    reasons.push(`runs excluded as incomplete: ${Math.round(exBase * 100)}% of baseline runs against ${Math.round(exCand * 100)}% of candidate runs; the gap is over 10 points, so this cannot be KEEP`);
    if (decision === "KEEP") decision = "INCONCLUSIVE";
  }
  // Arms must differ only in what the comparison is about: compare the recorded server settings and task env.
  let settings_problem: string | null = null;
  const manifestOf = (dir: string): { settings?: Record<string, string>; task_env?: unknown } | null => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as { settings?: Record<string, string>; task_env?: unknown };
    } catch {
      return null;
    }
  };
  const cm = manifestOf(candidateDir);
  if (cm?.settings) {
    const diffs = new Set<string>();
    for (const dir of baselineDirs) {
      const bm = manifestOf(dir);
      if (!bm?.settings) continue;
      for (const k of new Set([...Object.keys(bm.settings), ...Object.keys(cm.settings)])) if (!CONTEXT_SETTINGS.includes(k) && bm.settings[k] !== cm.settings[k]) diffs.add(k);
      if (JSON.stringify(bm.task_env ?? {}) !== JSON.stringify(cm.task_env ?? {})) diffs.add("task env");
    }
    if (diffs.size) settings_problem = `the baseline and candidate runs differ in ${[...diffs].join(", ")}, which are not context settings: the comparison is not like for like`;
  }
  if (settings_problem) {
    reasons.push(`${settings_problem}; this cannot be KEEP`);
    if (decision === "KEEP") decision = "INCONCLUSIVE";
  }
  // The final statistic is paired over tasks: repeats of one task are not independent, so the unit is the per-task change.
  let final: FinalStats | null = null;
  if (opts.final) {
    const devDiffs = dev.map((d) => d.delta);
    const p = signFlipPValue(devDiffs, { alternative: "greater" });
    let ni: NonInferiority | null = null;
    if (heldout) {
      const bh = byTask(hb);
      const ch = byTask(hc);
      const heldDiffs = [...sharedSet].sort().map((t) => mean(aggregate(ch.get(t)!).hidden_pass) - mean(aggregate(bh.get(t)!).hidden_pass));
      ni = nonInferiority(heldDiffs, heldout.tolerance, FINAL_ALPHA);
    }
    final = { alpha: FINAL_ALPHA, dev: { n: devDiffs.length, mean_diff: r3(devDiffs.length ? devDiffs.reduce((a, b) => a + b, 0) / devDiffs.length : 0), p_improve: r3(p), significant: p <= FINAL_ALPHA }, heldout: ni };
    if (decision === "KEEP") {
      const why: string[] = [];
      if (!final.dev.significant) why.push(`the paired improvement test over ${final.dev.n} dev task(s) gives p=${final.dev.p_improve}, above ${FINAL_ALPHA}`);
      if (!ni) why.push("held-out non-inferiority could not be tested");
      else if (!ni.non_inferior) why.push(`held-out non-inferiority is not shown (p=${r3(ni.p)} at margin ${ni.margin}, alpha ${FINAL_ALPHA})`);
      if (why.length) {
        decision = "INCONCLUSIVE";
        reasons.push(`final decision: ${why.join("; ")}`);
      }
    }
  }
  const usedBase = filtered ? devOf(baseRows) : baseRows;
  const usedCand = filtered ? devOf(cand.rows) : cand.rows;
  const bTok = mean(aggregate(usedBase).tokens_total);
  const cTok = mean(aggregate(usedCand).tokens_total);
  const token_ratio = bTok > 0 ? Math.round((cTok / bTok) * 100) / 100 : null;
  const bCost = mean(aggregate(usedBase).cost);
  const cost_ratio = bCost > 0 ? Math.round((mean(aggregate(usedCand).cost) / bCost) * 100) / 100 : null;
  if (cost_ratio !== null && cost_ratio > 1.5) reasons.push(`cost rule: mean cost per run is x${cost_ratio} of the baseline, over 1.5; adoption needs the owner to accept the rise`);
  if (token_ratio !== null && token_ratio > 1.25) reasons.push(`cost warning: mean tokens per run rose ${Math.round((token_ratio - 1) * 100)}%`);
  const skipped = dev.filter((d) => !d.counted);
  if (skipped.length) reasons.push(`not counted: ${skipped.map((d) => `${d.task} (${d.verdict} on a ${d.band} task)`).join(", ")}`);
  return { baselines: bases.map((b) => b.run_id), candidate: cand.run_id, opts, dev, gains, losses, net, net_clean, heldout, overall: { base: aggregate(usedBase), cand: aggregate(usedCand) }, token_ratio, cost_ratio, exclusion, settings_problem, decision, reasons, heldout_problem, final };
}

const pct = (s: Stat | null): string => (s ? `${Math.round(s.mean * 100)}%` : "-");
const sign = (n: number): string => (n > 0 ? `+${Math.round(n * 100)}pp` : `${Math.round(n * 100)}pp`);
const arrow = (a: Stat | null, b: Stat | null): string => `${pct(a)} -> ${pct(b)}`;
const k = (s: Stat | null): string => `${Math.round(mean(s) / 100) / 10}k`;

export function renderComparison(c: Comparison): string {
  const out = [`# Compare - ${c.candidate} vs ${c.baselines.join(" + ")}`, ""];
  if (c.opts.devOnly) out.push("**SCREENING comparison: dev tasks only, no held-out guard, no look spent. A KEEP here is not a KEEP in the loop; the real decision is the candidate branch's normal comparison.**", "");
  out.push(`Rule: a dev task is a gain/loss when its hidden-pass mean moves by >= ${c.opts.delta}; KEEP needs net >= ${c.opts.minNet} and held-out within the tolerance below.`, "");
  out.push(`## ${c.opts.devOnly ? "Screening verdict" : "Decision"}: ${c.opts.devOnly && c.decision === "KEEP" ? "SCREEN PASS (not a KEEP)" : c.decision}`, "", ...c.reasons.map((r) => `- ${r}`), "");
  out.push("## Dev tasks (hidden pass, paired)", "", "| task | tier | band | family | hidden pass | change | false accept | compliance | tokens | noise between baselines | |", "|---|---|---|---|---|---|---|---|---|---|---|");
  for (const d of c.dev) out.push(`| ${d.task} | ${d.tier}${d.after_result ? " (after result)" : ""} | ${d.band ?? "-"} | ${d.family} | ${arrow(d.base.hidden_pass, d.cand.hidden_pass)} | ${sign(d.delta)} | ${arrow(d.base.false_accept, d.cand.false_accept)} | ${arrow(d.base.compliance, d.cand.compliance)} | ${k(d.base.tokens_total)} -> ${k(d.cand.tokens_total)} | ${d.noise === null ? "-" : sign(d.noise)} | ${d.verdict === "same" ? "" : d.counted ? d.verdict : `${d.verdict} (not counted)`} |`);
  out.push("", `gains ${c.gains}, losses ${c.losses}, net ${c.net}; net without tasks authored after a result: ${c.net_clean}`, "");
  out.push("## Aggregates", "", "| | hidden pass | false accept | first try | compliance |", "|---|---|---|---|---|");
  out.push(`| all runs | ${arrow(c.overall.base.hidden_pass, c.overall.cand.hidden_pass)} | ${arrow(c.overall.base.false_accept, c.overall.cand.false_accept)} | ${arrow(c.overall.base.first_try, c.overall.cand.first_try)} | ${arrow(c.overall.base.compliance, c.overall.cand.compliance)} |`);
  if (c.heldout) out.push(`| held-out (aggregate) | ${arrow(c.heldout.base.hidden_pass, c.heldout.cand.hidden_pass)} (${sign(c.heldout.delta)}, ${c.heldout.ok ? "within tolerance" : "REGRESSED"}) | ${arrow(c.heldout.base.false_accept, c.heldout.cand.false_accept)} | ${arrow(c.heldout.base.first_try, c.heldout.cand.first_try)} | ${arrow(c.heldout.base.compliance, c.heldout.cand.compliance)} |`);
  out.push("", c.token_ratio !== null ? `Mean tokens per run: x${c.token_ratio} of baseline.${c.cost_ratio !== null ? ` Mean cost per run: x${c.cost_ratio}.` : ""} Runs excluded as incomplete: ${Math.round(c.exclusion.base * 100)}% baseline, ${Math.round(c.exclusion.cand * 100)}% candidate.` : "", "");
  if (c.final) {
    const f = c.final;
    out.push(`## Final statistic (paired over tasks, one-sided, alpha ${f.alpha})`, "",
      `- dev improvement: mean per-task change ${sign(f.dev.mean_diff)} over ${f.dev.n} task(s); exact sign-flip p = ${f.dev.p_improve} (${f.dev.significant ? "significant" : "not significant"})`,
      f.heldout ? `- held-out non-inferiority: mean per-task change ${sign(f.heldout.mean_diff)} over ${f.heldout.n} task(s); margin ${f.heldout.margin}; p = ${Math.round(f.heldout.p * 1000) / 1000} (${f.heldout.non_inferior ? "non-inferiority shown" : "not shown"})` : "- held-out non-inferiority: not tested (guard not applied)", "");
  }
  const g = c.heldout;
  if (g) {
    const src = g.tolerance_source === "derived" ? `derived from baselines ${g.noise_runs.join(" and ")}: noise SE ${g.noise_se}, 1.5 x SE clamped to ${TOL_FLOOR}-${TOL_CAP}` : g.tolerance_source === "explicit" ? "set explicitly" : "default (no two baselines of identical code to measure noise from)";
    out.push(`Held-out guard: ${g.shared_tasks} task(s) common to both sides${g.base_only || g.cand_only ? ` (${g.base_only} only in the baselines, ${g.cand_only} only in the candidate: not pooled)` : ""}; tolerance ${g.tolerance}, ${src}.`, "");
  }
  const l = c.opts.looks;
  if (l) out.push(`Held-out looks: this lineage ${l.lineage_used}/${l.lineage_budget} (${l.lineage_left} left); all lineages ${l.total_used}/${l.total_budget} since the last rotation (${l.total_left} left).${l.reason ? ` REFUSED: ${l.reason}.` : ""}`, "");
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (key: string): string | undefined => {
    const i = args.indexOf(`--${key}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const runs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "runs");
  const dir = (id: string): string => (fs.existsSync(id) ? path.resolve(id) : path.join(runs, id));
  const base = get("baseline")?.split(",").map((s) => s.trim()).filter(Boolean);
  const cand = get("candidate");
  if (!base?.length || !cand) {
    console.error("usage: node eval/compare.ts --baseline a,b --candidate c [--min-net 2] [--delta 0.4] [--heldout-tol 0.1] [--final] [--dev-only] [--axis a,b] [--exclude-axis a] [--tasks id,id]");
    process.exit(1);
  }
  // Every comparison that shows the held-out aggregate spends one look, keyed by the candidate's lineage (the src/ tree it was
  // cut from, from its manifest). A run with no lineage falls back to its own id, which is the weakest key and says so.
  let candLineage = `run:${path.basename(dir(cand))}`;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(dir(cand), "manifest.json"), "utf8")) as { lineage?: string | null };
    if (m.lineage) candLineage = m.lineage;
  } catch {
    /* no manifest: keyed by run id */
  }
  const evalDir = path.dirname(fileURLToPath(import.meta.url));
  const bands = loadBands(evalDir);
  const afterResult = new Set(loadTasks([path.join(evalDir, "tasks")], ["dev"]).filter((t) => t.authored_after_result === true).map((t) => t.id));
  const stale = frozenProblem(evalDir);
  const devOnly = args.includes("--dev-only");
  if (devOnly && args.includes("--final")) {
    console.error("--final needs the held-out guard and cannot be combined with --dev-only");
    process.exit(1);
  }
  const list = (k: string): string[] | undefined => get(k)?.split(",").map((s) => s.trim()).filter(Boolean);
  // A screening comparison reads no held-out rows, so it must not spend a look either.
  const look = devOnly ? { allowed: true, lineage_used: 0, lineage_budget: 0, lineage_left: 0, total_used: 0, total_budget: 0, total_left: 0, reason: "" } : spendLook(path.join(runs, "heldout-looks.json"), candLineage, Number(get("heldout-budget") ?? 4), Number(get("heldout-total") ?? 12));
  const result = compareRuns(base.map(dir), dir(cand), { minNet: Number(get("min-net") ?? 2), delta: Number(get("delta") ?? 0.4), ...(get("heldout-tol") !== undefined ? { heldoutTol: Number(get("heldout-tol")) } : {}), ignoreHeldout: !look.allowed, ...(devOnly ? {} : { looks: look }), final: args.includes("--final") && !devOnly, bands, afterResult, devOnly, ...(list("axis") ? { axes: list("axis")! } : {}), ...(list("exclude-axis") ? { excludeAxes: list("exclude-axis")! } : {}), ...(list("tasks") ? { tasks: list("tasks")! } : {}) });
  if (stale) result.reasons.push(stale);
  const text = renderComparison(result);
  fs.writeFileSync(path.join(dir(cand), devOnly ? "compare-screening.md" : "compare.md"), text);
  console.log(text);
}
