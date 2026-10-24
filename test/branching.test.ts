import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, gitOut, mkJob, mkTask, put, resetRepo, sh } from "./helpers.ts";
import { branchExists, discardBranch, latestBranchFor, planBranch, restoreBranch } from "../src/branching.ts";
import type { BranchPlan } from "../src/branching.ts";
import type { Job } from "../src/types.ts";

after(cleanup);
beforeEach(resetRepo);

/** A branch off main, optionally with one commit; leaves you on main. */
function mkBranch(name: string, file?: string): void {
  sh("git", ["checkout", "-q", "-b", name, "main"]);
  if (file) {
    put(file, `${name}\n`);
    sh("git", ["add", file]);
    sh("git", ["commit", "-qm", name]);
  }
  sh("git", ["checkout", "-q", "main"]);
}
const sha = (ref: string) => gitOut("rev-parse", ref);
const hist = (task: string, branch: string, role: Job["role"] = "impl", targetRel = `specs/f/tasks/${task}-x.md`): Job => mkJob({ task, role, state: "done", branch, targetRel });
const taskB = mkTask({ id: "02", rel: "specs/f/tasks/02-b.md", dependsOn: ["01"] });
const plan = (roleName: string, task: ReturnType<typeof mkTask>, history: Job[], targetRel = "x"): BranchPlan => planBranch({ roleName, task, targetRel, history, baseRef: "main" });
const errorOf = (p: BranchPlan): string => p.error ?? "(no error)";

describe("planBranch", () => {
  it("impl with no dependencies starts from the base", () => {
    assert.deepEqual(plan("impl", mkTask({ id: "01", dependsOn: [] }), []), { mode: "new", from: "main" });
  });

  it("one unmerged dependency is the starting point; once merged, the base is again", () => {
    mkBranch("dep1", "dep1.txt");
    assert.deepEqual(plan("impl", taskB, [hist("01", "dep1")]), { mode: "new", from: "dep1" });
    sh("git", ["merge", "-q", "dep1"]);
    assert.deepEqual(plan("impl", taskB, [hist("01", "dep1")]), { mode: "new", from: "main" });
  });

  it("two unmerged dependencies are refused", () => {
    mkBranch("dep3", "dep3.txt");
    mkBranch("dep4", "dep4.txt");
    assert.match(errorOf(plan("impl", { ...taskB, dependsOn: ["03", "04"] }, [hist("03", "dep3"), hist("04", "dep4")])), /2 unmerged/);
  });

  it("fix continues the task's own branch, and is refused when it is gone", () => {
    mkBranch("dep3", "dep3.txt");
    assert.deepEqual(plan("fix", taskB, [hist("02", "dep3", "impl", "T")], "T"), { mode: "continue", branch: "dep3", from: "dep3" });
    assert.match(errorOf(plan("fix", taskB, [hist("02", "gone", "impl", "T")], "T")), /run impl first/);
  });

  it("test with no branch starts from the base", () => {
    assert.equal((plan("test", taskB, [], "T") as { mode: string }).mode, "new");
  });

  it("review picks the newest branch under its feature, and ignores other features", () => {
    mkBranch("dep1", "dep1.txt");
    mkBranch("dep3", "dep3.txt");
    const history = [hist("01", "dep1"), hist("02", "dep3", "fix")];
    assert.equal(latestBranchFor(history, "specs/f"), "dep3");
    assert.equal(latestBranchFor([hist("01", "dep1")], "specs/other"), null);
  });
});

describe("restoreBranch", () => {
  it("returns to the human's branch and removes a branch that got no commits", () => {
    const base = sha("main");
    sh("git", ["checkout", "-q", "-b", "tmp-empty", "main"]);
    const r = restoreBranch({ switched: true, baseBranch: "main", baseSha: base, branch: "tmp-empty", createdBranch: true, startedSha: base, endSha: base });
    assert.equal(r.returned_to, "main");
    assert.equal(r.empty_branch_removed, "tmp-empty");
    assert.ok(!branchExists("tmp-empty"));
  });

  it("keeps a branch that has commits", () => {
    mkBranch("dep3", "dep3.txt");
    const base = sha("main");
    sh("git", ["checkout", "-q", "dep3"]);
    const r = restoreBranch({ switched: true, baseBranch: "main", baseSha: base, branch: "dep3", createdBranch: true, startedSha: base, endSha: sha("dep3") });
    assert.equal(r.returned_to, "main");
    assert.equal(r.empty_branch_removed, undefined);
    assert.ok(branchExists("dep3"));
  });

  it("a dirty tree stays on the work branch and says so", () => {
    mkBranch("dep3", "dep3.txt");
    const base = sha("main");
    sh("git", ["checkout", "-q", "dep3"]);
    put("stray.txt", "x\n");
    const r = restoreBranch({ switched: true, baseBranch: "main", baseSha: base, branch: "dep3", startedSha: base, endSha: sha("dep3") });
    assert.equal(r.left_on_branch, "dep3");
    assert.match(r.restore_error ?? "", /not clean/);
  });

  it("does nothing when the job never switched", () => {
    assert.deepEqual(restoreBranch({ switched: false, baseBranch: "main" }), {});
  });
});

describe("discardBranch", () => {
  it("refuses an unmerged branch without force and lists its commits", () => {
    mkBranch("dep3", "dep3.txt");
    const d = discardBranch({ branch: "dep3", baseRef: "main" });
    assert.match(d.error ?? "", /not in main/);
    assert.equal(d.unmerged_commits?.length, 1);
    assert.ok(branchExists("dep3"));
  });

  it("force deletes it, and the returned tip recovers the work", () => {
    mkBranch("dep3", "dep3.txt");
    const tip = sha("dep3");
    const d = discardBranch({ branch: "dep3", baseRef: "main", force: true });
    assert.equal(d.deleted, "dep3");
    assert.equal(d.tip, tip);
    assert.equal(d.was_merged, false);
    assert.ok(!branchExists("dep3"));
    sh("git", ["branch", "dep3", d.tip ?? ""]);
    assert.equal(sha("dep3"), tip);
  });

  it("a merged branch goes without force and needs no recovery hint", () => {
    mkBranch("done1", "done1.txt");
    sh("git", ["merge", "-q", "done1"]);
    const d = discardBranch({ branch: "done1", baseRef: "main" });
    assert.equal(d.deleted, "done1");
    assert.equal(d.was_merged, true);
    assert.equal(d.recover, undefined);
    assert.ok(!branchExists("done1"));
  });

  it("never deletes the base branch or the checked-out branch", () => {
    assert.match(discardBranch({ branch: "main", baseRef: "main", force: true }).error ?? "", /base branch/);
    mkBranch("dep4", "dep4.txt");
    sh("git", ["checkout", "-q", "dep4"]);
    assert.match(discardBranch({ branch: "dep4", baseRef: "main", force: true }).error ?? "", /checked out/);
    assert.ok(branchExists("dep4"));
  });

  it("reports a missing branch as gone, and rejects unsafe names and non-branch refs", () => {
    assert.equal(discardBranch({ branch: "nope", baseRef: "main" }).gone, true);
    assert.match(discardBranch({ branch: "--force; rm", baseRef: "main", force: true }).error ?? "", /usable branch/);
    sh("git", ["tag", "v1"]);
    assert.equal(discardBranch({ branch: "v1", baseRef: "main", force: true }).gone, true);
  });
});
