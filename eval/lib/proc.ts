import path from "node:path";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

/** Variables a child may inherit. Everything else - above all DEEPSEEK_* and any key or token - is left out. */
const INHERIT = ["path", "systemroot", "windir", "comspec", "pathext", "temp", "tmp", "home", "userprofile", "homedrive", "homepath", "programfiles", "programfiles(x86)", "programdata", "git_bin", "lang", "tz"];

/** Server settings a task or the runner may pass through to the server under test. */
export const SERVER_SETTINGS = ["DEEPSEEK_MODEL", "DEEPSEEK_EFFORT", "DEEPSEEK_THINKING", "MAX_TOKENS", "MAX_TURNS", "TIMEOUT_MS", "REQUEST_TIMEOUT_MS", "MAX_REPAIRS", "CONTEXT_CHARS", "MAX_FIX_ROUNDS", "DIFF_CAP", "MAX_WAIT_S"];

/** An explicit allowlist, not a copy of process.env. The running Node comes first on PATH so test commands use it. */
export function allowlistEnv(extra: Record<string, string | undefined> = {}, from: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(from)) if (v !== undefined && INHERIT.includes(k.toLowerCase()) && k.toLowerCase() !== "path") env[k] = v;
  const base = Object.entries(from).find(([k]) => k.toLowerCase() === "path")?.[1] ?? "";
  env[process.platform === "win32" ? "Path" : "PATH"] = `${path.dirname(process.execPath)}${path.delimiter}${base}`;
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = v;
  return env;
}

/** Kill a child and everything it started (child.kill() leaves test subprocesses behind on Windows). */
export function killTree(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else process.kill(-child.pid, "SIGKILL"); // the whole group; needs a child started with `detached: true`
  } catch {
    // Not a group leader (or already gone): at least stop the child itself, or its pipes keep the parent alive.
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

export interface ProcResult {
  code: number | null;
  out: string;
  timedOut: boolean;
}

/** Run a command to completion with a timeout; the whole process tree is killed on timeout. */
export function runProc(cmd: string, args: string[], opts: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }): Promise<ProcResult> {
  return new Promise((resolve) => {
    let out = "";
    let timedOut = false;
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, detached: process.platform !== "win32" });
    const add = (d: Buffer): void => {
      out += d;
      if (out.length > 1_000_000) out = out.slice(-500_000);
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, opts.timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: null, out: `${out}\n${e.message}`, timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out: out.trim(), timedOut });
    });
  });
}
