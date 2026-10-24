import fs from "node:fs";
import path from "node:path";
import { CFG } from "./config.js";
import { SKIP_DIRS, git, resolveInRepo, toPosix } from "./repo.js";
import { isDeniedRead, normRel } from "./taskfile.js";

/**
 * A short, deterministic orientation block added to every prompt so the model
 * spends its turns on the task, not on discovering the repo. Background only:
 * everything here can be re-read with tools, and none of it overrides the role's rules.
 *
 *   conventions  CONVENTIONS.md | AGENTS.md | .deepseek/context.md (first one found)
 *   project      name, engines, npm scripts
 *   tree         repo root + the directories the task may touch
 *   commits      last few commit subjects
 */

const CONVENTION_FILES = ["CONVENTIONS.md", "AGENTS.md", ".deepseek/context.md"];
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function conventions() {
  for (const f of CONVENTION_FILES) {
    try {
      const txt = fs.readFileSync(path.join(CFG.repo, f), "utf8").trim();
      if (txt) return `## Conventions (${f})\n${clip(txt, 2500)}`;
    } catch {
      /* not present */
    }
  }
  return "";
}

function project() {
  const lines = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(CFG.repo, "package.json"), "utf8"));
    if (pkg.name) lines.push(`name: ${pkg.name}${pkg.type ? ` (${pkg.type})` : ""}`);
    if (pkg.engines?.node) lines.push(`node: ${pkg.engines.node}`);
    for (const [k, v] of Object.entries(pkg.scripts || {}).slice(0, 12)) lines.push(`npm run ${k}: ${clip(String(v), 80)}`);
  } catch {
    /* no package.json */
  }
  for (const m of ["pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "tsconfig.json"]) {
    if (fs.existsSync(path.join(CFG.repo, m))) lines.push(`has ${m}`);
  }
  return lines.length ? `## Project\n${clip(lines.join("\n"), 800)}` : "";
}

function listFiles(dirRel, depth, limit, out) {
  let entries;
  try {
    entries = fs.readdirSync(resolveInRepo(dirRel), { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (out.length >= limit) return;
    if (SKIP_DIRS.has(e.name) || isDeniedRead(e.name)) continue;
    const p = toPosix(path.join(dirRel, e.name));
    if (e.isDirectory()) {
      if (depth > 1) listFiles(p, depth - 1, limit, out);
    } else out.push(p);
  }
}

/** Directory a glob points into: `src/auth/**` -> `src/auth`, `src/a*.js` -> `src`. */
function dirOf(glob) {
  const pre = normRel(glob).split(/[*?]/)[0];
  const dir = pre === "" || pre.endsWith("/") ? pre.replace(/\/$/, "") : path.posix.dirname(pre);
  return dir === "." ? "" : dir;
}

function tree(dirs) {
  const root = [];
  try {
    for (const e of fs.readdirSync(CFG.repo, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (SKIP_DIRS.has(e.name) || isDeniedRead(e.name)) continue;
      root.push(e.isDirectory() ? `${e.name}/` : e.name);
    }
  } catch {
    /* unreadable root */
  }
  const parts = [`root: ${root.slice(0, 40).join("  ")}`];
  const seen = new Set();
  for (const d of dirs) {
    if (!d || seen.has(d)) continue;
    seen.add(d);
    const files = [];
    listFiles(d, 3, 30, files);
    if (files.length) parts.push(`${d}/ (${files.length >= 30 ? "first 30 files" : `${files.length} files`}):\n${files.map((f) => `  ${f}`).join("\n")}`);
  }
  return `## Layout\n${clip(parts.join("\n"), 1800)}`;
}

function commits() {
  const r = git(["log", "--oneline", "-n", "5"]);
  return r.ok && r.out ? `## Recent commits\n${clip(r.out, 500)}` : "";
}

/** `scope`: the globs the role may write. `targetRel`: the file/dir the handoff points at. */
export function buildContextPack({ scope = [], targetRel = "" } = {}) {
  const budget = CFG.contextChars;
  if (!budget) return "";
  const dirs = scope.map(dirOf);
  if (targetRel && targetRel !== ".") {
    try {
      dirs.push(fs.statSync(resolveInRepo(targetRel)).isDirectory() ? targetRel : path.posix.dirname(targetRel));
    } catch {
      /* target doesn't exist yet */
    }
  }
  let out = "";
  // Stable material first (it is the same for every job, so the provider can cache it); volatile last.
  for (const section of [conventions(), project(), tree(dirs), commits()]) {
    if (!section) continue;
    if (out.length + section.length + 2 > budget) continue; // skip what doesn't fit, keep what does
    out += `${out ? "\n\n" : ""}${section}`;
  }
  return out;
}
