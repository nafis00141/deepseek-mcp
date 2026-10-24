import fs from "node:fs";
import path from "node:path";
import { CFG } from "./config.js";

/** Keys whose value is a list. Everything else is kept as one raw string. */
const LIST_KEYS = new Set(["allowed_paths", "depends_on"]);

const unquote = (s) => s.trim().replace(/^["']|["']$/g, "");

/**
 * Parse a task file. Frontmatter is intentionally dumb: `key: value` or
 * `key: [a, b]`. List keys (allowed_paths, depends_on) are split on commas;
 * every other key - notably test_command - is kept verbatim, commas included.
 */
export function readTask(file) {
  const abs = path.isAbsolute(file) ? file : path.resolve(CFG.repo, file);
  const raw = fs.readFileSync(abs, "utf8");
  const split = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  const fm = {};
  if (split) {
    for (const line of split[1].split(/\r?\n/)) {
      const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
      if (!kv) continue;
      const [, key, val] = kv;
      fm[key] = LIST_KEYS.has(key)
        ? val.replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean)
        : [unquote(val)].filter(Boolean);
    }
  }
  return {
    path: abs,
    rel: path.relative(CFG.repo, abs).replace(/\\/g, "/"),
    id: (fm.id && fm.id[0]) || path.basename(abs, ".md"),
    allowedPaths: fm.allowed_paths || [],
    dependsOn: fm.depends_on || [],
    testCommand: (fm.test_command && fm.test_command[0]) || "",
    body: (split ? split[2] : raw).trim(),
  };
}

/* ------------------------------------------------------------------- paths */

/** Repo-relative, forward-slash, no leading ./ or duplicate slashes. */
export function normRel(p) {
  return path.posix.normalize(String(p).replace(/\\/g, "/")).replace(/^(\.\/)+/, "").replace(/\/+$/, "");
}

const CI = process.platform === "win32" ? "i" : "";
const cache = new Map();

function globToRe(g) {
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
export function matchAny(file, globs) {
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
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i,
];

/** `denySpecs`: code roles may not touch specs/ either. */
export function isDeniedWrite(file, { denySpecs = false } = {}) {
  const f = normRel(file);
  if (DENY_WRITE.some((re) => re.test(f))) return true;
  return denySpecs && /^specs(\/|$)/i.test(f);
}

/** Never readable by the model: secrets and git internals. */
export function isDeniedRead(file) {
  const f = normRel(file);
  if (/^\.git(\/|$)/i.test(f)) return true;
  if (/(^|\/)\.env\.example$/i.test(f)) return false;
  return /(^|\/)\.env(\..*)?$/i.test(f);
}

/* ------------------------------------------------------------ scope rules */

/** A glob that names a test location (tests/**, test/**, **\/*.test.ts, ...). specs/ is NOT a test path. */
export const isTestGlob = (g) => /(^|\/)(tests?|__tests__)(\/|$)|\.(test|spec)\b/i.test(String(g).replace(/\\/g, "/"));

/** The globs a role may actually write. The `test` role is narrowed to test globs and fails closed. */
export function scopeFor(roleName, task) {
  const all = task?.allowedPaths ?? [];
  return roleName === "test" ? all.filter(isTestGlob) : all;
}

const staticPrefix = (g) => normRel(g).split(/[*?]/)[0];

/** Heuristic: do two globs claim overlapping territory? Compares literal prefixes. */
export function globsOverlap(a, b) {
  const pa = staticPrefix(a);
  const pb = staticPrefix(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

/** Problems with a declared scope; empty array = acceptable. */
export function scopeProblems(globs, { denySpecs = true } = {}) {
  if (!globs.length) return ["allowed_paths is empty"];
  const out = [];
  for (const g of globs) {
    const n = normRel(g);
    if (/^(\*+|\*\*\/\*+|\.)$/.test(n) || n === "") out.push(`"${g}" matches the whole repo`);
    else if (n.startsWith("..") || path.isAbsolute(n)) out.push(`"${g}" leaves the repo`);
    else if (isDeniedWrite(staticPrefix(g) || n, { denySpecs })) out.push(`"${g}" targets a protected location`);
  }
  return out;
}
