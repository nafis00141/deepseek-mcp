/**
 * Shared fixture for the offline tests. No API key, no network: DeepSeek is a local mock server and the
 * repo under test is a throwaway git repo in the OS temp dir. Needs git (found the way the server finds it).
 *
 * Every *.test.ts file imports this module first. `node --test` runs each file in its own process, so each
 * file gets its own repo. (./env.ts must evaluate before src/config.ts; it is a synchronous dependency of this module.)
 */
import { repo, tmp } from "./env.ts"; // first: sets the environment src/config.ts reads at import time
import { CFG } from "../src/config.ts";
export { CFG, repo, tmp };
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import type { ChatMessage } from "../src/engine.ts";
import type { Task } from "../src/taskfile.ts";
import type { ExecResult, Job } from "../src/types.ts";

// --- mock DeepSeek: pops one scripted reply per request --------------------------------------------
export interface Scripted {
  message?: ChatMessage;
  status?: number;
  finish_reason?: string;
  /** Replaces the default usage block (prompt 10 / completion 5). */
  usage?: Record<string, unknown>;
  delayMs?: number;
}
export interface SeenBody {
  messages?: ChatMessage[];
  thinking?: { type?: string };
  reasoning_effort?: string;
  temperature?: number;
}
export const script: Scripted[] = [];
export const bodies: SeenBody[] = [];

const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c: Buffer) => (raw += c));
  req.on("end", () => {
    try {
      bodies.push(JSON.parse(raw) as SeenBody);
    } catch {
      /* not json */
    }
    const next = script.shift() ?? { message: { role: "assistant", content: "(script exhausted)" } };
    setTimeout(() => {
      if (next.status) {
        res.writeHead(next.status);
        res.end("mock error");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: next.message, finish_reason: next.finish_reason ?? "stop" }], usage: next.usage ?? { prompt_tokens: 10, completion_tokens: 5 } }));
    }, next.delayMs ?? 0);
  });
});
await new Promise<void>((r) => mock.listen(0, "127.0.0.1", () => r()));

CFG.baseUrl = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;

// --- repo helpers ------------------------------------------------------------------------------------
export const sh = (cmd: string, args: string[]) => spawnSync(cmd === "git" ? CFG.git : cmd, args, { cwd: repo, encoding: "utf8" });
export const gitOut = (...args: string[]): string => String(sh("git", args).stdout).trim();

export const put = (rel: string, content: string): void => {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
export const read = (rel: string): string => fs.readFileSync(path.join(repo, rel), "utf8");
export const exists = (rel: string): boolean => fs.existsSync(path.join(repo, rel));

if (sh("git", ["--version"]).status !== 0) {
  throw new Error(`git not found (tried: ${CFG.git}). Install Git for Windows or set GIT_BIN to git.exe, then rerun.`);
}
sh("git", ["init", "-q"]);
sh("git", ["symbolic-ref", "HEAD", "refs/heads/main"]);
put("package.json", JSON.stringify({ scripts: { test: "echo ok" } }));
put("src/a.js", "export const a = 1;\n");
put(".env", "SECRET=hunter2\n");
put(".gitignore", ".env\nspecs/.jobs/\n");
sh("git", ["add", "."]);
sh("git", ["commit", "-qm", "init"]);

/** Back to the fixture state: on main, clean tree, no other branches, empty mock. Call from beforeEach. */
export function resetRepo(): void {
  sh("git", ["reset", "-q", "--hard"]);
  sh("git", ["clean", "-fdq"]);
  sh("git", ["checkout", "-q", "main"]);
  for (const b of gitOut("for-each-ref", "--format=%(refname:short)", "refs/heads").split("\n")) if (b && b !== "main") sh("git", ["branch", "-D", b]);
  for (const t of gitOut("tag").split("\n")) if (t) sh("git", ["tag", "-d", t]);
  script.length = 0;
  bodies.length = 0;
}

/** Call from `after`. */
export function cleanup(): void {
  mock.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- fixtures ----------------------------------------------------------------------------------------
export const mkTask = (p: Partial<Task> = {}): Task => ({ path: "", rel: "specs/demo/tasks/01-x.md", id: "01", allowedPaths: [], dependsOn: [], testCommand: "", body: "", ...p });
export const mkJob = (p: Partial<Job> = {}): Job => ({
  jobId: "00000000", key: "", role: "impl", mode: "code", artifact: null, headings: [], targetRel: "", branch: null, reviewBranch: null,
  baseBranch: "main", baseSha: "", switched: false, createdBranch: false, startedFrom: null, task: null, allowedPaths: [], startedSha: "",
  startedChanges: {}, logPath: "", promptPath: "", packChars: 0, startedAt: "", state: "running", ...p,
});
export const mkRes = (p: Partial<ExecResult> = {}): ExecResult => ({ isError: false, turns: 1, usage: null, result: "", summary: null, gap: null, ...p });

/** A scripted model turn that calls one tool. */
export const toolCall = (name: string, args: unknown): Scripted => ({
  message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name, arguments: JSON.stringify(args) } }] },
});
/** A scripted final answer carrying a done summary block. */
export const finalDone: Scripted = {
  message: { role: "assistant", content: 'Done.\n```json\n{"status":"done","did":["added feature"],"not_done":[],"notes":""}\n```' },
};
