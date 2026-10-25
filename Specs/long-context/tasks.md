# Tasks: using the 1M-token context window

Order matters where noted. "Done when" is checkable. Spec ids are AC-n in `spec.md` (v5).

## Status

| task | state |
|---|---|
| T1 settings | done (889b749); `loadContextSettings` and `configProblem` instead of a `loadConfig(env)` function |
| T4 caps | done; extended mode also previews an oversize result up to a line boundary and the `read_file` trace summary carries from/to |
| T5 guard and size check | done; size refusal ends as exhausted `request_size`; `context_budget` is added with T3 |
| T7 runner, proxy, compare | done; `--upstream-timeout`, timeouts in the manifest, `task.env` refusal, `--dev-only` (SCREENING), `--axis`, `--exclude-axis`, `--tasks` |
| compare fixes from review 4 | done: SCREEN PASS wording, unknown filter refused, filtered aggregates and cost ratio, exclusion-rate refusal (>10 points), like-for-like settings check, `--dev-only --final` refused; `confirm.ts` refuses two runs of the same server code and takes `--upstream-timeout`; the proxy charges an estimate for timed-out upstream calls against the cap and counts them; the runner validates the arm's context settings before spending and records the effective values and task env |
| job guard | a final answer that fails its self-check no longer gets a repair turn once the cap is reached |
| review 5 fixes | done: REFUSED decision (capped arm, unequal exclusions, unlike manifests: server code, timeouts, non-arm settings incl. `JOB_INPUT_TOKEN_CAP`, per-task env), excluded records carry axis/tier, `--exclude-axis` on an absent axis is a note, the runner asks the pinned server copy (`--check-config`) and refuses `--resume` with different settings and an upstream timeout not above `REQUEST_TIMEOUT_MS`, the proxy charges only timeouts and keeps the estimate apart from measured cost, `CONTEXT_MODE=extended` is refused until T3 |
| T2 legacy compaction module | done: `src/compact.ts` (`compactLegacy`, `createCompactor`); `COMPACT_CHARS` is the legacy budget and works now; the oracle test `test/compact.test.ts` runs a frozen copy of the old function the engine's way over growing conversations of eight shapes |
| T7b interleaved arms | not started |
| T3, T6 (the rest), T8-T13 | not started |

Tests: `test/context-settings.test.ts`, `test/compact.test.ts`, additions in `test/eval-lib.test.ts`, `test/eval-calibrate.test.ts` and `test/eval-confirm.test.ts`. Last full suite: 305 tests, none failing. `Specs/STATUS.md` has the one-page summary.


## T1. Settings with unchanged defaults
- Goal: add a testable `loadContextSettings(env, maxTokens)` (plus `configProblem`, checked at server start-up before any folder is touched) and `CONTEXT_MODE` (`legacy`|`extended`), `COMPACT_CHARS`, `COMPACT_LOW`, `CONTEXT_TOKENS`, `CONTEXT_WINDOW`, `READ_BUDGET_CHARS`, `READ_MAX_LINES`, `RESULT_LIMIT_CHARS`, `MAX_REQUEST_BYTES` (default 0), `JOB_INPUT_TOKEN_CAP` to `src/config.ts`; each setting has its own type and range (0 where it means off or already has a meaning; `COMPACT_LOW` a fraction in (0,1]).
- Files: `src/config.ts`, `src/server.ts`, `test/context-settings.test.ts`.
- Done when: defaults equal today's constants; bad values, `CONTEXT_TOKENS` without `CONTEXT_WINDOW`, and a budget with no room for `MAX_TOKENS` fail at start-up with a clear message; `CONTEXT_CHARS=0` and `MAX_REPAIRS=0` still work. (AC-1, AC-2)

## T2. Legacy-exact compaction in its own module
- Goal: move `compact()` to `src/compact.ts` unchanged in behaviour (legacy mode, including in-place mutation across turns, re-cutting and marker churn; the engine ignores its return value, so it must not become a pure function); `engine.ts` calls it with the settings.
- Files: `src/compact.ts`, `src/engine.ts`, `test/compact.test.ts`.
- Done when: a frozen copy of the old function inside the test is the oracle, run the engine's way (every turn on one growing array), and the new legacy mode gives identical arrays over growing multi-turn synthetic conversations of many shapes. (AC-1)
- Depends on: T1.

## T3. Token-aware, cache-friendly compaction modes
- Goal: extended mode: the `CHARS_PER_TOKEN` setting (default 3.5) for the estimate, token budget (last `prompt_tokens` plus an estimate for new messages, falling back to characters), fixed marker, cut messages tracked in a side `WeakSet`, consistent escaped-JSON sizes, watermark cut-down, then ending the job as exhausted with reason `context_budget` if the budget is still unreachable (never dropping `reasoning_content`: the API answers 400 without it in a tool loop). Add `context_budget` to `exhaustedReason`, the gate text and `engine.ts`.
- Files: `src/compact.ts`, `src/engine.ts`, `src/types.ts` (`exhaustedReason` gains `context_budget`), `src/gates.ts` (gate text), `src/config.ts` (flip `COMPACTION_BUILT`), `test/compact.test.ts`.
- Done when: works with usage and without; no cut message is ever changed again and no marker field reaches the request body; on a synthetic 40-turn conversation the watermark gives at most half as many prefix-changing turns as no watermark; first two and last six messages untouched; the unreachable-budget path ends as `context_budget` and is tested. (AC-2, AC-3)
- Depends on: T2.

## T4. Read and result caps from settings
- Goal: `read_file` characters and line window, and the tool result limit, read from config; legacy behaviour kept at defaults.
- Files: `src/engine.ts`, tests (`test/repo.test.ts` or a new engine test).
- Done when: defaults and legacy mode unchanged; at 5x and 20x paging works in both modes and, in extended mode, cuts happen at line boundaries (one over-long line gets a marker); the `read_file` trace summary records the returned from/to. (AC-4, AC-6)
- Depends on: T1.

## T5. Job input-token guard and request size check
- Goal: before each request, end the job as exhausted when the running input sum is at or over `JOB_INPUT_TOKEN_CAP`; `chat()` refuses a body above `MAX_REQUEST_BYTES`.
- Files: `src/engine.ts`, `src/types.ts` (`AgentOutput` exhausted reason), `src/gates.ts` (the exhausted text at line 283 is hard-wired to MAX_TURNS), `src/server.ts` if needed, tests.
- Done when: a mock model requesting large reads ends with the cap reason and reaches the gates as exhausted with commit rules unchanged; cap off is unchanged; an oversize body is refused before sending. (AC-5, AC-10)
- Depends on: T1.

## T7b. Interleaved arm runs
- Goal: run several arms in one go with the (task, k) cells interleaved in a randomised order, recorded in each manifest, so provider load, cache warm-up and peak against off-peak pricing do not line up with an arm. Same pinned code, per-arm settings, per-arm run folders and caps.
- Files: `eval/run.ts` (or a thin `eval/arms.ts` over `runEval`), tests with the stub upstream.
- Done when: the recorded order is a permutation covering every cell once per arm; a test shows no arm always goes first; each arm's manifest carries its settings and the shared order; caps and the exclusion rules still hold per arm. (AC-8)
- Depends on: T7.

## T6. Trace and score metrics (needs T4 for the returned from/to; both done or in the same change)
- Goal: `compact` trace event; peak prompt tokens, cache-hit share, compactions, overlap-based repeat reads, reasoning tokens, truncated events and timeouts in `score.ts`; columns in compare tables.
- Files: `src/types.ts`, `src/trace.ts` (`summarizeResult` for `read_file`), `eval/score.ts`, `eval/compare.ts`, tests.
- Done when: synthetic traces give the expected numbers (ordinary paging is not a repeat; the longest turn latency per run and per arm is reported); a trace from before this change still scores. (AC-6)
- Depends on: T3.

## T7. Runner, proxy and compare support
- Goal: add the new settings to the runner allowlist so manifests record them, and record `--task-timeout` too; make the proxy's upstream timeout (fixed 330 s) a setting; the loader refuses the new settings in a task's `env`; `compare.ts --dev-only` (skips `spendLook`, passes `devOnly`, prints the verdict as SCREENING) and a task filter by axis or list.
- Files: `eval/lib/proc.ts`, `eval/lib/proxy.ts`, `eval/lib/fixture.ts`, `eval/run.ts`, `eval/compare.ts`, tests.
- Done when: a run with a changed setting shows it, and the timeouts, in its manifest; a task with such an `env` is refused; `--dev-only` writes no look, prints a SCREENING verdict and honours the task filter. (AC-8, AC-11)
- Depends on: T1.

## T8. XL fixture generator
- Goal: a deterministic generator for large original filler (seeded; near-duplicate names; plausible code) used by task `setup.ts` files, with its files covered by `taskSetHash` (which today walks only the hard task folders); `setup.ts` commits the expansion (`runSetup` runs after the seed commit); `task.json` `expanded: { bytes, sha256 }` (generated paths and bytes before any overlay) checked by `--validate`; expansion is fast because `--validate` expands each task once per variant.
- Files: generator module, `eval/lib/calibration.ts`, `eval/lib/validate.ts`, tests.
- Done when: same seed gives the same bytes; a changed generator changes the task-set hash; `--validate` fails on a size or hash mismatch. (AC-7)
- Depends on: T7; `Specs/harder-evals/` T1 and T4.

## T9. XL tasks (T9a: three, T9b: three; separate sessions)
- Goal: six hard dev tasks, axis `long-context-xl`, none solvable by one lexical `grep` (it skips lines of 2,000+ characters and files over 1 MB): needle in a very large file that needs reasoning; cross-file change in a repo larger than the old compaction limit; a long job whose early reads matter after the old limit; and three more variations. Hidden checks, a reference and two decoys of different kinds each; edits by reference and decoys stay in small files. Authored without looking at any run result. Also amend `Specs/harder-evals/spec.md` AC-11, AC-12 and AC-14 so these tasks are outside the hard-tier counts and budgets, and edit `Specs/harder-evals/spec.md` AC-13 to cover "seed plus generator" and exempt these tasks from its AC-10 structural retune.
- Done when: `--validate` passes for all six and total `--validate` time stays within its budget; each expands above the old compaction limit; committed folders stay small; the harder-evals spec is amended. (AC-7)
- Depends on: T8. Must land before `Specs/harder-evals/` T17 or that freeze is redone.

## T10. Transport measurements (needs approval; small spend)
- Goal: measure characters per token on the generated filler; probe the real request-size limit; record the longest turn latency at a near-limit request. The probe goes through the proxy with `--max-cost` (never a raw key) and uses content with many bytes per token so the byte ceiling is not confused with the 1M-token window. Choose arm (d)'s budget and `MAX_REQUEST_BYTES` from the ceiling; update the token estimate in T3 if the ratio differs.
- Files: a script under `scripts/` or `eval/`, notes in `Specs/long-context/`.
- Done when: the ceiling, the ratio and the latency are recorded and `MAX_REQUEST_BYTES` guidance is written. (AC-10)
- Depends on: T3, T5, T9. Ask the owner before spending.

## T11. Experiment plan, estimate and pilot (needs approval)
- Goal: write the four arms (the top arm only if the pilot's peak prompt tokens are at least 1.5 times the primary's), the guard definition and its false-block rate, the job count, wall-clock and concurrency, the task list, k, identical timeouts and `JOB_INPUT_TOKEN_CAP`, the cost estimate from `eval/pricing.json` and the pilot results (k=1 on all arms, to catch broken scenarios and calibrate cost). Pre-register that arm (c) vs (a) decides. Ask the owner before the full run.
- Files: `Specs/long-context/experiment.md`.
- Done when: the negative control (baseline twice) is specified; the task list is fixed; the estimate (including retries and calibration of the XL tasks at defaults) is written; the owner has approved it. (AC-8, AC-9)
- Depends on: T4, T6, T7, T7b, T9, T10. Also fixes the cost and time estimate: 300 XL jobs one after another at 15-60 minutes each is roughly 75-300 hours, so concurrency (`--parallel`) and the interleaved order are decided here.

## T12. Run, compare, decide (needs approval)
- Goal: baseline, caps-only, primary, top; XL tasks at k=10, related and regression tasks at k=5; `--max-cost`; compare each arm to the baseline with `--dev-only` (a SCREENING verdict; the decision counts the XL tasks only and the other tasks are a loss guard); run the negative control first; add cost, latency, peak tokens and cache-hit share; a capped arm is excluded; triage failures through the reviewer bundle. Write the result and a recommendation. The owner decides Q1 and Q2; any default change is a separate candidate branch through the normal loop and confirmation.
- Done when: results recorded; a screening verdict for the primary arm and descriptive results for the others; the cost rule outcome stated. (AC-8, AC-9)
- Depends on: T11.

## T13. Docs
- Goal: README lists the new settings, defaults, measured results and the recommended values for a 1M-token model; `eval/loop.md` mentions the new metrics, `--dev-only`, and that setting arms are not confirmed.
- Done when: a reader can turn the settings on for a 1M-window model and knows what was measured. (AC-1, AC-6, AC-8)
- Depends on: T12.
