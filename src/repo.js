import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { CFG } from "./config.js";

export const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".venv", "__pycache__", ".cache"]);

export const toPosix = (p) => String(p).replace(/\\/g, "/");
export const rel = (p) => toPosix(path.relative(CFG.repo, p));

/** Run git. Output is trimmed unless `raw` (needed for `status -z`, where leading spaces are data). */
export function git(args, { raw = false } = {}) {
  try {
    const out = execFileSync(CFG.git, args, { cwd: CFG.repo, encoding: "utf8", timeout: 60000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, out: raw ? String(out) : String(out).trim() };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ""}\n${e.stderr || ""}`.trim() };
  }
}

/** Environment for model-controlled commands: no API keys or tokens. */
export function childEnv() {
  const e = { ...process.env };
  for (const k of Object.keys(e)) if (/^DEEPSEEK_/i.test(k) || /(API_KEY|SECRET|TOKEN)$/i.test(k)) delete e[k];
  // Claude Desktop does not run fnm/nvm shell hooks, so a bare `node` or `npm` in a test command can
  // resolve to an old install. Put the Node that runs this server first, so tests use the same one.
  // Windows can carry both `Path` and `PATH`, and the child would pick whichever sorts first - so
  // collapse every spelling into one variable that starts with this server's Node.
  const base = process.env.PATH ?? "";
  for (const k of Object.keys(e)) if (k.toLowerCase() === "path") delete e[k];
  e[process.platform === "win32" ? "Path" : "PATH"] = `${path.dirname(process.execPath)}${path.delimiter}${base}`;
  return e;
}

/** Async so a long test run never freezes the MCP server; kills the whole process tree on timeout. */
export function runCmd(command, timeoutMs = 600000) {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    let timedOut = false;
    const win = process.platform === "win32";
    const child = spawn(command, { cwd: CFG.repo, shell: true, env: childEnv(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true, detached: !win });
    const add = (d) => {
      out += d;
      if (out.length > 2_000_000) out = out.slice(-1_000_000);
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    const kill = () => {
      try {
        if (win) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
        else process.kill(-child.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);
    const finish = (pass, extra = "") => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ pass, out: (out + extra).trim() });
    };
    child.on("error", (e) => finish(false, `\n${e.message}`));
    child.on("close", (code) => finish(code === 0 && !timedOut, timedOut ? `\n[timed out after ${timeoutMs}ms]` : ""));
  });
}

/** Every change in the tree (untracked files listed individually), minus our own bookkeeping. */
export function changedFiles(root) {
  const args = ["status", "--porcelain", "-z", "-uall"];
  if (root) args.push("--", root);
  const r = git(args, { raw: true });
  if (!r.ok) return [];
  const parts = r.out.split("\0");
  const res = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    const code = e.slice(0, 2);
    const file = e.slice(3);
    if (/[RC]/.test(code)) i++; // renames/copies carry the original path as the next entry
    if (file.startsWith("specs/.jobs")) continue;
    res.push({ code: code.trim(), file });
  }
  return res;
}

/** file -> "mtime:size" for every changed file; lets a gate tell "touched by this job" from "already dirty". */
export function snapshot() {
  const o = {};
  for (const c of changedFiles()) {
    try {
      const st = fs.statSync(path.join(CFG.repo, c.file));
      o[c.file] = `${st.mtimeMs}:${st.size}`;
    } catch {
      o[c.file] = "gone";
    }
  }
  return o;
}

/**
 * Line ending the repo mostly uses, sampled from tracked text files. New files follow it,
 * so a CRLF checkout on Windows doesn't get LF-only files (and vice versa).
 */
export function detectRepoEol() {
  const files = git(["ls-files"]).out.split(/\r?\n/).filter((f) => /\.(js|mjs|cjs|ts|tsx|jsx|json|md|py|go|rs|java|cs|css|html|yml|yaml|txt)$/i.test(f)).slice(0, 60);
  let crlf = 0;
  let lf = 0;
  for (const f of files) {
    try {
      const txt = fs.readFileSync(path.join(CFG.repo, f), "utf8");
      const c = (txt.match(/\r\n/g) || []).length;
      const l = (txt.match(/\n/g) || []).length - c;
      if (c > 0 && l === 0) crlf++;
      else if (l > 0 && c === 0) lf++;
    } catch {
      /* deleted or unreadable */
    }
  }
  return crlf > lf ? "\r\n" : "\n";
}

export function commitsBetween(base) {
  return Number(git(["rev-list", "--count", `${base}..HEAD`]).out || 0) || 0;
}

export function diffFilesBetween(base) {
  return git(["diff", "--name-only", `${base}..HEAD`]).out.split(/\r?\n/).filter(Boolean);
}

/** Files on this branch relative to the merge base with `base` (what a reviewer sees). */
export function diffFilesAgainst(base) {
  return git(["diff", "--name-only", `${base}...HEAD`]).out.split(/\r?\n/).filter(Boolean);
}

export function diffSize(base) {
  let added = 0;
  let removed = 0;
  for (const line of git(["diff", "--numstat", `${base}..HEAD`]).out.split(/\r?\n/)) {
    const [a, b] = line.split("\t");
    added += Number(a) || 0;
    removed += Number(b) || 0;
  }
  return { added, removed };
}

const DIFF_EXCLUDES = [":(exclude,glob)**/.env", ":(exclude,glob)**/.env.*"];

/**
 * The code a finished job committed (startedSha..endSha), paged so Claude can read and judge it
 * directly. Secrets files are excluded. Doc, review and ask jobs have no code range.
 */
export function jobDiff(job, offset = 0, chunk = 30000) {
  if (!job.startedSha || !job.endSha) return { error: "this job has no committed code range (doc, review and ask jobs write no code)" };
  const range = `${job.startedSha}..${job.endSha}`;
  const files = git(["diff", "--name-only", range, "--", ".", ...DIFF_EXCLUDES]).out.split(/\r?\n/).filter(Boolean);
  const stat = git(["diff", "--stat", range, "--", ".", ...DIFF_EXCLUDES]).out;
  const full = git(["diff", "-U5", range, "--", ".", ...DIFF_EXCLUDES]).out;
  const from = Math.max(0, offset);
  const end = Math.min(full.length, from + chunk);
  return {
    from: job.startedSha.slice(0, 8),
    to: job.endSha.slice(0, 8),
    empty: files.length === 0,
    files,
    stat: stat.slice(0, 4000),
    total_chars: full.length,
    offset: from,
    diff: full.slice(from, end),
    next_offset: end < full.length ? end : null,
  };
}

export function commit(files, message) {
  if (!files.length) return { ok: false, out: "nothing to commit" };
  const add = git(["add", "--", ...files]);
  if (!add.ok) return add;
  return git(["-c", "commit.gpgsign=false", "commit", "-m", message]);
}

export function detectBaseRef() {
  const pinned = process.env.BASE_REF;
  if (pinned && git(["rev-parse", "--verify", pinned]).ok) return pinned;
  for (const b of ["main", "master"]) {
    if (git(["rev-parse", "--verify", b]).ok) return b;
  }
  const head = git(["rev-parse", "--short", "HEAD"]);
  return head.ok ? head.out : "HEAD";
}

const lc = (s) => (process.platform === "win32" ? s.toLowerCase() : s);
const inside = (a, root) => lc(a) === lc(root) || lc(a).startsWith(lc(root) + path.sep.toLowerCase());

/** Resolve a model-supplied path; refuse anything outside the repo, including via symlinks. */
export function resolveInRepo(p) {
  const root = path.resolve(CFG.repo);
  const abs = path.resolve(root, p || ".");
  if (!inside(abs, root)) throw new Error(`path escapes the repo: ${p}`);
  let probe = abs;
  while (!fs.existsSync(probe) && probe !== root) probe = path.dirname(probe);
  if (!inside(fs.realpathSync(probe), fs.realpathSync(root))) throw new Error(`path escapes the repo via symlink: ${p}`);
  return abs;
}

export function parseSummary(text) {
  if (!text) return null;
  const fence = /```(?:json)?\s*([\s\S]*?)```/gi;
  const blocks = [...String(text).matchAll(fence)].map((m) => m[1]);
  const candidates = blocks.length ? blocks.reverse() : [String(text)];
  for (const c of candidates) {
    const s = c.indexOf("{");
    const e = c.lastIndexOf("}");
    if (s < 0 || e <= s) continue;
    try {
      return JSON.parse(c.slice(s, e + 1));
    } catch {
      /* try the next block */
    }
  }
  return null;
}

export function tail(file, lines = 12) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
  } catch {
    return "";
  }
}

/* ---------------------------------------------------------------- job store */

/** Write-then-rename so a concurrent reader never sees a half-written file. */
export function writeJob(id, obj) {
  const file = path.join(CFG.jobs, `${id}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

export function readJob(id) {
  const p = path.join(CFG.jobs, `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function allJobs() {
  try {
    return fs
      .readdirSync(CFG.jobs)
      .filter((f) => /^[0-9a-f]{8}\.json$/.test(f))
      .map((f) => readJob(f.slice(0, -5)))
      .filter(Boolean)
      .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  } catch {
    return [];
  }
}

export function listJobs(n = 12) {
  return allJobs()
    .map((j) => ({ id: j.jobId, role: j.role, state: j.state, target: j.targetRel, startedAt: j.startedAt }))
    .slice(-n);
}

/** At startup nothing can be running, so any "running" record is a job the previous server died on. */
export function reapStaleJobs() {
  let n = 0;
  for (const j of allJobs()) {
    if (j.state !== "running") continue;
    writeJob(j.jobId, {
      ...j,
      state: "interrupted",
      finishedAt: new Date().toISOString(),
      result: { status: "interrupted", reasons: ["server restarted while this job was running"], role: j.role },
    });
    n++;
  }
  return n;
}

export function appendRunLog(entry) {
  try {
    fs.appendFileSync(path.join(CFG.jobs, "run-log.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch {
    /* never fail a request over logging */
  }
}
