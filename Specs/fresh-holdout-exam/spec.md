# Spec: a fresh held-out exam and a protected confirmation set

Status: draft v2 (after review). Builds on `Specs/eval-system/` (AC-14, AC-19).

## Goal

Keep the held-out evidence honest. Today there are 8 held-out tasks and they serve as the regression guard on every candidate. Several things have already gone wrong:

- The held-out aggregate has been looked at many times, so it is turning into a second dev set. The look budget (4) is keyed by run id, so a renamed run starts fresh, and one candidate's budget was exhausted by a series of comparisons.
- The guard tolerance (0.10) equals the noise between two baselines of identical code, so it cannot tell a regression from chance.
- Some held-out task details were read while fixing broken scenarios.
- The code only knows one private split: `score.ts`, `compare.ts` and `run.ts` treat everything except `heldout` as dev, so any new private split would be listed per task.
- Old run folders already hold held-out task ids in manifests and logs.

Create a protected confirmation set used only for final decisions, a reserve of unseen tasks to refresh held-out, a look budget that cannot be reset by renaming, a guard calibrated from measured noise, and an audit that proves nothing leaks.

## Non-goals

- No change to the dev tasks or to the keep rule's gain/loss definitions (see `Specs/harder-evals/`).
- No secrecy against the machine's owner: this protects against accidental and adaptive overfitting, not deliberate cheating.
- No change to the server.

## Order of work

This spec's infrastructure (T1-T9) comes before any hard held-out task is written (`Specs/harder-evals/` T16).

## Acceptance criteria

Private splits:
- AC-1. One helper `isPrivate(split)` (true for `heldout`, `confirm`, `reserve`) is used everywhere a split decides visibility: `score.ts` (scores.json, report.md), `compare.ts` (held-out aggregate only), `run.ts` (output folder, logs), `bundle.ts`, `patch-lint.ts`. All private splits write their run details to `private/<split>/...` inside the run folder and appear in reports only as aggregates. Tests plant a task in each private split and assert it never appears by name in any report, score file, log or bundle.
- AC-2. Task folders for private splits live in `eval/heldout/`, `eval/confirm/`, `eval/reserve/`, all gitignored. `loadTasks` reads `confirm` and `reserve` only when asked.

Confirmation and reserve:
- AC-3. A confirmation set of at least 8 tasks, covering ask, writing, code, review, failure and chain, is authored without seeing any candidate's results; each task records author and date. A reserve pool of at least 8 further tasks is authored the same way and never run until promoted.
- AC-4. Confirmation runs happen only through `node eval/confirm.ts --candidate <run> --baseline <run> --final`. Without `--final` it refuses. It runs k>=8 on both arms from the pinned server copies of those runs, prints aggregate-only numbers, and prints no task, check or per-task result.
- AC-5. Confirmation looks are limited: one per lineage and three in total since the last rotation. Every look is appended to `runs/confirm-log.jsonl` (time, lineage, server-code hash, baseline hash). A repeated server-code hash is refused, and a new hash from an already-confirmed lineage is refused too.
- AC-6. The cost of a confirmation is estimated and shown first, and the run is refused if the estimate exceeds the cap (default $2.50 at peak prices).

Look budget, noise and statistics:
- AC-7. A run's manifest records `lineage` = the git tree hash of `src/` at the merge-base with the baseline branch, plus `arm`. The held-out look budget is keyed by lineage. The binding limit is 12 total looks since the last rotation; 4 per lineage. `compare.ts` prints looks used and left.
- AC-8. The manifest records `heldout_hash` = a hash of the sorted held-out task ids and their `task.json` contents. `compare.ts` pools held-out rows only over tasks present in both sides, prints how many, and refuses when there is no overlap.
- AC-9. Guard tolerance is derived from the held-out split only, from at least two baseline runs of identical server code (equal `server_hash`): the tolerance is `clamp(1.5 x standard error of the per-task gap between those baselines, 0.05, 0.15)`. `compare.ts` prints the measured noise and the tolerance applied. Which baselines count is fixed before the comparison (the two named on the command line).
- AC-10. The final decision statistic is paired over tasks, not pooled over runs (repeats of one task are not independent): the per-task difference in hidden-pass mean between candidate and baseline, tested with an exact sign-flip (permutation) test for improvement, and a non-inferiority check that the mean per-task difference is not below `-margin` (the tolerance of AC-9) with the decision made at a fixed alpha of 0.10 (one-sided). Alpha, margin and the rule are written into `eval/loop.md` before any final run.

Rotation, audit and provenance:
- AC-11. `eval/rotate.ts` promotes spent held-out tasks (over the look limit) into dev, rewriting each `task.json` `split`, and moves reserve tasks into held-out. It refuses when the reserve holds fewer than 8 tasks. A rotation logs itself and resets look counters. One reserve of 8 allows one rotation.
- AC-12. `eval/audit.ts` lists every file in run folders, logs and bundles that contains a private task id or fixture path outside `private/`, and exits non-zero on any hit. Run manifests and logs written from now on contain only hashes of private ids, never the ids or titles. Existing files are covered by a recorded allowlist (`eval/audit-allow.json`: path and content hash) so history is not rewritten.
- AC-13. `patch-lint` and the reviewer bundle treat all three private splits as forbidden (ids, fixture paths, instruction text); nothing under them is read.
- AC-14. Provenance fields are the same as in `Specs/harder-evals/` AC-1 (`author`, `authored_on`, `authored_after_result`).
- AC-15. All new commands are offline-testable with the stub upstream; `npm test` stays green.

## Constraints

- TypeScript with erasable syntax, Node built-ins only; no statistics library (the sign-flip test is exact and small).
- The key stays in the runner and proxy.

## Open questions

- Q1. Who authors confirmation and reserve tasks: a fresh agent session that has not seen results (preferred) or the owner by hand?
- Q2. Is 12 looks the right rotation threshold given 4 per lineage?
- Q3. Should confirmation results be visible to the improvement loop, or only to the owner? (Default: only to the owner.)
