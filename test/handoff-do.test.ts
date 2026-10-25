import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { CFG } from "../src/config.ts";
import { removeDir } from "../eval/lib/fixture.ts";
import { McpClient } from "../eval/lib/mcp.ts";
import { allowlistEnv } from "../eval/lib/proc.ts";

/**
 * The real server over stdio, a throwaway repo, and a scripted stand-in for DeepSeek. Each model request pops one scripted
 * reply; when the script is empty the model just finishes with a done summary.
 */
const REPO = path.resolve(import.meta.dirname, "..");
const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-do-")));
const repo = path.join(root, "repo");

type Reply = Record<string, unknown>;
const script: Reply[] = [];
let modelCalls = 0;
const DONE = '```json\n{"status":"done","did":["changed it"],"not_done":[],"notes":""}\n```';
const say = (content: string): Reply => ({ message: { role: "assistant", content }, finish_reason: "stop" });
/** A scripted reply that the stand-in model sends only after `ms`, so a job stays running long enough to be interrupted by another call. */
const slow = (ms: number, reply: Reply): Reply => ({ ...reply, delay: ms });
const call = (name: string, args: unknown): Reply => ({ message: { role: "assistant", content: null, tool_calls: [{ id: `c${Math.random().toString(36).slice(2, 8)}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: "tool_calls" });

let stubServer: http.Server;
let client: McpClient;
/** the branch the first successful do job made: a real, server-made branch for the fix tests to start from */
let doBranch = "";
let fixBranch = "";

const git = (...args: string[]): string => String(spawnSync(CFG.git, args, { cwd: repo, encoding: "utf8" }).stdout).trim();
const write = (rel: string, text: string): void => {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), text);
};
const read = (rel: string): string => fs.readFileSync(path.join(repo, rel), "utf8");

before(async () => {
  stubServer = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      modelCalls++;
      const { delay, ...next } = (script.shift() ?? say(`All done.\n${DONE}`)) as Reply & { delay?: number };
      setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [next], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
      }, delay ?? 0);
    });
  });
  await new Promise<void>((r) => stubServer.listen(0, "127.0.0.1", () => r()));

  fs.mkdirSync(repo);
  git("init", "-q");
  git("symbolic-ref", "HEAD", "refs/heads/main");
  for (const [k, v] of [["user.name", "t"], ["user.email", "t@t"], ["commit.gpgsign", "false"], ["core.autocrlf", "false"]]) git("config", k!, v!);
  write("package.json", JSON.stringify({ name: "x", scripts: { test: "node --test tests/lib.test.js" } }));
  write(".gitignore", "specs/.jobs/\nspecs/review/\n");
  write("src/lib/parse.js", "module.exports = { parse: (s) => s.split(',') };\n");
  write("tests/lib.test.js", "const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { parse } = require('../src/lib/parse.js');\ntest('parses a comma list', () => { assert.deepEqual(parse('a,b'), ['a', 'b']); });\n");
  git("add", "-A");
  git("commit", "-qm", "init");

  client = new McpClient(
    path.join(REPO, "src", "server.ts"),
    allowlistEnv({ REPO_ROOT: repo, GIT_BIN: CFG.git, DEEPSEEK_API_KEY: "test-key", DEEPSEEK_BASE_URL: `http://127.0.0.1:${(stubServer.address() as AddressInfo).port}`, MAX_WAIT_S: "60", DEEPSEEK_MODEL: "m" }),
    repo,
  );
  await client.start();
});

after(() => {
  client?.close();
  stubServer?.closeAllConnections();
  stubServer?.close();
  removeDir(root);
});

/** handoff, then poll until the job leaves "running". */
async function handoff(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  let res = await client.call("handoff", { wait: false, ...args });
  const id = res.job_id;
  for (let i = 0; res.status === "running" && typeof id === "string" && i < 40; i++) res = { ...(await client.call("job_status", { job_id: id, wait_s: 30 })), job_id: id };
  return res;
}

const DO = { role: "do", target: "src/lib", paths: ["src/lib/**"], test_command: "node --test tests/lib.test.js" };
const trace = (id: string): { type: string; denied?: unknown; name?: string }[] => fs.readFileSync(path.join(repo, "specs", ".jobs", `${id}.trace.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { type: string });

describe("handoff role=do over the real server", () => {
  it("is listed, with its needs", async () => {
    const roles = (await client.call("roles", {})) as unknown as { role: string; needs: string[] }[];
    assert.deepEqual(roles.find((r) => r.role === "do")?.needs, ["instruction", "paths + test_command"]);
    assert.ok(roles.some((r) => r.role === "research"));
  });

  it("refuses a bad call before any model call: no paths, a catch-all, no literal folder, a protected place, a bad or unknown test command", async () => {
    const before = modelCalls;
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ ...DO, instruction: "x", paths: undefined }, /paths is required/],
      [{ ...DO, instruction: "x", paths: ["**"] }, /matches the whole repo/],
      [{ ...DO, instruction: "x", paths: ["**/*.js"] }, /no literal folder before its wildcard/],
      [{ ...DO, instruction: "x", paths: ["specs/**"] }, /protected location/],
      [{ ...DO, instruction: "x", paths: [".github/workflows/x.yml"] }, /protected location/],
      [{ ...DO, instruction: "x", test_command: undefined }, /test_command is required/],
      [{ ...DO, instruction: "x", test_command: "npx jest" }, /not allowed for role=do/],
      [{ ...DO, instruction: "x", test_command: "npm run deploy" }, /does not define/],
      [{ ...DO, instruction: undefined }, /needs an instruction/],
    ];
    for (const [args, re] of cases) {
      const r = await client.call("handoff", args);
      assert.equal(r.status, "blocked", JSON.stringify(args));
      assert.match(String(r.reason), re);
    }
    assert.equal(modelCalls, before, "no request reached the model");
    assert.equal(git("branch", "--list", "do/*"), "", "no branch was created");
    assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), "main");
  });

  it("runs on its own branch cut from main, commits once, passes the saved test command, and gives the human's branch back", async () => {
    script.push(call("write_file", { path: "src/lib/parse.js", content: "module.exports = { parse: (s) => s.split(/[,\\t]/).map((x) => x.trim()) };\n" }), say(`Fixed.\n${DONE}`));
    const r = await handoff({ ...DO, instruction: "make parse() split on tabs as well as commas" });
    assert.deepEqual([r.status, r.reasons], ["done", []]);
    const branch = String(r.branch);
    doBranch = branch;
    assert.match(branch, /^do\/[0-9a-f]{8}-[0-9a-z]+$/);
    assert.ok(branch.includes(String(r.job_id)), "the branch name carries the job id");
    assert.equal(r.started_from, "main");
    assert.deepEqual(r.files, ["src/lib/parse.js"]);
    assert.equal(git("rev-list", "--count", `main..${branch}`), "1");
    assert.match(git("log", "-1", "--format=%s", branch), /^task-do: do$/);
    assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), "main", "the human's branch is back");
    assert.equal(git("status", "--porcelain"), "");
    assert.equal(read("src/lib/parse.js"), "module.exports = { parse: (s) => s.split(',') };\n", "main still has the original: nothing leaked onto it");
    assert.match(git("show", `${branch}:src/lib/parse.js`), /split\(\/\[,\\t\]\//, "the change is on the do branch");
  });

  it("denies a write outside paths (and to the tests and package.json), records the refusals, and still finishes the in-scope part", async () => {
    git("checkout", "-q", "main");
    script.push(
      call("write_file", { path: "tests/lib.test.js", content: "// weakened\n" }),
      call("write_file", { path: "package.json", content: "{}" }),
      call("write_file", { path: "specs/.jobs/zzzzzzzz.json", content: "{}" }),
      call("write_file", { path: "src/lib/extra.js", content: "module.exports = 1;\n" }),
      say(`Wrote the helper only.\n${DONE}`),
    );
    const r = await handoff({ ...DO, instruction: "add a helper module" });
    assert.equal(r.status, "done", JSON.stringify(r.reasons));
    assert.deepEqual(r.files, ["src/lib/extra.js"]);
    const denied = trace(String(r.job_id)).filter((e) => e.type === "tool" && e.denied === "write").length;
    assert.equal(denied, 3, "three refused writes are in the trace");
    assert.equal(read("tests/lib.test.js").includes("weakened"), false);
    assert.equal(git("status", "--porcelain"), "");
  });

  it("an identical failed call is refused, a changed scope is a new call", async () => {
    script.push(say("SPEC_GAP: the two requirements contradict each other"));
    const first = await handoff({ ...DO, instruction: "make parse() return a number and a string", paths: ["src/lib/**"] });
    assert.equal(first.status, "failed");
    assert.match(JSON.stringify(first.reasons), /BLOCKED|SPEC_GAP/);
    const calls = modelCalls;
    const again = await client.call("handoff", { ...DO, instruction: "make parse() return a number and a string", paths: ["src/lib/**"] });
    assert.equal(again.status, "blocked");
    assert.match(String(again.reason), /identical to failed job/);
    assert.equal(modelCalls, calls, "the repeat never reached the model");
    script.push(say("SPEC_GAP: still contradictory"));
    const changed = await handoff({ ...DO, instruction: "make parse() return a number and a string", paths: ["src/lib/**", "tests/**"] });
    assert.equal(changed.status, "failed", "a different scope runs again (and fails again, here)");
    assert.ok(modelCalls > calls, "the changed call did reach the model");
    assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), "main");
  });

  it("fix can start from that branch although no fix job exists, and never commits onto it", async () => {
    assert.ok(doBranch, "the earlier test made a do branch");
    write("specs/f/tasks/01-x.md", "---\nid: 01\nallowed_paths: [src/**, tests/**]\ntest_command: node --test tests/lib.test.js\ndepends_on: []\n---\n# Task 01\n## Acceptance criteria\n- AC-1: parse splits on commas\n");
    write("specs/review/r.md", "# review\n- F1 major: parse() should trim whitespace around items\n");
    const tipBefore = git("rev-parse", doBranch);
    script.push(call("write_file", { path: "src/lib/parse.js", content: "module.exports = { parse: (s) => s.split(/[,\\t]/).map((x) => x.trim()).filter(Boolean) };\n" }), say(`Addressed F1.\n${DONE}`));
    const r = await handoff({ role: "fix", target: "specs/f/tasks/01-x.md", feedback_path: "specs/review/r.md", branch: doBranch, instruction: "address F1" });
    assert.equal(r.status, "done", JSON.stringify(r.reasons));
    assert.match(String(r.branch), /^fix\/01-[0-9a-z]+$/);
    assert.equal(r.started_from, doBranch);
    assert.equal(git("rev-parse", doBranch), tipBefore, "the source branch is untouched");
    assert.equal(git("rev-list", "--count", `${doBranch}..${String(r.branch)}`), "1");
    assert.equal(git("log", "-1", "--format=%s", String(r.branch)), "task-01: fix");
    assert.equal(git("rev-parse", "--abbrev-ref", "HEAD"), "main");
    fixBranch = String(r.branch);
  });

  it("a second fix on the same task continues the fix branch the server made; a third is escalated", async () => {
    script.push(call("write_file", { path: "src/lib/parse.js", content: "module.exports = { parse: (s) => s.split(/[,\\t]/).map((x) => x.trim()).filter((x) => x !== '') };\n" }), say(`Second pass.\n${DONE}`));
    const second = await handoff({ role: "fix", target: "specs/f/tasks/01-x.md", feedback_path: "specs/review/r.md", branch: doBranch, instruction: "tidy" });
    assert.equal(second.status, "done", JSON.stringify(second.reasons));
    assert.equal(second.branch, fixBranch, "continued onto the server's own fix branch, not the source");
    assert.equal(git("rev-list", "--count", `${doBranch}..${fixBranch}`), "2");
    const third = await client.call("handoff", { role: "fix", target: "specs/f/tasks/01-x.md", feedback_path: "specs/review/r.md", branch: doBranch, instruction: "once more" });
    assert.equal(third.status, "escalate");
    assert.match(String(third.reason), /2 fix round\(s\) already used/);
  });

  it("renaming the source branch does not reset the rounds: the same task is still escalated", async () => {
    git("branch", "do/renamed-copy", doBranch);
    const r = await client.call("handoff", { role: "fix", target: "specs/f/tasks/01-x.md", feedback_path: "specs/review/r.md", branch: "do/renamed-copy", instruction: "try the copy" });
    assert.equal(r.status, "escalate");
  });

  it("refuses the base branch, another prefix, a missing branch, a branch with no server-made commit and the branch you are on", async () => {
    write("specs/f/tasks/02-y.md", "---\nid: 02\nallowed_paths: [src/**]\ntest_command: node --test tests/lib.test.js\ndepends_on: []\n---\n# Task 02\n## Acceptance criteria\n- AC-1: x\n");
    git("checkout", "-q", "-b", "impl/handmade", "main");
    write("src/lib/hand.js", "module.exports = 1;\n");
    git("add", "src/lib/hand.js"); // not -A: the task file written above must stay untracked on main
    git("commit", "-qm", "wip");
    git("checkout", "-q", "main");
    const before = modelCalls;
    const ask = (branch: string) => client.call("handoff", { role: "fix", target: "specs/f/tasks/02-y.md", feedback_path: "specs/review/r.md", branch });
    const cases: [string, RegExp][] = [
      ["main", /is the base branch/],
      ["feature/x", /must start with impl\/, fix\/, test\/, do\//],
      ["do/none", /branch not found: do\/none/],
      ["impl/handmade", /no commit made by this server/],
    ];
    for (const [branch, re] of cases) {
      const r = await ask(branch);
      assert.equal(r.status, "blocked", branch);
      assert.match(String(r.reason), re, branch);
    }
    // a server-made branch this server has no job for (history would otherwise continue its own work), checked out by the human
    git("checkout", "-q", "-b", "impl/other", "main");
    write("src/lib/other.js", "module.exports = 2;\n");
    git("add", "src/lib/other.js");
    git("commit", "-qm", "task-09: impl");
    const current = await ask("impl/other");
    git("checkout", "-q", "main");
    assert.equal(current.status, "blocked");
    assert.match(String(current.reason), /branch you are on/);
    assert.equal(modelCalls, before, "no refusal reached the model");
  });

  it("test follows the same rule: for a task the server already worked on it continues that task's branch, as it always has", async () => {
    script.push(call("write_file", { path: "tests/lib.extra.test.js", content: "const test = require('node:test');\ntest('extra', () => {});\n" }), say(`Added a test.\n${DONE}`));
    // task 01 allows tests/**, which the test role needs (task 02 only allows src/**)
    const r = await handoff({ role: "test", target: "specs/f/tasks/01-x.md", branch: doBranch, instruction: "add an extra test" });
    assert.equal(r.status, "done", JSON.stringify(r.reasons ?? r.reason));
    assert.equal(r.branch, fixBranch, "one branch per task: the test job continues the fix branch");
    assert.equal(r.started_from, fixBranch);
    assert.deepEqual(r.files, ["tests/lib.extra.test.js"]);
  });

  it("safety: a fix started from a branch is held to its task's scope like any other job", async () => {
    git("checkout", "-q", "main");
    script.length = 0;
    // a fresh server-made branch (no history), so this is an external start; task 02 allows only src/**
    git("checkout", "-q", "-b", "impl/for-escape", "main");
    write("src/lib/esc.js", "module.exports = 3;\n");
    git("add", "src/lib/esc.js");
    git("commit", "-qm", "task-07: impl");
    git("checkout", "-q", "main");
    script.push(call("write_file", { path: "tests/lib.test.js", content: "// weakened by the fix\n" }), call("write_file", { path: "package.json", content: "{}" }), call("write_file", { path: "src/lib/esc.js", content: "module.exports = 4;\n" }), say(`Done.\n${DONE}`));
    const r = await handoff({ role: "fix", target: "specs/f/tasks/02-y.md", feedback_path: "specs/review/r.md", branch: "impl/for-escape", instruction: "bump it" });
    assert.equal(r.status, "done", JSON.stringify(r.reasons ?? r.reason));
    assert.deepEqual(r.files, ["src/lib/esc.js"]);
    assert.equal(trace(String(r.job_id)).filter((e) => e.type === "tool" && e.denied === "write").length, 2);
    assert.equal(git("show", `${String(r.branch)}:tests/lib.test.js`).includes("weakened"), false);
  });

  it("safety: one writer at a time holds for the new roles, and a read-only ask may overlap", async () => {
    script.length = 0;
    script.push(slow(2500, say(`Slow one.\n${DONE}`)));
    const first = await client.call("handoff", { ...DO, instruction: "a slow job", paths: ["src/lib/**", "tests/**"], wait: false });
    assert.equal(first.status, "running");
    const second = await client.call("handoff", { ...DO, instruction: "a second writer", paths: ["src/lib/**", "tests/**"] });
    assert.equal(second.status, "blocked");
    assert.match(String(second.reason), /is still running/);
    const research = await client.call("handoff", { role: "research", target: "specs/topic", instruction: "what is parse?" });
    assert.equal(research.status, "blocked", "a doc role is a writer too");
    const fix = await client.call("handoff", { role: "fix", target: "specs/f/tasks/02-y.md", feedback_path: "specs/review/r.md", branch: "impl/for-escape" });
    assert.equal(fix.status, "blocked");
    const ask = await client.call("handoff", { role: "ask", target: "src", instruction: "what is in src/lib?", wait: false });
    assert.equal(ask.status, "running", "a read-only ask is allowed alongside a writer");
    for (let i = 0; i < 30; i++) {
      const s = await client.call("job_status", { job_id: first.job_id, wait_s: 10 });
      if (s.status !== "running") {
        assert.equal(s.status, "noop", "the slow job changed nothing and its tests pass");
        break;
      }
    }
    for (let i = 0; i < 30; i++) if ((await client.call("job_status", { job_id: ask.job_id, wait_s: 10 })).status !== "running") break;
    git("checkout", "-q", "main");
  });

  it("the key ignores the order of paths: the same set in another order is still the same call", async () => {
    script.length = 0;
    script.push(say("SPEC_GAP: no"));
    const a = await handoff({ ...DO, instruction: "order test", paths: ["src/lib/**", "tests/**"].reverse() });
    assert.equal(a.status, "failed");
    const b = await client.call("handoff", { ...DO, instruction: "order test", paths: ["src/lib/**", "tests/**"] });
    assert.equal(b.status, "blocked");
  });
});
