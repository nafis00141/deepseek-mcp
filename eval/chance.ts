/**
 * Chance check: how often would the keep rule say KEEP when nothing changed?
 *
 *   node eval/chance.ts <baseline-run-id>,<baseline-run-id>,... [--tier hard] [--min-net 2] [--delta 0.4]
 *
 * Takes independent baseline runs (arm baseline, purpose comparison) of identical server code, compares every ordered pair as
 * baseline vs candidate on the dev tasks with the real keep rule (bands and provenance included), and reports the share of pairs
 * that would be KEEP by chance. Exits non-zero when that share is above MAX_FALSE_KEEP, or when it cannot be measured.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareRuns } from "./compare.ts";
import type { CompareOpts } from "./compare.ts";
import { frozenProblem, loadBands } from "./lib/calibration.ts";
import { loadTasks } from "./lib/fixture.ts";
import type { Tier } from "./lib/types.ts";
import { scoreRun } from "./score.ts";

export const MAX_FALSE_KEEP = 0.1;

export interface ChanceResult {
  runs: string[];
  server_hash: string;
  /** ordered pairs compared */
  pairs: { baseline: string; candidate: string; net: number; net_clean: number; decision: string }[];
  keeps: number;
  rate: number;
  ok: boolean;
  problems: string[];
}

export function chanceCheck(runDirs: string[], opts: Omit<CompareOpts, "devOnly">): ChanceResult {
  const scored = runDirs.map((d) => ({ dir: d, s: scoreRun(d) }));
  const problems: string[] = [];
  for (const { s } of scored) {
    const m = (s.manifest ?? {}) as { arm?: string | null; purpose?: string | null; server_hash?: string };
    if (m.arm !== "baseline" || m.purpose !== "comparison") throw new Error(`${s.run_id}: the chance check needs baseline runs made with --purpose comparison (arm ${JSON.stringify(m.arm ?? null)}, purpose ${JSON.stringify(m.purpose ?? null)})`);
    if (!m.server_hash) throw new Error(`${s.run_id}: no server hash in the manifest, so identical code cannot be shown`);
  }
  const hashes = new Set(scored.map(({ s }) => (s.manifest as { server_hash: string }).server_hash));
  if (hashes.size > 1) throw new Error(`the runs ran different server code (${hashes.size} server hashes): the chance check needs identical code`);
  const pairs: ChanceResult["pairs"] = [];
  for (const a of scored) {
    for (const b of scored) {
      if (a === b) continue;
      const c = compareRuns([a.dir], b.dir, { ...opts, devOnly: true });
      pairs.push({ baseline: a.s.run_id, candidate: b.s.run_id, net: c.net, net_clean: c.net_clean, decision: c.decision });
    }
  }
  if (!pairs.length) problems.push("fewer than two baseline runs: nothing to compare");
  const keeps = pairs.filter((p) => p.decision === "KEEP").length;
  const rate = pairs.length ? Math.round((keeps / pairs.length) * 1000) / 1000 : 1;
  if (pairs.length && pairs.length < 6) problems.push(`only ${pairs.length} ordered pair(s) (${scored.length} runs): the rate is coarse; three or more baselines give a usable estimate`);
  return { runs: scored.map(({ s }) => s.run_id), server_hash: [...hashes][0] ?? "", pairs, keeps, rate, ok: pairs.length > 0 && rate <= MAX_FALSE_KEEP, problems };
}

export function renderChance(r: ChanceResult): string {
  const out = [`# Chance check - ${r.runs.join(", ")}`, "", `Identical server code (${r.server_hash.slice(0, 10)}). Every ordered pair compared with the keep rule on dev tasks.`, ""];
  out.push("| baseline | candidate | net | net (clean) | decision |", "|---|---|---|---|---|", ...r.pairs.map((p) => `| ${p.baseline} | ${p.candidate} | ${p.net} | ${p.net_clean} | ${p.decision} |`), "");
  out.push(`KEEP by chance in ${r.keeps} of ${r.pairs.length} pair(s): ${Math.round(r.rate * 100)}% (limit ${Math.round(MAX_FALSE_KEEP * 100)}%). ${r.ok ? "The tier is usable." : "The tier is NOT usable for a decision yet."}`, "");
  for (const p of r.problems) out.push(`- ${p}`);
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const get = (key: string): string | undefined => {
    const i = args.indexOf(`--${key}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const used = new Set(["--tier", "--min-net", "--delta"].flatMap((f) => (args.includes(f) ? [args.indexOf(f) + 1] : [])));
  const ids = args.filter((a, i) => !a.startsWith("--") && !used.has(i)).flatMap((a) => a.split(",")).map((s) => s.trim()).filter(Boolean);
  if (ids.length < 2) {
    console.error("usage: node eval/chance.ts <baseline-run-id>,<baseline-run-id>,... [--tier hard] [--min-net 2] [--delta 0.4]");
    process.exit(1);
  }
  const runs = path.join(here, "..", "runs");
  const tier = get("tier");
  if (tier !== undefined && tier !== "hard" && tier !== "regression") {
    console.error("--tier must be hard or regression");
    process.exit(1);
  }
  try {
    const afterResult = new Set(loadTasks([path.join(here, "tasks")], ["dev"]).filter((t) => t.authored_after_result === true).map((t) => t.id));
    const r = chanceCheck(ids.map((id) => (fs.existsSync(id) ? path.resolve(id) : path.join(runs, id))), { minNet: Number(get("min-net") ?? 2), delta: Number(get("delta") ?? 0.4), bands: loadBands(here), afterResult, ...(tier ? { tier: tier as Tier } : {}) });
    const stale = frozenProblem(here);
    if (stale) r.problems.push(stale);
    const text = renderChance(r);
    console.log(text);
    if (!r.ok) process.exitCode = 1;
  } catch (e) {
    console.error(`chance check failed: ${(e as Error).message}`);
    process.exit(1);
  }
}
