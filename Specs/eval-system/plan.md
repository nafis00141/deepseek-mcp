# Plan: online eval system for deepseek-mcp

Implements `Specs/eval-system/spec.md`. Order follows the agreed sequence: trace, runner + first tasks, scoring, baseline (ask first), remaining tasks, reviewer, loop.

## Approach

Keep the server the system under test and add only observability to it. Everything else lives in `eval/`, driven from outside over the real stdio MCP interface, so the eval exercises exactly what Claude Desktop uses.

1. **Trace in the server.** A small `src/trace.ts` exposes `traceEvent(jobId, event)` appending JSONL to `specs/.jobs/<jobId>.trace.jsonl` (try/catch, never throws). `runAgent` gets an optional `trace` callback so the engine stays testable without the server; `server.ts` wires it and emits `job_start`/`gate`/`job_end`. `Usage` gains `reasoning`. The existing `.log` stays.
2. **Runner.** `eval/run.ts` loads tasks, copies each fixture to a temp dir, `git init`s it, applies an optional `setup.ts` hook (extra branches, existing artifacts), spawns `src/server.ts` with `REPO_ROOT` and `DEEPSEEK_BASE_URL` pointing at the local proxy, and runs the task's `steps` (a list of `handoff` calls, with `job_status` polling) through `eval/lib/mcp.ts` (factored from `scripts/smoke.ts`).
3. **Proxy.** `eval/lib/proxy.ts` listens on 127.0.0.1, validates a random per-run bearer, forwards `/chat/completions` to `https://api.deepseek.com`, adds the real key, counts tokens (cache-hit and miss separately), and enforces `--max-tokens`/`--max-cost` with a non-retryable 402 (the run is marked `capped`, not scored; worst-case reserve or one-request overshoot is accepted and documented). It strips content-encoding/length on relayed bodies, disables the http server request/header timeouts (the server allows 300s per request), never logs headers, and injects per-task faults (`fail_first: 2 x 500`, tiny `max_tokens`; a 429 plus a 500 on one request exhausts the server's 4 attempts, so faults are scripted with that in mind). The server child and hidden-check processes get an explicit env allowlist and never the real key. The server code under test is copied to `runs/<id>/server/` at run start; the runner refuses a dirty tree unless `--allow-dirty` and writes a manifest (SHA, model, thinking, effort, MAX_TOKENS, env). After each live run the runner scans `runs/<id>/` and temp repos for the real key.
4. **Hidden checks.** After the steps finish, structural checks (`tree_clean`, `commit_count`, `no_commit`, files in scope) run first from git on the untouched job repo. Then the runner makes a throwaway copy or `git worktree` of the result branch tip (base when no branch), copies `hidden/` in there (never into the job repo, so preflight and later chain steps are unaffected), and runs with the same Node, a timeout and process-tree kill. Check types from `task.json`: `node --test`, `file_contains`, `file_not_contains`, `json_path`, `verdict_is`, `no_commit`, `answer_matches`, `answer_cites`, `tree_clean`. Results go to `checks.json`.
5. **Scoring.** `eval/score.ts` joins `checks.json`, job result and trace into one row per run, aggregates by task, family and split, computes false accepts/rejects and spread, and writes `scores.json` plus a readable `report.md`.
6. **Reviewer and loop.** `eval/bundle.ts` builds the dev-only reviewer input; `eval/review-prompt.md` defines the Claude pass. `eval/compare.ts` implements the keep/reject rule. `eval/loop.md` documents the human-gated procedure.

## Touch points

Existing files to change (all verified present):

- `src/engine.ts`: `chat()` retry loop (add `api_retry` events), `runAgent` turn loop and tool dispatch (turn/tool/repair/truncated events), usage accumulation (reasoning tokens). `ChatResponse.usage` type.
- `src/types.ts`: `Usage` adds `reasoning`; trace event types.
- `src/server.ts`: `executeJob` (job_start, gate, job_end), pass the trace callback to `runAgent`.
- `src/gates.ts`: no change in phase 1.
- `src/repo.ts`: no change (`changedFiles` already ignores `specs/.jobs`, `.gitignore` already lists it).
- `test/`: new `trace.test.ts` using the existing mock server in `test/helpers.ts` (extend the mock to return `completion_tokens_details`).
- `scripts/smoke.ts`: unchanged; `eval/lib/mcp.ts` copies its JSON-RPC client.
- `package.json`: add scripts `eval`, `eval:score`, `eval:dry` (no dependencies). The `npm test` glob stays `test/*.test.ts`, so fixture `.ts` files under `eval/` are never picked up.
- `tsconfig.json`: add `eval/**/*.ts` to `include` (fixture `repo/` and `hidden/` folders excluded) so the eval code is typechecked.
- `engine.ts` detail: `chat()` takes an optional trace handle for `api_retry` (`ping` passes none); a single helper classifies tool errors into `denied: write|read|false` by message prefix without altering model-visible output; the truncated-final-answer case is detected next to the existing mid-tool-call case; `ChatResponse.usage` gets a typed `completion_tokens_details`.
- `test/helpers.ts`: extend the mock with per-reply `usage` fields (including reasoning and cache tokens) and an optional delay.
- `.gitignore`: add `runs/`.
- `README.md`: short Eval section.

New files:

```
src/trace.ts
eval/run.ts  score.ts  compare.ts  bundle.ts  review-prompt.md  loop.md  pricing.json
eval/lib/mcp.ts  proxy.ts  fixture.ts  checks.ts  types.ts
eval/tasks/<id>/{task.json, repo/, hidden/, setup.ts?}
eval/heldout/<id>/...
test/trace.test.ts  test/eval-lib.test.ts
```

## Data and API changes

- Trace event shape (one line each, ISO `ts`): `job_start{role,model,effort,prompt_chars,pack_chars}`, `turn{n,ms,finish_reason,prompt_tokens,completion_tokens,reasoning_tokens,tool_calls}`, `tool{turn,name,args,ok,error?,denied,ms}`, `repair{n,turn,why}`, `truncated{turn}`, `api_retry{attempt,status}`, `gate{status,reasons,verdict?}`, `job_end{elapsed_ms,state}`.
- `task.json`: `id, family, split, title, needs_role?, env? (server env overrides), proxy? (fault script), steps[] (role, target, instruction, expect_status), checks[], expect{gate, hidden}`.
- `scores.json` row: task, k, gate_status, hidden_pass, false_accept, false_reject, first_try, instruction_compliance, repairs, turns, tokens{in,out,reasoning}, wall_s, oos_attempts.
- No change to the MCP tool schemas.

## Windows and runner hygiene

- Temp repos: `git init` then `symbolic-ref HEAD refs/heads/main`, local `user.name`/`user.email`, `commit.gpgsign=false`, `core.autocrlf=false`; temp dir resolved with `realpath.native` (this machine's temp path is an 8.3 name); EBUSY/EPERM retries on removal.
- CRLF fixtures are generated at copy time or protected by `.gitattributes` (`eval/**/repo/** -text`), so the user's global autocrlf cannot rewrite them in this repo.
- The server and every test process are killed as a tree (`taskfile /T`), not with `child.kill()`.
- Runs are sequential by default (up to a 15 minute job timeout each); `--parallel n` is safe because every run has its own repo and server.

## Methodology guards

- Scoring uses `expect.gate` per task (see spec AC-15); review tasks read the saved review file; instruction compliance is a named check per task.
- Held-out details live in a private tree and `bundle.ts` has a dev-path allowlist; one F1 or F2 task is held out; a small confirmation set is used only for the final decision; held-out looks are budgeted; reviewer patches mentioning task ids or fixture text are rejected.
- Keep rule: paired per-task outcomes, baseline k>=5 once, baseline/candidate interleaved in time, gains must exceed losses by at least 2 tasks with no flaky tasks counted.

## Test strategy

- Server: `test/trace.test.ts` with the mock DeepSeek: event sequence for a normal job, a repair, a truncated tool call, an API 500 retry, a denied write (`denied:true`); reasoning tokens parsed; trace write failure ignored; fake key never present in any output file (AC-3).
- Eval libs: `test/eval-lib.test.ts` offline, with a stub upstream instead of DeepSeek: proxy token cap refuses after the limit and stops cleanly; fixture copy produces a clean git repo with CRLF preserved; checks helpers; score aggregation on a canned run directory (AC-17 determinism); `--dry-run` makes zero upstream requests.
- Task validation without spending: `run.ts --dry-run --validate` runs every hidden check against the fixture's *unsolved* state (must fail) and against a stored reference solution (must pass), so a bad check cannot silently pass or fail. Reference solutions live beside each task.
- Extra cases: proxy cap returns 402 and the run is `capped`; env allowlist excludes the real key from server and hidden-check children; a hidden-check run leaves the job repo byte-identical; tiny `max_tokens` under thinking mode (may return empty content) behaves as expected; denied reads are not counted as write attempts.
- Each phase ends with `npm run typecheck`, `npm test`, `npm run smoke` green on Windows.

## Phases

1. **Trace** (small, `src/`): `trace.ts`, engine/server wiring, `Usage.reasoning`, tests.
2. **Runner core:** `mcp.ts`, `proxy.ts`, `fixture.ts`, `run.ts` with flags, estimate, resume, cap; offline lib tests.
3. **First 8 tasks** with hidden checks and reference solutions: `ask-cite`, `ask-no-answer` (held-out), `tasks-update-existing` (F1), `plan-steering` (F1/F3), `chain-impl-review-context` (F2), `impl-add-fn-hidden` (F3), `impl-contradictory-spec`, `review-planted-bug` (held-out).
4. **Scoring:** `score.ts`, report.
5. **Pilot + baseline (ask the user first):** 1-2 tasks to measure tokens, then print the estimate for 8 tasks x k=3; run only after approval.
6. **Remaining ~12 tasks** (CRLF, refactor, debug, tests-only, clean review, fix-after-finding, scope-escape, failing test_command, truncated output, API retry, full chain, extra ask/writing), tagging `needs_role` tasks N/A.
7. **Reviewer + loop:** `bundle.ts`, `review-prompt.md`, `compare.ts`, `loop.md`. Candidate #1 is the `plan`/`tasks` prompt change to include `instruction`, evaluated through the loop rather than applied before baseline.

## Risks

- **Noise:** LLM runs vary; k=3 may not separate small gains. Mitigation: report spread, require improvement beyond it, allow larger k for final comparison.
- **Overfitting the dev set:** held-out guard, one edit per candidate, and the reviewer never sees held-out detail. Held-out set is small, so its signal is coarse.
- **Bad hidden checks** give wrong scores. Mitigation: reference-solution validation before any live run.
- **Cost overrun:** proxy-enforced cap, dry-run estimate, pilot first; thinking mode with `max_tokens` 32000 can make single tasks expensive.
- **Key leakage:** key lives only in the runner env and proxy memory; server child gets a dummy; AC-3 test greps outputs; test commands already run without `DEEPSEEK_*`.
- **Windows specifics:** process-tree kill, path separators, CRLF, `where node`/old Node in PATH (server's `childEnv` already prepends the running Node); fixtures must set `core.autocrlf=false`; one skipped symlink test means symlink escape is untested on Windows.
- **Trace volume/privacy:** args are summarised, not full contents; full transcripts are opt-in (Q4).
- **Fixture realism:** tiny repos may not reflect real use; keep a few multi-file fixtures and revisit after the baseline.

## Task breakdown rationale

Trace first because everything downstream (scoring of out-of-scope attempts, reasoning tokens, repairs) depends on it and it is the only change to `src/`. The runner is built before many tasks so tasks are authored against a working harness and validated offline. Scoring precedes the baseline so the first spend produces scored data. The baseline is gated on user approval of a measured estimate. The reviewer and loop come last because they need real traces and a baseline to be meaningful.
