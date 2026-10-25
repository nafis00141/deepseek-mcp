# Tasks: new handoff roles

Order matters as marked. "Done when" is checkable. Spec ids are AC-n in `spec.md` (v2).

## T1. Deny writes to `specs/.jobs`
- Goal: add `specs/.jobs` to `DENY_WRITE`; spec/plan/tasks jobs and code roles can no longer overwrite job records or prompts.
- Files: `src/taskfile.ts`, `test/sandbox.test.ts`.
- Done when: a test shows a write to `specs/.jobs/x` is denied for every caps type. (AC-13)

## T2. Types and registry entries
- Goal: `do` and `research` in `RoleName`; `ROLES` entries; Job fields `synthetic`, `testCommand`, `sourceBranch`; `capsFor` takes the target; `do` added to `CODE_ROLES`; the `branch` parameter description updated.
- Files: `src/types.ts`, `src/roles.ts`, `src/engine.ts`, `src/branching.ts`, `src/server.ts`.
- Done when: typecheck passes; the `roles` tool lists both roles; existing tests unchanged. (AC-3, AC-14)

## T3. Research role: caps and prompt
- Goal: `research` prompt; write access only to `<target>/research.md`; read-only repo access.
- Files: `src/roles.ts`, `src/engine.ts`, `test/sandbox.test.ts`.
- Done when: writes elsewhere (including other `specs/` files) are denied and `.env` reads are denied. (AC-6, AC-13)
- Depends on: T1, T2.

## T4. Research role: gate and citations
- Goal: headings and length; `citationProblems`: distinct resolving citations, quote check, `NOT FOUND:` handling; counts in the report.
- Files: `src/gates.ts`, `test/gates.test.ts`.
- Done when: tests cover missing sections, a bad line, a missing file, a denied path, repeated citations, a wrong quote, `NOT FOUND:` with one citation, and a passing document. (AC-7, AC-8)
- Depends on: T3.

## T5. In-memory task for `do`, and the gate from the job record
- Goal: build the `Task` in memory from `paths`, `test_command` and the instruction; literal-prefix rule for `paths`; allowed `test_command` forms; store `allowedPaths` and `testCommand` in the job record; `codeGate` uses them for synthetic jobs.
- Files: `src/taskfile.ts`, `src/gates.ts`, `src/server.ts`, tests.
- Done when: empty, catch-all, `**/*.ts`, protected, escaping, unknown-script and disallowed-command inputs are refused before any model call; a test changes the task file on the branch and shows the gate still uses the saved scope. (AC-1, AC-2)
- Depends on: T2.

## T6. `do` role: prompt, key, branch and gate
- Goal: `do` prompt; key from role, target, instruction, sorted paths, test command and branch; job id created before the branch; branch `do/<id>-<time>` from the base; `handoff` accepts `paths` and `test_command`.
- Files: `src/roles.ts`, `src/server.ts`, `scripts/smoke.ts`, tests.
- Done when: a mock-model test makes one commit on a `do/` branch, denies a write outside `paths`, gives BLOCKED on SPEC_GAP, restores the human's branch, blocks an identical failed call but not a changed `paths`; smoke lists the new parameters. (AC-3, AC-4, AC-5, AC-13, AC-14)
- Depends on: T5.

## T7. `fix`/`test` from an existing branch
- Goal: `validateExternalBranch` (prefix, existence, base/current exclusion, a server-made commit); new branch cut from the source tip; round count is the larger of by task file and by source branch.
- Files: `src/branching.ts`, `src/server.ts`, `test/branching.test.ts`.
- Done when: tests cover each refusal, acceptance of a valid branch, no commit on the source branch, and escalation after two rounds across renamed source branches. (AC-9, AC-10, AC-11, AC-12)
- Depends on: T2.

## T8. Safety regression pass
- Goal: a scope-escape attempt per new role; a write to `specs/.jobs`; no merge or push path exists; one writer at a time still holds with the new roles.
- Files: tests only.
- Done when: all pass with the full existing suite. (AC-13, AC-16)
- Depends on: T4, T6, T7.

## T9. Eval runner and validator support
- Goal: `StepDef` accepts `paths` and `test_command`; the runner passes them; `--validate` simulates `do`, `research` and a second decoy; `citations_resolve` check.
- Files: `eval/lib/types.ts`, `eval/run.ts`, `eval/lib/validate.ts`, `eval/lib/checks.ts`, tests.
- Done when: a synthetic `do` task validates offline. (AC-15)
- Depends on: T6; the second decoy also needs `Specs/harder-evals/` T4.

## T10. Docs
- Goal: README role table, parameters, examples, and the decisions on Q1-Q4.
- Done when: a reader can call each new role from the README. (AC-14)

## T11. Eval tasks for the three roles
- Goal: convert `free-form-refactor`, `research-report` and `fix-after-finding` from N/A to real tasks, plus one more per role (a free-form bug fix with a scope trap; research that must say NOT FOUND; a fix after a planted review finding where the first attempt is incomplete); hidden checks, a reference and two decoys each.
- Files: `eval/tasks/...`, tests.
- Done when: `--validate` passes for all six. (AC-15)
- Depends on: T4, T6, T7, T9.

## T12. Measurement
- Goal: run the six tasks at k=5 on the candidate arm (a baseline without the roles cannot run them); record pass rates; triage failures through the reviewer bundle. Ask the owner before spending.
- Done when: results recorded in `Specs/new-roles/`. (AC-15)
- Depends on: T11.

## Measured pass rates (T12)

Hidden-check pass, k=5, DeepSeek, dev split.

| task | roles-1 (before fixes) | roles-2 (after fixes) |
|---|---|---|
| do-scope-trap | 1/5 | 5/5 |
| research-not-found | 4/5 | 5/5 (first try 1/5; one in-job citation repair each) |
| free-form-refactor | 5/5 | 5/5 |
| research-report | 5/5 | 5/5 |
| fix-after-finding, fix-refuses-handmade-branch | 5/5 | not rerun |

Fixes: `do` prompt splits whole-task SPEC_GAP from the partial path; research citations are repaired inside the job. No false accepts or rejects. Runs: `runs/roles-1`, `runs/roles-2`.
