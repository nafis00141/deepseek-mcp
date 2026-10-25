import fs from "node:fs";
import path from "node:path";
import { CFG } from "./config.ts";
import { changedFiles, commitsBetween, diffFilesAgainst, diffFilesBetween, diffSize, parseSummary, rel, resolveInRepo, runCmd, snapshot, toPosix } from "./repo.ts";
import { globsOverlap, isDeniedRead, isDeniedWrite, matchAny, normRel, readTask, scopeFor, scopeProblems } from "./taskfile.ts";
import type { Task } from "./taskfile.ts";
import type { VerifyProblem } from "./engine.ts";
import type { ExecResult, Job, JobResult } from "./types.ts";

const stamp = (): string => new Date().toISOString().replace(/\.\d+Z$/, "").replace(/[-:]/g, "").replace("T", "-");
const clip = (s: string, n = 1400): string => (s.length > n ? s.slice(0, n) + "\n..." : s);

/** The model says it cannot do the task: `SPEC_GAP: ...` / `BLOCKED: ...` at the start of a line. */
export const GAP_RE = /^\s*(?:SPEC_GAP|BLOCKED)\s*:\s*(.+)$/m;

const lines = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).map((x) => clip(String(x), 160)).slice(0, 5);

/** Entries of a model-supplied list that are objects; anything else is ignored rather than trusted. */
const records = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : []);

/** The small "what it did / what it couldn't" block returned to Claude: the model's own account plus the harness's repair log. */
export function report(res: Pick<ExecResult, "summary" | "repairs"> | null | undefined): Record<string, unknown> | null {
  const s = res?.summary;
  const repairs = (res?.repairs || []).map((r) => r.why);
  if (!s && !repairs.length) return null;
  return { status: s?.status ?? null, did: lines(s?.did ?? s?.bullets), not_done: lines(s?.not_done), notes: clip(String(s?.notes ?? ""), 240), repairs };
}

/**
 * Self-check run inside the job when the model says it is finished. Returning a problem sends it
 * back to the model (see runAgent) instead of failing the job and costing Claude a round trip.
 */
export function makeVerifier(mode: string, task: Task | null | undefined): ((text: string) => Promise<VerifyProblem | null>) | null {
  if (mode === "text") return null;
  return async (text: string): Promise<VerifyProblem | null> => {
    if (GAP_RE.test(text)) return null; // an honest "can't" is not repaired
    const summary = parseSummary(text);
    if (mode === "review") {
      if (typeof summary?.verdict !== "string") {
        return {
          why: summary ? "review json has no verdict" : "no review json",
          message: 'Your last message did not end with the review result. Reply again with ONLY one fenced json block of the form {"verdict":"PASS|FAIL","criteria":[{"id":"AC-1","status":"met|not met|not verified"}],"findings":[{"id":"F1","severity":"blocker|major|minor","file":"...","line":"...","issue":"...","fix":"..."}],"scope_creep":[]}.',
        };
      }
    } else if (!summary) {
      return { why: "no summary json", message: "Your last message had no closing fenced json block. Reply again with only that summary block, in the format given at the top of the task." };
    }
    if (mode === "code" && task?.testCommand) {
      const r = await runCmd(task.testCommand);
      if (!r.pass) {
        const tail = r.out.split(/\r?\n/).filter(Boolean).slice(-40).join("\n");
        const last = tail.split("\n").pop() || "exited non-zero with no output";
        return {
          why: `tests failed: ${clip(last, 100)}`,
          message: `The harness just ran \`${task.testCommand}\` and it FAILED.\n\n${clip(tail, 3000)}\n\nFix the code so it passes (only inside your allowed paths), confirm with run_tests, then finish again with the summary block. If it cannot be fixed, set status to "partial" and say why in not_done.`,
        };
      }
    }
    return null;
  };
}

/** `npm test` / `npm run x` must exist in package.json; other commands are not second-guessed. */
function testCommandProblem(cmd: string): string | null {
  const m = /^npm\s+(?:run\s+(\S+)|(test))\b/.exec(cmd.trim());
  if (!m) return null;
  try {
    const scripts = (JSON.parse(fs.readFileSync(path.join(CFG.repo, "package.json"), "utf8")) as { scripts?: Record<string, unknown> }).scripts || {};
    const name = m[1] || "test";
    return scripts[name] ? null : `test_command uses npm script "${name}" which package.json does not define`;
  } catch {
    return "test_command uses npm but package.json is unreadable";
  }
}

/* ------------------------------------------------------------------ citations */

export interface Citations {
  /** every path:line citation found, counting repeats */
  total: number;
  /** distinct citations that resolve to a real line */
  distinct: number;
  resolved: string[];
  unresolved: { cite: string; why: string }[];
  /** citations followed by a backticked quote that is not on the cited line(s) */
  quote_mismatches: string[];
  /** the document says, with a `NOT FOUND:` line, that the answer is not in the repository */
  not_found: boolean;
}

// path:line or path:start-end. Not preceded by a path character, so a URL's tail or a longer path is not matched mid-way.
const CITE_RE = /(?<![\w/.:@\\-])([A-Za-z0-9_@.\-/\\]+\.[A-Za-z][A-Za-z0-9]{0,7}):(\d+)(?:-(\d+))?/g;
// a quote straight after the citation: optional closing backtick, then an optional separator, then `quote`
const QUOTE_AFTER = /^`?\s*(?:[-–—:]\s*)?`([^`\n]{1,300})`/;
const squash = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Check every `path:line` citation in a research document: the file exists in the repo, may be read, and the line (or range)
 * is inside it; a backticked quote right after a citation must occur on the cited line(s). Repeating a citation does not add
 * to the distinct count. Nothing here judges whether a citation *supports* a claim; that gap is named in the spec.
 */
export function citationProblems(text: string): Citations {
  const resolvedLines = new Map<string, string> (); // cite -> the cited text, squashed; resolved once per distinct citation
  const failed = new Set<string>();
  const unresolved: { cite: string; why: string }[] = [];
  const mismatches = new Set<string>();
  let total = 0;
  for (const m of text.matchAll(CITE_RE)) {
    total++;
    const file = toPosix(m[1] as string).replace(/^\.\//, "");
    const start = Number(m[2]);
    const end = m[3] ? Number(m[3]) : start;
    const cite = `${file}:${start}${m[3] ? `-${end}` : ""}`;
    if (failed.has(cite)) continue;
    if (!resolvedLines.has(cite)) {
      const problem = ((): string | { cited: string } => {
        try {
          const abs = resolveInRepo(file);
          if (isDeniedRead(rel(abs))) return "not readable";
          if (!fs.statSync(abs).isFile()) return "not a file";
          const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
          if (lines[lines.length - 1] === "") lines.pop();
          if (start < 1 || end < start || end > lines.length) return `line outside the file (${lines.length} lines)`;
          return { cited: squash(lines.slice(start - 1, end).join(" ")) };
        } catch (e) {
          return /ENOENT/.test((e as Error).message) ? "no such file" : (e as Error).message.slice(0, 60);
        }
      })();
      if (typeof problem === "string") {
        failed.add(cite);
        unresolved.push({ cite, why: problem });
        continue;
      }
      resolvedLines.set(cite, problem.cited);
    }
    // Every occurrence is checked, not only the first: a citation first used bare and later given a wrong quote must still fail.
    const quote = QUOTE_AFTER.exec(text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 400))?.[1];
    if (quote && !(resolvedLines.get(cite) as string).includes(squash(quote))) mismatches.add(cite);
  }
  return { total, distinct: resolvedLines.size, resolved: [...resolvedLines.keys()], unresolved, quote_mismatches: [...mismatches], not_found: /^\s*(?:[-*>]\s*)?(?:\*\*)?NOT FOUND:/im.test(text) };
}

/** What a research document must show: at least 3 distinct resolving citations (1 when it honestly reports NOT FOUND), none unresolved, no wrong quote. */
function citationReasons(c: Citations): string[] {
  const out: string[] = [];
  const need = c.not_found ? 1 : 3;
  if (c.unresolved.length) out.push(`unresolved citation(s): ${c.unresolved.slice(0, 5).map((u) => `${u.cite} (${u.why})`).join(", ")}${c.unresolved.length > 5 ? ", ..." : ""}`);
  if (c.quote_mismatches.length) out.push(`quote not on the cited line: ${c.quote_mismatches.slice(0, 5).join(", ")}`);
  if (c.distinct < need) out.push(`only ${c.distinct} distinct resolving citation(s); need at least ${need}${c.not_found ? " (the document says NOT FOUND)" : ""}`);
  return out;
}

/** spec / plan / tasks / research: docs only, judged by artifact shape. */
function docGate(job: Job, res: ExecResult | null): JobResult {
  const reasons: string[] = [];
  if (!res) reasons.push("no result from the model");
  else {
    if (res.isError) reasons.push(`model error: ${res.error}`);
    if (res.gap) reasons.push(`model reported BLOCKED: ${res.gap}`);
    else if (res.summary?.status === "blocked") reasons.push("model reported status=blocked");
    if (!res.summary) reasons.push("final message had no parsable summary JSON");
  }

  const all = changedFiles();
  // "fresh" = new, or touched since the job started (an overwritten, already-dirty file counts).
  const now = snapshot();
  const before = job.startedChanges || {};
  const fresh = all.filter((c) => now[c.file] !== before[c.file]);
  const outside = all.filter((c) => !c.file.startsWith("specs/"));

  if (outside.length) reasons.push(`touched files outside specs/: ${outside.map((c) => c.file).slice(0, 5).join(", ")}`);
  if (!fresh.length) reasons.push("no files were written");

  let artifact: string | null = null;
  let preview = "";
  let citations: Citations | null = null;
  const missing: string[] = [];

  if (job.mode === "doc" && job.artifact === "tasks/") {
    const made = fresh.filter((c) => /(^|\/)tasks\/\d+[^/]*\.md$/.test(toPosix(c.file)));
    if (!made.length) reasons.push("no tasks/NN-*.md files were created");
    const parsed: Task[] = [];
    for (const m of made) {
      let txt = "";
      let t: Task | undefined;
      try {
        txt = fs.readFileSync(path.join(CFG.repo, m.file), "utf8");
        t = readTask(m.file);
      } catch {
        continue;
      }
      if (!t) continue;
      parsed.push(t);
      for (const prob of scopeProblems(t.allowedPaths)) reasons.push(`${m.file}: ${prob}`);
      if (!t.testCommand) reasons.push(`${m.file}: missing test_command frontmatter`);
      else {
        const bad = testCommandProblem(t.testCommand);
        if (bad) reasons.push(`${m.file}: ${bad}`);
      }
      if (!/##\s+Acceptance criteria/i.test(txt)) reasons.push(`${m.file}: missing acceptance criteria`);
      if (!preview) preview = clip(txt);
    }
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const hit = parsed[i].allowedPaths.find((a) => parsed[j].allowedPaths.some((b) => globsOverlap(a, b)));
        if (hit) reasons.push(`tasks ${parsed[i].id} and ${parsed[j].id} overlap in allowed_paths (${hit})`);
      }
    }
    artifact = made[0]?.file ?? null;
  } else if (job.artifact) {
    const p = `${job.targetRel}/${job.artifact}`;
    const abs = path.join(CFG.repo, p);
    if (!fs.existsSync(abs)) reasons.push(`expected artifact not created: ${p}`);
    else {
      const txt = fs.readFileSync(abs, "utf8");
      for (const h of job.headings || []) if (!txt.includes(h)) missing.push(h);
      if (missing.length) reasons.push(`missing sections: ${missing.join(", ")}`);
      const minChars = job.role === "research" ? 400 : 200;
      if (txt.length < minChars) reasons.push(`artifact suspiciously short (${txt.length} bytes; need ${minChars})`);
      if (job.role === "research") {
        citations = citationProblems(txt);
        reasons.push(...citationReasons(citations));
      }
      artifact = p;
      preview = clip(txt);
    }
  }

  return { status: reasons.length ? "failed" : "done", reasons, infra: Boolean(res?.isError), artifact, missing_sections: missing, preview, report: report(res), turns: res?.turns ?? null, ...(citations ? { citations } : {}) };
}

/** impl / fix / test: code, judged by the repo itself. */
async function codeGate(job: Job, res: ExecResult | null): Promise<JobResult> {
  const task = readTask(job.targetRel);
  const scope = scopeFor(job.role, task);
  const files = diffFilesBetween(job.startedSha);
  const commits = commitsBetween(job.startedSha);
  const { added, removed } = diffSize(job.startedSha);
  const before = new Set(Object.keys(job.startedChanges || {}));
  const outside = changedFiles().filter((c) => !before.has(c.file) && !matchAny(c.file, scope));
  const badCommitted = files.filter((f) => !matchAny(f, scope) || isDeniedWrite(f, { denySpecs: true }));
  const tests: { pass: boolean; out: string } = task.testCommand ? await runCmd(task.testCommand) : { pass: false, out: "(no test_command declared)" };

  const reasons: string[] = [];
  if (!res) reasons.push("no result from the model");
  else {
    if (res.isError) reasons.push(`model error: ${res.error}`);
    if (res.gap) reasons.push(`model reported BLOCKED: ${res.gap}`);
    else if (res.summary?.status === "blocked") reasons.push("model reported status=blocked");
    if (!res.summary) reasons.push("final message had no parsable summary JSON");
    if (res.exhausted) reasons.push(`hit MAX_TURNS (${CFG.maxTurns}) without finishing`);
  }
  if (!scope.length) reasons.push(job.role === "test" ? "task has no test-path glob in allowed_paths" : "task has no allowed_paths");
  if (!task.testCommand) reasons.push("task declares no test_command");
  // A model that said it cannot do the task (BLOCKED / SPEC_GAP) made no commit on purpose; don't pile
  // "commits=0" on top of its own explanation.
  const refused = Boolean(res?.gap) || res?.summary?.status === "blocked";
  const quietNoCommit = commits === 0 && refused;
  if (job.commitError && !quietNoCommit) reasons.push(`commit failed: ${job.commitError}`);
  if (commits !== 1 && !quietNoCommit) reasons.push(`commits=${commits} (expected exactly 1)`);
  if (outside.length) reasons.push(`out of scope: ${outside.map((c) => c.file).join(", ")}`);
  if (badCommitted.length) reasons.push(`committed outside scope: ${badCommitted.join(", ")}`);
  if (!tests.pass) reasons.push(`test_command failed${res?.repairs?.length ? ` (still failing after ${res.repairs.length} repair attempt(s))` : ""}`);
  if (added + removed > CFG.diffCap) reasons.push(`diff ${added + removed} lines > cap ${CFG.diffCap}`);

  // No-op: the model says it is done, nothing needed changing, and the tests are green. That is neither a
  // pass nor a failure - Claude decides whether "nothing to do" is believable (see report.did).
  let noop = false;
  if (commits === 0 && !refused && res && !res.isError && !res.exhausted && res.summary?.status === "done" && tests.pass && !outside.length && scope.length && task.testCommand) {
    const rest = reasons.filter((r) => !/^commit failed: nothing in scope to commit$/.test(r) && !/^commits=0 \(expected exactly 1\)$/.test(r));
    if (rest.length === 0) {
      noop = true;
      reasons.length = 0;
    }
  }

  return {
    status: reasons.length ? "failed" : noop ? "noop" : "done",
    ...(noop ? { note: "No changes were made and the tests pass. The model says nothing was left to do - read report.did, then decide." } : {}),
    reasons,
    infra: Boolean(res?.isError),
    branch: job.branch,
    base_branch: job.baseBranch ?? null,
    started_from: job.startedFrom ?? null,
    commit: job.commit,
    files,
    added,
    removed,
    tests: { pass: tests.pass, tail: tests.out.split(/\r?\n/).slice(-20).join("\n") },
    out_of_scope: [...outside.map((c) => c.file), ...badCommitted],
    turns: res?.turns ?? null,
    usage: res?.usage ?? null,
    report: report(res),
  };
}

/** review: judged by a machine-readable verdict, which the server re-derives rather than trusts. */
function reviewGate(job: Job, res: ExecResult | null): JobResult {
  const s = res?.summary;
  if (!s || typeof s.verdict !== "string") {
    const why = res?.gap ? `model reported BLOCKED: ${res.gap}` : s ? "review JSON has no verdict" : `no parsable review JSON${res?.error ? `: ${res.error}` : ""}`;
    return { status: "failed", infra: Boolean(res?.isError), reasons: [why], report: report(res), final_text_path: `specs/.jobs/${job.jobId}.final.txt` };
  }
  const findings = records(s.findings);
  const criteria = records(s.criteria);
  const blockers = findings.filter((f) => f.severity === "blocker");
  const majors = findings.filter((f) => f.severity === "major");
  const unmet = criteria.filter((c) => c.status !== "met").map((c) => String(c.id));

  // The prompt says PASS needs every criterion met and zero blockers; enforce it here.
  let verdict = String(s.verdict).toUpperCase();
  const forced = [];
  if (verdict === "PASS") {
    if (blockers.length) forced.push(`${blockers.length} blocker(s) reported`);
    if (unmet.length) forced.push(`criteria not met: ${unmet.join(", ")}`);
    if (!criteria.length) forced.push("no acceptance criteria were evaluated");
    if (forced.length) verdict = "FAIL";
  }

  // "No evidence, no finding": flag findings that point at files outside the diff.
  const inDiff = new Set(diffFilesAgainst(CFG.baseRef || "HEAD").map(normRel));
  const unverified = inDiff.size ? findings.filter((f) => !f.file || !inDiff.has(normRel(String(f.file)))).map((f) => f.id ?? "?") : [];

  const out = path.join(CFG.specs, "review", `${job.role}-${stamp()}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    `# ${job.role} review - ${job.targetRel}\n\n\`\`\`json\n${JSON.stringify(s, null, 2)}\n\`\`\`\n\n## Reviewer notes\n\n${res?.result ?? ""}\n`
  );
  return {
    status: "done",
    reasons: [],
    verdict,
    verdict_forced: forced.length ? { from: "PASS", because: forced } : undefined,
    blockers: blockers.length,
    majors: majors.length,
    minors: findings.filter((f) => f.severity === "minor").length,
    criteria_unmet: unmet,
    findings: [...blockers, ...majors].slice(0, 12),
    findings_outside_diff: unverified,
    scope_creep: s.scope_creep || [],
    review_path: rel(out),
    turns: res?.turns ?? null,
  };
}

/** ask: judged by "did it actually answer". */
function textGate(_job: Job, res: ExecResult | null): JobResult {
  const reasons: string[] = [];
  if (!res) reasons.push("no result from the model");
  else {
    if (res.isError) reasons.push(`model error: ${res.error}`);
    if (!res.result || res.result.trim().length < 20) reasons.push("empty answer");
  }
  return { status: reasons.length ? "failed" : "done", reasons, infra: Boolean(res?.isError), answer: clip(res?.result || "", 3000) };
}

export async function gate(job: Job, res: ExecResult | null): Promise<JobResult> {
  const byMode: Record<string, (job: Job, res: ExecResult | null) => JobResult | Promise<JobResult>> = { doc: docGate, code: codeGate, review: reviewGate, text: textGate };
  const fn = byMode[job.mode];
  if (!fn) return { status: "failed", reasons: [`no gate for mode "${job.mode}"`] };
  return { ...(await fn(job, res)), role: job.role };
}
