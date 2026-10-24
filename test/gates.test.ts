import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, gitOut, mkJob, mkRes, put, resetRepo, sh } from "./helpers.ts";
import { gate } from "../src/gates.ts";
import { commit, snapshot } from "../src/repo.ts";
import type { ExecResult, Job } from "../src/types.ts";

after(cleanup);
beforeEach(resetRepo);

const done = { status: "done" };
const run = (job: Partial<Job>, res: Partial<ExecResult> = {}) => gate(mkJob(job), mkRes(res));

describe("doc gate", () => {
  const planV1 = "# Plan\n## Approach\n" + "first draft of the approach. ".repeat(12);
  const docJob = () => ({ role: "plan" as const, mode: "doc" as const, targetRel: "specs/demo", artifact: "plan.md", headings: ["## Approach"], startedChanges: snapshot() });

  it("fails when the artifact was not touched", async () => {
    put("specs/demo/plan.md", planV1);
    const job = docJob();
    const out = await run(job, { summary: done });
    assert.match((out.reasons ?? []).join("|"), /no files were written/);
  });

  it("counts a rewrite of an already-dirty artifact", async () => {
    put("specs/demo/plan.md", planV1);
    const job = docJob();
    put("specs/demo/plan.md", planV1 + "second pass adds more text. ".repeat(5));
    assert.equal((await run(job, { summary: done })).status, "done");
  });
});

describe("tasks gate", () => {
  it("catches overlapping scopes and unknown npm scripts", async () => {
    put("specs/demo/tasks/01-a.md", "---\nid: 01\nallowed_paths: [src/**]\ntest_command: npm test\n---\n# Task 01\n## Acceptance criteria\n- AC-1\n");
    put("specs/demo/tasks/02-b.md", "---\nid: 02\nallowed_paths: [src/b/**]\ntest_command: npm run nope\n---\n# Task 02\n## Acceptance criteria\n- AC-2\n");
    const out = await run({ role: "tasks", mode: "doc", targetRel: "specs/demo", artifact: "tasks/" }, { summary: done });
    const reasons = out.reasons ?? [];
    assert.ok(reasons.some((r) => /overlap/.test(r)), "overlap");
    assert.ok(reasons.some((r) => /nope/.test(r)), "unknown script");
  });
});

describe("review gate", () => {
  const review = (summary: Record<string, unknown>) => run({ role: "review", mode: "review", targetRel: "specs/demo" }, { summary, result: "notes" });
  const met = [{ id: "AC-1", status: "met" }];

  it("turns PASS with a blocker into FAIL", async () => {
    assert.equal((await review({ verdict: "PASS", criteria: met, findings: [{ id: "F1", severity: "blocker", file: "src/a.js" }] })).verdict, "FAIL");
  });
  it("turns PASS with an unmet criterion into FAIL", async () => {
    assert.equal((await review({ verdict: "PASS", criteria: [{ id: "AC-1", status: "not met" }], findings: [] })).verdict, "FAIL");
  });
  it("keeps a clean PASS", async () => {
    assert.equal((await review({ verdict: "PASS", criteria: met, findings: [] })).verdict, "PASS");
  });
});

describe("code gate", () => {
  const summary = { status: "done", did: ["added feature"], not_done: [], notes: "" };

  /** An impl branch with one in-scope commit, as the agent loop leaves it. */
  function implBranch() {
    put("specs/demo/tasks/01-feature.md", "---\nid: 01\nallowed_paths: [src/**, tests/**]\ntest_command: node --version\n---\n# Task 01\n## Acceptance criteria\n- AC-1\n");
    sh("git", ["checkout", "-q", "-b", "impl/01"]);
    const startedSha = gitOut("rev-parse", "HEAD");
    const startedChanges = snapshot();
    put("src/feature.js", "export const x = 1;\n");
    commit(["src/feature.js"], "task-01: impl");
    return { role: "impl" as const, mode: "code" as const, targetRel: "specs/demo/tasks/01-feature.md", branch: "impl/01", startedSha, startedChanges, commit: "x", commitError: null };
  }

  it("passes a clean one-commit task and reports the files and a small report", async () => {
    const out = await run(implBranch(), { summary });
    assert.deepEqual(out.reasons ?? [], []);
    assert.equal(out.status, "done");
    assert.deepEqual(out.files, ["src/feature.js"]);
    assert.deepEqual(out.report, { ...summary, repairs: [] });
  });

  it("fails status=blocked", async () => {
    const out = await run(implBranch(), { summary: { status: "blocked", did: [], not_done: ["x"] } });
    assert.ok((out.reasons ?? []).some((r) => /status=blocked/.test(r)));
  });

  it("fails a new out-of-scope file but does not blame already-dirty specs/ files", async () => {
    const job = implBranch();
    put("docs/leak.md", "x\n");
    const out = await run(job, { summary });
    assert.equal(out.status, "failed");
    assert.ok((out.reasons ?? []).some((r) => /out of scope: .*docs\/leak\.md/.test(r)));
    assert.ok(!(out.reasons ?? []).some((r) => /specs\//.test(r)));
  });

  describe("no-op (nothing to commit)", () => {
    const noop = () => {
      const job = implBranch();
      return { ...job, startedSha: gitOut("rev-parse", "HEAD"), commit: null, commitError: "nothing in scope to commit", startedChanges: snapshot() };
    };

    it("is a noop, not a failure, when tests are green and the model says done", async () => {
      const out = await run(noop(), { summary: { ...summary, did: ["checked: already implemented"] }, turns: 2 });
      assert.equal(out.status, "noop");
      assert.deepEqual(out.reasons, []);
      assert.match(String(out.note), /nothing was left/);
    });
    it("a partial no-op and a missing summary are still failures", async () => {
      const job = noop();
      assert.equal((await run(job, { summary: { ...summary, status: "partial" } })).status, "failed");
      assert.equal((await run(job, { summary: null })).status, "failed");
    });
    it("a blocked model reports its own reason without commit-count noise", async () => {
      const out = await run(noop(), { summary: { status: "blocked", did: [], not_done: ["x"] }, gap: "AC-1 contradicts AC-2" });
      assert.equal(out.status, "failed");
      assert.equal(out.reasons?.length, 1);
      assert.match(out.reasons?.[0] ?? "", /BLOCKED: AC-1/);
    });
  });
});
