# Spec: harder evals

Status: v2, tooling built (T1-T7), the 12 hard dev tasks written and reviewed, calibration and the hard reserve tasks not yet (see `Specs/STATUS.md`). Builds on `Specs/eval-system/`. Baseline server version: 0.9.0 plus the accepted candidates.

## Goal

Keep the eval able to tell a better harness from a worse one. After three candidates the suite sits near its ceiling: about 95-97% hidden pass over 25 tasks, and 19 of the 25 tasks pass in every run. A task that every run passes cannot show an improvement and hides regressions that only appear on harder work. Add a calibrated tier of harder tasks so that the baseline fails a meaningful share of them, the keep rule (net +2 on dev) becomes reachable, and new harness changes can be measured, without the calibration itself manufacturing gains.

## Non-goals

- No change to the server, roles, gates or prompts.
- No new model comparison; the model stays fixed.
- No replacement of the existing tasks: they stay as the regression floor.
- No change to the keep-rule thresholds (delta 0.4, net 2).

## Order of work across the three spec folders

1. `Specs/fresh-holdout-exam/` infrastructure first (private-split handling, reserve folder, audit): hard held-out tasks must not exist before the folder that protects them does.
2. This spec's tooling (T1-T7), in parallel with `Specs/new-roles/`.
3. New roles change the server, so difficulty bands measured before they land go stale for any task the roles touch. Calibrate (T17) only after `Specs/new-roles/` has landed, or recalibrate afterwards.

## Acceptance criteria

- AC-1. `task.json` gains `tier` (`regression` or `hard`), `axis`, and the provenance fields `author`, `authored_on`, `authored_after_result` (true when the author had seen any run result for that task's family before writing it) and `authored_after_run`. A missing `tier` reads as `regression`. `score.ts` and `compare.ts` report by tier.
- AC-2. At least 12 `hard` dev tasks are added. Each targets exactly one named axis: larger repo with distractors (10+ files, near-duplicate names, a dead copy of the code); ambiguous spec whose correct reading is fixed by another artifact; bug whose cause is two files away from the failing test; change that needs two or more in-job repairs (the `MAX_REPAIRS` loop; not fix rounds); cross-file refactor pinned by hidden behaviour tests; Windows-specific behaviour (paths, line endings, case-insensitive names); a suite with an order-dependent test the model must not break (deterministic: the reference passes every time); long context with the relevant file buried among large irrelevant ones.
- AC-3. Hard held-out tasks are written into `eval/reserve/` (see `Specs/fresh-holdout-exam/`), are not calibrated per task, and enter the held-out set only through `rotate.ts`. Nothing about their per-task results is read to tune them.
- AC-4. Every hard task passes `--validate`: the unsolved fixture fails, the reference passes, and there are two decoys of different kinds (`decoy/` and `decoy2/`; for example a special-case hack and an incomplete fix; each decoy's `outcome.json` declares its `kind` and the two must differ), each accepted by the server gate but failing a hidden check.
- AC-5. Calibration. A dev hard task is `calibrated` when, over at least 10 baseline runs (two runs at k=5), its hidden-pass rate is 20-80%; above 80% it is `ceiling`, below 20% `floor`. Calibration runs carry `--purpose calibration` and are never used as comparison baselines: `compare.ts` refuses a run with that purpose as a baseline. After calibration the task set is frozen (a hash of the dev task folders recorded in `eval/frozen.json`) and fresh baselines are run for comparisons.
- AC-6. Gains and losses. `ceiling` tasks are excluded from gains only (a ceiling task that falls still counts as a loss); `floor` tasks are excluded from losses only (a floor task that rises still counts as a gain). All are shown in the report.
- AC-7. Calibration uses baseline runs only: `calibrate.ts` refuses any run whose manifest `arm` is not `baseline` or whose purpose is not `calibration`. `--arm` and `--purpose` are required on every live run; there is no default.
- AC-8. Chance check. Before the hard tier is used for a decision, `eval/chance.ts` compares every ordered pair of independent baseline runs (arm baseline, purpose comparison) of identical server code with the keep rule on dev tasks, and reports how often the rule would say KEEP by chance. The tier is usable only if that rate is at most 10%.
- AC-9. Provenance in the rule. `compare.ts` computes the net twice: over all tasks, and over tasks with `authored_after_result: false`. KEEP needs both to reach `--min-net`.
- AC-10. Calibration stops after at most 3 retune rounds per task set; tasks still outside the band after that are marked `ceiling` or `floor` and kept. A retune changes structure (size, distractors, fixtures), never anything derived from a candidate's output, and is recorded in `calibration.json`.
- AC-11. At least 8 of the 12 dev hard tasks end up `calibrated`; if not, more tasks are added (within AC-10's limit).
- AC-12. A hard-tier run at k=5 costs at most $2 at the peak prices in `eval/pricing.json` and finishes in under 90 minutes; the proxy cap enforces the money limit.
- AC-13. All fixtures are original: small enough to read in minutes, with no third-party code or data (checked by a review step in the authoring task).
- AC-14. `npm test` stays green; new tooling has tests; `--validate` runs offline for every task and the full set takes under 3 minutes (measured and recorded).

## Constraints

- TypeScript run by Node type stripping, erasable syntax only, no new runtime dependencies.
- Held-out and reserve handling follows `Specs/fresh-holdout-exam/`; the key stays in the runner and proxy.

## Open questions

- Q1. Decided for now: band 20-80%. The owner may tighten it.
- Q2. Ceiling tasks stay as a regression floor; the owner may retire them after a time limit.
- Q3. Who writes the hard tasks? A separate agent session that has not seen candidate results is preferred (it keeps `authored_after_result` false).
