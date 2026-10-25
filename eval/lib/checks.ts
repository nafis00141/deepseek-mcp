/**
 * Hidden checks. They run after the job, never modify the job repo, and read results from git or from
 * the recorded step results. Code tests run in a throwaway worktree of the result branch tip.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { allowlistEnv, runProc } from "./proc.ts";
import { removeDir } from "./fixture.ts";
import type { CheckDef, CheckResult, StepResult } from "./types.ts";

export interface CheckCtx {
  repo: string;
  gitBin: string;
  /** <task.dir>/hidden, may not exist */
  hiddenDir: string;
  steps: StepResult[];
}

const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

async function git(ctx: CheckCtx, args: string[]): Promise<{ ok: boolean; out: string }> {
  const r = await runProc(ctx.gitBin, args, { cwd: ctx.repo, env: allowlistEnv({ GIT_BIN: ctx.gitBin }), timeoutMs: 60000 });
  return { ok: r.code === 0, out: r.out.trim() };
}

/** The branch the last step that made one ended on, if it still exists. */
async function resultBranch(ctx: CheckCtx): Promise<string | null> {
  for (const s of [...ctx.steps].reverse()) {
    const b = s.result.branch;
    if (typeof b === "string" && b && (await git(ctx, ["rev-parse", "--verify", "-q", b])).ok) return b;
  }
  return null;
}

const stepOf = (ctx: CheckCtx, n: unknown): StepResult | undefined => (typeof n === "number" ? ctx.steps[n - 1] : ctx.steps[ctx.steps.length - 1]);

/** File text at `ref: "branch"` (the result branch tip, else HEAD) or `"work"` (the working tree on disk). */
async function readAt(ctx: CheckCtx, ref: string, file: string): Promise<string | null> {
  if (ref === "work") {
    try {
      return fs.readFileSync(path.join(ctx.repo, file), "utf8");
    } catch {
      return null;
    }
  }
  const r = await git(ctx, ["show", `${(await resultBranch(ctx)) ?? "HEAD"}:${file}`]);
  return r.ok ? r.out : null;
}

const refOf = (c: CheckDef, ctx: CheckCtx): string => str(c.ref) || (ctx.steps.some((s) => typeof s.result.branch === "string") ? "branch" : "work");

type Outcome = { pass: boolean; detail: string };
const ok = (detail: string): Outcome => ({ pass: true, detail });
const bad = (detail: string): Outcome => ({ pass: false, detail });

const RUNNERS: Record<string, (c: CheckDef, ctx: CheckCtx) => Promise<Outcome>> = {
  /** No tracked or untracked change outside specs/.jobs and specs/review. */
  async tree_clean(_c, ctx) {
    const r = await git(ctx, ["status", "--porcelain", "-uall"]);
    const dirty = r.out.split(/\r?\n/).filter((l) => l && !/ "?specs\/(\.jobs|review)\//.test(l));
    return dirty.length ? bad(`dirty: ${dirty.slice(0, 5).join(" | ")}`) : ok("clean");
  },
  /** Doc roles: files changed in the working tree under a path prefix (default specs/). */
  async only_changed_under(c, ctx) {
    const prefix = str(c.prefix, "specs/");
    const r = await git(ctx, ["status", "--porcelain", "-uall"]);
    const outside = r.out.split(/\r?\n/).filter(Boolean).map((l) => l.replace(/^[ MADRCU?!]{1,2} /, "").replace(/"/g, "")).filter((f) => !f.startsWith(prefix));
    return outside.length ? bad(`changed outside ${prefix}: ${outside.slice(0, 5).join(", ")}`) : ok(`all changes under ${prefix}`);
  },
  /** Commits on the result branch beyond the base branch. */
  async commit_count(c, ctx) {
    const b = await resultBranch(ctx);
    const n = b ? Number((await git(ctx, ["rev-list", "--count", `${str(c.base, "main")}..${b}`])).out) : 0;
    const want = num(c.equals);
    return want !== undefined ? (n === want ? ok(`${n} commit(s)`) : bad(`${n} commit(s), expected ${want}`)) : ok(`${n} commit(s)`);
  },
  /** The job left no commit and no branch with work on it. */
  async no_commit(c, ctx) {
    const b = await resultBranch(ctx);
    if (!b) return ok("no work branch");
    const n = Number((await git(ctx, ["rev-list", "--count", `${str(c.base, "main")}..${b}`])).out);
    return n === 0 ? ok("branch has no commits") : bad(`${b} has ${n} commit(s)`);
  },
  async file_contains(c, ctx) {
    const txt = await readAt(ctx, refOf(c, ctx), str(c.path));
    if (txt === null) return bad(`${str(c.path)} not found`);
    return new RegExp(str(c.pattern), str(c.flags, "i")).test(txt) ? ok(`matches /${str(c.pattern)}/`) : bad(`${str(c.path)} does not match /${str(c.pattern)}/`);
  },
  async file_not_contains(c, ctx) {
    const txt = await readAt(ctx, refOf(c, ctx), str(c.path));
    if (txt === null) return bad(`${str(c.path)} not found`);
    return new RegExp(str(c.pattern), str(c.flags, "i")).test(txt) ? bad(`${str(c.path)} matches forbidden /${str(c.pattern)}/`) : ok("absent");
  },
  /** Files directly under `dir` whose name matches `regex`, counted in the working tree. */
  async file_count(c, ctx) {
    let names: string[] = [];
    try {
      names = fs.readdirSync(path.join(ctx.repo, str(c.dir))).filter((n) => new RegExp(str(c.regex, ".*")).test(n));
    } catch {
      /* missing dir counts as 0 */
    }
    const lo = num(c.min) ?? 0;
    const hi = num(c.max) ?? Infinity;
    return names.length >= lo && names.length <= hi ? ok(`${names.length} file(s)`) : bad(`${names.length} file(s), wanted ${lo}..${hi === Infinity ? "any" : hi}`);
  },
  /** Some file directly under `dir` whose name matches `name_pattern` has content matching `pattern` (working tree). */
  async dir_file_contains(c, ctx) {
    let names: string[] = [];
    try {
      names = fs.readdirSync(path.join(ctx.repo, str(c.dir))).filter((n) => new RegExp(str(c.name_pattern, ".*")).test(n));
    } catch {
      /* missing dir */
    }
    const re = new RegExp(str(c.pattern), str(c.flags, "i"));
    const hit = names.find((n) => re.test(fs.readFileSync(path.join(ctx.repo, str(c.dir), n), "utf8")));
    return hit ? ok(`${hit} matches /${str(c.pattern)}/`) : bad(`none of [${names.join(", ")}] matches /${str(c.pattern)}/`);
  },
  async result_field(c, ctx) {
    const s = stepOf(ctx, c.step);
    if (!s) return bad("no such step");
    let v: unknown = s.result;
    for (const k of str(c.path).split(".")) v = (v as Record<string, unknown> | undefined)?.[k];
    if (c.equals !== undefined) return JSON.stringify(v) === JSON.stringify(c.equals) ? ok(`${str(c.path)} = ${JSON.stringify(v)}`) : bad(`${str(c.path)} = ${JSON.stringify(v)}, expected ${JSON.stringify(c.equals)}`);
    if (c.matches !== undefined) return new RegExp(str(c.matches), "i").test(String(v ?? "")) ? ok("matches") : bad(`${str(c.path)} = ${JSON.stringify(v)}`);
    return bad("result_field needs equals or matches");
  },
  async verdict_is(c, ctx) {
    const v = String(stepOf(ctx, c.step)?.result.verdict ?? "");
    return v.toUpperCase() === str(c.value).toUpperCase() ? ok(`verdict ${v}`) : bad(`verdict ${v || "(none)"}, expected ${str(c.value)}`);
  },
  /**
   * Every `path:line` citation in a document resolves in the fixture repo, a backticked quote after a citation is on its line,
   * and there are at least `min` distinct ones (1 when the document has a `NOT FOUND:` line). Written here, not borrowed from
   * the server's own gate: a hidden check must not depend on the code it is checking.
   */
  async citations_resolve(c, ctx) {
    const txt = await readAt(ctx, str(c.ref, "work"), str(c.path));
    if (txt === null) return bad(`${str(c.path)} not found`);
    const re = /(?<![\w/.:@\\-])([A-Za-z0-9_@.\-/\\]+\.[A-Za-z][A-Za-z0-9]{0,7}):(\d+)(?:-(\d+))?/g;
    const distinct = new Set<string>();
    const unresolved: string[] = [];
    const wrongQuote: string[] = [];
    for (const m of txt.matchAll(re)) {
      const file = String(m[1]).replace(/\\/g, "/").replace(/^\.\//, "");
      const start = Number(m[2]);
      const end = m[3] ? Number(m[3]) : start;
      const cite = `${file}:${start}${m[3] ? `-${end}` : ""}`;
      let lines: string[] | null = null;
      try {
        const abs = path.resolve(ctx.repo, file);
        if (abs.startsWith(path.resolve(ctx.repo) + path.sep) && fs.statSync(abs).isFile()) {
          lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
          if (lines[lines.length - 1] === "") lines.pop();
        }
      } catch {
        lines = null;
      }
      if (!lines || start < 1 || end < start || end > lines.length) {
        if (!unresolved.includes(cite)) unresolved.push(cite);
        continue;
      }
      distinct.add(cite);
      const tail = txt.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 400);
      const quote = /^`?\s*(?:[-–—:]\s*)?`([^`\n]{1,300})`/.exec(tail)?.[1];
      const squash = (s: string): string => s.replace(/\s+/g, " ").trim();
      if (quote && !squash(lines.slice(start - 1, end).join(" ")).includes(squash(quote)) && !wrongQuote.includes(cite)) wrongQuote.push(cite);
    }
    const notFound = /^\s*(?:[-*>]\s*)?(?:\*\*)?NOT FOUND:/im.test(txt);
    const need = notFound ? 1 : num(c.min) ?? 3;
    if (unresolved.length) return bad(`unresolved: ${unresolved.slice(0, 4).join(", ")}`);
    if (wrongQuote.length) return bad(`quote not on the cited line: ${wrongQuote.slice(0, 4).join(", ")}`);
    return distinct.size >= need ? ok(`${distinct.size} distinct citation(s) resolve`) : bad(`${distinct.size} distinct citation(s), need ${need}`);
  },
  /** A finding in the saved review file (the full list, not the 12 the job result keeps) whose file and text match. */
  async review_finding(c, ctx) {
    const p = stepOf(ctx, c.step)?.result.review_path;
    if (typeof p !== "string") return bad("step produced no review file");
    const txt = await readAt(ctx, "work", p);
    const block = txt ? /```json\s*([\s\S]*?)```/.exec(txt)?.[1] : undefined;
    if (!block) return bad("review file has no json block");
    let findings: Record<string, unknown>[] = [];
    try {
      const f = (JSON.parse(block) as { findings?: unknown }).findings;
      findings = Array.isArray(f) ? f.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];
    } catch {
      return bad("review json does not parse");
    }
    const fileRe = new RegExp(str(c.file_pattern, "."), "i");
    const textRe = new RegExp(str(c.issue_pattern, "."), "i");
    const hit = findings.find((f) => fileRe.test(String(f.file ?? "")) && textRe.test(`${String(f.issue ?? "")} ${String(f.fix ?? "")}`));
    return hit ? ok(`finding ${String(hit.id ?? "?")} in ${String(hit.file)}`) : bad(`no finding matching file /${str(c.file_pattern)}/ and /${str(c.issue_pattern)}/ among ${findings.length}`);
  },
  async answer_matches(c, ctx) {
    const a = String(stepOf(ctx, c.step)?.result.answer ?? "");
    return new RegExp(str(c.pattern), str(c.flags, "i")).test(a) ? ok(`answer matches /${str(c.pattern)}/`) : bad(`answer does not match /${str(c.pattern)}/`);
  },
  async answer_not_matches(c, ctx) {
    const a = String(stepOf(ctx, c.step)?.result.answer ?? "");
    return new RegExp(str(c.pattern), str(c.flags, "i")).test(a) ? bad(`answer matches forbidden /${str(c.pattern)}/`) : ok("absent");
  },
  /** The answer cites `file` (optionally at a line within `tolerance` of `line`). */
  async answer_cites(c, ctx) {
    const a = String(stepOf(ctx, c.step)?.result.answer ?? "");
    const file = str(c.file).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (typeof c.line !== "number") return new RegExp(file, "i").test(a) ? ok(`cites ${str(c.file)}`) : bad(`no citation of ${str(c.file)}`);
    const tol = num(c.tolerance) ?? 2;
    const lines = [...a.matchAll(new RegExp(`${file}[:#L ]+(\\d+)`, "gi"))].map((m) => Number(m[1]));
    return lines.some((n) => Math.abs(n - (c.line as number)) <= tol) ? ok(`cites ${str(c.file)}:${(c.line as number)}±${tol}`) : bad(`cited lines [${lines.join(",")}] for ${str(c.file)}, wanted ${c.line}±${tol}`);
  },
  /** Every line ending in the file is CRLF (or LF): an edit must not leave a mixed or converted file. */
  async file_eol(c, ctx) {
    const txt = await readAt(ctx, refOf(c, ctx), str(c.path));
    if (txt === null) return bad(`${str(c.path)} not found`);
    const crlf = (txt.match(/\r\n/g) || []).length;
    const lf = (txt.match(/\n/g) || []).length - crlf;
    const want = str(c.eol, "crlf");
    return want === "crlf" ? (crlf > 0 && lf === 0 ? ok(`all ${crlf} line endings are CRLF`) : bad(`${crlf} CRLF and ${lf} bare LF line endings`)) : lf > 0 && crlf === 0 ? ok(`all ${lf} line endings are LF`) : bad(`${crlf} CRLF and ${lf} bare LF line endings`);
  },
  /** Number of matches of `pattern` in a file, within min..max. */
  async file_pattern_count(c, ctx) {
    const txt = await readAt(ctx, refOf(c, ctx), str(c.path));
    if (txt === null) return bad(`${str(c.path)} not found`);
    const n = (txt.match(new RegExp(str(c.pattern), str(c.flags, "g"))) || []).length;
    const lo = num(c.min) ?? 0;
    const hi = num(c.max) ?? Infinity;
    return n >= lo && n <= hi ? ok(`${n} match(es)`) : bad(`${n} match(es) of /${str(c.pattern)}/, wanted ${lo}..${hi === Infinity ? "any" : hi}`);
  },
  /** Count of trace events of one type in a step's trace.jsonl, within min..max. */
  async trace_event(c, ctx) {
    const s = stepOf(ctx, c.step);
    if (!s?.job_id) return bad("step has no job id");
    let lines: string[] = [];
    try {
      lines = fs.readFileSync(path.join(ctx.repo, "specs", ".jobs", `${s.job_id}.trace.jsonl`), "utf8").split(/\r?\n/).filter(Boolean);
    } catch {
      return bad("no trace file");
    }
    const n = lines.filter((l) => {
      try {
        return (JSON.parse(l) as { type?: string }).type === str(c.event);
      } catch {
        return false;
      }
    }).length;
    const lo = num(c.min) ?? 0;
    const hi = num(c.max) ?? Infinity;
    return n >= lo && n <= hi ? ok(`${n} ${str(c.event)} event(s)`) : bad(`${n} ${str(c.event)} event(s), wanted ${lo}..${hi === Infinity ? "any" : hi}`);
  },
  /** Everything the result branch changed relative to the base lies under `prefix` (e.g. a tests-only job). */
  async diff_only_under(c, ctx) {
    const b = await resultBranch(ctx);
    if (!b) return bad("no result branch");
    const files = (await git(ctx, ["diff", "--name-only", `${str(c.base, "main")}..${b}`])).out.split(/\r?\n/).filter(Boolean);
    const outside = files.filter((f) => !f.startsWith(str(c.prefix)));
    return !files.length ? bad("branch changed nothing") : outside.length ? bad(`changed outside ${str(c.prefix)}: ${outside.slice(0, 5).join(", ")}`) : ok(`${files.length} file(s), all under ${str(c.prefix)}`);
  },
  /**
   * Tests written by the job must pass on the original code and fail on every mutant (a broken copy of a source file,
   * kept in hidden/). Run in a throwaway worktree of the result branch tip.
   */
  async mutants_killed(c, ctx) {
    const b = await resultBranch(ctx);
    if (!b) return bad("no result branch");
    const tests = (await git(ctx, ["diff", "--name-only", `${str(c.base, "main")}..${b}`])).out.split(/\r?\n/).filter((f) => /^tests?\//.test(f));
    if (!tests.length) return bad("the job added no test files");
    const mutants = Array.isArray(c.mutants) ? (c.mutants as { file: string; from: string }[]) : [];
    const wt = path.join(fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-mu-"))), "wt");
    const add = await git(ctx, ["worktree", "add", "--detach", wt, b]);
    if (!add.ok) return bad(`worktree failed: ${add.out.slice(0, 200)}`);
    try {
      const run = () => runProc(process.execPath, ["--test", ...tests], { cwd: wt, env: allowlistEnv(), timeoutMs: 60000 });
      if ((await run()).code !== 0) return bad("the new tests fail on the original code");
      const survivors: string[] = [];
      for (const m of mutants) {
        const target = path.join(wt, m.file);
        const original = fs.readFileSync(target);
        fs.copyFileSync(path.join(ctx.hiddenDir, m.from), target);
        if ((await run()).code === 0) survivors.push(m.from);
        fs.writeFileSync(target, original);
      }
      return survivors.length ? bad(`${survivors.length}/${mutants.length} mutant(s) survived: ${survivors.join(", ")}`) : ok(`all ${mutants.length} mutants killed`);
    } finally {
      await git(ctx, ["worktree", "remove", "--force", wt]);
      removeDir(path.dirname(wt));
      await git(ctx, ["worktree", "prune"]);
    }
  },
  /** `node --test` on hidden files, run in a throwaway worktree of the result branch tip (or HEAD). */
  async node_test(c, ctx) {
    if (!fs.existsSync(ctx.hiddenDir)) return bad("task has no hidden/ folder");
    const ref = (await resultBranch(ctx)) ?? "HEAD";
    const wt = path.join(fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-wt-"))), "wt");
    const add = await git(ctx, ["worktree", "add", "--detach", wt, ref]);
    if (!add.ok) return bad(`worktree failed: ${add.out.slice(0, 200)}`);
    try {
      fs.cpSync(ctx.hiddenDir, wt, { recursive: true });
      const files = (Array.isArray(c.files) ? (c.files as string[]) : []).map(String);
      const r = await runProc(process.execPath, ["--test", ...files], { cwd: wt, env: allowlistEnv(), timeoutMs: (num(c.timeout_s) ?? 120) * 1000 });
      const tail = r.out.split(/\r?\n/).slice(-6).join(" | ").slice(0, 300);
      return r.timedOut ? bad("hidden tests timed out") : r.code === 0 ? ok("hidden tests pass") : bad(`hidden tests failed: ${tail}`);
    } finally {
      await git(ctx, ["worktree", "remove", "--force", wt]);
      removeDir(path.dirname(wt));
      await git(ctx, ["worktree", "prune"]);
    }
  },
};

export const CHECK_TYPES = Object.keys(RUNNERS);

export async function runChecks(defs: CheckDef[], ctx: CheckCtx): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  for (const [i, c] of defs.entries()) {
    const fn = RUNNERS[c.type];
    let r: Outcome;
    const gate = ctx.steps[ctx.steps.length - 1]?.status ?? "";
    try {
      r = c.only_if_gate && !c.only_if_gate.includes(gate) ? ok(`skipped (gate was "${gate}")`) : fn ? await fn(c, ctx) : bad(`unknown check type "${c.type}"`);
    } catch (e) {
      r = bad(`check crashed: ${(e as Error).message.slice(0, 200)}`);
    }
    out.push({ name: c.name ?? `${c.type}#${i + 1}`, type: c.type, pass: r.pass, detail: r.detail, compliance: Boolean(c.compliance) });
  }
  return out;
}
