import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { TIERS, tierOf } from "./types.ts";
import type { LoadedTask, Split, TaskDef } from "./types.ts";

export const sleepSync = (ms: number): void => void Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** The split a task folder must declare, by the name of the folder that holds it. */
const FOLDER_SPLIT: Record<string, Split> = { tasks: "dev", heldout: "heldout", confirm: "confirm", reserve: "reserve" };

/** Every task folder root next to eval/run.ts: dev tasks plus the three private ones (the latter are gitignored and may be absent). */
export const taskRoots = (evalDir: string): string[] => Object.keys(FOLDER_SPLIT).map((d) => path.join(evalDir, d));

/**
 * Read every <dir>/<id>/task.json under the given roots, keeping only the requested splits, so a run that asks for dev tasks
 * never opens a private task. A task whose `split` disagrees with the folder it sits in is refused: a private task left in
 * `tasks/` would be listed by name, and a dev task in `heldout/` would be hidden from the dev report.
 */
export function loadTasks(roots: string[], splits: Split[]): LoadedTask[] {
  const out: LoadedTask[] = [];
  const seen = new Map<string, string>();
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const mustBe = FOLDER_SPLIT[path.basename(root)];
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
      const file = path.join(root, e.name, "task.json");
      if (!e.isDirectory() || !fs.existsSync(file)) continue;
      const def = JSON.parse(fs.readFileSync(file, "utf8")) as TaskDef;
      if (def.id !== e.name) throw new Error(`${file}: id "${def.id}" must equal the folder name "${e.name}"`);
      // An id shared by two folders (say a reserve task and a dev task) would make the public name stand for a private task in every report and audit.
      const prior = seen.get(def.id);
      if (prior) throw new Error(`task id "${def.id}" is used twice: ${prior} and ${file}`);
      seen.set(def.id, file);
      if (def.tier !== undefined && !TIERS.includes(def.tier)) throw new Error(`${file}: tier "${String(def.tier)}" must be one of ${TIERS.join(", ")}`);
      if (tierOf(def) === "hard" && !def.axis) throw new Error(`${file}: a hard task must name its axis`);
      if (mustBe && def.split !== mustBe) throw new Error(`${file}: split "${def.split}" does not match the folder "${path.basename(root)}" (expected "${mustBe}")`);
      if (!splits.includes(def.split)) continue;
      out.push({ ...def, dir: path.join(root, e.name) });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export interface Fixture {
  tmp: string;
  repo: string;
  git: (...args: string[]) => string;
  remove: () => void;
}

const toCrlf = (s: string): string => s.replace(/\r?\n/g, "\r\n");

/**
 * A throwaway git repo built from <task.dir>/repo. Conventions match the server's tests: main branch via symbolic-ref,
 * local identity, no signing, autocrlf off (the user's global setting must not rewrite fixtures). The temp path is
 * resolved with realpath.native because os.tmpdir() can be an 8.3 short name on Windows.
 */
export function makeRepo(task: Pick<LoadedTask, "dir" | "crlf_files">, git: string): Fixture {
  const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-")));
  const repo = path.join(tmp, "repo");
  fs.mkdirSync(repo);
  const src = path.join(task.dir, "repo");
  if (fs.existsSync(src)) fs.cpSync(src, repo, { recursive: true });
  for (const f of task.crlf_files ?? []) {
    const p = path.join(repo, f);
    fs.writeFileSync(p, toCrlf(fs.readFileSync(p, "utf8")));
  }
  const run = (...args: string[]): string => {
    const r = spawnSync(git, args, { cwd: repo, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${`${r.stdout}${r.stderr}`.trim().slice(0, 300)}`);
    return String(r.stdout).trim();
  };
  run("init", "-q");
  run("symbolic-ref", "HEAD", "refs/heads/main");
  for (const [k, v] of [["user.name", "eval"], ["user.email", "eval@example.invalid"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]] as const) run("config", k, v);
  const ign = path.join(repo, ".gitignore");
  const have = fs.existsSync(ign) ? fs.readFileSync(ign, "utf8") : "";
  const nl = have.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(ign, `${have}${have && !have.endsWith("\n") ? nl : ""}specs/.jobs/${nl}specs/review/${nl}`);
  run("add", "-A");
  run("commit", "-qm", "fixture");
  return { tmp, repo, git: run, remove: () => removeDir(tmp) };
}

/** Run an optional <task.dir>/setup.ts: default export (ctx) => void, for extra branches or committed artifacts. */
export async function runSetup(task: Pick<LoadedTask, "dir">, fx: Fixture): Promise<void> {
  const file = path.join(task.dir, "setup.ts");
  if (!fs.existsSync(file)) return;
  const mod = (await import(pathToFileURL(file).href)) as { default?: (ctx: { repo: string; git: Fixture["git"] }) => void | Promise<void> };
  if (typeof mod.default !== "function") throw new Error(`${file}: default export must be a function`);
  await mod.default({ repo: fx.repo, git: fx.git });
}

/** rm -rf with retries: antivirus and the indexer hold files briefly on Windows (EBUSY/EPERM). */
export function removeDir(dir: string): void {
  for (let i = 0; i < 6; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      sleepSync(200 * (i + 1));
    }
  }
}
