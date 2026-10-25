# Tasks: using the 1M-token context window

Order matters where noted. "Done when" is checkable. Spec ids are AC-n in `spec.md` (v2).

## T1. Settings with unchanged defaults
- Goal: add `COMPACT_CHARS`, `COMPACT_LOW`, `CONTEXT_TOKENS`, `CONTEXT_WINDOW`, `READ_BUDGET_CHARS`, `READ_MAX_LINES`, `RESULT_LIMIT_CHARS`, `MAX_REQUEST_BYTES`, `JOB_INPUT_TOKEN_CAP` to `src/config.ts` with validation (0 allowed where it means "off" or already has a meaning).
- Files: `src/config.ts`, `test/config.test.ts` (new).
- Done when: defaults equal today's constants; bad values, `CONTEXT_TOKENS` without `CONTEXT_WINDOW`, and a budget with no room for `MAX_TOKENS` fail at start-up with a clear message; `CONTEXT_CHARS=0` and `MAX_REPAIRS=0` still work. (AC-1, AC-2)

## T2. Legacy-exact compaction in its own module
- Goal: move `compact()` to `src/compact.ts` unchanged in behaviour (legacy mode, including re-cutting and marker churn); `engine.ts` calls it with the settings.
- Files: `src/compact.ts`, `src/engine.ts`, `test/compact.test.ts`.
- Done when: a frozen copy of the old function inside the test is the oracle and the new legacy mode gives identical output on synthetic conversations of many shapes. (AC-1)
- Depends on: T1.

## T3. Token-aware, cache-friendly compaction modes
- Goal: token mode (last `prompt_tokens` plus an estimate for new messages, falling back to characters), fixed marker, per-message cut flag, consistent escaped-JSON sizes, watermark cut-down.
- Files: `src/compact.ts`, `test/compact.test.ts`.
- Done when: with usage and without; no cut message is ever changed again; on a synthetic 40-turn conversation the watermark gives at most half as many prefix-changing turns as no watermark; first two and last six messages untouched. (AC-2, AC-3)
- Depends on: T2.

## T4. Read and result caps from settings
- Goal: `read_file` characters and line window, and the tool result limit, read from config; legacy behaviour kept at defaults.
- Files: `src/engine.ts`, tests (`test/repo.test.ts` or a new engine test).
- Done when: defaults unchanged; at 5x and 20x paging works and cuts happen at line boundaries (one over-long line gets a marker). (AC-4)
- Depends on: T1.

## T5. Job input-token guard and request size check
- Goal: before each request, end the job as exhausted when the running input sum is at or over `JOB_INPUT_TOKEN_CAP`; `chat()` refuses a body above `MAX_REQUEST_BYTES`.
- Files: `src/engine.ts`, `src/gates.ts` (reason text), `src/server.ts` if needed, tests.
- Done when: a mock model requesting large reads ends with the cap reason and reaches the gates as exhausted with commit rules unchanged; cap off is unchanged; an oversize body is refused before sending. (AC-5, AC-10)
- Depends on: T1.

## T6. Trace and score metrics
- Goal: `compact` trace event; peak prompt tokens, cache-hit share, compactions, overlap-based repeat reads, reasoning tokens, truncated events and timeouts in `score.ts`; columns in compare tables.
- Files: `src/types.ts`, `src/trace.ts`, `eval/score.ts`, `eval/compare.ts`, tests.
- Done when: synthetic traces give the expected numbers (ordinary paging is not a repeat); a trace from before this change still scores. (AC-6)
- Depends on: T3.

## T7. Runner and compare support
- Goal: add the new settings to the runner allowlist so manifests record them; the loader refuses them in a task's `env`; `compare.ts --dev-only` (no held-out look spent).
- Files: `eval/lib/proc.ts`, `eval/lib/fixture.ts`, `eval/compare.ts`, tests.
- Done when: a run with a changed setting shows it in its manifest; a task with such an `env` is refused; `--dev-only` produces a decision from dev tasks and writes no look. (AC-8, AC-11)
- Depends on: T1.

## T8. XL fixture generator
- Goal: a deterministic generator for large original filler (seeded; near-duplicate names; plausible code) used by task `setup.ts` files, with its files covered by `taskSetHash`; `setup.ts` commits the expansion; `task.json` `expanded: { bytes, sha256 }` checked by `--validate`.
- Files: generator module, `eval/lib/calibration.ts`, `eval/lib/validate.ts`, tests.
- Done when: same seed gives the same bytes; a changed generator changes the task-set hash; `--validate` fails on a size or hash mismatch. (AC-7)
- Depends on: T7; `Specs/harder-evals/` T1 and T4.

## T9. XL tasks (3 + 3)
- Goal: six hard dev tasks, axis `long-context-xl`: needle in a very large file; cross-file change in a repo larger than the old compaction limit; a long job whose early reads matter after the old limit; and three more variations. Hidden checks, a reference and two decoys of different kinds each; edits by reference and decoys stay in small files. Authored without looking at any run result. Split into two sessions of three if needed.
- Done when: `--validate` passes for all six; each expands above the old compaction limit; committed folders stay small. (AC-7)
- Depends on: T8. Must land before `Specs/harder-evals/` T17 or that freeze is redone.

## T10. Transport measurements (needs approval; small spend)
- Goal: measure characters per token on the generated filler; probe the real request-size limit; record the longest turn latency at a near-limit request. Choose arm (d)'s budget from the ceiling; update the token estimate in T3 if the ratio differs.
- Files: a script under `scripts/` or `eval/`, notes in `Specs/long-context/`.
- Done when: the ceiling, the ratio and the latency are recorded and `MAX_REQUEST_BYTES` guidance is written. (AC-10)
- Depends on: T3, T5, T9. Ask the owner before spending.

## T11. Experiment plan, estimate and pilot (needs approval)
- Goal: write the four arms, the task list, k, identical timeouts and `JOB_INPUT_TOKEN_CAP`, the cost estimate from `eval/pricing.json` and the pilot results (k=1 on all arms, to catch broken scenarios and calibrate cost). Pre-register that arm (c) vs (a) decides. Ask the owner before the full run.
- Files: `Specs/long-context/experiment.md`.
- Done when: the owner has approved the estimate. (AC-8, AC-9)
- Depends on: T6, T7, T9, T10.

## T12. Run, compare, decide (needs approval)
- Goal: baseline, caps-only, primary, top; XL tasks at k=10, related and regression tasks at k=5; `--max-cost`; compare each arm to the baseline with `--dev-only`; add cost, latency, peak tokens and cache-hit share; a capped arm is excluded; triage failures through the reviewer bundle. Write the result and a recommendation. The owner decides Q1 and Q2; any default change is a separate candidate branch through the normal loop and confirmation.
- Done when: results recorded; verdicts for each arm; the cost rule outcome stated. (AC-8, AC-9)
- Depends on: T11.

## T13. Docs
- Goal: README lists the new settings, defaults, measured results and the recommended values for a 1M-token model; `eval/loop.md` mentions the new metrics, `--dev-only`, and that setting arms are not confirmed.
- Done when: a reader can turn the settings on for a 1M-window model and knows what was measured. (AC-1, AC-6, AC-8)
- Depends on: T12.
