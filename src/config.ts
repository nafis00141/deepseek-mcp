import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

// Minimal .env loader for local runs. Never overrides an already-set variable,
// so the env block from Claude Desktop always wins.
try {
  const f = path.join(ROOT, ".env");
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore */
}

const env = process.env;
const baseUrl = (env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");

const isFile = (p: string): boolean => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

/**
 * Git is often installed but not on PATH - GUI apps, SourceTree's bundled copy,
 * portable installs. Resolve it once, so the gates never depend on PATH.
 */
function discoverGit(): string {
  if (env.GIT_BIN && isFile(env.GIT_BIN)) return env.GIT_BIN;
  const local = env.LOCALAPPDATA || "";
  const pf = env.ProgramFiles || "C:\\Program Files";
  const pf86 = env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const candidates = [
    path.join(local, "Atlassian", "SourceTree", "git_local", "cmd", "git.exe"),
    path.join(local, "Atlassian", "SourceTree", "git_local", "bin", "git.exe"),
    path.join(pf, "Git", "cmd", "git.exe"),
    path.join(pf86, "Git", "cmd", "git.exe"),
    path.join(local, "Programs", "Git", "cmd", "git.exe"),
  ].filter(isFile);
  if (candidates.length) return candidates[0];
  try {
    // where.exe, not "where" - in PowerShell "where" is an alias for Where-Object
    const cmd = process.platform === "win32" ? "where.exe" : "which";
    const hit = execFileSync(cmd, ["git"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0];
    if (hit) return hit;
  } catch {
    /* not on PATH either */
  }
  return "git";
}

function pick<T extends string>(v: string | undefined, allowed: readonly T[], dflt: T, name: string): T {
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return dflt;
  const hit = allowed.find((a) => a === x);
  if (hit) return hit;
  console.error(`[handoff] ${name}="${v}" is not one of ${allowed.join("/")}; using ${dflt}`);
  return dflt;
}
const thinking = pick(env.DEEPSEEK_THINKING, ["enabled", "disabled"] as const, "enabled", "DEEPSEEK_THINKING");
const effort = pick(env.DEEPSEEK_EFFORT, ["low", "high", "max"] as const, "high", "DEEPSEEK_EFFORT");

/** How old tool results are cut when the conversation grows: `legacy` is the original behaviour, `extended` the cache-friendly one (Specs/long-context). */
export type ContextMode = "legacy" | "extended";

/** The limits that decide how much of the model's context window a job may use. Every default is the value that was hard-coded before. */
export interface ContextSettings {
  contextMode: ContextMode;
  /** conversation size (characters of JSON) at which old tool results start being cut */
  compactChars: number;
  /** fraction of the budget to cut down to once cutting starts; 0 = cut only as far as needed */
  compactLow: number;
  /** token budget for the conversation (0 = use compactChars); needs contextWindow */
  contextTokens: number;
  contextWindow: number;
  readBudgetChars: number;
  readMaxLines: number;
  resultLimitChars: number;
  /** refuse to send a request body larger than this (0 = no check) */
  maxRequestBytes: number;
  /** end a job once its cumulative input tokens reach this (0 = no cap) */
  jobInputTokenCap: number;
}

export const CONTEXT_MARGIN_TOKENS = 50000; // room kept below the window on top of MAX_TOKENS

/**
 * The token-aware and watermark compaction modes (Specs/long-context T2/T3) are not built yet. Until they are, settings that
 * only they would read are refused, so that an arm can never record a setting that did nothing.
 */
export const COMPACTION_BUILT = false;

/**
 * Read and validate the context settings from an environment. Throws one Error naming every bad variable, so a typo fails
 * at start-up instead of silently running with a different limit. An empty variable counts as unset.
 */
export function loadContextSettings(e: NodeJS.ProcessEnv, maxTokens: number, compactionBuilt: boolean = COMPACTION_BUILT): ContextSettings {
  const bad: string[] = [];
  if (!Number.isFinite(maxTokens) || maxTokens < 1) bad.push(`MAX_TOKENS must be a positive number (got ${String(maxTokens)})`);
  const raw = (name: string): string | undefined => {
    const v = e[name];
    return v === undefined || String(v).trim() === "" ? undefined : String(v).trim();
  };
  const int = (name: string, dflt: number, min: number, max: number): number => {
    const v = raw(name);
    if (v === undefined) return dflt;
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) {
      bad.push(`${name}="${v}" must be an integer from ${min} to ${max}`);
      return dflt;
    }
    return n;
  };
  const modeRaw = raw("CONTEXT_MODE")?.toLowerCase();
  let contextMode: ContextMode = "legacy";
  if (modeRaw === "legacy" || modeRaw === "extended") contextMode = modeRaw;
  else if (modeRaw !== undefined) bad.push(`CONTEXT_MODE="${modeRaw}" must be legacy or extended`);
  let compactLow = 0;
  const lowRaw = raw("COMPACT_LOW");
  if (lowRaw !== undefined) {
    const n = Number(lowRaw);
    if (!(n > 0 && n <= 1)) bad.push(`COMPACT_LOW="${lowRaw}" must be a number above 0 and at most 1`);
    else compactLow = n;
  }
  const s: ContextSettings = {
    contextMode,
    compactChars: int("COMPACT_CHARS", 220000, 1000, 16_000_000),
    compactLow,
    contextTokens: int("CONTEXT_TOKENS", 0, 0, 4_000_000),
    contextWindow: int("CONTEXT_WINDOW", 0, 0, 4_000_000),
    readBudgetChars: int("READ_BUDGET_CHARS", 30000, 100, 4_000_000),
    readMaxLines: int("READ_MAX_LINES", 400, 1, 200_000),
    resultLimitChars: int("RESULT_LIMIT_CHARS", 45000, 1000, 16_000_000),
    maxRequestBytes: int("MAX_REQUEST_BYTES", 0, 0, 128_000_000),
    jobInputTokenCap: int("JOB_INPUT_TOKEN_CAP", 0, 0, 2_000_000_000),
  };
  if (!compactionBuilt) {
    for (const [name, set] of [["COMPACT_CHARS", s.compactChars !== 220000], ["COMPACT_LOW", s.compactLow !== 0], ["CONTEXT_TOKENS", s.contextTokens !== 0], ["CONTEXT_WINDOW", s.contextWindow !== 0]] as const) {
      if (set) bad.push(`${name} is not supported yet (the new compaction modes are not built); remove it`);
    }
  }
  if ((s.contextTokens > 0) !== (s.contextWindow > 0)) bad.push("CONTEXT_TOKENS and CONTEXT_WINDOW must be set together");
  else if (s.contextTokens > 0 && s.contextMode !== "extended") bad.push("CONTEXT_TOKENS needs CONTEXT_MODE=extended");
  else if (s.contextTokens > 0 && s.contextTokens + maxTokens + CONTEXT_MARGIN_TOKENS > s.contextWindow) {
    bad.push(`CONTEXT_TOKENS ${s.contextTokens} + MAX_TOKENS ${maxTokens} + ${CONTEXT_MARGIN_TOKENS} margin does not fit in CONTEXT_WINDOW ${s.contextWindow}`);
  }
  if (bad.length) throw new Error(`invalid context settings: ${bad.join("; ")}`);
  return s;
}

export interface Config extends ContextSettings {
  root: string;
  repo: string;
  git: string;
  key: string;
  baseUrl: string;
  model: string;
  maxTurns: number;
  timeoutMs: number;
  requestTimeoutMs: number;
  diffCap: number;
  temperature: number;
  thinking: "enabled" | "disabled";
  effort: "low" | "high" | "max";
  maxTokens: number;
  baseRef: string | null;
  maxWaitS: number;
  maxRepairs: number;
  contextChars: number;
  maxFixRounds: number;
  specs: string;
  jobs: string;
}

const maxTokensSetting = Number(env.MAX_TOKENS || (thinking === "enabled" ? 32000 : 8000));

/**
 * A bad context setting must stop the server, but not every program that imports this module (the eval runner and the
 * tests read CFG too). So the problem is kept here, the defaults are used, and the server's start-up refuses to run.
 */
let contextSettings: ContextSettings;
export let configProblem: string | null = null;
try {
  contextSettings = loadContextSettings(env, maxTokensSetting);
} catch (e) {
  configProblem = (e as Error).message;
  contextSettings = loadContextSettings({}, maxTokensSetting);
}

export const CFG: Config = {
  ...contextSettings,
  root: ROOT,
  repo: path.resolve(env.REPO_ROOT || process.cwd()),
  git: discoverGit(),
  key: env.DEEPSEEK_API_KEY || "",
  baseUrl,
  model: env.DEEPSEEK_MODEL || "deepseek-chat",
  maxTurns: Number(env.MAX_TURNS || 30),
  timeoutMs: Number(env.TIMEOUT_MS || 900000),
  requestTimeoutMs: Number(env.REQUEST_TIMEOUT_MS || 300000),
  diffCap: Number(env.DIFF_CAP || 600),
  temperature: Number(env.TEMPERATURE || 0.2),
  thinking, // "enabled" | "disabled": DeepSeek thinking mode (default enabled)
  effort, // "low" | "high" | "max": reasoning effort, sent only while thinking is enabled (default high)
  // Reasoning tokens count against max_tokens, so thinking needs a much larger budget than plain replies.
  maxTokens: maxTokensSetting,
  baseRef: env.BASE_REF || null, // BASE_REF pins it; otherwise detected from the repo at each handoff
  maxWaitS: Number(env.MAX_WAIT_S || 45), // longest a tool call blocks; keeps under the client's tool timeout
  maxRepairs: Number(env.MAX_REPAIRS ?? 2), // in-job repair attempts after a failed self-check, before the gate judges
  contextChars: Number(env.CONTEXT_CHARS ?? 6000), // size of the context pack added to every prompt; 0 disables it
  maxFixRounds: Number(env.MAX_FIX_ROUNDS || 2), // fix rounds per task before escalating to the human
  specs: "",
  jobs: "",
};

CFG.specs = path.join(CFG.repo, "specs");
CFG.jobs = path.join(CFG.specs, ".jobs");
