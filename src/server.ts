#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CFG, configProblem } from "./config.ts";
import {
  childEnv,
  allJobs,
  appendRunLog,
  changedFiles,
  commit,
  detectBaseRef,
  git,
  jobDiff,
  listJobs,
  parseSummary,
  readJob,
  reapStaleJobs,
  rel,
  resolveInRepo,
  runCmd,
  snapshot,
  writeJob,
} from "./repo.ts";
import { ROLES, ROLE_NAMES, buildPrompt } from "./roles.ts";
import { capsFor, ping as pingModel, runAgent } from "./engine.ts";
import { GAP_RE, doCallProblems, gate, makeVerifier } from "./gates.ts";
import { buildContextPack } from "./context.ts";
import { traceSink } from "./trace.ts";
import { branchExists, discardBranch, latestBranchFor, planBranch, restoreBranch } from "./branching.ts";
import { isDeniedWrite, matchAny, readTask, scopeFor, scopeProblems, syntheticTask } from "./taskfile.ts";
import { callKey } from "./callkey.ts";
import type { Task } from "./taskfile.ts";
import type { Caps, ExecResult, Job, JobResult, Mode, RoleName } from "./types.ts";

const PKG = JSON.parse(fs.readFileSync(path.join(CFG.root, "package.json"), "utf8")) as { version: string };
const log = (...a: unknown[]): void => void process.stderr.write(`[handoff] ${a.join(" ")}\n`);
const json = (o: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(o, null, 2) }] });
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** jobId -> { promise, role, mode } for jobs this process is executing right now. */
const running = new Map<string, { promise: Promise<void>; role: string; mode: Mode }>();
/** jobId -> latest progress line. Kept in memory: no file churn, no read-modify-write race. */
const progress = new Map<string, string>();

function ensureDirs(): void {
  fs.mkdirSync(CFG.jobs, { recursive: true });
}

function preflight(): { ok: true } | { ok: false; reason: string } {
  if (!CFG.key) return { ok: false, reason: "DEEPSEEK_API_KEY is not set in the MCP server env." };
  if (!CFG.model) return { ok: false, reason: "DEEPSEEK_MODEL is empty." };
  const inside = git(["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.out !== "true") {
    return { ok: false, reason: `REPO_ROOT is not a git repo: ${CFG.repo} (git: ${CFG.git})` };
  }
  if (!git(["rev-parse", "HEAD"]).ok) return { ok: false, reason: "repo has no commits yet; make an initial commit first" };
  const dirty = changedFiles().filter((c) => !c.file.startsWith("specs/"));
  if (dirty.length) return { ok: false, reason: `working tree not clean: ${dirty.slice(0, 5).map((c) => c.file).join(" | ")}` };
  CFG.baseRef = detectBaseRef();
  return { ok: true };
}

function withDeadline<T>(promise: Promise<T>, ms: number, onAbort?: () => void): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        onAbort?.();
      } catch {
        /* ignore */
      }
      reject(new Error(`timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

function commitWork(job: Job, task: Task | null | undefined): { commit: string | null; commitError: string | null } {
  const scope = scopeFor(job.role, task);
  const before = new Set(Object.keys(job.startedChanges || {}));
  const inScope = changedFiles().filter((c) => !before.has(c.file) && matchAny(c.file, scope) && !isDeniedWrite(c.file, { denySpecs: true }));
  if (!inScope.length || !scope.length) return { commit: null, commitError: "nothing in scope to commit" };
  const r = commit(inScope.map((c) => c.file), `task-${task?.id ?? "x"}: ${job.role}`);
  if (!r.ok) return { commit: null, commitError: r.out.split(/\r?\n/).slice(-3).join(" ") };
  return { commit: git(["rev-parse", "--short", "HEAD"]).out, commitError: null };
}

/** The model's last message, kept next to the job record so a bad verdict or summary can be diagnosed. */
function saveFinal(jobId: string, text: unknown): void {
  try {
    fs.writeFileSync(path.join(CFG.jobs, `${jobId}.final.txt`), String(text ?? ""));
  } catch {
    /* diagnostics only */
  }
}

/** Merge fields into a stored job record. A no-op if the record is gone. */
function patchJob(id: string, fields: Partial<Job>): Job | null {
  const current = readJob(id);
  if (!current) return null;
  const next: Job = { ...current, ...fields };
  writeJob(id, next);
  return next;
}

async function executeJob(jobId: string, ctx: { prompt: string; caps: Caps; mode: Mode; task: Task | null; researchDoc?: string | undefined }): Promise<void> {
  const job = readJob(jobId);
  if (!job) throw new Error(`job record ${jobId} is missing`);
  let res: ExecResult | null = null;
  let aborted = false;
  const ctrl = new AbortController();
  const trace = traceSink(jobId);
  trace({ type: "job_start", role: job.role, model: CFG.model, effort: CFG.thinking === "enabled" ? CFG.effort : null, thinking: CFG.thinking, prompt_chars: ctx.prompt.length, pack_chars: job.packChars, target: job.targetRel });
  const agent = runAgent({
    prompt: ctx.prompt,
    caps: ctx.caps,
    logPath: job.logPath,
    signal: ctrl.signal,
    trace,
    verify: makeVerifier(ctx.mode, ctx.task, { researchDoc: ctx.researchDoc }),
    onProgress: (m) => progress.set(jobId, m),
  });

  try {
    const out = await withDeadline(agent, CFG.timeoutMs, () => {
      aborted = true;
      ctrl.abort();
    });
    const summary = parseSummary(out.finalText);
    const gap = GAP_RE.exec(out.finalText || "")?.[1]?.trim() ?? null;
    saveFinal(jobId, out.finalText);
    res = { isError: false, turns: out.turns, usage: out.usage, result: out.finalText, summary, gap, exhausted: out.exhausted, ...(out.exhaustedReason ? { exhaustedReason: out.exhaustedReason } : {}), repairs: out.repairs };

    if (ctx.mode === "code" && !gap) {
      const c = commitWork(job, ctx.task);
      patchJob(jobId, { commit: c.commit, commitError: c.commitError });
    }
    if (ctx.mode === "code") patchJob(jobId, { endSha: git(["rev-parse", "HEAD"]).out });
  } catch (e) {
    // Give the aborted loop a moment to stop writing before the gate inspects the tree.
    if (aborted) await Promise.race([agent.catch(() => {}), sleep(10000)]);
    res = { isError: true, turns: 0, usage: null, result: "", summary: null, error: (e as Error).message, gap: null, aborted };
  }

  const finalJob = readJob(jobId);
  if (!finalJob) throw new Error(`job record ${jobId} vanished before the gate`);
  let result: JobResult;
  try {
    result = await gate(finalJob, res);
  } catch (e) {
    result = { status: "failed", reasons: [`gate error: ${(e as Error).message}`] };
  }
  trace({ type: "gate", status: result.status, reasons: (result.reasons ?? []).map((r) => String(r).slice(0, 200)), verdict: result.verdict ?? null, infra: Boolean(result.infra) });
  // The gate has inspected the work branch; now put the human's branch back.
  result = { ...result, job_id: jobId, ...restoreBranch(finalJob) };
  writeJob(jobId, { ...finalJob, state: result.status, result, finishedAt: new Date().toISOString() });
  trace({ type: "job_end", state: result.status, elapsed_ms: Date.now() - Date.parse(finalJob.startedAt), turns: res?.turns ?? null });
  progress.delete(jobId);
  appendRunLog({
    job: jobId,
    role: finalJob.role,
    target: finalJob.targetRel,
    state: result.status,
    reasons: result.reasons,
    turns: res?.turns ?? null,
    usage: res?.usage ?? null,
    verdict: result.verdict,
  });
}

const blocked = (reason: string, extra: Record<string, unknown> = {}): CallToolResult => json({ status: "blocked", reason, ...extra });

/* -------------------------------------------------------------------- server */

CFG.baseRef = detectBaseRef();
ensureDirs();
const reaped = reapStaleJobs();
if (reaped) log(`marked ${reaped} job(s) from a previous run as interrupted`);

const server = new McpServer({ name: "deepseek-handoff", version: PKG.version });

server.tool("version", "Report config, repo, git, base ref, and credential presence.", {}, async () =>
  json({
    version: PKG.version,
    repo: CFG.repo,
    git: CFG.git,
    gitVersion: (() => {
      try {
        return execFileSync(CFG.git, ["--version"], { encoding: "utf8", timeout: 20000 }).trim();
      } catch (e) {
        return `NOT WORKING: ${(e as Error).message.split("\n")[0]}`;
      }
    })(),
    baseRef: CFG.baseRef,
    baseUrl: CFG.baseUrl,
    model: CFG.model,
    thinking: CFG.thinking,
    effort: CFG.thinking === "enabled" ? CFG.effort : null,
    maxTokens: CFG.maxTokens,
    keyPresent: Boolean(CFG.key),
    maxTurns: CFG.maxTurns,
    diffCap: CFG.diffCap,
    maxFixRounds: CFG.maxFixRounds,
    maxRepairs: CFG.maxRepairs,
    contextChars: CFG.contextChars,
    maxWaitS: CFG.maxWaitS,
    node: process.version,
    // what a test_command sees when it runs `node` - should match the line above
    testCommandNode: (await runCmd("node --version", 20000)).out.split(/\r?\n/).pop(),
    diagnostics: {
      execPath: process.execPath,
      whereNode: (await runCmd(process.platform === "win32" ? "where node" : "command -v node", 20000)).out.split(/\r?\n/).slice(0, 5),
      testCommandPathHead: (childEnv()[process.platform === "win32" ? "Path" : "PATH"] || "").split(path.delimiter).slice(0, 4),
    },
  })
);

server.tool("roles", "List the handoff roles, what each produces, and how it is judged.", {}, async () =>
  json(
    ROLE_NAMES.map((n) => ({
      role: n,
      does: ROLES[n].title,
      writes: ROLES[n].mode === "doc" ? `${ROLES[n].artifact} under target` : ROLES[n].mode === "code" ? "code + one commit" : "nothing",
      needs: [ROLES[n].needsTask ? "target = task file" : null, ROLES[n].needsInstruction ? "instruction" : null, ROLES[n].synthetic ? "paths + test_command" : ROLES[n].caps === "code" ? "task frontmatter" : null].filter(Boolean),
      judged_by: ROLES[n].mode,
      blocks_by_default: Boolean(ROLES[n].wait),
    }))
  )
);

server.tool("ping", "One tiny DeepSeek call. Proves the key, base URL, and model id work.", {}, async () => {
  if (!CFG.key) return json({ ok: false, reason: "DEEPSEEK_API_KEY is not set" });
  const t0 = Date.now();
  try {
    const r = await withDeadline(pingModel(), 90000);
    return json({ ok: true, reply: r.reply.slice(0, 300), elapsed_s: Math.round((Date.now() - t0) / 1000), usage: r.usage });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message, elapsed_s: Math.round((Date.now() - t0) / 1000) });
  }
});

server.tool(
  "handoff",
  "Delegate one phase to DeepSeek. role decides prompt, capabilities, and the acceptance gate. Waits up to ~45s, then returns a job_id to poll.",
  {
    role: z.string().describe(`One of: ${ROLE_NAMES.join(", ")}`),
    target: z.string().describe("specs/<feature> for doc roles (spec, plan, tasks, research); the task .md file for impl/fix/test; a path for ask; the directory or file the change is about for do"),
    instruction: z.string().optional().describe("Brief for spec, question for ask and research, the whole task for do, extra steer for others"),
    feedback_path: z.string().optional().describe("Review markdown to address; required for role=fix"),
    wait: z.boolean().optional().describe("false = return a job_id immediately; true = wait as long as allowed"),
    branch: z.string().optional().describe("review: branch to review (default: newest code branch for the feature). fix/test: an existing impl/, fix/, test/ or do/ branch made by this server to start from (a new branch is cut from its tip; it is never committed onto)"),
    paths: z.array(z.string()).optional().describe("do only (required): globs the job may change, each with a literal folder before its wildcard, e.g. src/lib/**"),
    test_command: z.string().optional().describe("do only (required): npm test, npm run <script>, or node --test <paths>"),
  },
  async ({ role: roleName, target, instruction, feedback_path, wait, branch: reviewBranchParam, paths: doPaths, test_command: doTestCommand }) => {
    const role = (ROLE_NAMES as readonly string[]).includes(roleName) ? ROLES[roleName as RoleName] : undefined;
    if (!role) return blocked(`unknown role "${roleName}"; use one of ${ROLE_NAMES.join(", ")}`);
    const roleKey = roleName as RoleName;

    ensureDirs();
    const pre = preflight();
    if (!pre.ok) return blocked(pre.reason);

    // One writer at a time: jobs share a working tree and `git checkout -b`. Read-only asks may overlap.
    const busy = [...running.entries()].find(([, r]) => r.mode !== "text" && role.mode !== "text");
    if (busy) return blocked(`job ${busy[0]} (${busy[1].role}) is still running; poll job_status first`);

    let targetRel: string;
    try {
      targetRel = rel(resolveInRepo(String(target || ""))) || ".";
    } catch (e) {
      return blocked((e as Error).message);
    }
    if (role.mode === "doc" && !targetRel.startsWith("specs/")) {
      return blocked("doc roles write under specs/ - pass target like specs/<feature>");
    }
    if (role.needsInstruction && !instruction) return blocked(`role=${roleName} needs an instruction`);
    if (role.needsTask && !targetRel.endsWith(".md")) return blocked(`role=${roleName} needs target = a task .md file`);

    let task: Task | null = null;
    if (role.needsTask) {
      try {
        task = readTask(targetRel);
      } catch (e) {
        return blocked(`cannot read task file: ${(e as Error).message}`);
      }
      const scope = scopeFor(roleName, task);
      const problems = scope.length ? scopeProblems(scope) : [roleName === "test" ? "task has no test-path glob in allowed_paths" : "allowed_paths is empty"];
      if (!task.testCommand) problems.push("test_command is empty");
      if (problems.length) return blocked(`task ${targetRel} is not runnable: ${problems.join("; ")}`);
    }

    // A free-form job has no task file: the call itself supplies the scope and the test command, so they are validated here,
    // before any model call, by the same rules a task file's front matter gets (plus the stricter ones for `do`).
    if (role.synthetic) {
      const problems = doCallProblems(doPaths, doTestCommand);
      if (problems.length) return blocked(`role=${roleName} is not runnable: ${problems.join("; ")}`);
      task = syntheticTask({ rel: targetRel, paths: doPaths as string[], testCommand: String(doTestCommand), body: String(instruction) });
    }

    let feedback: string | null = null;
    if (feedback_path) {
      try {
        feedback = fs.readFileSync(resolveInRepo(feedback_path), "utf8");
      } catch (e) {
        return blocked(`cannot read feedback: ${(e as Error).message}`);
      }
    }
    if (roleName === "fix" && !feedback) return blocked("role=fix requires feedback_path");

    // The human's rules, enforced: no identical retry of a failed call, and a cap on fix rounds.
    const history = allJobs();
    // The key is built from the caller's inputs. For a free-form job that includes the scope and the test command, so a changed
    // `paths` is a changed call, and an identical failed call is still refused. (Other roles keep their original key.)
    const key = callKey({ role: roleName, target: targetRel, instruction, feedback, synthetic: role.synthetic, paths: doPaths, testCommand: doTestCommand, branch: reviewBranchParam });
    const prior = history.filter((j) => j.key === key).pop();
    if (prior && prior.state === "failed" && !prior.result?.infra) {
      return blocked(`identical to failed job ${prior.jobId}; read its reasons and change the instruction, task or feedback instead of retrying`, { prior_reasons: prior.result?.reasons ?? [] });
    }
    if (roleName === "fix") {
      // Rounds are the larger of the count by task file and the count by the branch the fixes started from, and never reset:
      // renaming a branch does not hide the rounds already spent on the task, and changing the task file does not hide the branch's.
      const spent = history.filter((j) => j.role === "fix" && ["done", "failed", "noop"].includes(j.state) && !j.result?.infra);
      const byTask = spent.filter((j) => j.targetRel === targetRel).length;
      const byBranch = reviewBranchParam ? spent.filter((j) => j.sourceBranch === reviewBranchParam || j.branch === reviewBranchParam).length : 0;
      const used = Math.max(byTask, byBranch);
      if (used >= CFG.maxFixRounds) {
        return json({ status: "escalate", reason: `${used} fix round(s) already used on ${byBranch > byTask ? `branch ${reviewBranchParam}` : targetRel} (max ${CFG.maxFixRounds}); hand this back to the human` });
      }
    }

    // The job id exists before the branch does, so a branch name can carry it.
    const jobId = crypto.randomUUID().slice(0, 8);

    // Where the human is now (we return here when the job ends) and where the job should work.
    const baseBranch = git(["rev-parse", "--abbrev-ref", "HEAD"]).out;
    const baseSha = git(["rev-parse", "HEAD"]).out;
    let branch: string | null = null;
    let reviewBranch: string | null = null;
    let switched = false;
    let createdBranch = false;
    let startedFrom: string | null = null;
    let sourceBranch: string | null = null;
    if (role.branch) {
      const plan = planBranch({ roleName, task, targetRel, history, baseRef: CFG.baseRef ?? "HEAD", branchParam: roleName === "fix" || roleName === "test" ? reviewBranchParam : undefined, currentBranch: baseBranch });
      if (plan.error !== undefined) return blocked(plan.error);
      startedFrom = plan.from;
      sourceBranch = plan.source ?? null;
      if (plan.mode === "continue" && plan.branch) {
        branch = plan.branch;
        const co = git(["checkout", branch]);
        if (!co.ok) return blocked(`cannot switch to ${branch}: ${co.out}`);
      } else {
        branch = role.synthetic ? `${roleName}/${jobId}-${Date.now().toString(36)}` : `${roleName}/${task?.id ?? "x"}-${Date.now().toString(36)}`;
        const co = git(["checkout", "-b", branch, plan.from]);
        if (!co.ok) return blocked(`branch create failed: ${co.out}`);
        createdBranch = true;
      }
      switched = true;
    } else if (roleName === "review") {
      reviewBranch = reviewBranchParam || latestBranchFor(history, targetRel);
      if (reviewBranchParam && !branchExists(reviewBranchParam)) return blocked(`branch not found: ${reviewBranchParam}`);
      if (reviewBranch && reviewBranch !== baseBranch) {
        const co = git(["checkout", reviewBranch]);
        if (!co.ok) return blocked(`cannot switch to ${reviewBranch}: ${co.out}`);
        switched = true;
      }
    }
    const startedSha = git(["rev-parse", "HEAD"]).out;
    const startedChanges = snapshot();

    const promptPath = path.join(CFG.jobs, `${jobId}.prompt.txt`);
    const pack = buildContextPack({ scope: task ? scopeFor(roleName, task) : [], targetRel });
    const prompt = buildPrompt(roleKey, { target: targetRel, instruction, feedback, task, pack });
    fs.writeFileSync(promptPath, prompt);

    writeJob(jobId, {
      jobId,
      key,
      role: roleKey,
      mode: role.mode,
      artifact: role.artifact ?? null,
      headings: role.headings ?? [],
      targetRel,
      branch,
      reviewBranch,
      baseBranch,
      baseSha,
      switched,
      createdBranch,
      startedFrom,
      task: task?.id ?? null,
      allowedPaths: task?.allowedPaths ?? [],
      ...(role.synthetic ? { synthetic: true, testCommand: task?.testCommand ?? null } : {}),
      ...(sourceBranch ? { sourceBranch } : {}),
      startedSha,
      startedChanges,
      logPath: path.join(CFG.jobs, `${jobId}.log`),
      promptPath,
      packChars: pack.length,
      startedAt: new Date().toISOString(),
      state: "running",
    });

    const promise = executeJob(jobId, { prompt, caps: capsFor(roleKey, role, task, targetRel), mode: role.mode, task, researchDoc: role.caps === "research" ? `${targetRel}/${role.artifact}` : undefined })
      .catch((e) => {
        log(`job ${jobId} crashed: ${(e as Error).message}`);
        const j = readJob(jobId);
        if (j && j.state === "running") traceSink(jobId)({ type: "job_end", state: "failed", elapsed_ms: Date.now() - Date.parse(j.startedAt), turns: null, crashed: true });
        if (j && j.state === "running") writeJob(jobId, { ...j, state: "failed", result: { status: "failed", infra: true, reasons: [`server error: ${(e as Error).message}`], ...restoreBranch(j) }, finishedAt: new Date().toISOString() });
      })
      .finally(() => {
        running.delete(jobId);
        progress.delete(jobId);
      });
    running.set(jobId, { promise, role: roleName, mode: role.mode });

    const natural = wait === false ? 0 : wait === true ? role.wait || 150 : role.wait || 0;
    const seconds = Math.min(natural, CFG.maxWaitS);
    if (seconds) {
      const outcome = await Promise.race([promise.then(() => "done"), sleep(seconds * 1000).then(() => "timeout")]);
      if (outcome === "done") {
        const done = readJob(jobId);
        if (done) return json({ status: done.state, job_id: jobId, ...done.result });
      }
    }
    return json({ status: "running", job_id: jobId, role: roleName, branch, started_from: startedFrom, base_branch: baseBranch, next: "poll job_status(job_id, wait_s=40)" });
  }
);

server.tool(
  "job_status",
  "Poll a handoff. Returns progress while running, the gated verdict once done. wait_s blocks up to that many seconds for it to finish.",
  { job_id: z.string(), wait_s: z.number().int().min(0).max(120).optional() },
  async ({ job_id, wait_s }) => {
    if (!/^[0-9a-f]{8}$/.test(job_id)) return json({ status: "unknown_job" });
    const live = running.get(job_id);
    if (live && wait_s) await Promise.race([live.promise, sleep(Math.min(wait_s, CFG.maxWaitS) * 1000)]);
    const job = readJob(job_id);
    if (!job) return json({ status: "unknown_job" });
    if (job.state === "running") {
      return json({
        status: "running",
        role: job.role,
        elapsed_s: Math.round((Date.now() - Date.parse(job.startedAt)) / 1000),
        progress: progress.get(job_id) ?? "(starting)",
      });
    }
    return json({ status: job.state, ...job.result });
  }
);

server.tool(
  "job_diff",
  "Read the code diff a finished impl/fix/test job committed, so you can judge it yourself. Paged: pass offset=next_offset to continue.",
  { job_id: z.string(), offset: z.number().int().min(0).optional() },
  async ({ job_id, offset }) => {
    if (!/^[0-9a-f]{8}$/.test(job_id)) return json({ status: "unknown_job" });
    const job = readJob(job_id);
    if (!job) return json({ status: "unknown_job" });
    if (job.state === "running") return json({ status: "running", job_id });
    return json({ job_id, role: job.role, branch: job.branch ?? null, ...jobDiff(job, offset || 0) });
  }
);

server.tool(
  "discard",
  "Delete the work branch of a finished impl/fix/test job. Refuses if the branch has commits that are not merged into the base, unless force=true (the result then includes how to recover it). Never touches the base branch or the branch you are on.",
  { job_id: z.string(), force: z.boolean().optional() },
  async ({ job_id, force }) => {
    if (!/^[0-9a-f]{8}$/.test(job_id)) return json({ status: "unknown_job" });
    const job = readJob(job_id);
    if (!job) return json({ status: "unknown_job" });
    if (job.state === "running") return blocked(`job ${job_id} is still running`);
    if (!job.branch) return blocked("this job has no branch (doc, review and ask jobs write none)");
    if ([...running.values()].some((r) => r.mode !== "text")) return blocked("a job is running; wait for it to finish before deleting branches");
    const pre = preflight();
    if (!pre.ok) return blocked(pre.reason);
    const res = discardBranch({ branch: job.branch, baseRef: CFG.baseRef ?? "HEAD", force: Boolean(force) });
    if (res.error) return json({ status: res.gone ? "gone" : "refused", job_id, reason: res.error, ...(res.unmerged_commits ? { unmerged_commits: res.unmerged_commits, tip: res.tip } : {}) });
    writeJob(job_id, { ...job, discardedAt: new Date().toISOString() });
    return json({ status: "discarded", job_id, ...res });
  }
);

server.tool("jobs", "List recent handoffs with their state.", {}, async () => json(listJobs(12)));

process.on("unhandledRejection", (e) => log("unhandled rejection:", String(e)));
if (configProblem) {
  console.error(`[handoff] ${configProblem}`);
  process.exit(1);
}
await server.connect(new StdioServerTransport());
log(`ready - repo=${CFG.repo} base=${CFG.baseRef} model=${CFG.model} roles=${ROLE_NAMES.length}`);
