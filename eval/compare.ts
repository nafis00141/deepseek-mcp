/**
 * Baseline vs candidate on paired per-task outcomes. Proposes a decision; a human approves every merge.
 *
 *   node eval/compare.ts --baseline baseline-1,baseline-2 --candidate candidate-1 [--min-net 2] [--delta 0.4] [--heldout-tol 0.1]
 *
 * Rule (spec AC-19), applied to the dev tasks:
 *   gain  = a task's hidden-pass mean rose by at least --delta; loss = it fell by at least --delta
 *   KEEP  needs (gains - losses) >= --min-net AND the pooled held-out hidden-pass mean not below baseline by more than --heldout-tol
 *   REJECT if the net is negative, the held-out guard fails, or tasks lost without any gain
 *   otherwise INCONCLUSIVE: the evidence points the right way but is too thin to act on
 * Held-out tasks are never itemised, only their pooled aggregate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aggregate, scoreRun } from "./score.ts";
import type { Aggregate, RunRow, Stat } from "./score.ts";

export interface CompareOpts {
  minNet: number;
  delta: number;
  heldoutTol: number;
  /** The held-out look budget for this candidate is spent: the held-out guard cannot be applied, so KEEP is off the table. */
  ignoreHeldout?: boolean;
}

export interface TaskDelta {
  task: string;
  family: string;
  base: Aggregate;
  cand: Aggregate;
  delta: number;
  verdict: "gain" | "loss" | "same";
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
  heldout: { base: Aggregate; cand: Aggregate; delta: number; ok: boolean } | null;
  overall: { base: Aggregate; cand: Aggregate };
  token_ratio: number | null;
  decision: "KEEP" | "REJECT" | "INCONCLUSIVE";
  reasons: string[];
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
  const cand = scoreRun(candidateDir);
  const baseRows = bases.flatMap((b) => b.rows);
  const devOf = (rows: RunRow[]): RunRow[] => rows.filter((r) => r.split !== "heldout");
  const heldOf = (rows: RunRow[]): RunRow[] => rows.filter((r) => r.split === "heldout");
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
    dev.push({
      task, family: brs[0]!.family, base, cand: c, delta, verdict: delta >= opts.delta ? "gain" : delta <= -opts.delta ? "loss" : "same",
      noise: means.length > 1 ? r3(Math.max(...means) - Math.min(...means)) : null,
    });
  }
  const gains = dev.filter((d) => d.verdict === "gain").length;
  const losses = dev.filter((d) => d.verdict === "loss").length;
  const net = gains - losses;

  const hb = heldOf(baseRows);
  const hc = heldOf(cand.rows);
  let heldout: Comparison["heldout"] = null;
  if (hb.length && hc.length && !opts.ignoreHeldout) {
    const base = aggregate(hb);
    const c = aggregate(hc);
    const delta = r3(mean(c.hidden_pass) - mean(base.hidden_pass));
    heldout = { base, cand: c, delta, ok: delta >= -opts.heldoutTol };
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
    if (heldout && !heldout.ok) reasons.push(`held-out hidden-pass fell by ${Math.abs(heldout.delta)} (tolerance ${opts.heldoutTol})`);
  } else if (net >= opts.minNet) {
    decision = "KEEP";
    reasons.push(`net ${net} >= ${opts.minNet} with the held-out guard intact`);
  } else {
    decision = "INCONCLUSIVE";
    reasons.push(net > 0 ? `net ${net} is below the required ${opts.minNet}: the direction is right but the dev set is too small to act on` : "no dev task changed by the required margin");
  }
  if (opts.ignoreHeldout) {
    reasons.push("held-out look budget exhausted: the held-out guard was not applied, so this cannot be KEEP");
    if (decision === "KEEP") decision = "INCONCLUSIVE";
  }
  const bTok = mean(aggregate(baseRows).tokens_total);
  const cTok = mean(aggregate(cand.rows).tokens_total);
  const token_ratio = bTok > 0 ? Math.round((cTok / bTok) * 100) / 100 : null;
  if (token_ratio !== null && token_ratio > 1.25) reasons.push(`cost warning: mean tokens per run rose ${Math.round((token_ratio - 1) * 100)}%`);
  return { baselines: bases.map((b) => b.run_id), candidate: cand.run_id, opts, dev, gains, losses, net, heldout, overall: { base: aggregate(baseRows), cand: aggregate(cand.rows) }, token_ratio, decision, reasons };
}

const pct = (s: Stat | null): string => (s ? `${Math.round(s.mean * 100)}%` : "-");
const sign = (n: number): string => (n > 0 ? `+${Math.round(n * 100)}pp` : `${Math.round(n * 100)}pp`);
const arrow = (a: Stat | null, b: Stat | null): string => `${pct(a)} -> ${pct(b)}`;
const k = (s: Stat | null): string => `${Math.round(mean(s) / 100) / 10}k`;

export function renderComparison(c: Comparison): string {
  const out = [`# Compare - ${c.candidate} vs ${c.baselines.join(" + ")}`, ""];
  out.push(`Rule: a dev task is a gain/loss when its hidden-pass mean moves by >= ${c.opts.delta}; KEEP needs net >= ${c.opts.minNet} and held-out within ${c.opts.heldoutTol}.`, "");
  out.push(`## Decision: ${c.decision}`, "", ...c.reasons.map((r) => `- ${r}`), "");
  out.push("## Dev tasks (hidden pass, paired)", "", "| task | family | hidden pass | change | false accept | compliance | tokens | noise between baselines | |", "|---|---|---|---|---|---|---|---|---|");
  for (const d of c.dev) out.push(`| ${d.task} | ${d.family} | ${arrow(d.base.hidden_pass, d.cand.hidden_pass)} | ${sign(d.delta)} | ${arrow(d.base.false_accept, d.cand.false_accept)} | ${arrow(d.base.compliance, d.cand.compliance)} | ${k(d.base.tokens_total)} -> ${k(d.cand.tokens_total)} | ${d.noise === null ? "-" : sign(d.noise)} | ${d.verdict === "same" ? "" : d.verdict} |`);
  out.push("", `gains ${c.gains}, losses ${c.losses}, net ${c.net}`, "");
  out.push("## Aggregates", "", "| | hidden pass | false accept | first try | compliance |", "|---|---|---|---|---|");
  out.push(`| all runs | ${arrow(c.overall.base.hidden_pass, c.overall.cand.hidden_pass)} | ${arrow(c.overall.base.false_accept, c.overall.cand.false_accept)} | ${arrow(c.overall.base.first_try, c.overall.cand.first_try)} | ${arrow(c.overall.base.compliance, c.overall.cand.compliance)} |`);
  if (c.heldout) out.push(`| held-out (aggregate) | ${arrow(c.heldout.base.hidden_pass, c.heldout.cand.hidden_pass)} (${sign(c.heldout.delta)}, ${c.heldout.ok ? "within tolerance" : "REGRESSED"}) | ${arrow(c.heldout.base.false_accept, c.heldout.cand.false_accept)} | ${arrow(c.heldout.base.first_try, c.heldout.cand.first_try)} | ${arrow(c.heldout.base.compliance, c.heldout.cand.compliance)} |`);
  out.push("", c.token_ratio !== null ? `Mean tokens per run: x${c.token_ratio} of baseline.` : "", "");
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
    console.error("usage: node eval/compare.ts --baseline a,b --candidate c [--min-net 2] [--delta 0.4] [--heldout-tol 0.1]");
    process.exit(1);
  }
  // Every comparison that shows the held-out aggregate spends one look for that candidate; the budget is pre-registered.
  const budget = Number(get("heldout-budget") ?? 4);
  const lookFile = path.join(runs, "heldout-looks.json");
  let looks: Record<string, number> = {};
  try {
    looks = JSON.parse(fs.readFileSync(lookFile, "utf8")) as Record<string, number>;
  } catch {
    /* first look */
  }
  const used = looks[path.basename(dir(cand))] ?? 0;
  const ignoreHeldout = used >= budget;
  if (!ignoreHeldout) {
    looks[path.basename(dir(cand))] = used + 1;
    fs.writeFileSync(lookFile, JSON.stringify(looks, null, 2));
  }
  const result = compareRuns(base.map(dir), dir(cand), { minNet: Number(get("min-net") ?? 2), delta: Number(get("delta") ?? 0.4), heldoutTol: Number(get("heldout-tol") ?? 0.1), ignoreHeldout });
  const text = renderComparison(result);
  fs.writeFileSync(path.join(dir(cand), "compare.md"), text);
  console.log(text);
}
