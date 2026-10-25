/**
 * Eval runner: starts the REAL server (a pinned copy of src/) over stdio per task run, against a temp git repo built
 * from the task fixture, drives it only through handoff / job_status, then applies the hidden checks.
 *
 *   node eval/run.ts --dry-run
 *   node eval/run.ts --only ask-cite --k 1 --max-tokens 400000 --yes
 *
 * The real key is read from DEEPSEEK_API_KEY (or eval/.env) and lives only in this process and the local proxy.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { CFG } from "../src/config.ts";
import { runChecks } from "./lib/checks.ts";
import { loadTasks, makeRepo, removeDir, runSetup, taskRoots } from "./lib/fixture.ts";
import { McpClient } from "./lib/mcp.ts";
import { SERVER_SETTINGS, TASK_ENV_SETTINGS, allowlistEnv } from "./lib/proc.ts";
import { computeLineage, heldoutSetHash } from "./lib/lineage.ts";
import { isPrivate, labelOf, runSubdir } from "./lib/privacy.ts";
import { DEFAULT_UPSTREAM_TIMEOUT_MS, startProxy } from "./lib/proxy.ts";
import { loadContextSettings } from "../src/config.ts";
import type { ContextSettings } from "../src/config.ts";
import { validateTasks } from "./lib/validate.ts";
import { tierOf } from "./lib/types.ts";
import type { LoadedTask, Pricing, Split, StepResult, Tier, UsageStats } from "./lib/types.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

export interface EvalOpts {
  rootDir: string;
  tasksRoots: string[];
  runsDir: string;
  runId: string;
  only?: string[];
  k: number;
  splits: Split[];
  parallel: number;
  dryRun: boolean;
  yes: boolean;
  maxTokens?: number | undefined;
  maxCost?: number | undefined;
  /** Which side of a comparison this run is, and what it is for; recorded in the manifest (required by the harder-evals spec later). */
  arm?: "baseline" | "candidate" | undefined;
  purpose?: "calibration" | "comparison" | undefined;
  /** Use this directory's src/ and package.json as the code under test (a previous run's `server/` folder) instead of the working tree. */
  serverSrc?: string | undefined;
  taskTimeoutS: number;
  /** how long the proxy waits for one upstream reply (default 330) */
  upstreamTimeoutS?: number | undefined;
  resume: boolean;
  allowDirty: boolean;
  apiKey: string;
  upstream: string;
  gitBin: string;
  /** Settings passed through to the server under test (allowlisted names only). */
  serverEnv: Record<string, string | undefined>;
  pricing?: Pricing | undefined;
  log: (line: string) => void;
}

export interface RunRecord {
  complete: boolean;
  status: "ok" | "capped" | "infra" | "timeout" | "error" | "key_leak";
  task: string;
  k: number;
  family: string;
  /** Absent in records written before tiers existed: those read as regression. */
  tier?: Tier;
  axis?: string;
  split: Split;
  expect: { gate: string };
  gate_status: string | null;
  steps: { step: number; role: string; job_id: string | null; status: string; infra: boolean }[];
  checks: Awaited<ReturnType<typeof runChecks>>;
  usage: UsageStats;
  wall_s: number;
  error?: string;
}

const sha1 = (s: string | Buffer): string => crypto.createHash("sha1").update(s).digest("hex");

/** Hash of every file under dir, in a stable order: identifies the exact server code under test. */
export function hashTree(dir: string): string {
  const h = crypto.createHash("sha1");
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else h.update(path.relative(dir, p).replace(/\\/g, "/")).update(fs.readFileSync(p));
    }
  };
  walk(dir);
  return h.digest("hex");
}

/** The first file under the given dirs (skipping .git) that contains `secret`, or null. */
export function findSecret(dirs: string[], secret: string): string | null {
  if (secret.length < 8) return null;
  const walk = (d: string): string | null => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const e of entries) {
      if (e.name === ".git") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        const r = walk(p);
        if (r) return r;
      } else {
        try {
          if (fs.statSync(p).size <= 5_000_000 && fs.readFileSync(p).includes(secret)) return p;
        } catch {
          /* unreadable */
        }
      }
    }
    return null;
  };
  for (const d of dirs) {
    const r = walk(d);
    if (r) return r;
  }
  return null;
}

const writeAtomic = (file: string, data: string): void => {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};

function readJsonFile<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

const readRecord = (file: string): RunRecord | null => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as RunRecord;
  } catch {
    return null;
  }
};

const emptyUsage = (): UsageStats => ({ requests: 0, prompt: 0, completion: 0, reasoning: 0, cache_hit: 0, cost: 0, capped: false, upstream_failures: 0 });

/** Print what would run and what it may cost. Costs come from a measured pilot (runs/last-usage.json), never a guess. */
function describePlan(o: EvalOpts, tasks: LoadedTask[], skipped: LoadedTask[]): void {
  const n = tasks.length * o.k;
  o.log(`run ${o.runId}: ${tasks.length} task(s) x k=${o.k} = ${n} run(s), splits ${o.splits.join("+")}, parallel ${o.parallel}`);
  for (const t of tasks) o.log(isPrivate(t.split) ? `  ${labelOf(t)}  [${t.split}] (private)` : `  ${t.id}  [${t.split}] ${t.family}: ${t.title} (${t.steps.map((s) => s.role).join(" > ")})`);
  for (const t of skipped) o.log(`  N/A ${labelOf(t)}: needs role "${t.needs_role}"`);
  const pilot = readRecordJson(path.join(o.runsDir, "last-usage.json"));
  if (pilot?.runs) {
    const tokens = Math.round(pilot.mean_tokens * n);
    o.log(`estimate from the last measured run (${pilot.runs} run(s)): ~${tokens.toLocaleString()} tokens${pilot.mean_cost ? `, ~$${(pilot.mean_cost * n).toFixed(2)}` : ""}`);
  } else {
    o.log("estimate: none yet - run a pilot first (--only <task> --k 1 with a small --max-tokens); it records runs/last-usage.json");
  }
  o.log(`cap: ${o.maxTokens !== undefined ? `${o.maxTokens.toLocaleString()} tokens` : "(none)"}${o.maxCost !== undefined ? `, $${o.maxCost}` : ""}`);
}

/** The settings the server under test will get: explicit defaults for the model, then every allowlisted variable (names matched without regard to case, as Windows does). */
export function collectSettings(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const settings: Record<string, string | undefined> = { DEEPSEEK_MODEL: "deepseek-flash", DEEPSEEK_EFFORT: "high", DEEPSEEK_THINKING: "enabled" }; // explicit, so the manifest records what ran
  for (const [k, v] of Object.entries(env)) {
    const name = k.toUpperCase();
    if (SERVER_SETTINGS.includes(name) && v !== undefined && v !== "") settings[name] = v;
  }
  return settings;
}

/** The context settings in effect for these server settings, validated the way the server will validate them. Throws, so a bad arm is refused before any money is spent. */
export function effectiveContext(settings: Record<string, string | undefined>): ContextSettings {
  const maxTokens = Number(settings.MAX_TOKENS || (settings.DEEPSEEK_THINKING === "disabled" ? 8000 : 32000));
  try {
    return loadContextSettings(settings as NodeJS.ProcessEnv, maxTokens);
  } catch (e) {
    throw new Error(`refused: ${(e as Error).message}`);
  }
}

function readRecordJson(file: string): { runs: number; mean_tokens: number; mean_cost: number } | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as { runs: number; mean_tokens: number; mean_cost: number };
  } catch {
    return null;
  }
}

export async function runEval(o: EvalOpts): Promise<{ runDir: string; records: RunRecord[]; planned: number; aborted: string | null }> {
  const all = loadTasks(o.tasksRoots, o.splits).filter((t) => !o.only || o.only.includes(t.id));
  const skipped = all.filter((t) => t.needs_role);
  const tasks = all.filter((t) => !t.needs_role);
  const runDir = path.join(o.runsDir, o.runId);
  describePlan(o, tasks, skipped);
  const settings = collectSettings(o.serverEnv);
  const effective = effectiveContext(settings);
  o.log(`server settings: ${Object.entries(settings).map(([k, v]) => `${k}=${v}`).join(" ")}; context in effect: ${JSON.stringify(effective)}`);
  if (o.dryRun) return { runDir, records: [], planned: tasks.length * o.k, aborted: null };

  if (!o.apiKey) throw new Error("DEEPSEEK_API_KEY is not set (environment or eval/.env)");
  if (o.maxTokens === undefined && o.maxCost === undefined) throw new Error("a live run needs a hard cap: pass --max-tokens and/or --max-cost");
  if (o.maxCost !== undefined && !o.pricing) throw new Error("--max-cost needs eval/pricing.json");
  if (!o.yes) throw new Error("live runs spend money: re-run with --yes after reading the plan above");
  if (!tasks.length) throw new Error("no tasks selected");

  // With `serverSrc` the code under test is an existing run's pinned copy, so the working tree's state does not matter.
  const dirty = o.serverSrc ? "" : spawnSync(o.gitBin, ["status", "--porcelain"], { cwd: o.rootDir, encoding: "utf8" }).stdout.trim();
  if (dirty && !o.allowDirty) throw new Error(`working tree has uncommitted changes (pass --allow-dirty to run them; the server code hash is recorded):\n${dirty.split("\n").slice(0, 8).join("\n")}`);

  // Pin the server code: every run uses this copy, so edits or branch switches mid-run change nothing.
  fs.mkdirSync(runDir, { recursive: true });
  const serverDir = path.join(runDir, "server");
  if (!fs.existsSync(serverDir)) {
    const from = o.serverSrc ?? o.rootDir;
    fs.cpSync(path.join(from, "src"), path.join(serverDir, "src"), { recursive: true });
    fs.copyFileSync(path.join(from, "package.json"), path.join(serverDir, "package.json"));
  }
  // Dependencies are shared, not copied: a junction needs no admin rights on Windows and works wherever runs/ lives.
  const deps = path.join(o.rootDir, "node_modules");
  if (fs.existsSync(deps) && !fs.existsSync(path.join(serverDir, "node_modules"))) fs.symlinkSync(deps, path.join(serverDir, "node_modules"), "junction");
  const serverEntry = path.join(serverDir, "src", "server.ts");
  // A resumed run may cover other tasks than the first pass did: keep the union in the manifest. Facts about how the run
  // started (lineage, arm, purpose, the working tree's state, the held-out set) are kept from the first pass: a resume may
  // happen on another branch, and that must not change what the run is.
  type Prev = { tasks?: string[]; started?: string; dirty?: boolean; git_sha?: string; lineage?: string | null; merge_base?: string | null; arm?: string | null; purpose?: string | null; heldout_hash?: string | null; heldout_count?: number | null };
  const prevManifest = readJsonFile<Prev>(path.join(runDir, "manifest.json"));
  const lin = prevManifest?.lineage !== undefined ? null : computeLineage(o.gitBin, o.rootDir);
  const held = prevManifest?.heldout_hash !== undefined ? null : heldoutSetHash(path.join(o.rootDir, "eval", "heldout"));
  writeAtomic(
    path.join(runDir, "manifest.json"),
    JSON.stringify({
      run_id: o.runId, started: prevManifest?.started ?? new Date().toISOString(), node: process.version, k: o.k, splits: o.splits,
      git_sha: prevManifest?.git_sha ?? spawnSync(o.gitBin, ["rev-parse", "HEAD"], { cwd: o.rootDir, encoding: "utf8" }).stdout.trim(),
      lineage: prevManifest?.lineage !== undefined ? prevManifest.lineage : lin?.lineage ?? null,
      merge_base: prevManifest?.merge_base !== undefined ? prevManifest.merge_base : lin?.merge_base ?? null,
      arm: prevManifest?.arm !== undefined ? prevManifest.arm : o.arm ?? null,
      purpose: prevManifest?.purpose !== undefined ? prevManifest.purpose : o.purpose ?? null,
      heldout_hash: prevManifest?.heldout_hash !== undefined ? prevManifest.heldout_hash : held?.hash ?? null,
      heldout_count: prevManifest?.heldout_count !== undefined ? prevManifest.heldout_count : held?.count ?? null,
      dirty: prevManifest?.dirty ?? Boolean(dirty), server_hash: hashTree(path.join(serverDir, "src")), settings, effective_context: effective, task_env: Object.fromEntries(tasks.filter((t) => t.env && Object.keys(t.env).length).map((t) => [labelOf(t), t.env])), caps: { max_tokens: o.maxTokens ?? null, max_cost: o.maxCost ?? null }, timeouts: { task_s: o.taskTimeoutS, upstream_s: o.upstreamTimeoutS ?? DEFAULT_UPSTREAM_TIMEOUT_MS / 1000 },
      pricing: o.pricing ?? null, tasks: [...new Set([...(prevManifest?.tasks ?? []), ...tasks.map((t) => labelOf(t))])].sort(), skipped: skipped.map((t) => ({ id: labelOf(t), needs_role: t.needs_role })),
    }, null, 2)
  );

  const proxy = await startProxy({ upstream: o.upstream, apiKey: o.apiKey, ...(o.upstreamTimeoutS !== undefined ? { upstreamTimeoutMs: o.upstreamTimeoutS * 1000 } : {}), ...(o.maxTokens !== undefined ? { maxTokens: o.maxTokens } : {}), ...(o.maxCost !== undefined ? { maxCost: o.maxCost } : {}), ...(o.pricing ? { pricing: o.pricing } : {}) });
  const records: RunRecord[] = [];
  let aborted: string | null = null;

  const runOne = async (task: LoadedTask, k: number): Promise<RunRecord> => {
    const outDir = path.join(runDir, runSubdir(task.split), task.id, String(k));
    const recFile = path.join(outDir, "checks.json");
    const prior = o.resume ? readRecord(recFile) : null;
    if (prior?.complete) {
      o.log(`  skip ${labelOf(task)}#${k} (complete)`);
      return prior;
    }
    fs.mkdirSync(outDir, { recursive: true });
    const t0 = Date.now();
    const deadline = t0 + o.taskTimeoutS * 1000;
    const fx = makeRepo(task, o.gitBin);
    const sess = proxy.session(task.proxy);
    const steps: StepResult[] = [];
    let status: RunRecord["status"] = "ok";
    let error: string | undefined;
    let client: McpClient | null = null;
    try {
      await runSetup(task, fx);
      const taskSettings = { ...settings };
      for (const [key, v] of Object.entries(task.env ?? {})) if (TASK_ENV_SETTINGS.includes(key)) taskSettings[key] = v;
      client = new McpClient(serverEntry, allowlistEnv({ ...taskSettings, REPO_ROOT: fx.repo, GIT_BIN: o.gitBin, DEEPSEEK_API_KEY: sess.bearer, DEEPSEEK_BASE_URL: proxy.url }), fx.repo);
      await client.start();
      for (const [i, def] of task.steps.entries()) {
        const n = i + 1;
        const feedback = def.feedback_from_step ? steps[def.feedback_from_step - 1]?.result.review_path : def.feedback_path;
        let res = await client.call("handoff", { role: def.role, target: resolveTarget(fx.repo, def.target), ...(def.instruction ? { instruction: def.instruction } : {}), ...(def.branch ? { branch: def.branch } : {}), ...(def.paths ? { paths: def.paths } : {}), ...(def.test_command ? { test_command: def.test_command } : {}), ...(typeof feedback === "string" ? { feedback_path: feedback } : {}), wait: true }, 150000);
        // job_status replies carry no job_id, so remember the id from the handoff reply.
        const jobId = typeof res.job_id === "string" ? res.job_id : null;
        while (res.status === "running" && jobId) {
          if (Date.now() > deadline) break;
          res = await client.call("job_status", { job_id: jobId, wait_s: 40 }, 90000);
        }
        if (res.status === "running") status = "timeout";
        steps.push({ step: n, role: def.role, job_id: jobId, status: String(res.status ?? "?"), result: res });
        if (jobId) saveJobFiles(fx.repo, jobId, n, outDir, fx.git);
        if (typeof res.review_path === "string") copyIf(path.join(fx.repo, res.review_path), path.join(outDir, `step${n}.review.md`));
        if (status === "timeout" || res.status === "running" || sess.stats.capped) break;
      }
    } catch (e) {
      status = "error";
      error = (e as Error).message;
    }
    if (client) {
      writeAtomic(path.join(outDir, "server.stderr.log"), client.stderr);
      client.close();
    }
    const last = steps[steps.length - 1];
    const infra = steps.some((s) => s.result.infra === true || s.status === "interrupted");
    if (sess.stats.capped) status = "capped";
    else if (status === "ok" && infra) status = "infra";
    let checks: RunRecord["checks"] = [];
    if (status === "ok" || status === "infra") checks = await runChecks(task.checks, { repo: fx.repo, gitBin: o.gitBin, hiddenDir: path.join(task.dir, "hidden"), steps });
    const leak = findSecret([outDir, fx.repo], o.apiKey);
    if (leak) {
      status = "key_leak";
      error = `the API key was found in ${path.basename(leak)}`;
      aborted = "API key found in run output; stopping";
    }
    const rec: RunRecord = {
      complete: status === "ok" && last?.status !== "running", status, task: task.id, k, family: task.family, tier: tierOf(task), ...(task.axis ? { axis: task.axis } : {}), split: task.split, expect: task.expect, gate_status: last ? last.status : null,
      steps: steps.map((s) => ({ step: s.step, role: s.role, job_id: s.job_id, status: s.status, infra: s.result.infra === true })),
      checks, usage: sess.stats, wall_s: Math.round((Date.now() - t0) / 100) / 10, ...(error ? { error } : {}),
    };
    writeAtomic(recFile, JSON.stringify(rec, null, 2));
    removeDir(fx.tmp);
    o.log(`  ${labelOf(task)}#${k}: ${status}${last ? ` gate=${last.status}` : ""} checks ${checks.filter((c) => c.pass).length}/${checks.length} tokens ${sess.stats.prompt + sess.stats.completion}`);
    return rec;
  };

  const queue = tasks.flatMap((t) => Array.from({ length: o.k }, (_, i) => ({ t, k: i + 1 })));
  const worker = async (): Promise<void> => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      if (aborted || proxy.totals.capped) {
        aborted ??= "cap reached; remaining runs not started";
        return;
      }
      records.push(await runOne(next.t, next.k));
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.max(1, o.parallel) }, worker));
  } finally {
    await proxy.close();
  }

  const wholeRunLeak = findSecret([runDir], o.apiKey);
  if (wholeRunLeak) aborted = `API key found in ${wholeRunLeak}`;
  const counted = records.filter((r) => r.status === "ok");
  if (counted.length) {
    const tokens = counted.reduce((s, r) => s + r.usage.prompt + r.usage.completion, 0) / counted.length;
    const cost = counted.reduce((s, r) => s + r.usage.cost, 0) / counted.length;
    writeAtomic(path.join(o.runsDir, "last-usage.json"), JSON.stringify({ run_id: o.runId, runs: counted.length, mean_tokens: Math.round(tokens), mean_cost: Number(cost.toFixed(4)) }, null, 2));
  }
  writeAtomic(path.join(runDir, "totals.json"), JSON.stringify({ totals: proxy.totals, aborted, runs: records.length, planned: tasks.length * o.k }, null, 2));
  o.log(`done: ${records.length}/${tasks.length * o.k} run(s), ${proxy.totals.prompt + proxy.totals.completion} tokens${o.pricing ? `, $${proxy.totals.cost.toFixed(4)}` : ""}${aborted ? ` - ${aborted}` : ""}`);
  return { runDir, records, planned: tasks.length * o.k, aborted };
}

/** A target like `specs/f/tasks/*.md` names a file an earlier step creates: take the first match, sorted. Anything else is returned as is. */
export function resolveTarget(repo: string, target: string): string {
  if (!target.includes("*")) return target;
  const dir = path.posix.dirname(target);
  const re = new RegExp(`^${path.posix.basename(target).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
  try {
    const hit = fs.readdirSync(path.join(repo, dir)).filter((n) => re.test(n)).sort()[0];
    return hit ? `${dir}/${hit}` : target;
  } catch {
    return target;
  }
}

function copyIf(from: string, to: string): void {
  try {
    if (fs.existsSync(from)) fs.copyFileSync(from, to);
  } catch {
    /* diagnostics only */
  }
}

/** job record, prompt, final text, log and trace go to the run folder; the committed diff becomes step<N>.diff.patch. */
function saveJobFiles(repo: string, jobId: string, n: number, outDir: string, git: (...a: string[]) => string): void {
  const jobs = path.join(repo, "specs", ".jobs");
  for (const ext of ["json", "final.txt", "prompt.txt", "log", "trace.jsonl"]) copyIf(path.join(jobs, `${jobId}.${ext}`), path.join(outDir, `step${n}.${ext}`));
  try {
    const job = JSON.parse(fs.readFileSync(path.join(jobs, `${jobId}.json`), "utf8")) as { startedSha?: string; endSha?: string };
    if (job.startedSha && job.endSha && job.startedSha !== job.endSha) fs.writeFileSync(path.join(outDir, `step${n}.diff.patch`), git("diff", "-U5", `${job.startedSha}..${job.endSha}`));
  } catch {
    /* no code range */
  }
}

/* ------------------------------------------------------------------------ CLI */

function loadEnvFile(file: string): void {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no env file */
  }
}

export function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) throw new Error(`unexpected argument: ${a}`);
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else out[key] = true;
  }
  return out;
}

function oneOf<T extends string>(v: string | true | undefined, allowed: readonly T[], flag: string): T | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  throw new Error(`${flag} must be one of: ${allowed.join(", ")}`);
}

const positive = (n: number | undefined, flag: string): number | undefined => {
  if (n !== undefined && !(n > 0)) throw new Error(`${flag} must be a positive number of seconds`);
  return n;
};

async function main(): Promise<void> {
  loadEnvFile(path.join(HERE, ".env"));
  const a = parseArgs(process.argv.slice(2));
  const num = (v: string | true | undefined): number | undefined => (typeof v === "string" && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const splitArg = typeof a.split === "string" ? a.split : "dev";
  if (!["dev", "heldout", "all", "confirm", "reserve"].includes(splitArg)) throw new Error(`--split must be dev, heldout, all, confirm or reserve`);
  // Confirm and reserve tasks are never run or scored from here (confirm.ts takes the one look); --validate is offline and only checks their fixtures.
  if ((splitArg === "confirm" || splitArg === "reserve") && a.validate !== true) throw new Error(`--split ${splitArg} is only for --validate: confirmation tasks are run by eval/confirm.ts, and reserve tasks are never run until promoted`);
  let pricing: Pricing | undefined;
  try {
    pricing = JSON.parse(fs.readFileSync(path.join(HERE, "pricing.json"), "utf8")) as Pricing;
  } catch {
    /* tokens-only caps */
  }
  const runsDir = path.join(ROOT, "runs");
  const opts: EvalOpts = {
    rootDir: ROOT,
    tasksRoots: taskRoots(HERE), // all four; `--split` decides which are opened (confirm and reserve are never selectable here)
    runsDir,
    runId: typeof a["run-id"] === "string" ? a["run-id"] : `${new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "")}-${crypto.randomBytes(2).toString("hex")}`,
    ...(typeof a.only === "string" ? { only: a.only.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
    k: num(a.k) ?? 1,
    splits: splitArg === "all" ? ["dev", "heldout"] : [splitArg as Split],
    parallel: num(a.parallel) ?? 1,
    dryRun: a["dry-run"] === true,
    yes: a.yes === true,
    maxTokens: num(a["max-tokens"]),
    maxCost: num(a["max-cost"]),
    arm: oneOf(a.arm, ["baseline", "candidate"], "--arm"),
    purpose: oneOf(a.purpose, ["calibration", "comparison"], "--purpose"),
    taskTimeoutS: positive(num(a["task-timeout"]), "--task-timeout") ?? 1200,
    upstreamTimeoutS: positive(num(a["upstream-timeout"]), "--upstream-timeout"),
    resume: a.resume === true,
    allowDirty: a["allow-dirty"] === true,
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    upstream: process.env.EVAL_UPSTREAM ?? "https://api.deepseek.com",
    gitBin: CFG.git,
    serverEnv: process.env,
    pricing,
    log: (l) => console.log(l),
  };
  if (opts.resume && typeof a["run-id"] !== "string") throw new Error("--resume needs --run-id <existing run>");
  // A live run is the only thing that spends money and produces evidence, so it must say whose evidence it is. No default: a
  // calibration run mistaken for a comparison baseline (or the reverse) is the mistake these two flags exist to stop.
  if (a.validate !== true && !opts.dryRun && !opts.resume && (!opts.arm || !opts.purpose)) throw new Error("a live run needs --arm baseline|candidate and --purpose calibration|comparison (there is no default)");
  if (a.validate === true) {
    // Offline: no key, no server, no model call.
    const tasks = loadTasks(opts.tasksRoots, opts.splits).filter((t) => !opts.only || opts.only.includes(t.id));
    const rows = await validateTasks(tasks, opts.gitBin, opts.log);
    const bad = rows.filter((r) => !r.ok).length;
    console.log(`validated ${tasks.length} task(s): ${rows.length - bad}/${rows.length} variant(s) ok`);
    if (bad) process.exitCode = 1;
    return;
  }
  const r = await runEval(opts);
  if (r.aborted) process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`eval failed: ${(e as Error).message}`);
    process.exit(1);
  });
}
