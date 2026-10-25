# Tasks: harder evals

## Status

| task | state |
|---|---|
| T1 metadata | done (df6a586) |
| T2 required `--arm`/`--purpose` | done (df6a586); the flags themselves existed from `fresh-holdout-exam` |
| T3 tier reporting | done (df6a586); band column added in T6 |
| T4 two decoys | done (df6a586); decoys also declare `kind` |
| T5 calibrate | done (972f9c4) |
| T6 band/provenance compare | done (972f9c4) |
| T7 chance check | done (972f9c4); ordered pairs, dev-only rule |
| T8-T15 twelve hard dev tasks | not started |
| T16 hard reserve tasks | not started |
| T17 calibrate and freeze | not started; spends money, ask first |
| T18 cost and speed | not started |
| T19 docs | not started |

Order matters where noted. "Done when" is checkable. Spec ids are AC-n in `spec.md` (v2).

## T1. Task metadata
- Goal: add `tier`, `axis`, `author`, `authored_on`, `authored_after_result`, `authored_after_run` to `TaskDef`; missing tier reads as `regression`.
- Files: `eval/lib/types.ts`, `eval/lib/fixture.ts`, tests.
- Done when: existing tasks load unchanged; a test shows the default. (AC-1)

## T2. Required `--arm` and `--purpose`
- Goal: both flags required on live runs and recorded in `manifest.json`; `--resume` keeps them.
- Files: `eval/run.ts`, `eval/loop.md`, tests.
- Done when: a live run without either flag is refused; the manifest shows both. (AC-7)
- Note: `Specs/fresh-holdout-exam/` T2 reuses this change for `arm`; this task owns it.

## T3. Tier-aware reporting
- Goal: `score.ts` adds a by-tier table; `compare.ts` shows tier and band per task.
- Files: `eval/score.ts`, `eval/compare.ts`, tests.
- Done when: both reports show tiers. (AC-1)
- Depends on: T1.

## T4. Two decoys for hard tasks
- Goal: `--validate` requires `decoy/` and `decoy2/` for `tier: hard`, runs both, rejects a decoy that passes every check.
- Files: `eval/lib/validate.ts`, tests.
- Done when: a hard task with one decoy fails validation with a clear message. (AC-4)
- Depends on: T1.

## T5. Calibration command
- Goal: `calibrate.ts <run-ids>`: accepts only `arm: baseline` and `purpose: calibration` runs with at least 10 runs per task; writes `calibration.json`; writes `eval/frozen.json` with a task-set hash; refuses more than 3 retune rounds per set.
- Files: `eval/calibrate.ts`, `test/eval-calibrate.test.ts`.
- Done when: band edges and every refusal are tested. (AC-5, AC-7, AC-10)
- Depends on: T1, T2.

## T6. Band-aware, provenance-aware comparison
- Goal: ceiling tasks excluded from gains only, floor from losses only; refuse a calibration-purpose baseline; net computed over all tasks and over `authored_after_result: false` tasks; KEEP needs both.
- Files: `eval/compare.ts`, tests.
- Done when: tests cover each rule including a falling ceiling task counting as a loss. (AC-6, AC-9)
- Depends on: T1, T5.

## T7. Chance check
- Goal: `eval/chance.ts` compares all pairs of independent baselines of the same server hash with the keep rule and reports the false-KEEP rate; non-zero exit above 10%.
- Files: `eval/chance.ts`, tests.
- Done when: synthetic data with a known gap gives the expected rate. (AC-8)
- Depends on: T6.

## T8-T15. Author the 12 hard dev tasks
Each task: fixture, hidden checks, reference, two decoys, `--validate` passes, one live pilot at k=1 (infrastructure and scenario check only). Each author step includes a review that the fixture is original, with no third-party code or data. (AC-13)
- T8. Larger repo with distractors, two tasks. (AC-2)
- T9. Ambiguous spec resolved by another artifact, two tasks. (AC-2)
- T10. Cause two files away from the failing test, two tasks. (AC-2)
- T11. Needs two or more in-job repairs, one task. (AC-2)
- T12. Cross-file refactor pinned by hidden behaviour tests, one task. (AC-2)
- T13. Windows-specific behaviour, one task. (AC-2)
- T14. Order-dependent test the model must not break; the reference must pass every time, one task. (AC-2)
- T15. Long context: the relevant file buried among large irrelevant ones, two tasks. (AC-2)
- Depends on: T1, T4.

## T16. Hard reserve tasks
- Goal: four tasks, one each for four different axes, written into `eval/reserve/` by a session that has not seen candidate results; never calibrated per task; they join held-out only through `rotate.ts`.
- Done when: they validate offline and appear nowhere in dev reports or bundles. (AC-3)
- Depends on: `Specs/fresh-holdout-exam/` T5, T6 and T9 (folders, forbidden terms, audit).

## T17. Calibrate and freeze (after `Specs/new-roles/` lands)
- Goal: run two baselines on the hard dev tasks with `--purpose calibration`; calibrate; retune on structure only (at most 3 rounds, each recorded); freeze. Then run fresh baselines with `--purpose comparison` and the chance check. Ask the owner before spending.
- Done when: 8 of 12 are `calibrated` (or the retune limit is hit and the rest are labelled); `frozen.json` exists; the chance check passes. (AC-5, AC-8, AC-10, AC-11)
- Depends on: T5, T6, T7, T8-T15, and `Specs/new-roles/`.

## T18. Cost, time and validation speed
- Goal: measure a hard-tier run at k=5 (under $2, 90 minutes) and the offline `--validate` time for the whole set (under 3 minutes); record both in `eval/loop.md`; trim tasks if over.
- Done when: both numbers are recorded and within limits. (AC-12, AC-14)

## T19. Docs
- Goal: `eval/loop.md` and the README describe tiers, axes, purposes, calibration, the chance check and provenance.
- Done when: a reader can add and calibrate a hard task from the docs alone. (AC-1, AC-5, AC-9)
