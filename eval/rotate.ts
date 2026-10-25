/**
 * Rotation: when the held-out set has been looked at too often to stay a guard, promote it into the dev tier and refill held-out
 * from the reserve.
 *
 *   node eval/rotate.ts [--looks-total 12] [--min-reserve 8] [--yes]
 *
 * Without --yes it only prints what it would do. A rotation refuses when too few looks were spent or the reserve is too small
 * to refill held-out, moves the task folders (rewriting each task.json `split`, since the loader filters on it), resets the
 * held-out look counters, writes a rotation marker into the confirm log, and records itself in runs/rotation-log.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTasks } from "./lib/fixture.ts";
import { readLooks } from "./lib/looks.ts";
import { privateLabel } from "./lib/privacy.ts";
import type { LoadedTask, Split } from "./lib/types.ts";

export interface RotateOpts {
  evalDir: string;
  runsDir: string;
  /** held-out looks since the last rotation that make the set "spent" */
  lookTotal: number;
  minReserve: number;
  yes: boolean;
  now?: () => Date;
  log: (line: string) => void;
}

export interface RotationSummary {
  applied: boolean;
  promoted: number;
  refilled: number;
  looks_before: number;
}

const readJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
};

/** Move a task folder into `destRoot`, setting its split and recording where it came from. */
function relocate(t: LoadedTask, destRoot: string, split: Split, from: string, on: string): void {
  const file = path.join(t.dir, "task.json");
  const def = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  def.split = split;
  def.rotated = { from, on };
  fs.writeFileSync(file, JSON.stringify(def, null, 2) + "\n");
  fs.mkdirSync(destRoot, { recursive: true });
  fs.renameSync(t.dir, path.join(destRoot, t.id));
}

export function rotate(o: RotateOpts): RotationSummary {
  const now = (o.now ?? (() => new Date()))().toISOString();
  const heldDir = path.join(o.evalDir, "heldout");
  const devDir = path.join(o.evalDir, "tasks");
  const reserveDir = path.join(o.evalDir, "reserve");
  const looksFile = path.join(o.runsDir, "heldout-looks.json");
  const state = readLooks(looksFile);

  const held = loadTasks([heldDir], ["heldout"]);
  const reserve = loadTasks([reserveDir], ["reserve"]);
  if (state.total < o.lookTotal) throw new Error(`refused: only ${state.total} of the ${o.lookTotal} held-out looks are spent, so the held-out set is not worn out yet`);
  if (reserve.length < o.minReserve) throw new Error(`refused: the reserve holds ${reserve.length} task(s) and a rotation needs at least ${o.minReserve} to refill held-out`);
  const taken = new Set(fs.existsSync(devDir) ? fs.readdirSync(devDir) : []);
  const clash = [...held, ...reserve].map((t) => t.id).filter((id, i, all) => taken.has(id) || all.indexOf(id) !== i);
  if (clash.length) throw new Error(`refused: ${clash.length} task id(s) would collide after the move (${clash.map(privateLabel).join(", ")})`);

  o.log(`rotation: promote ${held.length} held-out task(s) into the dev tier, move ${reserve.length} reserve task(s) into held-out, reset ${state.total} look(s)`);
  if (!o.yes) {
    o.log("dry run: nothing moved. Re-run with --yes to apply.");
    return { applied: false, promoted: held.length, refilled: reserve.length, looks_before: state.total };
  }

  for (const t of held) relocate(t, devDir, "dev", "heldout", now);
  for (const t of reserve) relocate(t, heldDir, "heldout", "reserve", now);
  fs.mkdirSync(o.runsDir, { recursive: true });
  fs.writeFileSync(looksFile, JSON.stringify({ version: 2, total: 0, by_lineage: {} }, null, 2));
  fs.appendFileSync(path.join(o.runsDir, "confirm-log.jsonl"), JSON.stringify({ ts: now, type: "rotation" }) + "\n");
  const logFile = path.join(o.runsDir, "rotation-log.json");
  const history = readJson<unknown[]>(logFile) ?? [];
  // Only hashed labels are recorded: the log must not name a private task.
  history.push({ ts: now, looks_before: state.total, promoted: held.map((t) => privateLabel(t.id)), refilled: reserve.map((t) => privateLabel(t.id)) });
  fs.writeFileSync(logFile, JSON.stringify(history, null, 2));
  return { applied: true, promoted: held.length, refilled: reserve.length, looks_before: state.total };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  try {
    rotate({ evalDir: here, runsDir: path.resolve(here, "..", "runs"), lookTotal: Number(get("looks-total") ?? 12), minReserve: Number(get("min-reserve") ?? 8), yes: args.includes("--yes"), log: (l) => console.log(l) });
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
