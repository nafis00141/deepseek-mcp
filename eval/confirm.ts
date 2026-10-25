/**
 * Confirmation: the one look at the protected confirmation set, for a final decision.
 *
 *   node eval/confirm.ts --candidate <run> --baseline <run> --final [--k 8] [--max-cost 2.5] [--margin 0.1] --yes
 *
 * It runs the confirmation tasks on two arms from the pinned server copies of two existing runs, then prints aggregate
 * numbers only: no task name, no check name, no per-task result. Looks are limited (one per lineage, three in total since the
 * last rotation), a server-code hash that was already confirmed is refused, every look is appended to runs/confirm-log.jsonl,
 * and the cost is estimated first and refused when it exceeds the cap.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CFG } from "../src/config.ts";
import { FINAL_ALPHA } from "./compare.ts";
import { loadTasks } from "./lib/fixture.ts";
import { nonInferiority, signFlipPValue } from "./lib/stats.ts";
import type { NonInferiority } from "./lib/stats.ts";
import type { Pricing } from "./lib/types.ts";
import { runEval } from "./run.ts";
import { aggregate, scoreRun } from "./score.ts";
import type { RunRow } from "./score.ts";

export const CONFIRM_LOOKS_PER_LINEAGE = 1;
export const CONFIRM_LOOKS_TOTAL = 3;

export interface ConfirmOpts {
  rootDir: string;
  evalDir: string;
  runsDir: string;
  candidate: string;
  baseline: string;
  final: boolean;
  k: number;
  maxCost: number;
  margin: number;
  yes: boolean;
  apiKey: string;
  upstream: string;
  gitBin: string;
  pricing?: Pricing | undefined;
  taskTimeoutS?: number;
  now?: () => Date;
  log: (line: string) => void;
}

/** What a confirmation reports. Deliberately has no task or check names. */
export interface ConfirmResult {
  tasks: number;
  k: number;
  baseline: { hidden_pass: number; false_accept: number };
  candidate: { hidden_pass: number; false_accept: number };
  mean_task_change: number;
  improvement_p: number;
  improvement_significant: boolean;
  non_inferiority: NonInferiority;
  lineage: string;
  alpha: number;
}

export interface ConfirmLogEntry {
  ts: string;
  type: "look" | "rotation";
  lineage?: string;
  candidate_hash?: string;
  baseline_hash?: string;
  candidate_run?: string;
  baseline_run?: string;
  tasks?: number;
  k?: number;
  result?: { mean_task_change: number; improvement_p: number; non_inferior: boolean };
}

const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
};

export function readConfirmLog(file: string): ConfirmLogEntry[] {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l) as ConfirmLogEntry);
  } catch {
    return [];
  }
}

/** Looks counted since the last rotation marker. */
export function looksSinceRotation(log: ConfirmLogEntry[]): ConfirmLogEntry[] {
  const lastRotation = log.map((e) => e.type).lastIndexOf("rotation");
  return log.slice(lastRotation + 1).filter((e) => e.type === "look");
}

const perTask = (rows: RunRow[]): Map<string, number> => {
  const sums = new Map<string, { pass: number; n: number }>();
  for (const r of rows.filter((x) => x.split === "confirm")) {
    const s = sums.get(r.task) ?? { pass: 0, n: 0 };
    sums.set(r.task, { pass: s.pass + (r.hidden_pass ? 1 : 0), n: s.n + 1 });
  }
  return new Map([...sums].map(([t, s]) => [t, s.pass / s.n]));
};

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

export async function runConfirm(o: ConfirmOpts): Promise<ConfirmResult> {
  if (!o.final) throw new Error("refused: a confirmation is a final look; pass --final to take it");
  const logFile = path.join(o.runsDir, "confirm-log.jsonl");
  const candDir = path.join(o.runsDir, o.candidate);
  const baseDir = path.join(o.runsDir, o.baseline);
  const cm = readJson<{ server_hash?: string; lineage?: string | null }>(path.join(candDir, "manifest.json"));
  const bm = readJson<{ server_hash?: string }>(path.join(baseDir, "manifest.json"));
  if (!cm?.server_hash || !bm?.server_hash) throw new Error("refused: both runs need a manifest with a server_hash");
  if (!cm.lineage) throw new Error("refused: the candidate's manifest has no lineage, so its look budget cannot be keyed");
  for (const d of [candDir, baseDir]) if (!fs.existsSync(path.join(d, "server", "src"))) throw new Error(`refused: ${d} has no pinned server/ copy to run`);

  const log = readConfirmLog(logFile);
  const looks = looksSinceRotation(log);
  if (log.some((e) => e.type === "look" && e.candidate_hash === cm.server_hash)) throw new Error("refused: this server code has already been confirmed");
  if (looks.some((e) => e.lineage === cm.lineage)) throw new Error(`refused: this lineage has already used its ${CONFIRM_LOOKS_PER_LINEAGE} confirmation look`);
  if (looks.length >= CONFIRM_LOOKS_TOTAL) throw new Error(`refused: the ${CONFIRM_LOOKS_TOTAL} confirmation looks since the last rotation are spent`);

  const tasks = loadTasks([path.join(o.evalDir, "confirm")], ["confirm"]);
  if (!tasks.length) throw new Error("refused: there are no confirmation tasks");
  if (!o.pricing) throw new Error("refused: the cost cap needs eval/pricing.json");
  const usage = readJson<{ mean_cost?: number }>(path.join(o.runsDir, "last-usage.json"));
  if (!usage?.mean_cost) throw new Error("refused: no cost estimate yet (runs/last-usage.json); run a pilot first");
  const estimate = usage.mean_cost * tasks.length * o.k * 2;
  o.log(`confirmation: ${tasks.length} task(s) x k=${o.k} x 2 arms; estimated cost about $${estimate.toFixed(2)}, cap $${o.maxCost.toFixed(2)}`);
  if (estimate > o.maxCost) throw new Error(`refused: the estimated cost $${estimate.toFixed(2)} is over the cap $${o.maxCost.toFixed(2)}; lower --k or raise --max-cost`);
  if (!o.yes) throw new Error("refused: this spends money and a look; re-run with --yes after reading the estimate above");

  const stamp = (o.now ?? (() => new Date()))().toISOString().replace(/[-:]/g, "").replace(/\..*/, "");
  const base = { rootDir: o.rootDir, tasksRoots: [path.join(o.evalDir, "confirm")], runsDir: o.runsDir, k: o.k, splits: ["confirm" as const], parallel: 1, dryRun: false, yes: true, maxCost: o.maxCost / 2, taskTimeoutS: o.taskTimeoutS ?? 1200, resume: false, allowDirty: true, apiKey: o.apiKey, upstream: o.upstream, gitBin: o.gitBin, serverEnv: process.env, pricing: o.pricing, purpose: "comparison" as const, log: () => {} };
  const ids = { baseline: `confirm-${stamp}-baseline`, candidate: `confirm-${stamp}-candidate` };
  const [rb, rc] = await Promise.all([
    runEval({ ...base, runId: ids.baseline, arm: "baseline", serverSrc: path.join(baseDir, "server") }),
    runEval({ ...base, runId: ids.candidate, arm: "candidate", serverSrc: path.join(candDir, "server") }),
  ]);
  const incomplete = [...rb.records, ...rc.records].filter((r) => !r.complete).length;
  if (rb.aborted || rc.aborted || incomplete || rb.records.length !== tasks.length * o.k || rc.records.length !== tasks.length * o.k) {
    throw new Error(`confirmation did not complete cleanly (${incomplete} incomplete run(s)${rb.aborted || rc.aborted ? ", a run was aborted" : ""}); no look was recorded`);
  }

  const sb = scoreRun(path.join(o.runsDir, ids.baseline));
  const sc = scoreRun(path.join(o.runsDir, ids.candidate));
  const mb = perTask(sb.rows);
  const mc = perTask(sc.rows);
  const common = [...mb.keys()].filter((t) => mc.has(t)).sort();
  const diffs = common.map((t) => mc.get(t)! - mb.get(t)!);
  const ab = aggregate(sb.rows.filter((r) => r.split === "confirm"));
  const ac = aggregate(sc.rows.filter((r) => r.split === "confirm"));
  const p = signFlipPValue(diffs, { alternative: "greater" });
  const ni = nonInferiority(diffs, o.margin, FINAL_ALPHA);
  const meanChange = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
  const result: ConfirmResult = {
    tasks: common.length, k: o.k,
    baseline: { hidden_pass: r3(ab.hidden_pass?.mean ?? 0), false_accept: r3(ab.false_accept?.mean ?? 0) },
    candidate: { hidden_pass: r3(ac.hidden_pass?.mean ?? 0), false_accept: r3(ac.false_accept?.mean ?? 0) },
    mean_task_change: r3(meanChange), improvement_p: r3(p), improvement_significant: p <= FINAL_ALPHA, non_inferiority: { ...ni, p: r3(ni.p), mean_diff: r3(ni.mean_diff) }, lineage: cm.lineage, alpha: FINAL_ALPHA,
  };
  const entry: ConfirmLogEntry = {
    ts: (o.now ?? (() => new Date()))().toISOString(), type: "look", lineage: cm.lineage, candidate_hash: cm.server_hash, baseline_hash: bm.server_hash,
    candidate_run: o.candidate, baseline_run: o.baseline, tasks: common.length, k: o.k, result: { mean_task_change: result.mean_task_change, improvement_p: result.improvement_p, non_inferior: ni.non_inferior },
  };
  fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  return result;
}

/** Aggregate-only text: nothing here names a task or a check. */
export function renderConfirm(r: ConfirmResult): string {
  const pct = (x: number): string => `${Math.round(x * 100)}%`;
  const ni = r.non_inferiority;
  return [
    `Confirmation (aggregate only): ${r.tasks} task(s), k=${r.k}, two arms`,
    `  hidden pass:   baseline ${pct(r.baseline.hidden_pass)} -> candidate ${pct(r.candidate.hidden_pass)}`,
    `  false accepts: baseline ${pct(r.baseline.false_accept)} -> candidate ${pct(r.candidate.false_accept)}`,
    `  mean per-task change ${r.mean_task_change >= 0 ? "+" : ""}${Math.round(r.mean_task_change * 100)}pp`,
    `  improvement (exact paired sign-flip, one-sided, alpha ${r.alpha}): p = ${r.improvement_p} (${r.improvement_significant ? "significant" : "not significant"})`,
    `  non-inferiority at margin ${ni.margin}: p = ${ni.p} (${ni.non_inferior ? "shown" : "not shown"})`,
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  let pricing: Pricing | undefined;
  try {
    pricing = JSON.parse(fs.readFileSync(path.join(here, "pricing.json"), "utf8")) as Pricing;
  } catch {
    /* no pricing file */
  }
  const candidate = get("candidate");
  const baseline = get("baseline");
  if (!candidate || !baseline) {
    console.error("usage: node eval/confirm.ts --candidate <run> --baseline <run> --final [--k 8] [--max-cost 2.5] [--margin 0.1] --yes");
    process.exit(1);
  }
  try {
    const r = await runConfirm({
      rootDir: path.resolve(here, ".."), evalDir: here, runsDir: path.resolve(here, "..", "runs"), candidate, baseline, final: args.includes("--final"), k: Number(get("k") ?? 8),
      maxCost: Number(get("max-cost") ?? 2.5), margin: Number(get("margin") ?? 0.1), yes: args.includes("--yes"), apiKey: process.env.DEEPSEEK_API_KEY ?? "",
      upstream: process.env.EVAL_UPSTREAM ?? "https://api.deepseek.com", gitBin: CFG.git, pricing, log: (l) => console.log(l),
    });
    console.log(renderConfirm(r));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
