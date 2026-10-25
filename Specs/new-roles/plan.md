# Plan: new handoff roles

Implements `Specs/new-roles/spec.md` (v2).

## Approach

Reuse the existing gates, scope rules and branch handling; the new roles mostly build different inputs for them. The review of the first draft found that two shortcuts would have weakened existing guarantees, so they are replaced.

**`do`.** The server builds a `Task` object in memory from the call (`allowedPaths` from `paths`, `testCommand`, body = instruction) and stores `allowedPaths` and `testCommand` in the job record. `codeGate` reads scope and test command from the job record when the job is synthetic, instead of `readTask(job.targetRel)`. No file is written under `specs/`, so no other role can edit the task. The job's `targetRel` stays the caller's target. The key for the identical-call block is `sha1(role, target, instruction, sorted(paths), test_command, branch)`. In `handoff`, the job id is created before the branch so any name derived from it is available. The branch is `do/<id>-<time>` cut from the base. `do` joins `CODE_ROLES`.

**`research`.** A doc-mode role whose write scope is one file: `capsFor` gets the target and returns `write: [<target>/research.md]` (the existing `specs` caps allow all of `specs/**`). The doc gate checks headings and length; a new `citationProblems` parses `path:line` citations, resolves each (exists, readable, not a denied read, line in range), counts distinct ones, checks any quoted snippet, and honours a `NOT FOUND:` line. No commit.

**`fix` and `test` from a branch.** `planBranch` gets an optional `branch`. `validateExternalBranch` checks the prefix, existence, base and current-branch exclusion, and that `base..branch` holds a commit with a server-made subject. The job never commits onto that branch: it cuts `fix/<id>-<time>` from its tip. Round counting becomes the maximum of the count by `targetRel` and the count by source branch, with no reset.

**Hardening that the roles need.** Add `specs/.jobs` to `DENY_WRITE` so no role can overwrite job records or prompts; spec, plan and tasks jobs have `specs/**` caps and could do so today.

## Touch points

Existing (verified present):
- `src/types.ts`: `RoleName`, `RoleSpec`, `Caps`, `Job` (add `synthetic`, `testCommand`, `sourceBranch`).
- `src/roles.ts`: `ROLES`, `buildPrompt`; the `impl` prompt is the template for `do`.
- `src/server.ts`: the `handoff` schema and body (`role`, `target`, `instruction`, `feedback_path`, `wait`, `branch`), the key at the identical-call check, the fix-round count, the job-id and branch ordering, the `roles` tool.
- `src/engine.ts`: `capsFor` (add the target).
- `src/gates.ts`: `codeGate` (use the job record for synthetic jobs), `docGate`, new `citationProblems`.
- `src/branching.ts`: `CODE_ROLES` (add `do`), `planBranch`, new `validateExternalBranch`.
- `src/taskfile.ts`: `DENY_WRITE` (add `specs/.jobs`), `scopeProblems`; a new literal-prefix rule for `do` paths; `testCommandProblem` logic (in gates.ts) extended to the allowed forms.
- `scripts/smoke.ts`, `README.md`.
- Tests: `test/agent.test.ts`, `test/gates.test.ts`, `test/branching.test.ts`, `test/sandbox.test.ts`.
- Eval: `eval/lib/types.ts` (`StepDef` gains `paths`, `test_command`), `eval/run.ts` (pass them), `eval/lib/validate.ts` (support `do`, `research` and the second decoy), `eval/lib/checks.ts` (a `citations_resolve` check).

New:
- `test/roles-new.test.ts`; eval tasks for the three families.

## Data and API changes

- `handoff`: optional `paths` and `test_command`; `branch` now also meaningful for `fix` and `test`.
- `RoleName` gains `do` and `research`.
- Job record: `synthetic`, `testCommand`, `sourceBranch`; the saved `allowedPaths` becomes authoritative for synthetic jobs.
- `research` result adds `citations: { total, distinct, resolved, unresolved[] }`.

## Test strategy

Offline tests with the mock DeepSeek and a throwaway repo, per role:
- `do`: refuses empty, catch-all, `**/*.ts`, protected and escaping paths, an unknown script and a disallowed command form before any model call; one commit on a `do/` branch; write outside `paths` denied; SPEC_GAP gives BLOCKED; branch restored; the repeat-call block fires for an identical failed call and not for a changed `paths`; the gate enforces the saved scope even if a file on the branch says otherwise.
- `research`: only `research.md` is writable (other `specs/` files, and `specs/.jobs`, denied); `.env` unreadable; the gate fails on missing sections, an unresolved citation, repeated citations, a quote that is not on the cited line, and passes with 3 distinct citations or a `NOT FOUND:` plus one; no commit.
- `fix` from a branch: refuses the base branch, the current branch, a wrong prefix, a missing branch, a branch without a server-made commit; accepts a valid seeded branch; never commits onto it; escalates after two rounds across renamed source branches.
- `specs/.jobs` is not writable by any role.
- Regression: all existing tests and smoke pass; the scoring and compare code is untouched.

## Risks

- **A wider door.** `do` removes the task-file ceremony. Mitigation: required, validated `paths` and `test_command` with the literal-prefix rule, diff cap, test gate, one commit.
- **Branch abuse.** `fix` from a branch could reach a human's work. Mitigation: prefix allow-list, a server-made commit required, no commits onto the source branch.
- **Citation gaming.** A citation can resolve without supporting anything. Mitigation: distinct citations, quote check; the remaining gap (a real line that does not support the claim) is accepted and named here.
- **Prompt drift.** New prompts could change shared behaviour. Mitigation: `COMMON` is not edited; the regression tier is rerun.
- **Schema churn in Claude Desktop.** Mitigation: optional parameters and the smoke test.
- **Baseline blindness.** A baseline arm cannot exercise roles it lacks, so comparisons for these tasks are candidate-only until a baseline with the roles exists.

## Task breakdown rationale

Hardening and types first, because the other work depends on them. Then one role at a time from least to most risky (research is read-only; `do` writes in a bounded scope; `fix` from a branch touches existing history). Each role ships with tests before the next starts; eval tasks come last so they measure the finished roles.
