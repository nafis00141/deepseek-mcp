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

const isFile = (p) => {
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
function discoverGit() {
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

const pick = (v, allowed, dflt, name) => {
  const x = String(v ?? "").trim().toLowerCase();
  if (!x) return dflt;
  if (allowed.includes(x)) return x;
  console.error(`[handoff] ${name}="${v}" is not one of ${allowed.join("/")}; using ${dflt}`);
  return dflt;
};
const thinking = pick(env.DEEPSEEK_THINKING, ["enabled", "disabled"], "enabled", "DEEPSEEK_THINKING");
const effort = pick(env.DEEPSEEK_EFFORT, ["low", "high", "max"], "high", "DEEPSEEK_EFFORT");

export const CFG = {
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
  maxTokens: Number(env.MAX_TOKENS || (thinking === "enabled" ? 32000 : 8000)),
  baseRef: env.BASE_REF || null, // BASE_REF pins it; otherwise detected from the repo at each handoff
  maxWaitS: Number(env.MAX_WAIT_S || 45), // longest a tool call blocks; keeps under the client's tool timeout
  maxRepairs: Number(env.MAX_REPAIRS ?? 2), // in-job repair attempts after a failed self-check, before the gate judges
  contextChars: Number(env.CONTEXT_CHARS ?? 6000), // size of the context pack added to every prompt; 0 disables it
  maxFixRounds: Number(env.MAX_FIX_ROUNDS || 2), // fix rounds per task before escalating to the human
};

CFG.specs = path.join(CFG.repo, "specs");
CFG.jobs = path.join(CFG.specs, ".jobs");
