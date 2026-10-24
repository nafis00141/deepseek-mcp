import { changedFiles, git } from "./repo.js";

const SAFE = /^[A-Za-z0-9._/-]+$/;
const CODE_ROLES = ["impl", "fix", "test"];

export const branchExists = (b) => Boolean(b) && SAFE.test(b) && git(["rev-parse", "--verify", "--quiet", `refs/heads/${b}`]).ok;
const isMerged = (branch, base) => git(["merge-base", "--is-ancestor", branch, base]).ok;
const featureOf = (rel) => String(rel || "").split("/tasks/")[0];

/**
 * Where a code job starts, so work does not pile up on whatever branch the last job left behind:
 *   fix / test  continue the branch of the task's most recent code job (one branch per task);
 *   impl        starts from the base branch, or from the single unmerged branch of a task it depends on.
 * Returns { mode: "new" | "continue", from, branch? } or { error }.
 */
export function planBranch({ roleName, task, targetRel, history, baseRef }) {
  if (roleName === "fix" || roleName === "test") {
    const prev = history.filter((j) => j.targetRel === targetRel && CODE_ROLES.includes(j.role) && j.branch && j.state !== "interrupted" && branchExists(j.branch)).pop();
    if (prev) return { mode: "continue", branch: prev.branch, from: prev.branch };
    if (roleName === "fix") return { error: `no branch to fix for ${targetRel}: run impl first (or its branch was deleted)` };
  }
  const unmerged = [];
  for (const id of task?.dependsOn || []) {
    const dep = history.filter((j) => j.task === id && j.role === "impl" && j.state === "done" && featureOf(j.targetRel) === featureOf(task.rel) && j.branch && branchExists(j.branch)).pop();
    if (dep && !isMerged(dep.branch, baseRef)) unmerged.push(dep.branch);
  }
  const uniq = [...new Set(unmerged)];
  if (uniq.length > 1) return { error: `task depends on ${uniq.length} unmerged branches (${uniq.join(", ")}); merge them into ${baseRef} first` };
  return { mode: "new", from: uniq[0] ?? baseRef };
}

/** The branch a review should read: the newest code branch for any task under the feature directory. */
export function latestBranchFor(history, featureDir) {
  const dir = String(featureDir).replace(/\/+$/, "");
  return history.filter((j) => CODE_ROLES.includes(j.role) && j.branch && (j.targetRel === dir || String(j.targetRel).startsWith(`${dir}/`)) && branchExists(j.branch)).pop()?.branch ?? null;
}

/**
 * Put the repo back on the branch the human was on, and drop a branch the job created but never
 * committed to. If the tree is dirty (e.g. a test wrote stray files) it stays put and says so.
 */
export function restoreBranch(job) {
  if (!job?.switched || !job.baseBranch) return {};
  const workBranch = job.branch ?? job.reviewBranch ?? null;
  const target = job.baseBranch === "HEAD" ? job.baseSha : job.baseBranch;
  if (git(["rev-parse", "--abbrev-ref", "HEAD"]).out === job.baseBranch) return {};
  const dirty = changedFiles().filter((c) => !c.file.startsWith("specs/"));
  if (dirty.length) return { left_on_branch: workBranch, restore_error: `working tree not clean: ${dirty.slice(0, 3).map((c) => c.file).join(", ")}` };
  const end = job.endSha || git(["rev-parse", "HEAD"]).out;
  const co = git(["checkout", target]);
  if (!co.ok) return { left_on_branch: workBranch, restore_error: co.out.split(/\r?\n/).pop() };
  const out = { returned_to: job.baseBranch };
  if (job.createdBranch && job.branch && end === job.startedSha && git(["branch", "-D", job.branch]).ok) out.empty_branch_removed = job.branch;
  return out;
}

/**
 * Delete a job's work branch. Only branches the caller took from a job record are passed in, and the
 * base branch / the checked-out branch are never deleted. Unmerged commits need `force`; the tip sha is
 * returned so a forced discard can still be undone with `git branch <name> <sha>`.
 */
export function discardBranch({ branch, baseRef, force = false }) {
  if (!branch || !SAFE.test(branch)) return { error: "job has no usable branch" };
  if (!branchExists(branch)) return { error: `branch ${branch} no longer exists`, gone: true };
  if (branch === baseRef) return { error: `refusing to delete the base branch ${baseRef}` };
  if (git(["rev-parse", "--abbrev-ref", "HEAD"]).out === branch) return { error: `${branch} is checked out; switch to ${baseRef} first` };
  const tip = git(["rev-parse", branch]).out;
  const merged = isMerged(branch, baseRef);
  const commits = merged ? [] : git(["log", "--format=%h %s", `${baseRef}..${branch}`]).out.split(/\r?\n/).filter(Boolean);
  if (!merged && !force) {
    return { error: `${branch} has ${commits.length} commit(s) not in ${baseRef}; merge it, or pass force=true to throw the work away`, unmerged_commits: commits.slice(0, 20), tip };
  }
  const del = git(["branch", "-D", branch]);
  if (!del.ok) return { error: `git branch -D failed: ${del.out.split(/\r?\n/).pop()}` };
  return { deleted: branch, tip, was_merged: merged, discarded_commits: commits.slice(0, 20), ...(merged ? {} : { recover: `git branch ${branch} ${tip}` }) };
}
