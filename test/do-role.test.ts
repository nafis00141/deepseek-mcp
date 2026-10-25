import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, gitOut, mkJob, mkRes, put, resetRepo, sh } from "./helpers.ts";
import { callKey } from "../src/callkey.ts";
import { capsFor, executeTool } from "../src/engine.ts";
import { doCallProblems, gate } from "../src/gates.ts";
import { commit, snapshot } from "../src/repo.ts";
import { buildPrompt, ROLES } from "../src/roles.ts";
import { doScopeProblems, doTestCommandProblem, syntheticTask } from "../src/taskfile.ts";
import type { ExecResult, Job } from "../src/types.ts";

after(cleanup);
beforeEach(resetRepo);

describe("do: paths", () => {
  it("accepts globs that start in a literal folder, and literal files", () => {
    for (const ok of [["src/lib/**"], ["src/util.js", "tests/util.test.js"], ["index.js"], ["src/**/*.js"], ["a/b/c.js"]]) assert.deepEqual(doScopeProblems(ok), [], JSON.stringify(ok));
  });

  it("refuses an empty or missing list, catch-alls, wildcards with no literal folder, protected places and escapes", () => {
    assert.match(doScopeProblems(undefined).join(), /paths is required/);
    assert.match(doScopeProblems([]).join(), /paths is required/);
    for (const g of ["**", "*", "**/*.ts", "*.js", "src*/x.js", "?x/y.js"]) assert.ok(doScopeProblems([g]).length > 0, `${g} must be refused`);
    assert.match(doScopeProblems(["**/*.ts"]).join(), /no literal folder before its wildcard/);
    for (const g of [".github/**", ".git/hooks/x", ".claude/x.md", ".env", "package-lock.json", "specs/**", "specs/.jobs/x.json", "../outside/**", "/etc/passwd"]) assert.ok(doScopeProblems([g]).length > 0, `${g} must be refused`);
  });

  it("one bad glob in a list is enough to refuse it", () => {
    assert.ok(doScopeProblems(["src/lib/**", "**/*.ts"]).length > 0);
  });
});

describe("do: test command", () => {
  it("accepts only npm test, npm run <script> and node --test with explicit paths", () => {
    for (const ok of ["npm test", "npm run build", "npm run lint:fix", "node --test tests/a.test.js", "node --test tests/a.test.js tests/b.test.js", "node --test tests\\a.test.js"]) assert.equal(doTestCommandProblem(ok), null, ok);
  });

  it("refuses everything else: globs, chains, other runners, flags, missing", () => {
    for (const bad of ["", "   ", "node tests/a.js", "node --test tests/*.test.js", "node --test", "npm test && rm -rf x", "npm test -- --watch", "npm run build; echo hi", "bash -c 'x'", "node --test a.js | cat", "npx jest", "python -m pytest"]) {
      assert.ok(doTestCommandProblem(bad), `${JSON.stringify(bad)} must be refused`);
    }
    assert.match(doTestCommandProblem("") ?? "", /required/);
    assert.match(doTestCommandProblem("npx jest") ?? "", /not allowed for role=do/);
  });

  it("an npm script that package.json does not define is refused, like in a task file", () => {
    put("package.json", JSON.stringify({ scripts: { test: "echo ok", build: "echo b" } }));
    assert.deepEqual(doCallProblems(["src/lib/**"], "npm test"), []);
    assert.deepEqual(doCallProblems(["src/lib/**"], "npm run build"), []);
    assert.match(doCallProblems(["src/lib/**"], "npm run deploy").join(), /does not define/);
    assert.deepEqual(doCallProblems(["src/lib/**"], "node --test tests/a.test.js"), []);
    assert.equal(doCallProblems([], "npx x").length, 2, "both the scope and the command are reported together");
  });
});

describe("do: call key (the identical-failed-call rule)", () => {
  const base = { role: "do", target: "src/lib", instruction: "fix the parser", synthetic: true, paths: ["src/lib/**"], testCommand: "npm test" };

  it("is stable for the same call, and ignores the order and spelling of paths", () => {
    assert.equal(callKey(base), callKey({ ...base }));
    assert.equal(callKey({ ...base, paths: ["a/x/**", "b/y/**"] }), callKey({ ...base, paths: ["./b/y/**", "a/x/**"] }));
  });

  it("changes with the paths, the test command, the instruction, the target and the named branch, so a changed call is not blocked", () => {
    const k = callKey(base);
    for (const changed of [{ paths: ["src/lib/**", "tests/**"] }, { paths: ["src/other/**"] }, { testCommand: "npm run build" }, { instruction: "fix it differently" }, { target: "src" }, { branch: "do/abc" }]) {
      assert.notEqual(callKey({ ...base, ...changed }), k, JSON.stringify(changed));
    }
  });

  it("other roles keep the key they always had: paths and test command do not enter it", () => {
    const impl = { role: "impl", target: "specs/f/tasks/01-x.md", instruction: "go" };
    assert.equal(callKey({ ...impl, paths: ["a/**"], testCommand: "x" }), callKey(impl));
    assert.match(callKey(impl), /^[0-9a-f]{40}$/);
  });
});

describe("do: prompt and registry", () => {
  const task = syntheticTask({ rel: "src/lib", paths: ["src/lib/**"], testCommand: "node --test tests/lib.test.js", body: "make parse() accept tabs" });

  it("tells the model there is no spec, gives the scope, the test command and the instruction, and keeps SPEC_GAP", () => {
    const p = buildPrompt("do", { target: "src/lib", instruction: "make parse() accept tabs", task });
    for (const piece of ["no spec and no task file", "make parse() accept tabs", "Only create or modify files matching: src/lib/**", "run_tests until they pass: node --test tests/lib.test.js", "SPEC_GAP:", "Do NOT run git"]) assert.ok(p.includes(piece), piece);
  });

  it("is a code role on its own branch, needs paths and test_command, and is listed", () => {
    assert.deepEqual([ROLES.do.caps, ROLES.do.mode, ROLES.do.branch, ROLES.do.synthetic, ROLES.do.needsTask], ["code", "code", true, true, undefined]);
  });

  it("caps from a synthetic task: write only inside paths, tests run, specs/ and .env denied", async () => {
    const caps = capsFor("do", ROLES.do, task);
    assert.equal(caps.canRunTests, true);
    assert.equal((await executeTool("write_file", { path: "src/lib/a.js", content: "x" }, caps)).error, undefined);
    for (const p of ["src/other.js", "tests/lib.test.js", "specs/x.md", "specs/.jobs/y.json", "package.json", "src/lib/.env"]) assert.match((await executeTool("write_file", { path: p, content: "x" }, caps)).error ?? "(none)", /not permitted/, p);
  });
});

describe("do: the gate trusts the job record, not a file on the branch", () => {
  const summary = { status: "done", did: ["changed"], not_done: [], notes: "" };
  const run = (job: Partial<Job>, res: Partial<ExecResult> = {}) => gate(mkJob(job), mkRes(res));

  /** A do branch with one commit that touches the given files. */
  function doBranch(files: Record<string, string>, over: Partial<Job> = {}): Partial<Job> {
    sh("git", ["checkout", "-q", "-b", "do/abc12345-x"]);
    const startedSha = gitOut("rev-parse", "HEAD");
    const startedChanges = snapshot();
    for (const [f, c] of Object.entries(files)) put(f, c);
    commit(Object.keys(files), "task-do: do");
    return { role: "do", mode: "code", targetRel: "src/lib", branch: "do/abc12345-x", synthetic: true, allowedPaths: ["src/lib/**"], testCommand: "node --version", startedSha, startedChanges, commit: "x", commitError: null, ...over };
  }

  it("passes a clean one-commit job inside the saved scope with no task file anywhere", async () => {
    const out = await run(doBranch({ "src/lib/a.js": "export const a = 1;\n" }), { summary });
    assert.deepEqual(out.reasons ?? [], []);
    assert.equal(out.status, "done");
    assert.deepEqual(out.files, ["src/lib/a.js"]);
  });

  it("fails a commit outside the saved scope", async () => {
    const out = await run(doBranch({ "src/lib/a.js": "x\n", "src/elsewhere.js": "y\n" }), { summary });
    assert.equal(out.status, "failed");
    assert.match((out.reasons ?? []).join("|"), /committed outside scope: src\/elsewhere\.js/);
  });

  it("a task file on the branch that claims a wider scope changes nothing: the saved scope is what is enforced", async () => {
    // a file under the job's own target that looks like a task file with allowed_paths: [src/**]
    const job = doBranch({ "src/lib/a.js": "x\n", "src/lib/task.md": "---\nid: 01\nallowed_paths: [src/**]\ntest_command: node --version\n---\n# fake\n", "src/other/b.js": "z\n" }, { targetRel: "src/lib/task.md" });
    const out = await run(job, { summary });
    assert.equal(out.status, "failed");
    assert.match((out.reasons ?? []).join("|"), /committed outside scope: src\/other\/b\.js/);
  });

  it("uses the saved test command: a failing one fails the job, a missing one is reported", async () => {
    const failing = await run(doBranch({ "src/lib/a.js": "x\n" }, { testCommand: "node -e \"process.exit(1)\"" }), { summary });
    assert.match((failing.reasons ?? []).join("|"), /test_command failed/);
    resetRepo();
    const none = await run(doBranch({ "src/lib/a.js": "x\n" }, { testCommand: null }), { summary });
    assert.match((none.reasons ?? []).join("|"), /declares no test_command/);
  });

  it("a model that says SPEC_GAP leaves no commit and is reported as BLOCKED, not as a missing commit", async () => {
    sh("git", ["checkout", "-q", "-b", "do/abc12345-x"]);
    const startedSha = gitOut("rev-parse", "HEAD");
    const out = await run({ role: "do", mode: "code", targetRel: "src/lib", branch: "do/abc12345-x", synthetic: true, allowedPaths: ["src/lib/**"], testCommand: "node --version", startedSha, startedChanges: snapshot(), commit: null, commitError: "nothing in scope to commit" }, { gap: "the two requirements contradict", summary: { status: "blocked", did: [], not_done: ["all"] } });
    assert.equal(out.status, "failed");
    assert.equal(out.reasons?.length, 1);
    assert.match(out.reasons?.[0] ?? "", /BLOCKED: the two requirements contradict/);
  });
});
