import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { CFG } from "../src/config.ts";
import { runChecks } from "../eval/lib/checks.ts";
import { loadTasks, makeRepo, removeDir, taskRoots } from "../eval/lib/fixture.ts";
import { allowlistEnv } from "../eval/lib/proc.ts";
import { McpClient } from "../eval/lib/mcp.ts";
import { privateLabel } from "../eval/lib/privacy.ts";
import { validateTasks } from "../eval/lib/validate.ts";
import { costOf, startProxy } from "../eval/lib/proxy.ts";
import type { Pricing, StepResult } from "../eval/lib/types.ts";
import { findSecret, parseArgs, runEval } from "../eval/run.ts";
import type { EvalOpts } from "../eval/run.ts";

const REPO_DIR = path.resolve(import.meta.dirname, "..");
const scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-test-")));
after(() => removeDir(scratch));

const put = (root: string, rel: string, content: string): void => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

/** A stand-in for DeepSeek: records what it was asked and answers with one fixed final message. */
async function stubUpstream(reply: Record<string, unknown> = {}) {
  const seen: { auth: string; body: Record<string, unknown> }[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c: Buffer) => (raw += c));
    req.on("end", () => {
      seen.push({ auth: String(req.headers.authorization), body: JSON.parse(raw || "{}") as Record<string, unknown> });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        choices: [{ message: { role: "assistant", content: 'src/a.js:1 exports a.\n```json\n{"status":"done","did":["read"],"not_done":[],"notes":""}\n```' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 20, prompt_cache_hit_tokens: 40, completion_tokens_details: { reasoning_tokens: 7 } },
        ...reply,
      }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const close = () => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); });
  open.push(close);
  return { seen, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close };
}
const open: (() => Promise<void>)[] = []; // closed in `after`, so a failing assertion cannot leave the test process hanging
after(async () => { for (const c of open) await c(); });

const PRICING: Pricing = { per_million_tokens: { peak: { input_cache_hit: 1, input_cache_miss: 10, output: 100 }, off_peak: { input_cache_hit: 0, input_cache_miss: 0, output: 0 } }, use: "peak" };

describe("proxy", () => {
  it("injects the real key, hides the session bearer upstream, and counts usage", async () => {
    const up = await stubUpstream();
    const proxy = await startProxy({ upstream: up.url, apiKey: "sk-REAL-KEY-123456", pricing: PRICING });
    const s = proxy.session();
    const r = await fetch(`${proxy.url}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${s.bearer}`, "content-type": "application/json" }, body: JSON.stringify({ model: "m", max_tokens: 9 }) });
    assert.equal(r.status, 200);
    assert.deepEqual(up.seen.map((x) => x.auth), ["Bearer sk-REAL-KEY-123456"]);
    assert.deepEqual([s.stats.requests, s.stats.prompt, s.stats.completion, s.stats.reasoning, s.stats.cache_hit], [1, 100, 20, 7, 40]);
    assert.equal(s.stats.cost, costOf(PRICING, 100, 40, 20));
    assert.equal(costOf(PRICING, 100, 40, 20), (40 * 1 + 60 * 10 + 20 * 100) / 1e6);
    await proxy.close();
    await up.close();
  });

  it("rejects unknown bearers without contacting upstream", async () => {
    const up = await stubUpstream();
    const proxy = await startProxy({ upstream: up.url, apiKey: "sk-REAL-KEY-123456" });
    const r = await fetch(`${proxy.url}/chat/completions`, { method: "POST", headers: { authorization: "Bearer guess" }, body: "{}" });
    const none = await fetch(`${proxy.url}/chat/completions`, { method: "POST", body: "{}" });
    assert.deepEqual([r.status, none.status, up.seen.length], [401, 401, 0]);
    await proxy.close();
    await up.close();
  });

  it("refuses with a non-retryable 402 once the token cap is reached, and marks capped", async () => {
    const up = await stubUpstream();
    const proxy = await startProxy({ upstream: up.url, apiKey: "sk-REAL-KEY-123456", maxTokens: 100 });
    const s = proxy.session();
    const call = () => fetch(`${proxy.url}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${s.bearer}` }, body: "{}" });
    assert.equal((await call()).status, 200); // 120 tokens: over the cap, by at most one request
    assert.equal((await call()).status, 402);
    assert.deepEqual([up.seen.length, s.stats.capped, proxy.totals.capped], [1, true, true]);
    await proxy.close();
    await up.close();
  });

  it("injects scripted faults first, and overrides max_tokens", async () => {
    const up = await stubUpstream();
    const proxy = await startProxy({ upstream: up.url, apiKey: "sk-REAL-KEY-123456" });
    const s = proxy.session({ fail_first: [500, 429], max_tokens: 5 });
    const call = () => fetch(`${proxy.url}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${s.bearer}` }, body: JSON.stringify({ max_tokens: 32000 }) });
    assert.deepEqual([(await call()).status, (await call()).status, (await call()).status], [500, 429, 200]);
    assert.equal(up.seen.length, 1);
    assert.equal(up.seen[0]?.body.max_tokens, 5);
    await proxy.close();
    await up.close();
  });
});

describe("McpClient.close", () => {
  it("really stops the child (a leaked server process keeps `node --test` from ever exiting, as on the Linux CI)", async () => {
    const script = path.join(scratch, "sleeper.mjs");
    fs.writeFileSync(script, "setInterval(() => {}, 1000);\n");
    const client = new McpClient(script, allowlistEnv(), scratch);
    const pid = client.pid!;
    assert.ok(pid > 0);
    client.close();
    let alive = true;
    for (let i = 0; i < 50 && alive; i++) {
      try {
        process.kill(pid, 0);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        alive = false;
      }
    }
    assert.equal(alive, false, "the child process is gone within 5s");
  });
});

describe("child environment", () => {
  it("is an allowlist: no keys or tokens, running Node first on PATH", () => {
    const env = allowlistEnv({ REPO_ROOT: "x" }, { Path: "C:\\bin", DEEPSEEK_API_KEY: "sk-secret", GITHUB_TOKEN: "t", SOME_API_KEY: "k", SystemRoot: "C:\\Windows" });
    assert.ok(!JSON.stringify(env).includes("sk-secret") && !("GITHUB_TOKEN" in env) && !("SOME_API_KEY" in env));
    assert.equal(env.SystemRoot, "C:\\Windows");
    assert.equal(env.REPO_ROOT, "x");
    const p = String(env.Path ?? env.PATH);
    assert.ok(p.toLowerCase().startsWith(path.dirname(process.execPath).toLowerCase()) && p.includes("C:\\bin"));
  });
});

describe("fixture repo", () => {
  it("is a clean main-branch repo, writes CRLF files on request, and keeps them CRLF in git", () => {
    const dir = path.join(scratch, "fx1");
    put(dir, "repo/src/a.js", "export const a = 1;\nexport const b = 2;\n");
    put(dir, "repo/package.json", "{}");
    const fx = makeRepo({ dir, crlf_files: ["src/a.js"] }, CFG.git);
    try {
      assert.equal(fx.git("rev-parse", "--abbrev-ref", "HEAD"), "main");
      assert.equal(fx.git("status", "--porcelain"), "");
      assert.ok(fs.readFileSync(path.join(fx.repo, "src/a.js"), "utf8").includes("\r\n"));
      assert.ok(fx.git("show", "HEAD:src/a.js").includes("\r\n"));
      assert.match(fs.readFileSync(path.join(fx.repo, ".gitignore"), "utf8"), /specs\/\.jobs\//);
      assert.equal(fx.tmp, fs.realpathSync.native(fx.tmp));
    } finally {
      fx.remove();
    }
    assert.ok(!fs.existsSync(fx.tmp));
  });

  it("task folders: each private split has its own root; only the requested splits are opened; a task in the wrong folder is refused", () => {
    const evalDir = path.join(scratch, "eval-folders");
    const def = (id: string, split: string) => JSON.stringify({ id, family: "x", split, title: id, steps: [], checks: [], expect: { gate: "done" } });
    put(evalDir, "tasks/d1/task.json", def("d1", "dev"));
    put(evalDir, "heldout/h1/task.json", def("h1", "heldout"));
    put(evalDir, "confirm/c1/task.json", def("c1", "confirm"));
    put(evalDir, "reserve/r1/task.json", def("r1", "reserve"));
    const roots = taskRoots(evalDir);
    assert.deepEqual(roots.map((r) => path.basename(r)), ["tasks", "heldout", "confirm", "reserve"]);
    assert.deepEqual(loadTasks(roots, ["dev"]).map((t) => t.id), ["d1"]);
    assert.deepEqual(loadTasks(roots, ["dev", "heldout"]).map((t) => t.id), ["d1", "h1"]);
    assert.deepEqual(loadTasks(roots, ["confirm"]).map((t) => t.id), ["c1"]);
    assert.deepEqual(loadTasks(roots, ["reserve"]).map((t) => t.id), ["r1"]);
    put(evalDir, "tasks/leaked/task.json", def("leaked", "confirm")); // a private task left in the public folder
    assert.throws(() => loadTasks(roots, ["dev"]), /does not match the folder "tasks"/);
    fs.rmSync(path.join(evalDir, "tasks", "leaked"), { recursive: true });
    put(evalDir, "heldout/wrong/task.json", def("wrong", "dev")); // a dev task hidden in the held-out folder
    assert.throws(() => loadTasks(roots, ["dev"]), /does not match the folder "heldout"/);
  });

  it("loads tasks, filtering by split", () => {
    const root = path.join(scratch, "tasks-a");
    for (const [id, split] of [["t-dev", "dev"], ["t-held", "heldout"]]) put(root, `${id}/task.json`, JSON.stringify({ id, family: "ask", split, title: id, steps: [], checks: [], expect: { gate: "done" } }));
    assert.deepEqual(loadTasks([root], ["dev"]).map((t) => t.id), ["t-dev"]);
    assert.deepEqual(loadTasks([root], ["dev", "heldout"]).map((t) => t.id), ["t-dev", "t-held"]);
    put(root, "bad/task.json", JSON.stringify({ id: "other", split: "dev" }));
    assert.throws(() => loadTasks([root], ["dev"]), /must equal the folder name/);
  });
});

describe("hidden checks", () => {
  const dir = path.join(scratch, "fx2");
  put(dir, "repo/src/a.js", "module.exports = { add: (a, b) => a + b };\n");
  put(dir, "hidden/pass.test.js", "const t = require('node:test'); const a = require('node:assert'); t('add', () => a.equal(require('./src/a.js').add(1, 2), 3));\n");
  put(dir, "hidden/fail.test.js", "const t = require('node:test'); const a = require('node:assert'); t('add', () => a.equal(require('./src/a.js').add(1, 2), 4));\n");
  const step = (result: Record<string, unknown>): StepResult[] => [{ step: 1, role: "ask", job_id: null, status: String(result.status ?? "done"), result }];

  it("runs hidden node tests in a throwaway worktree and leaves the job repo untouched", async () => {
    const fx = makeRepo({ dir }, CFG.git);
    try {
      const before = fx.git("status", "--porcelain");
      const ctx = { repo: fx.repo, gitBin: CFG.git, hiddenDir: path.join(dir, "hidden"), steps: step({}) };
      const r = await runChecks([{ type: "node_test", files: ["pass.test.js"] }, { type: "node_test", files: ["fail.test.js"] }], ctx);
      assert.deepEqual(r.map((c) => c.pass), [true, false]);
      assert.equal(fx.git("status", "--porcelain"), before);
      assert.ok(!fs.existsSync(path.join(fx.repo, "pass.test.js")));
      assert.equal(fx.git("worktree", "list").split("\n").length, 1, "worktree removed");
    } finally {
      fx.remove();
    }
  });

  it("structural and answer checks", async () => {
    const fx = makeRepo({ dir }, CFG.git);
    try {
      const ctx = { repo: fx.repo, gitBin: CFG.git, hiddenDir: path.join(dir, "hidden"), steps: step({ answer: "add lives in src/a.js:1 and returns a + b", verdict: "FAIL", n: { x: 3 } }) };
      const clean = await runChecks([{ type: "tree_clean" }, { type: "no_commit" }, { type: "commit_count", equals: 0 }, { type: "file_contains", path: "src/a.js", pattern: "a \\+ b" }, { type: "file_not_contains", path: "src/a.js", pattern: "TODO" }, { type: "answer_cites", file: "src/a.js", line: 2, tolerance: 1 }, { type: "answer_cites", file: "src/a.js", line: 40 }, { type: "answer_not_matches", pattern: "I guess" }, { type: "verdict_is", value: "fail" }, { type: "result_field", path: "n.x", equals: 3 }, { type: "nope" }], ctx);
      assert.deepEqual(clean.map((c) => c.pass), [true, true, true, true, true, true, false, true, true, true, false]);
      fs.writeFileSync(path.join(fx.repo, "stray.txt"), "x");
      const dirty = await runChecks([{ type: "tree_clean" }, { type: "only_changed_under", prefix: "specs/" }], ctx);
      assert.deepEqual(dirty.map((c) => c.pass), [false, false]);
    } finally {
      fx.remove();
    }
  });
});

describe("runner end to end (real server, stub upstream)", () => {
  const KEY = "sk-REAL-TEST-KEY-9f3a7c1d";
  const tasksRoot = path.join(scratch, "tasks-e2e");
  const base = { id: "ask-stub", family: "ask", split: "dev", title: "stub question", steps: [{ role: "ask", target: "src", instruction: "What does a.js export?" }], expect: { gate: "done" }, checks: [{ type: "answer_cites", file: "src/a.js", line: 1 }, { type: "tree_clean" }] };
  put(tasksRoot, "ask-stub/task.json", JSON.stringify(base));
  put(tasksRoot, "ask-stub/repo/src/a.js", "export const a = 1;\n");
  put(tasksRoot, "ask-stub/repo/package.json", JSON.stringify({ scripts: { test: "echo ok" } }));
  put(tasksRoot, "ask-flaky/task.json", JSON.stringify({ ...base, id: "ask-flaky", proxy: { fail_first: [500] } }));
  put(tasksRoot, "ask-flaky/repo/src/a.js", "export const a = 1;\n");

  const opts = (up: string, over: Partial<EvalOpts> = {}): EvalOpts => ({
    rootDir: path.resolve(import.meta.dirname, ".."), tasksRoots: [tasksRoot], runsDir: path.join(scratch, "runs"), runId: "r1", k: 1, splits: ["dev"], parallel: 1,
    dryRun: false, yes: true, maxTokens: 1_000_000, taskTimeoutS: 120, resume: false, allowDirty: true, apiKey: KEY, upstream: up, gitBin: CFG.git, serverEnv: {}, log: () => {}, ...over,
  });

  it("runs a task through the real server, applies checks, writes the run folder, and never leaks the key", async () => {
    const up = await stubUpstream();
    const r = await runEval(opts(up.url, { only: ["ask-stub"], pricing: PRICING }));
    const rec = r.records[0]!;
    assert.deepEqual([rec.status, rec.complete, rec.gate_status], ["ok", true, "done"]);
    assert.deepEqual(rec.checks.map((c) => c.pass), [true, true]);
    assert.deepEqual([rec.usage.prompt, rec.usage.completion, rec.usage.reasoning, rec.usage.cache_hit], [100, 20, 7, 40]);
    assert.ok(up.seen.every((x) => x.auth === `Bearer ${KEY}`), "upstream only ever sees the real key");

    const out = path.join(r.runDir, "ask-stub", "1");
    const trace = fs.readFileSync(path.join(out, "step1.trace.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { type: string; reasoning_tokens?: number | null; status?: string; state?: string });
    assert.deepEqual(trace.map((e) => e.type), ["job_start", "turn", "gate", "job_end"]);
    assert.equal(trace[1]?.reasoning_tokens, 7);
    assert.deepEqual([trace[2]?.status, trace[3]?.state], ["done", "done"]);
    for (const f of ["checks.json", "step1.json", "step1.prompt.txt", "step1.final.txt", "server.stderr.log"]) assert.ok(fs.existsSync(path.join(out, f)), f);
    const manifest = JSON.parse(fs.readFileSync(path.join(r.runDir, "manifest.json"), "utf8")) as { server_hash: string; settings: Record<string, string> };
    assert.match(manifest.server_hash, /^[0-9a-f]{40}$/);
    assert.equal(manifest.settings.DEEPSEEK_MODEL, "deepseek-flash");
    assert.equal(findSecret([r.runDir, scratch + path.sep + "runs"], KEY), null, "key appears in no run file");
    assert.ok(fs.existsSync(path.join(r.runDir, "server", "src", "server.ts")), "server code is pinned in the run folder");
    assert.equal(JSON.parse(fs.readFileSync(path.join(scratch, "runs", "last-usage.json"), "utf8")).mean_tokens, 120);

    // --resume skips complete runs: no further upstream request
    const n = up.seen.length;
    const again = await runEval(opts(up.url, { only: ["ask-stub"], resume: true }));
    assert.equal(again.records[0]?.complete, true);
    assert.equal(up.seen.length, n);
    await up.close();
  });

  it("records arm, purpose, lineage and the held-out set in the manifest, and a resume keeps what the first pass recorded", async () => {
    const up = await stubUpstream();
    const first = await runEval(opts(up.url, { only: ["ask-stub"], runId: "r-manifest", arm: "candidate", purpose: "comparison" }));
    const m1 = JSON.parse(fs.readFileSync(path.join(first.runDir, "manifest.json"), "utf8")) as Record<string, unknown>;
    assert.deepEqual([m1.arm, m1.purpose], ["candidate", "comparison"]);
    assert.ok(m1.lineage === null || /^[0-9a-f]{40}$/.test(String(m1.lineage)), "lineage is a tree hash, or null outside a git checkout");
    assert.ok("heldout_hash" in m1 && "heldout_count" in m1 && "merge_base" in m1);
    await runEval(opts(up.url, { only: ["ask-stub"], runId: "r-manifest", resume: true, arm: "baseline", purpose: "calibration" }));
    const m2 = JSON.parse(fs.readFileSync(path.join(first.runDir, "manifest.json"), "utf8")) as Record<string, unknown>;
    assert.deepEqual([m2.arm, m2.purpose, m2.lineage, m2.git_sha, m2.started], [m1.arm, m1.purpose, m1.lineage, m1.git_sha, m1.started]);
    await up.close();
  });

  it("a held-out task's id and title reach no log line, manifest or public file; its details go under private/heldout/", async () => {
    put(tasksRoot, "zz-secret-held/task.json", JSON.stringify({ ...base, id: "zz-secret-held", split: "heldout", title: "zz secret held title" }));
    put(tasksRoot, "zz-secret-held/repo/src/a.js", "export const a = 1;\n");
    const up = await stubUpstream();
    const lines: string[] = [];
    const r = await runEval(opts(up.url, { only: ["zz-secret-held"], splits: ["dev", "heldout"], runId: "r-priv", log: (l) => lines.push(l) }));
    assert.equal(r.records[0]?.status, "ok");
    assert.ok(!lines.join("\n").includes("zz-secret-held") && !lines.join("\n").includes("zz secret held title"), "no id or title in the console log");
    assert.ok(lines.some((l) => l.includes(privateLabel("zz-secret-held"))), "the hashed label is shown instead");
    const manifest = fs.readFileSync(path.join(r.runDir, "manifest.json"), "utf8");
    assert.ok(!manifest.includes("zz-secret-held") && manifest.includes(privateLabel("zz-secret-held")));
    assert.ok(fs.existsSync(path.join(r.runDir, "private", "heldout", "zz-secret-held", "1", "checks.json")));
    const outside: string[] = [];
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === "private" || e.name === "server") continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (fs.readFileSync(p, "utf8").includes("zz-secret-held")) outside.push(e.name);
      }
    };
    walk(r.runDir);
    assert.deepEqual(outside, [], "no file outside private/ names the task");
    await up.close();
  });

  it("records the server's retry of an injected 500", async () => {
    const up = await stubUpstream();
    const r = await runEval(opts(up.url, { only: ["ask-flaky"], runId: "r2" }));
    const trace = fs.readFileSync(path.join(r.runDir, "ask-flaky", "1", "step1.trace.jsonl"), "utf8");
    assert.match(trace, /"type":"api_retry","attempt":1,"status":500/);
    assert.equal(r.records[0]?.status, "ok");
    assert.equal(up.seen.length, 1, "the faulted request never reached upstream");
    await up.close();
  });

  it("follows a job that outlasts the handoff wait (job_status replies carry no job_id)", async () => {
    const up = await stubUpstream();
    const slow = http.createServer((req, res) => {
      req.resume();
      req.on("end", () => setTimeout(() => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: 'src/a.js:1 slow answer here.\n```json\n{"status":"done","did":[],"not_done":[],"notes":""}\n```' }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 5 } }));
      }, 2500));
    });
    await new Promise<void>((r) => slow.listen(0, "127.0.0.1", () => r()));
    open.push(() => new Promise<void>((r) => { slow.closeAllConnections(); slow.close(() => r()); }));
    const r = await runEval(opts(`http://127.0.0.1:${(slow.address() as AddressInfo).port}`, { only: ["ask-stub"], runId: "r6", serverEnv: { MAX_WAIT_S: "1" } }));
    const rec = r.records[0]!;
    assert.deepEqual([rec.status, rec.complete, rec.gate_status], ["ok", true, "done"]);
    assert.ok(rec.steps[0]?.job_id, "the job id is kept, so its files are saved");
    assert.ok(fs.existsSync(path.join(r.runDir, "ask-stub", "1", "step1.trace.jsonl")));
    await up.close();
  });

  it("marks a run capped (not complete) when the proxy cap is hit, and stops starting runs", async () => {
    const up = await stubUpstream();
    const r = await runEval(opts(up.url, { only: ["ask-stub"], runId: "r3", k: 3, maxTokens: 50 }));
    assert.deepEqual(r.records.map((x) => [x.status, x.complete]), [["ok", true], ["capped", false]]);
    assert.ok(r.aborted?.includes("cap"));
    await up.close();
  });

  it("dry-run makes no upstream request and starts no server; live needs a cap and --yes", async () => {
    const up = await stubUpstream();
    const lines: string[] = [];
    const dry = await runEval(opts(up.url, { dryRun: true, runId: "r4", log: (l) => lines.push(l) }));
    assert.deepEqual([dry.records.length, dry.planned, up.seen.length], [0, 2, 0]);
    assert.ok(lines.some((l) => l.includes("estimate")));
    assert.ok(!fs.existsSync(path.join(scratch, "runs", "r4")));
    await assert.rejects(runEval(opts(up.url, { runId: "r5", maxTokens: undefined })), /hard cap/);
    await assert.rejects(runEval(opts(up.url, { runId: "r5", yes: false })), /--yes/);
    await assert.rejects(runEval(opts(up.url, { runId: "r5", apiKey: "" })), /DEEPSEEK_API_KEY/);
    await assert.rejects(runEval(opts(up.url, { runId: "r5", maxTokens: undefined, maxCost: 1 })), /pricing/);
    await up.close();
  });
});

describe("task validation (--validate)", () => {
  const evalDir = path.resolve(import.meta.dirname, "..", "eval");

  it("every shipped task: the unsolved fixture fails, the reference passes, the decoy is accepted but wrong", async () => {
    const tasks = loadTasks([path.join(evalDir, "tasks"), path.join(evalDir, "heldout")], ["dev", "heldout"]);
    assert.ok(tasks.length >= 5, "the shipped dev suite is present (held-out tasks are gitignored and may be absent)");
    const rows = await validateTasks(tasks, CFG.git, () => {});
    assert.deepEqual(rows.filter((r) => !r.ok), []);
    assert.equal(rows.length, tasks.filter((t) => !t.needs_role).length * 3);
  });

  it("flags a task whose decoy proves nothing and whose reference does not pass", async () => {
    const dir = path.join(scratch, "tasks-bad", "bad");
    put(dir, "task.json", JSON.stringify({ id: "bad", family: "ask", split: "dev", title: "bad", steps: [{ role: "ask", target: "src" }], checks: [{ type: "answer_matches", pattern: "yes" }], expect: { gate: "done" } }));
    put(dir, "repo/src/a.js", "x\n");
    put(dir, "reference/outcome.json", JSON.stringify({ steps: [{ status: "done", result: { answer: "no" } }] }));
    put(dir, "decoy/outcome.json", JSON.stringify({ steps: [{ status: "done", result: { answer: "yes" } }] }));
    const rows = await validateTasks(loadTasks([path.join(scratch, "tasks-bad")], ["dev"]), CFG.git, () => {});
    assert.deepEqual(rows.map((r) => [r.variant, r.ok]), [["unsolved", true], ["reference", false], ["decoy", false]]);
    assert.match(rows[1]!.problems.join(), /reference fails/);
    assert.match(rows[2]!.problems.join(), /proves nothing/);
  });
});

describe("cli: private splits", () => {
  const runTs = path.join(REPO_DIR, "eval", "run.ts");
  const cli = (...args: string[]) => spawnSync(process.execPath, [runTs, ...args], { encoding: "utf8", env: allowlistEnv() });

  it("confirm and reserve can be validated offline but never run or dry-run from the runner", () => {
    for (const split of ["confirm", "reserve"]) {
      const dry = cli("--split", split, "--dry-run");
      assert.notEqual(dry.status, 0);
      assert.match(dry.stderr, new RegExp(`--split ${split} is only for --validate`));
      const validate = cli("--validate", "--split", split);
      assert.equal(validate.status, 0, validate.stderr);
      assert.match(validate.stdout, /validated \d+ task\(s\)/);
    }
    assert.match(cli("--split", "bogus").stderr, /--split must be dev, heldout, all, confirm or reserve/);
  });
});

describe("cli args", () => {
  it("parses flags with and without values", () => {
    assert.deepEqual(parseArgs(["--arm", "baseline", "--purpose", "comparison"]), { arm: "baseline", purpose: "comparison" });
    assert.deepEqual(parseArgs(["--only", "a,b", "--k", "3", "--dry-run"]), { only: "a,b", k: "3", "dry-run": true });
    assert.throws(() => parseArgs(["stray"]), /unexpected/);
  });
});
