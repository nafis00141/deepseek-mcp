/**
 * Rejects a proposed harness patch that is tied to the eval instead of general: a patch (or its added lines) that
 * mentions a task id, a fixture file path, or a long run of words copied from a task's instruction is overfitting.
 *
 *   node eval/patch-lint.ts <patch-or-text-file>        exit 1 on any hit
 *
 * The forbidden list is built from every task, held-out included, but held-out terms are never printed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTasks, taskRoots } from "./lib/fixture.ts";
import { isPrivate } from "./lib/privacy.ts";

export interface Forbidden {
  term: string;
  kind: "task id" | "fixture path" | "instruction text";
  heldout: boolean;
}

const GENERIC_PATHS = new Set(["package.json", "readme.md", ".gitignore", "src/index.js"]);
const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9_./-]+/g, " ").split(" ").filter(Boolean);

function listFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).replace(/\\/g, "/")]));
}

/** Terms that tie a patch to a particular task. */
export function forbiddenTerms(taskRoots: string[]): Forbidden[] {
  const out: Forbidden[] = [];
  for (const t of loadTasks(taskRoots, ["dev", "heldout", "confirm", "reserve"])) {
    const heldout = isPrivate(t.split);
    out.push({ term: t.id.toLowerCase(), kind: "task id", heldout });
    for (const f of listFiles(path.join(t.dir, "repo"))) {
      if (f.length >= 8 && !GENERIC_PATHS.has(f.toLowerCase())) out.push({ term: f.toLowerCase(), kind: "fixture path", heldout });
    }
    for (const s of t.steps) {
      const w = words(s.instruction ?? "");
      for (let i = 0; i + 6 <= w.length; i++) out.push({ term: w.slice(i, i + 6).join(" "), kind: "instruction text", heldout });
    }
  }
  return out;
}

export interface LintHit {
  line: number;
  kind: Forbidden["kind"];
  /** the matching term; "(held-out)" when it comes from a held-out task */
  term: string;
}

/** Check the added lines of a unified diff (every line when the text is not a diff). */
export function lintPatch(text: string, forbidden: Forbidden[]): LintHit[] {
  const lines = text.split(/\r?\n/);
  const isDiff = lines.some((l) => l.startsWith("+++ ") || l.startsWith("@@"));
  const hits: LintHit[] = [];
  lines.forEach((raw, i) => {
    if (isDiff && !(raw.startsWith("+") && !raw.startsWith("+++"))) return;
    const flat = words(raw).join(" ");
    const lower = raw.toLowerCase();
    const seen = new Set<string>(); // overlapping word runs would otherwise report one copied sentence many times
    for (const f of forbidden) {
      const hay = f.kind === "instruction text" ? flat : lower;
      if (hay.includes(f.term) && !seen.has(f.kind)) {
        seen.add(f.kind);
        hits.push({ line: i + 1, kind: f.kind, term: f.heldout ? "(held-out)" : f.term });
      }
    }
  });
  return hits;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error("usage: node eval/patch-lint.ts <patch-or-text-file>");
    process.exit(1);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const hits = lintPatch(fs.readFileSync(file, "utf8"), forbiddenTerms(taskRoots(here)));
  if (hits.length) {
    for (const h of hits.slice(0, 20)) console.error(`line ${h.line}: mentions a ${h.kind}: ${h.term}`);
    console.error("rejected: a harness patch must be general, not tied to an eval task");
    process.exit(1);
  }
  console.log("ok: no task ids, fixture paths or instruction text in the patch");
}
