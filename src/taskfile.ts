import fs from "node:fs";
import path from "node:path";
import { CFG } from "./config.ts";

/** Keys whose value is a list. Everything else is kept as one raw string. */
const LIST_KEYS = new Set(["allowed_paths", "depends_on"]);

const unquote = (s: string): string => s.trim().replace(/^["']|["']$/g, "");

/**
 * Parse a task file. Frontmatter is intentionally dumb: `key: value` or
 * `key: [a, b]`. List keys (allowed_paths, depends_on) are split on commas;
 * every other key - notably test_command - is kept verbatim, commas included.
 */
export interface Task {
  path: string;
  rel: string;
  id: string;
  allowedPaths: string[];
  dependsOn: string[];
  testCommand: string;
  body: string;
}

export function readTask(file: string): Task {
  const abs = path.isAbsolute(file) ? file : path.resolve(CFG.repo, file);
  const raw = fs.readFileSync(abs, "utf8");
  const split = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  const fm: Record<string, string[]> = {};
  if (split) {
    for (const line of (split[1] as string).split(/\r?\n/)) {
      const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
      if (!kv) continue;
      const key = kv[1] as string;
      const val = kv[2] as string;
      fm[key] = LIST_KEYS.has(key)
        ? val.replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean)
        : [unquote(val)].filter(Boolean);
    }
  }
  return {
    path: abs,
    rel: path.relative(CFG.repo, abs).replace(/\\/g, "/"),
    id: fm.id?.[0] || path.basename(abs, ".md"),
    allowedPaths: fm.allowed_paths || [],
    dependsOn: fm.depends_on || [],
    testCommand: fm.test_command?.[0] || "",
    body: (split ? (split[2] as string) : raw).trim(),
  };
}

/* ------------------------------------------------------------------- paths */

/** Repo-relative, forward-slash, no leading ./ or duplicate slashes. */
export function normRel(p: string): string {
  return path.posix.normalize(String(p).replace(/\\/g, "/")).replace(/^(\.\/)+/, "").replace(/\/+$/, "");
}

const CI = process.platform === "win32" ? "i" : "";
const cache = new Map<string, RegExp>();

function globToRe(g: string): RegExp {
  const s = String(g).replace(/\\/g, "/").replace(/^\.\//, "");
  let re = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "*") {
      if (s[i + 1] === "*") {
        if (s[i + 2] === "/") {
          re += "(?:.*/)?"; // `**/` also matches zero directories
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, CI);
}

/** Glob match for `src/auth/**` style patterns. Empty list means unrestricted. */
export function matchAny(file: string, globs: readonly string[]): boolean {
  if (!globs.length) return true;
  const f = normRel(file);
  return globs.some((g) => {
    let re = cache.get(g);
    if (!re) cache.set(g, (re = globToRe(g)));
    return re.test(f);
  });
}

/* ------------------------------------------------------------- deny lists */

// Never writable by any role, whatever the task file says.
const DENY_WRITE = [
  /^\.git(\/|$)/i,
  /^\.github(\/|$)/i,
  /^\.claude(\/|$)/i,
  /^\.vscode(\/|$)/i,
  // Job records, prompts, traces and logs: a doc role has `specs/**` caps and must not be able to rewrite them.
  /^specs\/\.jobs(\/|$)/i,
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i,
];

/** `denySpecs`: code roles may not touch specs/ either. */
export function isDeniedWrite(file: string, { denySpecs = false }: { denySpecs?: boolean } = {}): boolean {
  const f = normRel(file);
  if (DENY_WRITE.some((re) => re.test(f))) return true;
  return denySpecs && /^specs(\/|$)/i.test(f);
}

/** Never readable by the model: secrets and git internals. */
export function isDeniedRead(file: string): boolean {
  const f = normRel(file);
  if (/^\.git(\/|$)/i.test(f)) return true;
  if (/(^|\/)\.env\.example$/i.test(f)) return false;
  return /(^|\/)\.env(\..*)?$/i.test(f);
}

/* ------------------------------------------------------------ scope rules */

/** A glob that names a test location (tests/**, test/**, **\/*.test.ts, ...). specs/ is NOT a test path. */
export const isTestGlob = (g: string): boolean => /(^|\/)(tests?|__tests__)(\/|$)|\.(test|spec)\b/i.test(String(g).replace(/\\/g, "/"));

/* --------------------------------------------------- free-form (`do`) jobs: no task file */

/** An in-memory task for a `do` job: scope and test command come from the call, the instruction is the body. */
export function syntheticTask(p: { rel: string; paths: string[]; testCommand: string; body: string }): Task {
  return { path: "", rel: p.rel, id: "do", allowedPaths: p.paths.map(normRel), dependsOn: [], testCommand: p.testCommand.trim(), body: p.body.trim() };
}

/**
 * Problems with the `paths` of a `do` call, found before any model call. On top of the task-file rules (not empty, not catch-all,
 * no protected location, does not leave the repo) every glob needs a literal folder before its first wildcard: `src/lib/**` and
 * `src/util.js` are fine, `**` + `/*.ts`, `*.js` and `src*` + `/x` are not, because they would let a free-form job reach and edit
 * the tests that decide its own result.
 */
export function doScopeProblems(paths: readonly string[] | undefined): string[] {
  if (!paths || !paths.length) return ["paths is required for role=do (a list of globs the job may change)"];
  const out = scopeProblems(paths);
  for (const g of paths) {
    const n = normRel(g);
    const wildcard = n.search(/[*?]/);
    if (wildcard >= 0 && !n.slice(0, wildcard).includes("/")) out.push(`"${g}" has no literal folder before its wildcard (use src/lib/** rather than **/*.ts)`);
  }
  return out;
}

/** The only test commands a `do` job may declare: `npm test`, `npm run <script>`, or `node --test <explicit paths>`. */
export function doTestCommandProblem(cmd: string | undefined): string | null {
  const c = String(cmd ?? "").trim();
  if (!c) return "test_command is required for role=do";
  if (/^npm test$/.test(c) || /^npm run [\w:.-]+$/.test(c) || /^node --test(?: [\w./\\:-]+)+$/.test(c)) return null;
  return `test_command "${c}" is not allowed for role=do: use "npm test", "npm run <script>" or "node --test <paths>" (explicit paths, no globs or shell syntax)`;
}

/** The globs a role may actually write. The `test` role is narrowed to test globs and fails closed. */
export function scopeFor(roleName: string, task: Pick<Task, "allowedPaths"> | null | undefined): string[] {
  const all = task?.allowedPaths ?? [];
  return roleName === "test" ? all.filter(isTestGlob) : all;
}

const staticPrefix = (g: string): string => normRel(g).split(/[*?]/)[0] ?? "";

/** Heuristic: do two globs claim overlapping territory? Compares literal prefixes. */
export function globsOverlap(a: string, b: string): boolean {
  const pa = staticPrefix(a);
  const pb = staticPrefix(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

/** Problems with a declared scope; empty array = acceptable. */
export function scopeProblems(globs: readonly string[], { denySpecs = true }: { denySpecs?: boolean } = {}): string[] {
  if (!globs.length) return ["allowed_paths is empty"];
  const out: string[] = [];
  for (const g of globs) {
    const n = normRel(g);
    if (/^(\*+|\*\*\/\*+|\.)$/.test(n) || n === "") out.push(`"${g}" matches the whole repo`);
    else if (n.startsWith("..") || path.isAbsolute(n)) out.push(`"${g}" leaves the repo`);
    else if (isDeniedWrite(staticPrefix(g) || n, { denySpecs })) out.push(`"${g}" targets a protected location`);
  }
  return out;
}
