# Spec: online eval system for deepseek-mcp

Status: implemented and in use (see `Specs/STATUS.md`). Baseline server version: 0.9.0.

## Goal

Measure, with real DeepSeek calls, how well the handoff server works as a general-purpose subagent, and give an improvement loop objective evidence for changing the *harness* (role prompts, system prompt and tool descriptions, gate and repair messages, context pack, instruction flow, per-role settings) while the model stays fixed.

"Correct" is decided by hidden checks the model never sees, not by the server's own gate. The gap between the two (false accepts / false rejects) is the primary signal.

Live-run findings that the system must be able to detect and measure:

- F1. `plan` and `tasks` do not apply new steering in `instruction` when the artifact already exists. Observed root cause: `plan` and `tasks` prompt builders in `src/roles.ts` ignore `instruction` entirely.
- F2. A decision given only in the `impl` instruction is invisible to `review`, which then reports a false blocker.
- F3. A job can pass its gate while ignoring the instruction or failing hidden tests (gate-pass is not correctness).

## Non-goals

- No change to the safety design: allowed_paths enforcement, denied paths, one server-made commit per job, one writer at a time, identical-failed-call block, max 2 fix rounds then `escalate`, no merge or push.
- No new runtime dependencies. `eval/` uses Node built-ins only; dev dependencies stay `typescript` and `@types/node`.
- No automatic application of proposed harness patches; no automatic merge. The human approves every merge.
- No new server role (`do`, `research`) in this spec. Families the current roles cannot express are tagged and reported as N/A (see AC-12); the roles are a separate proposal.
- Not a model benchmark: comparing models is out of scope.
- No CI integration of live evals (they cost money and need the key).

## Acceptance criteria

Trace (server, `src/`):

- AC-1. Every job writes `specs/.jobs/<jobId>.trace.jsonl`, one JSON object per line, with event types `job_start`, `turn`, `tool`, `repair`, `truncated`, `api_retry`, `gate`, `job_end`. A test runs a mock-DeepSeek job and asserts the event sequence and required fields.
- AC-2. `turn` events carry `reasoning_tokens` (from `usage.completion_tokens_details.reasoning_tokens`; `null` when the API omits it, never 0), prompt and completion tokens (reasoning is a documented subset of completion, never added to it), cache-hit prompt tokens when reported, elapsed ms and `finish_reason`. `tool` events carry name, an args summary built from a per-tool whitelist (paths, sizes, counts; never file contents, `old`/`new` text or grep patterns), ok/error, `denied` as `"write"`, `"read"` or `false` (classified by one helper from the existing error text; model-visible tool output is unchanged), and ms. A truncated final answer (`finish_reason: length` with no tool call) emits `truncated` too, and `job_end` is emitted on the crash path as well.
- AC-3. No trace, log, job file or run output contains the API key. A test sets a recognisable fake key and greps all trace and job output for it. In addition, every live run ends with a scan of `runs/<id>/` and the fixture temp repos for the real key; any hit fails the run.
- AC-4. Tracing failure never fails a job (write errors are swallowed like the existing log). `npm run typecheck`, `npm test` and `npm run smoke` pass.

Runner:

- AC-5. `eval/run.ts` starts the real server over stdio, one server process per task run, with `REPO_ROOT` set to a temp git repo copied from the fixture, and drives it only through `handoff` and `job_status`. It never touches `F:\MyCodeProject\test-deepseek`.
- AC-6. The DeepSeek key is read from the runner's environment (or the runner's own env file) and injected by a local pass-through proxy bound to 127.0.0.1. The server child and the hidden-check processes are spawned with an explicit env allowlist (Path, SystemRoot, TEMP, GIT_BIN, REPO_ROOT, the DEEPSEEK_* settings the task needs), never a copy of the runner's env. The child gets a random per-run bearer token that the proxy validates, so model-written code cannot reach the real key through the proxy port. The key appears in no file.
- AC-6b. The server code under test is pinned: at run start `src/` and `package.json` are copied (or checked out at a recorded SHA) into `runs/<id>/server/` and every task spawns from that copy. The runner refuses a dirty working tree unless `--allow-dirty`. A run manifest records server SHA/diff hash, model, thinking, effort, MAX_TOKENS and every env setting that affects behaviour (including any `.env` values).
- AC-7. Flags: `--only <ids>`, `--k <n>`, `--split dev|heldout|all`, `--parallel <n>` (separate temp repo and server per run), `--dry-run` (prints plan and estimate, makes no API call; the estimate comes from a measured pilot, not a guess), `--max-tokens`/`--max-cost` (hard cap enforced by the proxy; `--max-cost` without `pricing.json` is an error), `--task-timeout`, `--resume`. The proxy answers over-cap requests with a non-retryable 4xx; such runs are marked `capped` and excluded from scoring. An estimate is printed before any live run.
- AC-8. Each task run writes `runs/<run-id>/<task>/<k>/` with the job JSON, final text, prompt, committed diff, the review file (`specs/review/*.md`) when present, `trace.jsonl`, and `checks.json`. `checks.json` is written atomically with `complete: true`; capped, aborted or infra-failed runs are never marked complete, and `--resume` skips only complete ones. `runs/` is gitignored. Each run uses a fresh repo and server (the identical-failed-call block is per repo).
- AC-8b. Hidden checks never modify the job repo. Structural checks (tree clean, commit count, `no_commit`, files in scope) run first against the real job repo via git. Hidden tests then run in a throwaway copy or `git worktree` of the result branch tip (the base branch when the job made none), with the same Node, a timeout and process-tree kill.
- AC-9. Temp repos use `core.autocrlf=false`, a local git identity, and work with Windows paths. At least one fixture is CRLF.

Tasks and checks:

- AC-10. The suite has about 20 tasks, each a fixture repo plus a task definition plus hidden checks that are copied in only after the job ends and are never visible to the model or server. Hidden checks are executable (node tests for code; grep/rubric checks for artifacts and answers). Each task ships a reference solution (passes gate and hidden checks) and, for the F1/F2/F3 tasks, a decoy solution that passes the server gate but fails the hidden checks; `--validate` proves both offline, and also that the unsolved fixture fails. Each task names its instruction-compliance check explicitly, and declares `expect.gate` (the correct gate outcome, e.g. `failed` for a contradictory spec) and `infra` faults it injects.
- AC-11. The suite covers the families: repo questions/research (citations, refusing to guess, read-only), writing (spec, plan, tasks, updating an existing artifact), code changes (add function, edit, multi-file, refactor, CRLF, debug a failing test, tests-only), review (planted bug expects FAIL and the bug found; clean code expects PASS with no invented blockers; instruction context), fix after a planted finding, failure behaviour (contradictory spec expects BLOCKED, already-done expects noop, scope-escape attempt, failing test_command, truncated output, API error/retry), and multi-step chains with steering passed along.
- AC-12. A family the current roles cannot express is represented by a task tagged `needs_role: <proposed role>`, listed in the report as N/A, never silently dropped.
- AC-13. The first 8 tasks include at least one non-code task and one targeting each of F1, F2 and F3, each with its decoy (AC-10). F1 is expected to be near-deterministic on 0.9.0 because the model never receives the instruction; F3 and F2 are measured, not predicted.
- AC-14. About one third of tasks are held out and kept outside the dev tree (`eval/heldout/` is gitignored or stored outside the repo). Held-out run details are written to a separate private tree (`runs/<id>/heldout-private/`); `bundle.ts` uses an allowlist of dev paths only, so the reviewer sees only aggregate held-out scores. At least one F1 or F2 task is held out so generalisation is measured. A further small confirmation set is touched only for the final keep decision. Held-out evaluations are budgeted (a pre-registered maximum number of looks), and reviewer patches must be task-agnostic: patches that mention task ids or fixture strings are rejected.

Scoring:

- AC-15. `eval/score.ts` computes, per task and overall: gate-pass rate, hidden-check pass rate, false accepts, false rejects, first-try pass (no repairs in the trace and no fix round), instruction compliance (the task's named check), repairs, turns, tokens (input, output, with reasoning shown as a subset of output), wall time, and out-of-scope write attempts (`denied: "write"` events only; denied reads are reported separately). Definitions are relative to the task's `expect.gate`: a false accept is a gate outcome in the task's "bad" set (done/noop where failure was expected, or done where hidden checks fail); a false reject is a gate status different from `expect.gate` while the hidden checks pass. A correct BLOCKED outcome (`failed` expected) is therefore not a false reject. Infra failures, injected faults and capped runs are excluded. Review tasks are scored on the verdict equalling the expected one AND the planted bug located in the full findings list (read from the saved review file), since the review gate returns `done` for any parsable verdict.
- AC-16. With `k` repeats it reports mean and spread (min/max or stdev) per metric and flags tasks whose outcome varies across repeats. Per-task outcomes are kept paired across baseline and candidate.
- AC-17. Scoring is deterministic and offline: re-running `score.ts` on an existing run directory gives identical output and makes no API call.

Reviewer and loop:

- AC-18. `eval/review-prompt.md` plus a bundling script produce a single input for a separate Claude pass: scores, grouped failures, and traces of dev-set runs only. The reviewer's contract is to group failures into patterns and propose concrete patches to harness files, each citing evidence runs. It proposes only.
- AC-19. The improvement loop is: baseline run, then exactly one candidate edit on a branch, rerun, `compare.ts` against baseline. The baseline is run at least once with k>=5 to estimate variance (thinking mode accepts no seed), and baseline and candidate runs are interleaved in time to limit API drift. A candidate is recommended for keeping only if, on paired per-task outcomes, it gains on at least two more tasks than it loses (none of them flagged flaky) and the held-out aggregate does not drop by more than the pre-registered tolerance; with a small held-out set one flake alone is not a regression. Merging requires explicit human approval; the tooling never merges or pushes.

## Constraints

- TypeScript, run by Node type stripping (Node >= 22.18): erasable syntax only, `.ts` import extensions, strict tsconfig used for `tsc --noEmit`. Windows is the primary platform.
- Any change in `src/` ships with tests and keeps existing tests green.
- Hard cost cap per run, estimate before start. Pricing comes from `eval/pricing.json` (see D1); token caps remain available and are always enforced.
- Never commit or push without being asked.


## Decisions (open questions resolved by the user)

- D1 (Q1, Q6). Prices for `deepseek-flash` (per 1M tokens, USD) go into `eval/pricing.json`: cache-hit input 0.003 off-peak / 0.006 peak; cache-miss input 0.15 off-peak / 0.3 peak; output 0.6 off-peak / 1.2 peak. Cost caps and estimates use the peak rates (conservative) because the peak window is not known to the runner. Source: DeepSeek model-details table supplied by the user; the file records that source and should be re-checked before relying on it.
- D2 (Q2). The key-holding proxy design is accepted.
- D3 (Q3). Held-out tasks are chosen by hand at authoring time, fixed, and recorded in each `task.json`.
- D4 (Q4). Prompt + final text + trace are enough for the reviewer. No `TRACE_FULL` transcript dump.
- D5 (Q5). Larger k is acceptable (baseline k>=5, per AC-19).
- D6 (Q7). Held-out tasks live in `eval/heldout/` inside this repo, gitignored; their run details go to the private tree (AC-14).
