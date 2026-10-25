/**
 * Offline scoring of a finished run: reads runs/<id>/**\/checks.json plus the per-step traces and writes
 * scores.json and report.md. No API call, no clock, no randomness: scoring the same folder twice gives identical files.
 *
 *   node eval/score.ts <run-id | path to run folder>
 *
 * Private splits (held-out, confirm, reserve) appear only as one aggregate row each; their per-task rows go to private/scores.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPrivate } from "./lib/privacy.ts";
import type { RunRecord } from "./run.ts";

export interface RunRow {
  task: string;
  k: number;
  family: string;
  split: string;
  expect_gate: string;
  gate_status: string | null;
  gate_accepted: boolean;
  gate_expected: boolean;
  hidden_pass: boolean;
  false_accept: boolean;
  false_reject: boolean;
  first_try: boolean;
  /** share of compliance-flagged checks that passed; null when the task flags none */
  compliance: number | null;
  repairs: number;
  turns: number;
  api_retries: number;
  tokens_in: number;
  tokens_out: number;
  tokens_reasoning: number;
  tokens_total: number;
  cost: number;
  wall_s: number;
  oos_writes: number;
  denied_reads: number;
  failing_checks: string[];
  trace_found: boolean;
}

export interface Excluded {
  task: string;
  k: number;
  split: string;
  status: string;
  reason: string;
}

export interface Stat {
  mean: number;
  sd: number;
  min: number;
  max: number;
  n: number;
}

export const METRICS = ["gate_accepted", "gate_expected", "hidden_pass", "false_accept", "false_reject", "first_try", "compliance", "repairs", "turns", "tokens_total", "tokens_reasoning", "cost", "wall_s", "oos_writes"] as const;
export type Metric = (typeof METRICS)[number];
export type Aggregate = { runs: number; flaky: boolean } & Record<Metric, Stat | null>;

export interface TaskScore extends Aggregate {
  task: string;
  family: string;
  split: string;
}

export interface ScoreResult {
  run_id: string;
  manifest: Record<string, unknown> | null;
  /** every complete run, held-out included; only written to the private file */
  rows: RunRow[];
  excluded: Excluded[];
  overall: Aggregate;
  by_split: Record<string, Aggregate>;
  by_family: Record<string, Aggregate>;
  tasks: TaskScore[];
  false_accepts: { task: string; k: number; split: string; failing_checks: string[] }[];
  false_rejects: { task: string; k: number; split: string; failing_checks: string[] }[];
}

const round = (n: number): number => Math.round(n * 1000) / 1000;
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function stat(values: number[]): Stat | null {
  if (!values.length) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = values.length > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)) : 0;
  return { mean: round(mean), sd: round(sd), min: round(Math.min(...values)), max: round(Math.max(...values)), n: values.length };
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

interface TraceFacts {
  found: boolean;
  repairs: number;
  turns: number;
  retries: number;
  oosWrites: number;
  deniedReads: number;
}

/** Facts from every step<N>.trace.jsonl in a run folder; malformed lines are skipped. */
function readTraces(dir: string): TraceFacts {
  const t: TraceFacts = { found: false, repairs: 0, turns: 0, retries: 0, oosWrites: 0, deniedReads: 0 };
  for (const f of fs.readdirSync(dir).filter((n) => /^step\d+\.trace\.jsonl$/.test(n)).sort()) {
    t.found = true;
    for (const line of fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      let e: { type?: string; denied?: unknown };
      try {
        e = JSON.parse(line) as typeof e;
      } catch {
        continue;
      }
      if (e.type === "repair") t.repairs++;
      else if (e.type === "turn") t.turns++;
      else if (e.type === "api_retry") t.retries++;
      else if (e.type === "tool") {
        if (e.denied === "write") t.oosWrites++;
        else if (e.denied === "read") t.deniedReads++;
      }
    }
  }
  return t;
}

/** Score one run record (a complete run only). */
export function scoreRecord(rec: RunRecord, family: string, dir: string): RunRow {
  const tr = readTraces(dir);
  const finalGate = rec.gate_status;
  const accepted = finalGate === "done" || finalGate === "noop";
  const expected = finalGate !== null && rec.expect.gate.split("|").includes(finalGate);
  const hidden = rec.checks.length > 0 && rec.checks.every((c) => c.pass);
  const flagged = rec.checks.filter((c) => c.compliance);
  const fixSteps = rec.steps.some((s) => s.role === "fix");
  return {
    task: rec.task, k: rec.k, family, split: rec.split, expect_gate: rec.expect.gate, gate_status: finalGate,
    gate_accepted: accepted, gate_expected: expected, hidden_pass: hidden,
    false_accept: accepted && !hidden,
    false_reject: !expected && hidden,
    first_try: hidden && expected && tr.repairs === 0 && !fixSteps,
    compliance: flagged.length ? round(flagged.filter((c) => c.pass).length / flagged.length) : null,
    repairs: tr.repairs, turns: tr.turns, api_retries: tr.retries,
    tokens_in: num(rec.usage.prompt), tokens_out: num(rec.usage.completion), tokens_reasoning: num(rec.usage.reasoning),
    tokens_total: num(rec.usage.prompt) + num(rec.usage.completion), cost: round(num(rec.usage.cost) * 10000) / 10000, wall_s: num(rec.wall_s),
    oos_writes: tr.oosWrites, denied_reads: tr.deniedReads,
    failing_checks: rec.checks.filter((c) => !c.pass).map((c) => c.name),
    trace_found: tr.found,
  };
}

export function aggregate(rows: RunRow[]): Aggregate {
  const v = (f: (r: RunRow) => number | null): number[] => rows.map(f).filter((x): x is number => x !== null);
  const b = (x: boolean): number => (x ? 1 : 0);
  const out = {
    gate_accepted: stat(v((r) => b(r.gate_accepted))), gate_expected: stat(v((r) => b(r.gate_expected))), hidden_pass: stat(v((r) => b(r.hidden_pass))),
    false_accept: stat(v((r) => b(r.false_accept))), false_reject: stat(v((r) => b(r.false_reject))), first_try: stat(v((r) => b(r.first_try))),
    compliance: stat(v((r) => r.compliance)), repairs: stat(v((r) => r.repairs)), turns: stat(v((r) => r.turns)), tokens_total: stat(v((r) => r.tokens_total)),
    tokens_reasoning: stat(v((r) => r.tokens_reasoning)), cost: stat(v((r) => r.cost)), wall_s: stat(v((r) => r.wall_s)), oos_writes: stat(v((r) => r.oos_writes)),
  };
  // flaky: repeats of the same task disagree on the hidden outcome
  const flaky = new Set(rows.map((r) => r.hidden_pass)).size > 1;
  return { runs: rows.length, flaky, ...out };
}

/** Find every <...>/<task>/<k>/checks.json under the run folder (not inside server/). */
function findRecords(runDir: string): { rec: RunRecord; dir: string }[] {
  const found: { rec: RunRecord; dir: string }[] = [];
  const walk = (d: string, depth: number): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!e.isDirectory() || e.name === "server" || depth > 3) continue;
      const p = path.join(d, e.name);
      const rec = readJson<RunRecord>(path.join(p, "checks.json"));
      if (rec) found.push({ rec, dir: p });
      else walk(p, depth + 1);
    }
  };
  walk(runDir, 0);
  return found;
}

export function scoreRun(runDir: string): ScoreResult {
  const manifest = readJson<Record<string, unknown>>(path.join(runDir, "manifest.json"));
  const rows: RunRow[] = [];
  const excluded: Excluded[] = [];
  const recs = findRecords(runDir).sort((a, b) => a.rec.split.localeCompare(b.rec.split) || a.rec.task.localeCompare(b.rec.task) || a.rec.k - b.rec.k);
  for (const { rec, dir } of recs) {
    if (!rec.complete) {
      excluded.push({ task: rec.task, k: rec.k, split: rec.split, status: rec.status, reason: rec.error ?? (rec.status === "capped" ? "proxy cap reached" : rec.status === "infra" ? "infrastructure failure inside the job" : rec.status) });
      continue;
    }
    rows.push(scoreRecord(rec, rec.family ?? "unknown", dir));
  }

  const byKey = <T>(items: RunRow[], key: (r: RunRow) => string, make: (k: string, rs: RunRow[]) => T): T[] => {
    const m = new Map<string, RunRow[]>();
    for (const r of items) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, rs]) => make(k, rs));
  };
  const tasks = byKey(rows, (r) => `${r.split}\u0000${r.task}`, (_k, rs) => ({ task: rs[0]!.task, family: rs[0]!.family, split: rs[0]!.split, ...aggregate(rs) }));
  const failures = (pick: (r: RunRow) => boolean) => rows.filter(pick).map((r) => ({ task: r.task, k: r.k, split: r.split, failing_checks: r.failing_checks }));
  return {
    run_id: path.basename(runDir), manifest, rows, excluded, overall: aggregate(rows),
    by_split: Object.fromEntries(byKey(rows, (r) => r.split, (k, rs) => [k, aggregate(rs)] as const)),
    by_family: Object.fromEntries(byKey(rows, (r) => r.family, (k, rs) => [k, aggregate(rs)] as const)),
    tasks, false_accepts: failures((r) => r.false_accept), false_rejects: failures((r) => r.false_reject),
  };
}

/* --------------------------------------------------------------------- report */

const pct = (s: Stat | null): string => (s ? `${Math.round(s.mean * 100)}%` : "-");
const val = (s: Stat | null, d = 1): string => (s ? String(round(Math.round(s.mean * 10 ** d) / 10 ** d)) : "-");
const pm = (s: Stat | null): string => (s && s.n > 1 && s.sd > 0 ? ` ±${round(s.sd)}` : "");
const tok = (s: Stat | null): string => (s ? `${Math.round(s.mean / 100) / 10}k` : "-");

function table(headers: string[], rows: string[][]): string {
  return [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

const aggRow = (label: string, a: Aggregate): string[] => [label, String(a.runs), pct(a.hidden_pass) + pm(a.hidden_pass), pct(a.gate_accepted), pct(a.false_accept), pct(a.false_reject), pct(a.first_try), pct(a.compliance), val(a.repairs), val(a.turns), tok(a.tokens_total), val(a.wall_s, 0) + "s", val(a.oos_writes)];
const HEAD = ["", "runs", "hidden pass", "gate accepted", "false accept", "false reject", "first try", "compliance", "repairs", "turns", "tokens", "wall", "oos writes"];

/** The report shows dev tasks one by one and held-out only as an aggregate. */
export function renderReport(r: ScoreResult): string {
  const m = (r.manifest ?? {}) as { settings?: Record<string, string>; server_hash?: string; k?: number; caps?: { max_tokens?: number | null; max_cost?: number | null }; skipped?: { id: string; needs_role: string }[]; dirty?: boolean };
  const out: string[] = [`# Eval report - ${r.run_id}`, ""];
  if (r.manifest) out.push(`model ${m.settings?.DEEPSEEK_MODEL ?? "?"}, effort ${m.settings?.DEEPSEEK_EFFORT ?? "default"}, k=${m.k ?? "?"}, server ${String(m.server_hash ?? "?").slice(0, 10)}${m.dirty ? " (dirty tree)" : ""}`, "");
  out.push("## Summary", "", table(HEAD, [aggRow("overall", r.overall), ...Object.entries(r.by_split).map(([s, a]) => aggRow(isPrivate(s) ? `${s === "heldout" ? "held-out" : s} (aggregate only)` : s, a))]), "");
  out.push("`hidden pass` is the true correctness. `false accept` = the gate said done/noop but a hidden check failed. `false reject` = the gate result differed from the expected one while every hidden check passed. `first try` = correct with no repair and no fix round. `compliance` = the task's instruction-compliance checks.", "");
  out.push("## By family", "", table(HEAD, Object.entries(r.by_family).map(([f, a]) => aggRow(f, a))), "");
  const dev = r.tasks.filter((t) => !isPrivate(t.split));
  out.push("## Tasks (dev)", "", table(["task", "family", ...HEAD.slice(1), "flaky"], dev.map((t) => [t.task, t.family, ...aggRow("", t).slice(1), t.flaky ? "yes" : ""])), "");
  const section = (title: string, items: ScoreResult["false_accepts"]): void => {
    const shown = items.filter((i) => !isPrivate(i.split));
    const hiddenCount = items.length - shown.length;
    out.push(`## ${title}`, "");
    out.push(shown.length ? shown.map((i) => `- ${i.task}#${i.k}: failing checks ${i.failing_checks.join(", ") || "(none recorded)"}`).join("\n") : "none", ...(hiddenCount ? [``, `(${hiddenCount} more in held-out tasks, not itemised)`] : []), "");
  };
  section("False accepts", r.false_accepts);
  section("False rejects", r.false_rejects);
  const oos = r.rows.filter((x) => !isPrivate(x.split) && (x.oos_writes > 0 || x.denied_reads > 0));
  out.push("## Refused tool calls", "", oos.length ? oos.map((x) => `- ${x.task}#${x.k}: ${x.oos_writes} write(s), ${x.denied_reads} read(s) refused`).join("\n") : "none", "");
  const noTrace = r.rows.filter((x) => !x.trace_found).length;
  if (noTrace) out.push(`Note: ${noTrace} run(s) have no trace file, so their repairs, turns and refused calls read as 0.`, "");
  out.push("## Excluded runs (not scored)", "", r.excluded.length ? r.excluded.filter((e) => !isPrivate(e.split)).map((e) => `- ${e.task}#${e.k}: ${e.status} - ${e.reason}`).join("\n") || "none (held-out only)" : "none", "");
  if (m.skipped?.length) out.push("## Not applicable (role missing)", "", m.skipped.map((s) => `- ${s.id}: needs role "${s.needs_role}"`).join("\n"), "");
  return out.join("\n");
}

/** Write scores.json and report.md (public splits itemised, private splits as aggregates) and private/scores.json (everything). */
export function writeScores(runDir: string): ScoreResult {
  const r = scoreRun(runDir);
  const pub = <T extends { split: string }>(items: T[]): T[] => items.filter((x) => !isPrivate(x.split));
  const visible = {
    run_id: r.run_id, overall: r.overall, by_split: r.by_split, by_family: r.by_family,
    tasks: pub(r.tasks), rows: pub(r.rows), excluded: pub(r.excluded), false_accepts: pub(r.false_accepts), false_rejects: pub(r.false_rejects),
  };
  fs.writeFileSync(path.join(runDir, "scores.json"), JSON.stringify(visible, null, 2) + "\n");
  fs.writeFileSync(path.join(runDir, "report.md"), renderReport(r) + "\n");
  if (r.rows.some((x) => isPrivate(x.split)) || r.excluded.some((e) => isPrivate(e.split))) {
    fs.mkdirSync(path.join(runDir, "private"), { recursive: true });
    fs.writeFileSync(path.join(runDir, "private", "scores.json"), JSON.stringify(r, null, 2) + "\n");
  }
  return r;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node eval/score.ts <run-id | path to run folder>");
    process.exit(1);
  }
  const dir = fs.existsSync(arg) ? path.resolve(arg) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "runs", arg);
  if (!fs.existsSync(dir)) {
    console.error(`no such run: ${dir}`);
    process.exit(1);
  }
  const r = writeScores(dir);
  console.log(renderReport(r));
  console.log(`\nwritten: ${path.join(dir, "scores.json")}, ${path.join(dir, "report.md")}`);
}
