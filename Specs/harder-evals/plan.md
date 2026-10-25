# Plan: harder evals

Implements `Specs/harder-evals/spec.md` (v2).

## Approach

Tooling first, then tasks, then calibration. The tooling is small: new `task.json` and manifest fields, a calibration command, a chance check, tier-aware reporting and a stricter `--validate`. The bulk of the work is authoring 12 hard dev tasks (and the held-out ones, into the reserve folder). Calibration uses baseline runs that are never reused as comparison baselines.

1. **Metadata.** `TaskDef` gains `tier`, `axis`, `author`, `authored_on`, `authored_after_result`, `authored_after_run`. A missing `tier` is `regression`. The manifest gains `arm` and `purpose`; `--arm` and `--purpose` are required for live runs (no defaults), so a candidate cannot be mistaken for a baseline.
2. **Stricter validation.** `tier: hard` requires `decoy/` and `decoy2/`; `--validate` runs both. `validate.ts` learns the second decoy and (after `Specs/new-roles/`) the new roles' steps.
3. **Calibration.** `eval/calibrate.ts <run-ids>` accepts only manifests with `arm: baseline` and `purpose: calibration`, pools per-task hidden-pass over at least 10 runs, and writes `calibration.json` per task (band, rate, run count, run ids, retune history). It then writes `eval/frozen.json` with a hash of the dev task folders.
4. **Comparison.** `compare.ts` refuses a `purpose: calibration` run as a baseline; counts gains excluding ceiling tasks and losses excluding floor tasks; computes the net over all tasks and over `authored_after_result: false` tasks, and requires both to reach min-net; reports tiers and bands.
5. **Chance check.** `eval/chance.ts` takes N independent baseline runs of the same `server_hash` and compares every pair with the keep rule, reporting the share of pairs that would say KEEP. It exits non-zero above 10%.
6. **Authoring.** Twelve hard dev tasks across the axes, each with hidden checks, a reference and two decoys, written by a session that has not seen candidate results where possible. Hard held-out tasks go to `eval/reserve/` and are never calibrated per task.
7. **Calibrate and freeze.** Run two baselines (`--purpose calibration`) on the hard dev tasks only, calibrate, retune on structure only (at most 3 rounds), freeze. Then run fresh comparison baselines (`--purpose comparison`) and the chance check.

## Touch points

Existing (verified present):
- `eval/lib/types.ts` (`TaskDef`), `eval/lib/fixture.ts` (`loadTasks`), `eval/lib/validate.ts` (`simulate`, `validateTasks`).
- `eval/score.ts` (family/split aggregation: add tier), `eval/compare.ts` (`compareRuns` gain/loss loop, baseline loading).
- `eval/run.ts` (manifest writer, `parseArgs`, flags).
- `test/eval-lib.test.ts`, `test/eval-score.test.ts`, `test/eval-bundle.test.ts`.
- `eval/loop.md`, `README.md`.

New:
- `eval/calibrate.ts`, `eval/chance.ts`, `eval/frozen.json` (generated), `eval/tasks/<id>/calibration.json`.
- `test/eval-calibrate.test.ts`.
- 12 hard dev task folders under `eval/tasks/`; hard held-out folders under `eval/reserve/`.

## Data and API changes

- `task.json`: `tier`, `axis`, `author`, `authored_on`, `authored_after_result`, `authored_after_run`.
- `manifest.json`: `arm`, `purpose` (both required on live runs).
- `calibration.json`: `{ band, pooled_hidden_pass, runs, run_ids, retunes[] }`; `frozen.json`: `{ task_set_hash, frozen_at }`.
- No change to MCP tools or the server.

## Test strategy

- `calibrate.ts`: band edges (19/20/80/81%); refuses candidate-arm runs, comparison-purpose runs and fewer than 10 runs; pools two runs; freezes a stable hash.
- `compare.ts`: ceiling excluded from gains only, floor from losses only (a falling ceiling task is a loss); refuses a calibration-purpose baseline; KEEP needs both nets (all tasks and non-provenance tasks).
- `chance.ts`: synthetic baselines with a known pair-gap give the expected share.
- `--validate`: a hard task with one decoy fails; with two passes; a decoy that passes every check fails.
- A live pilot at k=1 per new task to catch broken scenarios, without tuning on pass rates.
- Every new task runs through `--validate` offline inside `npm test`.

## Risks

- **Calibration bias.** Picking tasks by a baseline's pass rate selects tasks where that baseline was unlucky, and regression to the mean then looks like a gain. Mitigation: separate calibration and comparison runs, a frozen task set, and the chance check.
- **Hidden regressions.** Excluding ceiling tasks entirely would hide a collapse. Mitigation: ceiling excluded from gains only.
- **Held-out leakage.** Hard held-out tasks tuned per task become a dev set. Mitigation: they live in the reserve and are not calibrated.
- **Stale bands.** The new roles change the server. Mitigation: calibrate after `Specs/new-roles/` lands, or recalibrate.
- **Cost and time.** Large fixtures and chain-style tasks are slow. Mitigation: the $2 / 90 minute budget and the proxy cap.
- **Brittle checks.** Over-specific hidden checks. Mitigation: two decoys of different kinds, behaviour-based checks.
- **Band chasing.** Tuning a task into the band is fitting. Mitigation: structure-only retunes, at most 3 rounds, recorded.

## Task breakdown rationale

Metadata and required flags first, so every later run is labelled correctly. Validation and calibration tooling next, with the chance check before any decision uses the tier. Authoring follows, then calibration, because calibration needs money and time and only makes sense when every task validates offline.
