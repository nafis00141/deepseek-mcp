/**
 * What identifies "the code a candidate was cut from", and "the held-out set a run used".
 *
 * Lineage is the git tree hash of `src/` at the merge-base with the baseline branch. It follows the server code, not the
 * commit: a docs-only commit on the baseline branch moves the merge-base but not the tree, so renaming or rebasing cannot
 * give a candidate a fresh look budget, while a real change to `src/` on the baseline branch does start a new lineage.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadTasks } from "./fixture.ts";

function git(gitBin: string, cwd: string, args: string[]): string | null {
  const r = spawnSync(gitBin, args, { cwd, encoding: "utf8" });
  return r.status === 0 ? String(r.stdout).trim() : null;
}

export interface Lineage {
  /** git tree hash of src/ at the merge-base */
  lineage: string;
  merge_base: string;
  base_branch: string;
}

/** The baseline branch is `main` or `master` (whichever exists); null when the repo has neither or no merge-base. */
export function computeLineage(gitBin: string, rootDir: string): Lineage | null {
  for (const base of ["main", "master"]) {
    if (git(gitBin, rootDir, ["rev-parse", "--verify", "-q", base]) === null) continue;
    const mb = git(gitBin, rootDir, ["merge-base", "HEAD", base]);
    if (!mb) return null;
    const tree = git(gitBin, rootDir, ["rev-parse", `${mb}:src`]);
    return tree ? { lineage: tree, merge_base: mb, base_branch: base } : null;
  }
  return null;
}

/** A hash of the held-out set: every held-out task id with the hash of its task.json, sorted. Null when there is none. */
export function heldoutSetHash(heldoutRoot: string): { hash: string; count: number } | null {
  const tasks = loadTasks([heldoutRoot], ["heldout"]);
  if (!tasks.length) return null;
  const lines = tasks
    .map((t) => `${t.id}:${crypto.createHash("sha1").update(fs.readFileSync(path.join(t.dir, "task.json"))).digest("hex")}`)
    .sort();
  return { hash: crypto.createHash("sha1").update(lines.join("\n")).digest("hex"), count: tasks.length };
}
