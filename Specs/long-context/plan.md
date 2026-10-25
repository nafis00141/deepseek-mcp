# Plan: using the 1M-token context window

Implements `Specs/long-context/spec.md` (v2, after review).

## Approach

First make the limits settings with unchanged defaults and keep the old compaction as an exact "legacy" mode. Add new modes (token-aware, cache-friendly) beside it, plus a job guard, a pre-send size check and metrics. Then build large fixtures. Then find the real request ceiling, run a cheap pilot, and run the experiment with the existing loop. Only if the one pre-registered comparison passes the keep rule and the cost rule do the defaults change, and that change is a normal candidate branch (new code hash, usual loop and confirmation). Setting arms never use `confirm.ts`.

1. **Settings.** `src/config.ts` gains `COMPACT_CHARS`, `COMPACT_LOW` (watermark fraction, 0 = off), `CONTEXT_TOKENS` (0 = off) with `CONTEXT_WINDOW` (required together), `READ_BUDGET_CHARS`, `READ_MAX_LINES`, `RESULT_LIMIT_CHARS`, `MAX_REQUEST_BYTES`, `JOB_INPUT_TOKEN_CAP` (0 = off). `CONTEXT_CHARS` and `MAX_REPAIRS` keep 0 as valid. Defaults are today's constants.
2. **Compaction.** `src/compact.ts` holds a pure function `compact(messages, settings, lastUsage)`. Legacy mode reproduces `engine.ts:413-425` exactly, including re-cutting and the `[truncated N chars]` churn. New mode: fixed marker, a `cut` flag per message so it is never touched again, size in escaped JSON length, token budget from the last `prompt_tokens` plus an estimate for what was added since, watermark cut-down. Returns the messages plus a record of what it cut (for the trace).
3. **Caps.** `READ_BUDGET`, the line window in `read_file`, `RESULT_LIMIT` come from config. Legacy mode keeps the mid-line slice and the mid-string preview; non-default values cut at line boundaries (a single over-long line is cut with a marker).
4. **Job guard and size check.** `runAgent` checks before each request whether the running input sum is at or over `JOB_INPUT_TOKEN_CAP`; if so the job ends as exhausted (same path as the turn limit, `gates.ts` exhausted reason), with the reason and cost reported. `chat()` measures the serialized body and refuses above `MAX_REQUEST_BYTES`.
5. **Metrics.** Trace event `compact` (add to `TraceEvent` in `src/types.ts`). `score.ts` adds peak prompt tokens, cache-hit share, compactions, overlap-based repeat reads, reasoning tokens, `truncated` events and timeouts, with the old-trace case reading as absent; compare tables get the columns.
6. **Runner support.** New settings added to the runner allowlist (`eval/lib/proc.ts`), recorded in manifests; the task loader refuses them in `task.env`. `compare.ts` gets a `--dev-only` flag (the code path `devOnly` exists; the CLI must not spend a held-out look).
7. **Fixtures.** Six XL tasks. Each task's `setup.ts` expands a small seed deterministically (seeded generator, original text, near-duplicate names, plausible code) and commits it in the temp repo. `task.json` stores the expected size and sha256 of the expansion; `--validate` checks them. The shared generator lives where `taskSetHash` covers it (task-set hash extended to include the generator files). The needle edits made by references and decoys sit in small files.
8. **Measure the transport.** A characters-per-token measurement on the generated filler against the API (also needed for the token estimate), a real request-size probe, and the longest-latency check. These spend a little and need approval.
9. **Pilot, then experiment.** Pilot k=1 across the four arms to catch broken scenarios and to calibrate the cost estimate. Then the full experiment: baseline, caps-only, primary (250K, watermark, matching caps), top (derived from the measured ceiling). XL tasks at k=10; long-context and larger-repo tasks from `harder-evals` and a regression slice at k=5. Timeouts and `JOB_INPUT_TOKEN_CAP` identical in all arms. Decision: (c) vs (a) only, keep rule plus cost rule. (b) and (d) are reported for attribution and dose-response.
10. **Adopt or not.** If adopted, the owner decides defaults (Q1, Q2) and a normal candidate branch changes them; the owner merges.

## Touch points

Verified present (review confirmed lines):
- `src/engine.ts`: `compact` (413-425), `READ_BUDGET` and `RESULT_LIMIT` (80-81), `DIFF_CHUNK` (82), `read_file` window (154) and slice (162), `packResult` (329-333), request body build (about 389), `chat`, `runAgent` usage sums (470-476), `reasoning_content` handling (25-31).
- `src/config.ts` settings (100-123); `src/context.ts` pack budget (103-104); `src/gates.ts` exhausted reason (283, 301); `src/server.ts` (138).
- `src/types.ts` `TraceEvent` (49-57); `src/trace.ts` event summaries (30-61).
- `eval/lib/proc.ts` `SERVER_SETTINGS` (9); `eval/run.ts` manifest settings (206-207, 226) and per-task `env` (254-255), task timeout (431); `eval/lib/fixture.ts` `runSetup` (83-84); `eval/lib/validate.ts`; `eval/lib/calibration.ts` `taskSetHash`; `eval/score.ts`; `eval/compare.ts`; `eval/lib/looks.ts`; `eval/confirm.ts` (120, 121, 128, 135; read only, not changed here).
- Tests: `test/repo.test.ts` (`packResult`), `test/eval-score.test.ts`, `test/eval-calibrate.test.ts`. `test/engine.test.ts` and `test/config.test.ts` do not exist yet and are created.

New:
- `src/compact.ts`, `test/compact.test.ts`, `test/config.test.ts`.
- Six task folders under `eval/tasks/` with `setup.ts`; a generator module covered by the task-set hash.

## Data and API changes

- Environment settings only; no MCP tool or schema change.
- Trace gains one event type; score rows gain numeric fields; manifests already record settings.
- Job reports gain an "input token cap reached" reason; `chat()` gains a request-size refusal.
- `task.json` of XL tasks gains `expanded: { bytes, sha256 }`.

## Test strategy

- `compact.test.ts`: a frozen copy of the old `compact()` as the oracle; legacy mode equals it on synthetic conversations (various sizes, tool result lengths, short lists); token mode with and without usage; fixed marker and no re-cut in new modes; watermark gives at most half as many prefix-changing turns on a 40-turn synthetic conversation; never touches the system message, the first user message or the last six; a malformed list does not throw.
- `config.test.ts`: defaults equal today's constants; 0 accepted where it has a meaning and refused elsewhere; `CONTEXT_TOKENS` without `CONTEXT_WINDOW` refused; a budget with no room for `MAX_TOKENS` refused.
- `read_file`: paging at default, 5x, 20x; line-boundary cuts in non-default mode only (AC-4). Job guard: a mock model asking for large reads ends with the cap reason, reaches the gates as exhausted, commit rules unchanged; with the cap off, unchanged (AC-5). Size check: `chat()` refuses an over-limit body.
- Score tests: peak tokens, cache share, overlap-based repeat reads, old traces (AC-6).
- Runner tests: settings recorded in manifest; per-task `env` for these settings refused (AC-11).
- Fixture tests: generator is byte-stable; expansion size and sha256 match `task.json`; `--validate` passes for all six; the committed folders are small (AC-7).
- Full `npm test`, smoke and `--validate --split all` before any spend.

## Risks

- **Quality may fall with more context** (distraction, slower turns). Mitigation: dose-response arms, a pre-registered single decision, the keep rule.
- **Power.** With few XL tasks the paired tests cannot reach significance (the sign-flip test drops zero differences). Mitigation: six XL tasks, k=10, plus related tasks; the decision uses the normal keep rule, and a later `--final` statistic is a separate step after adoption.
- **Multiple comparisons.** Three arms against one baseline would triple false keeps. Mitigation: only the primary arm decides.
- **Cost.** About $8.35 worst case per 30-turn job at 800K tokens, about $0.70 realistic with 90% cache hits; multi-step tasks multiply it. Mitigation: estimate before spend, `--max-cost`, identical `JOB_INPUT_TOKEN_CAP`, pilot first, a capped arm is excluded, not scored.
- **Confounding.** Budget and caps move together. Mitigation: the caps-only arm. Timeouts raised identically everywhere; reasoning tokens, truncated events and timeouts reported per arm.
- **Cache behaviour is undocumented.** The saving is inferred from the two prices and the shape of the conversation. Mitigation: report the measured cache-hit share per arm; claim only what is measured.
- **Request size and timeouts at the top arm.** Mitigation: real probe first (AC-10), top arm derived from it, pre-send check, latency recorded.
- **Fixture realism and drift.** Generated filler may be too easy; a shared generator can change silently. Mitigation: near-duplicate names, two decoys, size and hash in `task.json`, generator inside the task-set hash.
- **Overlap with `Specs/harder-evals/`.** Mitigation: separate axis `long-context-xl`, authored before the calibration freeze or the freeze is redone; floor-task behaviour noted in the spec.
- **Settings and the held-out budget.** Arms share one lineage. Mitigation: exploration uses `--dev-only`; only the candidate branch that changes defaults spends looks.
- **Staleness.** Valid for this model only. Mitigation: settings, not hard-coded values; the model is recorded in the report.

## Task breakdown rationale

Settings and the legacy-exact compaction come first because everything depends on them and they can be proven identical to today's behaviour offline. New modes, guard and size check follow. Metrics and runner support come before fixtures so the first fixture run shows what happened. Transport measurements precede the experiment because they set the top arm. The pilot precedes the full run because it fixes the cost estimate. Anything that spends waits for the owner.
