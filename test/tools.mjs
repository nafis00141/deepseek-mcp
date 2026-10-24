/**
 * Offline tests. No API key, no network: DeepSeek is a local mock server and the
 * repo under test is a throwaway git repo in the OS temp dir. Needs git (found like the server does).
 *   node test/tools.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsmcp-"));
const repo = path.join(tmp, "repo");
fs.mkdirSync(repo);

// Mock DeepSeek: pops one scripted reply per request.
const script = [];
const bodies = [];
const mock = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    try {
      bodies.push(JSON.parse(raw));
    } catch {
      /* not json */
    }
    const next = script.shift() ?? { message: { role: "assistant", content: "(script exhausted)" } };
    if (next.status) {
      res.writeHead(next.status).end("boom");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: next.message, finish_reason: next.finish_reason ?? "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
  });
});
await new Promise((r) => mock.listen(0, "127.0.0.1", r));

// Must be set before config.js is imported (and beat any developer .env).
Object.assign(process.env, {
  REPO_ROOT: repo,
  BASE_REF: "main",
  DEEPSEEK_API_KEY: "test-key",
  DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.address().port}`,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
});

// Same git lookup the server uses (GIT_BIN, PATH, SourceTree's copy, Program Files), not just PATH.
const { CFG } = await import("../src/config.js");
const sh = (cmd, args) => spawnSync(cmd === "git" ? CFG.git : cmd, args, { cwd: repo, encoding: "utf8" });
if (sh("git", ["--version"]).status !== 0) {
  console.error(`FAIL: git not found (tried: ${CFG.git}). Install Git for Windows or set GIT_BIN to git.exe, then rerun.`);
  process.exit(1);
}

const { executeTool, capsFor, packResult, runAgent } = await import("../src/engine.js");
const { ROLES, buildPrompt } = await import("../src/roles.js");
const { buildContextPack } = await import("../src/context.js");
const { parseSummary, changedFiles, runCmd, snapshot, commit, git, detectRepoEol, childEnv, jobDiff } = await import("../src/repo.js");
const { matchAny, readTask, scopeProblems, globsOverlap, isTestGlob } = await import("../src/taskfile.js");
const { gate, makeVerifier, report } = await import("../src/gates.js");
const { planBranch, latestBranchFor, restoreBranch, branchExists, discardBranch } = await import("../src/branching.js");

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  let ok;
  if (typeof want === "function") ok = want(got);
  else if (typeof want === "string") ok = typeof got === "string" ? got === want : Boolean(got && got.error && String(got.error).includes(want));
  else ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else {
    fail++;
    console.log(`  got:  ${JSON.stringify(got)}\n  want: ${typeof want === "function" ? "(predicate)" : JSON.stringify(want)}`);
  }
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
};
const put = (rel, content) => {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};

// --- fixture repo -----------------------------------------------------------
sh("git", ["init", "-q"]);
sh("git", ["symbolic-ref", "HEAD", "refs/heads/main"]);
put("package.json", JSON.stringify({ scripts: { test: "echo ok" } }));
put("src/a.js", "export const a = 1;\n");
put(".env", "SECRET=hunter2\n");
put(".gitignore", ".env\nspecs/.jobs/\n");
sh("git", ["add", "."]);
sh("git", ["commit", "-qm", "init"]);

const task = { allowedPaths: ["src/**", "tests/**"], testCommand: "echo ok", id: "01", rel: "specs/demo/tasks/01-x.md" };
const caps = capsFor("impl", ROLES.impl, task);

// --- write / edit / read / grep --------------------------------------------
check("write inside allowed paths", await executeTool("write_file", { path: "src/_probe.txt", content: "hello" }, caps), { written: "src/_probe.txt", bytes: 5 });
check("write outside allowed paths", await executeTool("write_file", { path: "package.json", content: "{}" }, caps), "not permitted");
check("write escaping the repo", await executeTool("write_file", { path: "../escape.txt", content: "x" }, caps), "not permitted");
const before = fs.readFileSync(path.join(repo, "package.json"), "utf8");
check("write via src/../ traversal", await executeTool("write_file", { path: "src/../package.json", content: "PWNED" }, caps), "not permitted");
check("traversal left the file untouched", fs.readFileSync(path.join(repo, "package.json"), "utf8") === before, true);
check("./ prefix is normalised", await executeTool("write_file", { path: "./src/x2.txt", content: "y" }, caps), { written: "src/x2.txt", bytes: 1 });
check("env files are never writable", await executeTool("write_file", { path: "src/.env", content: "x" }, caps), "not permitted");
check("code roles cannot write specs/", await executeTool("write_file", { path: "specs/x.md", content: "x" }, capsFor("impl", ROLES.impl, { ...task, allowedPaths: ["specs/**"] })), "not permitted");
if (process.platform !== "win32") {
  const outside = path.join(tmp, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(repo, "src", "link"));
  check("write through a symlink out of the repo", await executeTool("write_file", { path: "src/link/x.txt", content: "x" }, caps), "symlink");
  fs.unlinkSync(path.join(repo, "src", "link"));
}
check("edit exact string", await executeTool("edit_file", { path: "src/_probe.txt", old: "hello", new: "world" }, caps), { edited: "src/_probe.txt", bytes: 5 });
check("edit with no match", await executeTool("edit_file", { path: "src/_probe.txt", old: "zzz", new: "y" }, caps), "not found");
check("read returns numbered lines", (await executeTool("read_file", { path: "src/_probe.txt" }, caps)).content, "1\tworld");
check("read refuses .env", await executeTool("read_file", { path: ".env" }, caps), "not permitted");
check("grep finds the file", (await executeTool("grep", { pattern: "world", path: "src" }, caps)).count, 1);
check("grep never reads .env", (await executeTool("grep", { pattern: "hunter2" }, caps)).count, 0);
check("list_dir hides .env", (await executeTool("list_dir", { path: "." }, caps)).entries.includes(".env"), false);
check("run_tests runs declared command", (await executeTool("run_tests", {}, caps)).pass, true);

// --- line endings ------------------------------------------------------------
put("src/crlf.js", "a\r\nb\r\nc\r\n");
put("src/lf.js", "a\nb\n");
put("src/mix.js", "a\r\nb\nc\n");
const read = (r) => fs.readFileSync(path.join(repo, r), "utf8");
check("edit: multi-line old matches a CRLF file", (await executeTool("edit_file", { path: "src/crlf.js", old: "a\nb", new: "x\ny" }, caps)).edited, "src/crlf.js");
check("edit: CRLF file stays pure CRLF", read("src/crlf.js"), "x\r\ny\r\nc\r\n");
await executeTool("edit_file", { path: "src/lf.js", old: "a\nb", new: "x\ny" }, caps);
check("edit: LF file stays LF", read("src/lf.js"), "x\ny\n");
check("edit: mixed file is matched exactly", (await executeTool("edit_file", { path: "src/mix.js", old: "b\nc", new: "B\nC" }, caps)).edited, "src/mix.js");
check("edit: mixed file keeps both endings", read("src/mix.js"), "a\r\nB\nC\n");
check("edit: mixed file does not guess", await executeTool("edit_file", { path: "src/mix.js", old: "a\nB", new: "z" }, caps), "not found");
check("edit: empty old rejected", await executeTool("edit_file", { path: "src/lf.js", old: "", new: "z" }, caps), "must not be empty");
await executeTool("write_file", { path: "src/crlf.js", content: "p\nq\n" }, caps);
check("write: overwriting a CRLF file keeps CRLF", read("src/crlf.js"), "p\r\nq\r\n");
await executeTool("write_file", { path: "src/fresh.js", content: "n\n" }, caps);
check("write: new file follows the repo's line ending (LF here)", read("src/fresh.js"), "n\n");
for (let i = 0; i < 12; i++) put(`src/crlf${i}.js`, "a\r\nb\r\n");
sh("git", ["add", "src"]);
check("repo EOL detection picks CRLF when most tracked files use it", detectRepoEol(), "\r\n");
sh("git", ["rm", "-rq", "--cached", "src"]);
sh("git", ["add", "src/a.js"]);
for (const f of fs.readdirSync(path.join(repo, "src"))) if (f !== "a.js") fs.rmSync(path.join(repo, "src", f), { recursive: true, force: true });

// --- context pack ------------------------------------------------------------
put("CONVENTIONS.md", "Use tabs. Never default-export.\n");
const pack = buildContextPack({ scope: ["src/**"], targetRel: "specs/demo" });
check("pack: includes conventions", pack.includes("Never default-export"), true);
check("pack: includes npm scripts", pack.includes("npm run test"), true);
check("pack: lists the task's directory", pack.includes("src/a.js"), true);
check("pack: stays inside the budget", pack.length <= CFG.contextChars, true);
check("pack: never leaks secrets", !pack.includes("hunter2") && !/(^|\s)\.env(\s|$)/m.test(pack), true);
CFG.contextChars = 0;
check("pack: CONTEXT_CHARS=0 disables it", buildContextPack({ scope: ["src/**"] }), "");
CFG.contextChars = 6000;
check("prompt: pack is appended after the rules", buildPrompt("ask", { instruction: "q", target: "src", pack: "PACKX" }).split("# Context pack")[1]?.includes("PACKX"), true);
check("prompt: no pack, no pack section", buildPrompt("ask", { instruction: "q", target: "src" }).includes("# Context pack"), false);
fs.rmSync(path.join(repo, "CONVENTIONS.md"));

const ro = capsFor("review", ROLES.review, null);
check("review role cannot write", await executeTool("write_file", { path: "specs/x.md", content: "x" }, ro), "read-only");
check("review role cannot run tests", await executeTool("run_tests", {}, ro), "no test command");

const doc = capsFor("spec", ROLES.spec, null);
check("doc role writes under specs/", await executeTool("write_file", { path: "specs/demo/spec.md", content: "# x" }, doc), { written: "specs/demo/spec.md", bytes: 3 });
check("doc role blocked outside specs/", await executeTool("write_file", { path: "src/nope.ts", content: "x" }, doc), "not permitted");

const testCaps = capsFor("test", ROLES.test, task);
check("test role may write tests/", await executeTool("write_file", { path: "tests/a.test.ts", content: "x" }, testCaps), (r) => !r.error);
check("test role blocked from src/", await executeTool("write_file", { path: "src/a.ts", content: "x" }, testCaps), "not permitted");
check("test role with no test glob is read-only", await executeTool("write_file", { path: "src/a.ts", content: "x" }, capsFor("test", ROLES.test, { ...task, allowedPaths: ["src/**"] })), "read-only");

// --- pure helpers -----------------------------------------------------------
check("packResult stays valid JSON when oversized", (() => { try { return JSON.parse(packResult({ x: "a".repeat(60000) })).error; } catch { return null; } })(), (e) => /too large/.test(e));
check("glob: ** spans directories", matchAny("src/a/b/x.js", ["src/**/x.js"]), true);
check("glob: **/ matches zero directories", matchAny("src/x.js", ["src/**/x.js"]), true);
check("glob: * stays in one directory", matchAny("src/a/b.ts", ["src/*.ts"]), false);
check("glob: traversal does not match", matchAny("src/../package.json", ["src/**"]), false);
check("glob: ./ prefix ok", matchAny("./src/a", ["src/**"]), true);
check("overlap detected", globsOverlap("src/a/**", "src/**"), true);
check("disjoint globs", globsOverlap("src/a/**", "tests/**"), false);
check("tests/** is a test glob", isTestGlob("tests/**"), true);
check("specs/** is not a test glob", isTestGlob("specs/**"), false);
check("scope: catch-all rejected", scopeProblems(["**"]).length > 0, true);
check("scope: .github rejected", scopeProblems([".github/**"]).length > 0, true);
check("scope: specs/ rejected for code", scopeProblems(["specs/**"]).length > 0, true);
check("scope: empty rejected", scopeProblems([]).length > 0, true);
check("scope: src/** fine", scopeProblems(["src/**"]), []);
check("summary fenced json", parseSummary('done\n```json\n{"status":"done","bullets":["a"]}\n```'), { status: "done", bullets: ["a"] });
check("summary absent", parseSummary("no json here"), null);

put("specs/demo/tasks/00-commas.md", "---\nid: 00\nallowed_paths: [src/**, tests/**]\ntest_command: npm test -- --grep a,b\n---\n# Task\n");
const parsed = readTask("specs/demo/tasks/00-commas.md");
check("test_command keeps its commas", parsed.testCommand, "npm test -- --grep a,b");
check("allowed_paths still splits", parsed.allowedPaths, ["src/**", "tests/**"]);

// --- git helpers -------------------------------------------------------------
fs.rmSync(path.join(repo, "src/_probe.txt"), { force: true });
fs.rmSync(path.join(repo, "src/x2.txt"), { force: true });
fs.rmSync(path.join(repo, "tests"), { recursive: true, force: true });
fs.rmSync(path.join(repo, "specs"), { recursive: true, force: true });
fs.appendFileSync(path.join(repo, "src/a.js"), "export const b = 2;\n");
put("specs/demo/spec.md", "# s\n");
const ch = changedFiles();
check("status: first modified file keeps its full path", ch.find((c) => c.code === "M")?.file, "src/a.js");
check("status: untracked dirs are expanded", ch.some((c) => c.file === "specs/demo/spec.md"), true);
sh("git", ["checkout", "--", "src/a.js"]);
fs.rmSync(path.join(repo, "specs"), { recursive: true, force: true });

const env1 = await runCmd(`node -e "process.stdout.write(String(process.env.DEEPSEEK_API_KEY))"`);
check("test commands do not inherit the API key", env1.out, "undefined");
const savedPath = process.env.PATH;
process.env.PATH = os.tmpdir(); // a PATH with no node on it, like Claude Desktop's
check("test commands run under the server's own node, not whatever is on PATH", (await runCmd("node --version")).out, process.version);
process.env.PATH = savedPath;
process.env.Path = "/should/not/survive"; // a second spelling, as Windows sometimes has
const envKeys = Object.keys(childEnv()).filter((k) => k.toLowerCase() === "path");
check("child env has exactly one PATH variable", envKeys.length, 1);
check("...and it starts with the server's node directory", childEnv()[envKeys[0]].startsWith(path.dirname(process.execPath)), true);
delete process.env.Path;
check("failing command reports failure", (await runCmd(`node -e "process.exit(3)"`)).pass, false);

// --- gates: docs -------------------------------------------------------------
const planV1 = "# Plan\n## Approach\n" + "first draft of the approach. ".repeat(12);
put("specs/demo/plan.md", planV1);
const docJob = (extra = {}) => ({ role: "plan", mode: "doc", targetRel: "specs/demo", artifact: "plan.md", headings: ["## Approach"], startedChanges: snapshot(), ...extra });
const unchanged = docJob();
check("doc gate: untouched artifact is 'no files were written'", (await gate(unchanged, { summary: { status: "done" }, turns: 1 })).reasons.join("|"), (r) => /no files were written/.test(r));
const rewrite = docJob();
put("specs/demo/plan.md", planV1 + "second pass adds more text. ".repeat(5));
check("doc gate: rewriting a dirty artifact counts", (await gate(rewrite, { summary: { status: "done" }, turns: 1 })).status, "done");

put("specs/demo/tasks/01-a.md", "---\nid: 01\nallowed_paths: [src/**]\ntest_command: npm test\n---\n# Task 01\n## Acceptance criteria\n- AC-1\n");
put("specs/demo/tasks/02-b.md", "---\nid: 02\nallowed_paths: [src/b/**]\ntest_command: npm run nope\n---\n# Task 02\n## Acceptance criteria\n- AC-2\n");
const tg = await gate({ role: "tasks", mode: "doc", targetRel: "specs/demo", artifact: "tasks/", startedChanges: {} }, { summary: { status: "done" }, turns: 1 });
check("tasks gate: overlapping scopes caught", tg.reasons.some((r) => /overlap/.test(r)), true);
check("tasks gate: unknown npm script caught", tg.reasons.some((r) => /nope/.test(r)), true);
fs.rmSync(path.join(repo, "specs"), { recursive: true, force: true });

// --- gates: review -----------------------------------------------------------
const rv = (summary) => gate({ role: "review", mode: "review", targetRel: "specs/demo" }, { summary, result: "notes", turns: 1 });
const forced = await rv({ verdict: "PASS", criteria: [{ id: "AC-1", status: "met" }], findings: [{ id: "F1", severity: "blocker", file: "src/a.js" }] });
check("review gate: PASS with a blocker becomes FAIL", forced.verdict, "FAIL");
check("review gate: unmet criterion forces FAIL", (await rv({ verdict: "PASS", criteria: [{ id: "AC-1", status: "not met" }], findings: [] })).verdict, "FAIL");
check("review gate: clean PASS stays PASS", (await rv({ verdict: "PASS", criteria: [{ id: "AC-1", status: "met" }], findings: [] })).verdict, "PASS");

// --- agent loop against the mock, then the code gate -------------------------
fs.rmSync(path.join(repo, "specs"), { recursive: true, force: true });
put("specs/demo/tasks/01-feature.md", "---\nid: 01\nallowed_paths: [src/**, tests/**]\ntest_command: node --version\n---\n# Task 01\n## Acceptance criteria\n- AC-1\n");
const t1 = readTask("specs/demo/tasks/01-feature.md");
const call = (name, args) => ({ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name, arguments: JSON.stringify(args) } }] } });
const final = { message: { role: "assistant", content: 'Done.\n```json\n{"status":"done","did":["added feature"],"not_done":[],"notes":""}\n```' } };

git(["checkout", "-q", "-b", "impl/01"]);
const startedSha = git(["rev-parse", "HEAD"]).out;
const startedChanges = snapshot();
script.push({ status: 500 }, call("write_file", { path: "src/feature.js", content: "export const x = 1;\n" }), call("write_file", { path: "src/../package.json", content: "PWNED" }), final);
const run = await runAgent({ prompt: "go", caps: capsFor("impl", ROLES.impl, t1), logPath: path.join(tmp, "agent.log") });
check("agent: retried a 500 and finished", run.exhausted === false && run.turns === 3, true);
check("agent: wrote the file", fs.existsSync(path.join(repo, "src/feature.js")), true);
check("agent: traversal attempt did not reach package.json", fs.readFileSync(path.join(repo, "package.json"), "utf8") === before, true);
const ac = new AbortController();
ac.abort();
check("agent: aborted signal stops the loop", (await runAgent({ prompt: "go", caps: capsFor("impl", ROLES.impl, t1), logPath: path.join(tmp, "agent.log"), signal: ac.signal })).aborted, true);

commit(["src/feature.js"], "task-01: impl");
const codeJob = { role: "impl", mode: "code", targetRel: t1.rel, branch: "impl/01", startedSha, startedChanges, commit: "x", commitError: null };
const good = await gate(codeJob, { summary: parseSummary(run.finalText), turns: run.turns, usage: run.usage });
if (good.status !== "done") console.log("  reasons:", good.reasons);
check("code gate: clean one-commit task passes", good.status, "done");
check("code gate: reports the files", good.files, ["src/feature.js"]);
const noopJob = { ...codeJob, startedSha: git(["rev-parse", "HEAD"]).out, commit: null, commitError: "nothing in scope to commit", startedChanges: snapshot() };
const okSummary = { status: "done", did: ["checked: already implemented"], not_done: [], notes: "" };
const nop = await gate(noopJob, { summary: okSummary, turns: 2 });
check("noop: nothing to commit + green tests + model says done = noop, not failed", nop.status === "noop" && nop.reasons.length === 0 && /nothing was left/.test(nop.note), true);
check("noop: a partial no-op is still a failure", (await gate(noopJob, { summary: { ...okSummary, status: "partial" }, turns: 2 })).status, "failed");
check("noop: no summary is still a failure", (await gate(noopJob, { summary: null, turns: 2 })).status, "failed");
const blockedRes = await gate(noopJob, { summary: { status: "blocked", did: [], not_done: ["x"] }, gap: "AC-1 contradicts AC-2", turns: 1 });
check("blocked: reports the model's reason without commits=0 noise", blockedRes.status === "failed" && blockedRes.reasons.length === 1 && /BLOCKED: AC-1/.test(blockedRes.reasons[0]), true);
const endSha = git(["rev-parse", "HEAD"]).out;
const dj = jobDiff({ startedSha, endSha, role: "impl" });
check("job_diff: lists the committed file", dj.files, ["src/feature.js"]);
check("job_diff: contains the change with context", dj.diff.includes("+export const x = 1;") && dj.stat.includes("src/feature.js"), true);
const paged = [];
for (let off = 0, d; ; off = d.next_offset) {
  d = jobDiff({ startedSha, endSha }, off, 40);
  paged.push(d.diff);
  if (d.next_offset === null) break;
}
check("job_diff: pages reassemble into the full diff", paged.join(""), dj.diff);
check("job_diff: a job with no range explains itself", jobDiff({ role: "spec" }).error, (e) => /no committed code range/.test(e));
check("job_diff: an empty range is reported as empty", jobDiff({ startedSha: endSha, endSha }).empty, true);
check("code gate: returns a small report", good.report, { status: "done", did: ["added feature"], not_done: [], notes: "", repairs: [] });
check("code gate: status=blocked is a failure", (await gate(codeJob, { summary: { status: "blocked", did: [], not_done: ["x"] }, turns: 1 })).reasons.some((r) => /status=blocked/.test(r)), true);

put("src/stray.js", "x\n"); // outside nothing - but untracked and not committed
put("docs/leak.md", "x\n");
const bad = await gate(codeJob, { summary: parseSummary(run.finalText), turns: run.turns, usage: run.usage });
check("code gate: new out-of-scope file fails", bad.status === "failed" && bad.reasons.some((r) => /out of scope: .*docs\/leak\.md/.test(r)), true);
check("code gate: already-dirty specs/ files are not blamed", !bad.reasons.some((r) => /specs\//.test(r)), true);

// --- repair loop -------------------------------------------------------------
put("scripts/chk.js", "process.exit(require('fs').existsSync('src/ok.txt') ? 0 : 1)");
const t2 = { allowedPaths: ["src/**"], testCommand: "node scripts/chk.js", id: "02", rel: "x.md" };
const caps2 = capsFor("impl", ROLES.impl, t2);
const verify2 = makeVerifier("code", t2);
check("verifier: missing json asks for the summary", (await verify2("all done")).why, "no summary json");
check("verifier: SPEC_GAP is not repaired", await verify2("SPEC_GAP: contradictory"), null);
check("verifier: 'blocked' mid-sentence is not a gap", (await verify2("Not blocked: all fine, no json")).why, "no summary json");
const verifyRv = makeVerifier("review", null);
check("verifier: review without json is repaired", (await verifyRv("great code")).why, "no review json");
check("verifier: review json without verdict is repaired", (await verifyRv('```json\n{"status":"done","did":[]}\n```')).why, "review json has no verdict");
check("verifier: review with a verdict is accepted", await verifyRv('```json\n{"verdict":"PASS","criteria":[],"findings":[]}\n```'), null);

script.length = 0;
script.push(call("write_file", { path: "src/feature2.js", content: "1\n" }), final, call("write_file", { path: "src/ok.txt", content: "ok" }), final);
const rep = await runAgent({ prompt: "go", caps: caps2, logPath: path.join(tmp, "agent.log"), verify: verify2 });
check("repair: one failed self-check, then a fix", rep.repairs.length === 1 && rep.turns === 4, true);
check("repair: failure output was fed back to the model", JSON.stringify(bodies.at(-2)).includes("FAILED") && !JSON.stringify(bodies.at(-3)).includes("FAILED"), true);
check("repair: log line is short", rep.repairs[0].why.length <= 160, true);
check("report merges the model's account with the repair log", report({ summary: { status: "partial", did: ["a"], not_done: ["b"], notes: "n" }, repairs: rep.repairs }), { status: "partial", did: ["a"], not_done: ["b"], notes: "n", repairs: [rep.repairs[0].why] });

fs.rmSync(path.join(repo, "src/ok.txt"));
script.length = 0;
script.push(final, final, final, final);
const capped = await runAgent({ prompt: "go", caps: caps2, logPath: path.join(tmp, "agent.log"), verify: verify2 });
check("repair: stops after MAX_REPAIRS and hands over", capped.repairs.length === CFG.maxRepairs && capped.turns === CFG.maxRepairs + 1, true);

// --- branching ---------------------------------------------------------------
sh("git", ["reset", "-q", "--hard"]);
sh("git", ["clean", "-fdq"]);
sh("git", ["checkout", "-q", "main"]);
const mkBranch = (name, file) => {
  sh("git", ["checkout", "-q", "-b", name, "main"]);
  if (file) {
    put(file, `${name}\n`);
    sh("git", ["add", file]);
    sh("git", ["commit", "-qm", name]);
  }
  sh("git", ["checkout", "-q", "main"]);
};
const sha = (ref) => git(["rev-parse", ref]).out;
const taskB = { id: "02", rel: "specs/f/tasks/02-b.md", dependsOn: ["01"] };
const hist = (t, branch, role = "impl", target = `specs/f/tasks/${t}-x.md`) => ({ task: t, role, state: "done", branch, targetRel: target });

check("branching: impl with no deps starts from the base", planBranch({ roleName: "impl", task: { id: "01", rel: "specs/f/tasks/01-a.md", dependsOn: [] }, targetRel: "x", history: [], baseRef: "main" }), { mode: "new", from: "main" });
mkBranch("dep1", "dep1.txt");
check("branching: one unmerged dependency is the starting point", planBranch({ roleName: "impl", task: taskB, targetRel: "x", history: [hist("01", "dep1")], baseRef: "main" }).from, "dep1");
sh("git", ["merge", "-q", "dep1"]);
check("branching: a merged dependency starts from the base again", planBranch({ roleName: "impl", task: taskB, targetRel: "x", history: [hist("01", "dep1")], baseRef: "main" }).from, "main");
sh("git", ["reset", "-q", "--hard", "HEAD~1"]); // un-merge so later cases can reuse dep1
mkBranch("dep3", "dep3.txt");
mkBranch("dep4", "dep4.txt");
check("branching: two unmerged dependencies are refused", planBranch({ roleName: "impl", task: { ...taskB, dependsOn: ["03", "04"] }, targetRel: "x", history: [hist("03", "dep3"), hist("04", "dep4")], baseRef: "main" }).error, (e) => /2 unmerged/.test(e));
check("branching: fix continues the task's own branch", planBranch({ roleName: "fix", task: taskB, targetRel: "T", history: [hist("02", "dep3", "impl", "T")], baseRef: "main" }), { mode: "continue", branch: "dep3", from: "dep3" });
check("branching: fix with no branch is refused", planBranch({ roleName: "fix", task: taskB, targetRel: "T", history: [hist("02", "gone", "impl", "T")], baseRef: "main" }).error, (e) => /run impl first/.test(e));
check("branching: test with no branch starts from the base", planBranch({ roleName: "test", task: taskB, targetRel: "T", history: [], baseRef: "main" }).mode, "new");
check("branching: review picks the newest branch under the feature", latestBranchFor([hist("01", "dep1"), hist("02", "dep3", "fix")], "specs/f"), "dep3");
check("branching: review ignores other features", latestBranchFor([hist("01", "dep1")], "specs/other"), null);

const base = sha("main");
sh("git", ["checkout", "-q", "-b", "tmp-empty", "main"]);
const r1 = restoreBranch({ switched: true, baseBranch: "main", baseSha: base, branch: "tmp-empty", createdBranch: true, startedSha: base, endSha: base });
check("restore: returns to the human's branch", r1.returned_to, "main");
check("restore: removes a branch that got no commits", r1.empty_branch_removed === "tmp-empty" && !branchExists("tmp-empty"), true);
sh("git", ["checkout", "-q", "dep3"]);
const r2 = restoreBranch({ switched: true, baseBranch: "main", baseSha: base, branch: "dep3", createdBranch: true, startedSha: base, endSha: sha("dep3") });
check("restore: keeps a branch that has commits", r2.returned_to === "main" && !r2.empty_branch_removed && branchExists("dep3"), true);
sh("git", ["checkout", "-q", "dep3"]);
put("stray.txt", "x\n");
const r3 = restoreBranch({ switched: true, baseBranch: "main", baseSha: base, branch: "dep3", startedSha: base, endSha: sha("dep3") });
check("restore: a dirty tree stays on the work branch and says so", r3.left_on_branch === "dep3" && /not clean/.test(r3.restore_error), true);
fs.rmSync(path.join(repo, "stray.txt"));
sh("git", ["checkout", "-q", "main"]);
check("restore: nothing to do when the job never switched", restoreBranch({ switched: false, baseBranch: "main" }), {});

// --- thinking mode -----------------------------------------------------------
const { requestBody } = await import("../src/engine.js");
const tl = [{ type: "function", function: { name: "x" } }];
check("thinking: enabled + high is the default", [CFG.thinking, CFG.effort], ["enabled", "high"]);
check("thinking: default request carries thinking+effort and no temperature", ((b) => [b.thinking, b.reasoning_effort, "temperature" in b])(requestBody([], tl)), [{ type: "enabled" }, "high", false]);
check("thinking: default token budget leaves room for reasoning", CFG.maxTokens >= 32000, true);
const off = requestBody([], [], { model: "m", maxTokens: 8000, thinking: "disabled", effort: "high", temperature: 0.2 });
check("thinking: disabled is sent explicitly, with temperature and no effort", [off.thinking, off.temperature, "reasoning_effort" in off], [{ type: "disabled" }, 0.2, false]);
check("thinking: effort value is passed through", requestBody([], [], { model: "m", maxTokens: 1, thinking: "enabled", effort: "max" }).reasoning_effort, "max");
check("thinking: no tools means no tool_choice", "tool_choice" in requestBody([], []), false);
check("thinking: the live request to the model has the fields", bodies.length > 0 && bodies.every((b) => b.thinking?.type === "enabled" && b.reasoning_effort === "high" && !("temperature" in b)), true);
script.length = 0;
script.push({ message: { role: "assistant", content: null, reasoning_content: "because", tool_calls: [{ id: "c9", type: "function", function: { name: "list_dir", arguments: "{" } }] }, finish_reason: "length" }, { message: { role: "assistant", content: "done" } });
const trunc = await runAgent({ prompt: "go", caps: caps2, logPath: path.join(tmp, "agent.log") });
check("thinking: a tool call cut off by max_tokens is not run; the model is told", trunc.finalText === "done" && JSON.stringify(bodies.at(-1)).includes("cut off") && JSON.stringify(bodies.at(-1)).includes("because"), true);

// --- discard -----------------------------------------------------------------
const d1 = discardBranch({ branch: "dep3", baseRef: "main" });
check("discard: an unmerged branch is refused without force and its commits are listed", d1.error && /not in main/.test(d1.error) && d1.unmerged_commits.length === 1 && branchExists("dep3"), true);
const dep3Tip = sha("dep3");
const d2 = discardBranch({ branch: "dep3", baseRef: "main", force: true });
check("discard: force deletes it and returns the tip", d2.deleted === "dep3" && d2.tip === dep3Tip && d2.was_merged === false && !branchExists("dep3"), true);
sh("git", ["branch", "dep3", d2.tip]);
check("discard: the returned tip really recovers the work", branchExists("dep3") && sha("dep3") === dep3Tip, true);
mkBranch("done1", "done1.txt");
sh("git", ["merge", "-q", "done1"]);
const d3 = discardBranch({ branch: "done1", baseRef: "main" });
check("discard: a merged branch goes without force", d3.deleted === "done1" && d3.was_merged === true && !d3.recover && !branchExists("done1"), true);
check("discard: the base branch is never deleted", discardBranch({ branch: "main", baseRef: "main", force: true }).error, (e) => /base branch/.test(e));
sh("git", ["checkout", "-q", "dep4"]);
check("discard: the checked-out branch is refused", discardBranch({ branch: "dep4", baseRef: "main", force: true }).error, (e) => /checked out/.test(e) && branchExists("dep4"));
sh("git", ["checkout", "-q", "main"]);
check("discard: a missing branch is reported as gone", discardBranch({ branch: "nope", baseRef: "main" }).gone, true);
check("discard: unsafe branch names are rejected", discardBranch({ branch: "--force; rm", baseRef: "main", force: true }).error, (e) => /usable branch/.test(e));
check("discard: tags and other refs are not branches", (sh("git", ["tag", "v1"]), discardBranch({ branch: "v1", baseRef: "main", force: true }).gone), true);

mock.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
