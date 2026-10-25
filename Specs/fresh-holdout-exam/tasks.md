# Tasks: a fresh held-out exam and a protected confirmation set

Order matters as marked. "Done when" is checkable. Spec ids are AC-n in `spec.md` (v2).

## T1. One privacy rule
- Goal: `isPrivate(split)`; `Split` gains `confirm` and `reserve`; use the helper in `score.ts`, `compare.ts`, `run.ts` (run folder and logs), `bundle.ts`, `patch-lint.ts`; private run details go to `private/<split>/`; manifests and logs carry hashes of private ids; readers accept the old `heldout-private/` folders.
- Files: `eval/lib/types.ts`, `eval/score.ts`, `eval/compare.ts`, `eval/run.ts`, `eval/bundle.ts`, `eval/patch-lint.ts`, tests.
- Done when: a planted task in each private split never appears by name in a report, score file, log, manifest or bundle; aggregates still do. (AC-1, AC-12, AC-13)

## T2. Folders and loader
- Goal: `eval/confirm/` and `eval/reserve/` (gitignored); `loadTasks` reads them only when asked.
- Files: `.gitignore`, `eval/lib/fixture.ts`, tests.
- Done when: default dev and held-out runs never load them. (AC-2)
- Depends on: T1.

## T3. Paired exact test
- Goal: `eval/lib/stats.ts`: the exact sign-flip test on per-task differences (fixed-seed Monte Carlo above 20 tasks) and the non-inferiority check.
- Files: `eval/lib/stats.ts`, `test/eval-stats.test.ts`.
- Done when: matches hand-computed cases (all positive, all zero, mixed, ties) and the boundary of the margin. (AC-10)

## T4. Manifest: lineage, arm and set hash
- Goal: record `lineage` (tree hash of `src/` at the merge-base), `arm` (owned by `Specs/harder-evals/` T2; reuse it) and `heldout_hash`.
- Files: `eval/run.ts`, tests.
- Done when: two runs cut at the same `src/` tree share a lineage; a docs-only commit does not change it; the held-out hash changes when a task changes. (AC-7, AC-8)
- Depends on: `Specs/harder-evals/` T2.

## T5. Lineage-keyed look budget
- Goal: `compare.ts` counts looks per lineage with a global binding limit of 12 and 4 per lineage; prints used and left.
- Files: `eval/compare.ts`, tests.
- Done when: renaming a run id does not reset the count; a new lineage starts fresh; the global limit binds. (AC-7)
- Depends on: T4.

## T6. Shared held-out set and derived tolerance
- Goal: pool held-out rows only over tasks present on both sides (print the count; refuse on no overlap); tolerance = `clamp(1.5 x SE, 0.05, 0.15)` from the two named baselines of equal `server_hash`; print the noise and the tolerance.
- Files: `eval/compare.ts`, tests.
- Done when: tests cover a set mismatch, no overlap, a known gap and a single baseline (default kept). (AC-8, AC-9)
- Depends on: T4.

## T7. Final decision statistic
- Goal: `compare.ts --final` reports the paired sign-flip p-value and the non-inferiority result at alpha 0.10; the rule is written into `eval/loop.md` before any final run.
- Files: `eval/compare.ts`, `eval/loop.md`, tests.
- Done when: tests cover each outcome. (AC-10)
- Depends on: T3, T6.

## T8. Confirm command
- Goal: `eval/confirm.ts --candidate --baseline --final`: pinned server copies, k>=8 on both arms, aggregate-only output, cost estimate and cap refusal, one look per lineage and three in total, append-only log, refusal of a repeated hash.
- Files: `eval/confirm.ts`, `test/eval-confirm.test.ts`.
- Done when: tests against the stub upstream show no task or check name in the output, the log grows, and every refusal works. (AC-4, AC-5, AC-6)
- Depends on: T2, T3, T4.

## T9. Rotation
- Goal: `eval/rotate.ts`: promote spent held-out tasks into dev (rewrite `split`), refill held-out from the reserve, log, reset counters; refuse a reserve under 8.
- Files: `eval/rotate.ts`, tests.
- Done when: tests cover the refusals and a rotation on synthetic folders; `loadTasks` sees the moved tasks under their new split. (AC-11)
- Depends on: T2, T5.

## T10. Leak audit
- Goal: `eval/audit.ts` scans run folders, logs and bundles outside `private/` for private ids and fixture paths; `eval/audit-allow.json` holds path plus content hash for known old files; non-zero exit on anything else; part of `npm test` on synthetic data.
- Files: `eval/audit.ts`, `test/eval-audit.test.ts`.
- Done when: a planted id is found in a bundle and a log; an allowlisted file matches only with the recorded hash; clean folders pass. (AC-12, AC-15)
- Depends on: T1, T2.

## T11. Author the confirmation set
- Goal: at least 8 tasks across ask, writing, code, review, failure and chain, in a fresh agent session given only the family list, the check helpers and the authoring rules; author and date recorded; `authored_after_result` false.
- Done when: all validate offline and no result data was shown to the author. (AC-3, AC-14)
- Depends on: T2. Ask the owner who authors them (spec Q1).

## T12. Author the reserve pool
- Goal: at least 8 further tasks, same procedure, in `eval/reserve/` (this includes the four hard reserve tasks of `Specs/harder-evals/` T16).
- Done when: all validate offline. (AC-3)
- Depends on: T2.

## T13. Docs
- Goal: `eval/loop.md` and the README describe the three private splits, the budgets, confirmation, rotation, the statistic and the audit.
- Done when: a reader can run a confirmation and a rotation from the docs. (AC-4, AC-11)

## T14. First audit and dry run
- Goal: run `audit.ts` on the existing `runs/` folder, record the allowlist for known old files (no rewriting), and do a dry run of `confirm.ts` with the stub upstream. Ask the owner before any live confirmation run.
- Done when: the audit is clean against the allowlist and the dry run passes. (AC-12)
- Depends on: T8, T10, T11.
