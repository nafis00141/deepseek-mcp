# Spec: new handoff roles (`do`, `research`, and `fix` from a branch)

Status: draft v2 (after review). Baseline server version: 0.9.0 plus the accepted candidates.

## Goal

Make deepseek-mcp a general-purpose subagent, not only a spec-to-code pipeline. Three families the eval had to mark "not applicable" cannot be expressed today:

- **Free-form work.** Every code role needs a task file with front matter, and Claude Desktop has no tool to write one, so a single refactor or bug fix forces a full spec, plan and tasks chain first.
- **Research that leaves an artifact.** `ask` returns text clipped to 3000 characters and writes nothing.
- **Fixing from a review.** `fix` only continues a branch created by an `impl` job in this server's history, so a branch left by an earlier session or a seeded fixture cannot be fixed.

Add three capabilities, each with a server-side gate, without weakening any safety rule.

## Non-goals

- No merge or push by the server, ever.
- No new MCP tool: `handoff` gains optional parameters; existing calls keep working.
- No change to the scoring or keep rule.
- No arbitrary shell for the model; `run_tests` still runs only the declared command.
- No role that edits another feature's spec, plan or tasks documents.

## Order of work

Land this before calibrating `Specs/harder-evals/` bands (T17 there), because the roles change the server. Open questions Q1-Q4 are settled in this spec (below) before any code is written.

## Acceptance criteria

`do` (free-form change):
- AC-1. `handoff(role: "do", target, instruction, paths: [globs], test_command)` runs with no task file. The server builds an in-memory task (`allowed_paths` = `paths`, `test_command`, the instruction as body) and stores the effective `allowedPaths` and `testCommand` in the job record. The code gate uses the values saved in the job record, not a file re-read after checkout, so the scope that was checked is the scope that is enforced. No file under `specs/` carries the task.
- AC-2. `paths` and `test_command` are required for `do`. Each glob must start with a literal folder prefix (`src/lib/**` is accepted; `**/*.ts`, `*` and `**` are refused) and be free of protected locations (`.git`, `.github`, `.claude`, `.vscode`, `.env*`, lockfiles, `specs/`) and of anything that leaves the repo. `test_command` must be `npm test`, `npm run <script>` (the script must exist in package.json) or `node --test <paths>`; anything else is refused. All of it is checked before any model call.
- AC-3. A `do` job works on its own branch `do/<id>-<time>` cut from the base branch, never from another job's branch; the human's branch is restored afterwards. `do` is added to the set of code roles so that `review` finds its branch through the job history.
- AC-4. The repeat-call block still works: the key for `do` is built from role, the caller's `target`, `instruction`, the sorted `paths`, `test_command` and `branch`, so an identical failed call is refused, and a changed one is not. The job id is created before the branch.
- AC-5. The `do` prompt says there is no spec, the instruction is the whole task, the model must stay inside `paths`, and it must print `SPEC_GAP:` if the instruction is contradictory (same rule as `impl`).

`research`:
- AC-6. `handoff(role: "research", target: "specs/<feature>", instruction)` has read-only repo access and may write only `specs/<feature>/research.md`. It does not commit. The one-writer rule applies to it like any doc role.
- AC-7. `research.md` must contain the sections `## Question`, `## Findings`, `## Evidence`, `## Open questions` and be at least 400 characters.
- AC-8. Evidence gate. Citations are `path:line` (or `path:start-end`). The gate counts distinct resolving citations: the file exists, is readable, and the line is within the file. A document needs at least 3 distinct resolving citations and no unresolved ones. A citation followed by a backticked quote must have that quote on the cited line. A `## Findings` line starting `NOT FOUND:` lowers the minimum to 1 distinct citation (the place that was searched). Repeating the same citation does not count twice.

`fix` and `test` from a branch:
- AC-9. `handoff(role: "fix" | "test", target: <task file>, feedback_path, branch: <name>)` may start from an existing local branch even when this server has no job for it, only if the name starts with `impl/`, `fix/`, `test/` or `do/`, the branch exists, it is neither the base branch nor the branch the human is on, and `base..branch` contains at least one commit whose subject has the server's own form (`task-<id>: <role>`).
- AC-10. The server never commits onto an outside branch: it cuts a new branch `fix/<id>-<time>` (or `test/...`) from that branch's tip and works there.
- AC-11. The two-round cap cannot be reset by renaming: rounds are the larger of the count by task file and the count by source branch, and escalation after two rounds applies to either.
- AC-12. Refusals are clear: base branch, the human's current branch, a wrong prefix, a missing branch, a branch with no server-made commit.

Cross-cutting:
- AC-13. All existing safety rules hold for every new path: allowed_paths enforced on every write, denied paths (now including `specs/.jobs`), one server-made commit (none for doc roles), one writer at a time, `.env` unreadable, no merge or push. Tests prove it per role, including a scope-escape attempt and a write to `specs/.jobs`.
- AC-14. The `roles` tool lists the new roles; the `branch` parameter description no longer says "review only"; README and `npm run smoke` list the new parameters.
- AC-15. The three eval tasks marked not applicable (`free-form-refactor`, `research-report`, `fix-after-finding`) become real tasks (runner steps accept `paths` and `test_command`; the simulator in `--validate` supports the new roles), each with hidden checks, a reference and two decoys (this needs `Specs/harder-evals/` T4), and a baseline run measures them (a baseline arm cannot exercise a role it lacks, so the comparison is candidate-only until a baseline with the roles exists).
- AC-16. `typecheck`, `npm test` and `smoke` pass; each new role has offline tests with the mock DeepSeek.

## Constraints

- TypeScript with erasable syntax, `.ts` imports, no new runtime dependencies.
- New `handoff` parameters are optional and ignored by other roles.
- Prompts for new roles follow the `COMMON` block and summary-JSON convention; `COMMON` is not edited.

## Decisions on the earlier open questions

- Q1. `test_command` is always required for `do`.
- Q2. No separate file-count cap for now; the diff-line cap and the `paths` rule bound the change. Revisit after the first eval run.
- Q3. `research` writes exactly one file.
- Q4. `fix` from a branch accepts any markdown feedback file under the repo (the existing `feedback_path` rule), because the branch is already required to carry a server-made commit.
