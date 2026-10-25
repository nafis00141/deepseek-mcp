/**
 * Difficulty calibration of the hard dev tier (Specs/harder-evals AC-5, AC-7, AC-10).
 *
 * A hard dev task is `calibrated` when, over at least MIN_RUNS baseline runs, its hidden-pass rate is 20-80%; above 80% it is
 * `ceiling`, below 20% `floor`. Only runs that say `arm: baseline` and `purpose: calibration` are accepted, so a candidate's
 * output can never shape the bands. The task set is frozen by a hash of the hard dev task folders; at most MAX_ROUNDS rounds
 * are allowed, and every round after the first must say what structural change it followed.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadTasks, taskRoots } from "./fixture.ts";
import { tierOf } from "./types.ts";
import { scoreRun } from "../score.ts";

export type Band = "calibrated" | "ceiling" | "floor";

export const MIN_RUNS = 10;
export const MAX_ROUNDS = 3;
export const BAND_LOW = 0.2;
export const BAND_HIGH = 0.8;

/** 20-80% inclusive is calibrated. */
export const bandOf = (rate: number): Band => (rate > BAND_HIGH ? "ceiling" : rate < BAND_LOW ? "floor" : "calibrated");

export interface CalibratedTask {
  runs: number;
  pass_rate: number;
  band: Band;
}

export interface Round {
  round: number;
  at: string;
  run_ids: string[];
  task_set_hash: string;
  /** what structural change (size, distractors, fixtures) this round followed; required from round 2 */
  note: string | null;
}

export interface CalibrationFile {
  rounds: Round[];
  tasks: Record<string, CalibratedTask>;
}

export interface FrozenFile {
  task_set_hash: string;
  frozen_at: string;
  round: number;
  tasks: string[];
}

/** A hash over every file of every hard dev task folder (names and bytes, sorted), so any edit to a hard task changes it. */
export function taskSetHash(evalDir: string): { hash: string; tasks: string[] } {
  const hard = loadTasks(taskRoots(evalDir), ["dev"]).filter((t) => tierOf(t) === "hard");
  const h = crypto.createHash("sha1");
  const walk = (base: string, rel: string): void => {
    for (const e of fs.readdirSync(path.join(base, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(base, r);
      else h.update(`${r}\0`).update(fs.readFileSync(path.join(base, r))).update("\0");
    }
  };
  for (const t of hard) {
    h.update(`task ${t.id}\n`);
    walk(t.dir, "");
  }
  return { hash: h.digest("hex"), tasks: hard.map((t) => t.id) };
}

const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
};

export const calibrationPath = (evalDir: string): string => path.join(evalDir, "calibration.json");
export const frozenPath = (evalDir: string): string => path.join(evalDir, "frozen.json");

export function loadCalibration(evalDir: string): CalibrationFile | null {
  return readJson<CalibrationFile>(calibrationPath(evalDir));
}

/** task id -> band, for the compare rule; empty when nothing was calibrated. */
export function loadBands(evalDir: string): Map<string, Band> {
  const c = loadCalibration(evalDir);
  return new Map(Object.entries(c?.tasks ?? {}).map(([id, t]) => [id, t.band]));
}

/** What compare and chance warn about when the hard tasks changed after the freeze. */
export function frozenProblem(evalDir: string): string | null {
  const f = readJson<FrozenFile>(frozenPath(evalDir));
  if (!f) return null;
  return taskSetHash(evalDir).hash === f.task_set_hash ? null : "the hard dev tasks changed after calibration (eval/frozen.json no longer matches): recalibrate before trusting the bands";
}

export interface CalibrateOpts {
  evalDir: string;
  runDirs: string[];
  note?: string;
  now?: () => Date;
}

/**
 * Pool the named calibration runs, band every hard dev task, write calibration.json and frozen.json. Throws, writing nothing,
 * on any run that is not a baseline calibration run, on a task with fewer than MIN_RUNS runs, on a missing note after round 1,
 * and when MAX_ROUNDS have been used.
 */
export function calibrate(o: CalibrateOpts): CalibrationFile {
  if (!o.runDirs.length) throw new Error("name at least one calibration run");
  const prior = loadCalibration(o.evalDir);
  const round = (prior?.rounds.length ?? 0) + 1;
  if (round > MAX_ROUNDS) throw new Error(`calibration is limited to ${MAX_ROUNDS} rounds per task set; tasks still outside the band stay labelled ceiling or floor`);
  if (round > 1 && !o.note?.trim()) throw new Error("a retune round needs --note saying which structural change (size, distractors, fixtures) it followed");

  const scored = o.runDirs.map((d) => scoreRun(d));
  for (const s of scored) {
    const m = (s.manifest ?? {}) as { arm?: string | null; purpose?: string | null };
    if (m.arm !== "baseline") throw new Error(`${s.run_id}: calibration uses baseline runs only (arm is ${JSON.stringify(m.arm ?? null)})`);
    if (m.purpose !== "calibration") throw new Error(`${s.run_id}: only --purpose calibration runs can be used to calibrate (purpose is ${JSON.stringify(m.purpose ?? null)})`);
  }
  const hard = new Set(loadTasks(taskRoots(o.evalDir), ["dev"]).filter((t) => tierOf(t) === "hard").map((t) => t.id));
  if (!hard.size) throw new Error("there are no hard dev tasks to calibrate");
  const rows = scored.flatMap((s) => s.rows).filter((r) => r.split === "dev" && hard.has(r.task));
  const tasks: Record<string, CalibratedTask> = {};
  const short: string[] = [];
  for (const id of [...hard].sort()) {
    const mine = rows.filter((r) => r.task === id);
    if (mine.length < MIN_RUNS) short.push(`${id} (${mine.length})`);
    const rate = mine.length ? Math.round((mine.filter((r) => r.hidden_pass).length / mine.length) * 1000) / 1000 : 0;
    tasks[id] = { runs: mine.length, pass_rate: rate, band: bandOf(rate) };
  }
  if (short.length) throw new Error(`each hard task needs at least ${MIN_RUNS} baseline runs; too few for: ${short.join(", ")}`);

  const set = taskSetHash(o.evalDir);
  const at = (o.now?.() ?? new Date()).toISOString();
  const file: CalibrationFile = {
    rounds: [...(prior?.rounds ?? []), { round, at, run_ids: scored.map((s) => s.run_id), task_set_hash: set.hash, note: o.note?.trim() || null }],
    tasks,
  };
  fs.writeFileSync(calibrationPath(o.evalDir), JSON.stringify(file, null, 2) + "\n");
  const frozen: FrozenFile = { task_set_hash: set.hash, frozen_at: at, round, tasks: set.tasks };
  fs.writeFileSync(frozenPath(o.evalDir), JSON.stringify(frozen, null, 2) + "\n");
  return file;
}
