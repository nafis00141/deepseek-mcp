# Plan: a fresh held-out exam and a protected confirmation set

Implements `Specs/fresh-holdout-exam/spec.md` (v2).

## Approach

Give each job the held-out folder does today its own mechanism: guarding every candidate (held-out), deciding at the end (confirmation), refilling the guard (reserve). Make visibility a single rule, make budgets impossible to reset by renaming, and prove with an audit that nothing leaks.

1. **One privacy rule.** Add `isPrivate(split)` in `eval/lib/types.ts` and use it in every place that currently tests `split !== "heldout"` or `split === "heldout"`: `score.ts` (scores.json, report.md, the private file), `compare.ts` (held-out aggregate), `run.ts` (the run folder: private splits go under `private/<split>/`; logs and manifests carry hashes of private ids), `bundle.ts`, `patch-lint.ts`. Tests plant a task in each private split.
2. **Lineage and set hashes.** The manifest records `lineage` (git tree hash of `src/` at the merge-base with the baseline branch), `arm`, and `heldout_hash`. The held-out look counter in `runs/heldout-looks.json` is keyed by lineage with a global counter that is the binding limit.
3. **Noise-derived tolerance.** From two baselines with equal `server_hash`, compute the standard error of the per-task held-out gap, and use `clamp(1.5 x SE, 0.05, 0.15)`. Held-out only; the two baselines are named on the command line.
4. **Paired exact test.** `eval/lib/stats.ts`: an exact sign-flip permutation test on per-task differences (small task counts make full enumeration cheap, falling back to a fixed-seed Monte Carlo above 20 tasks), and the non-inferiority check. No dependency.
5. **Confirmation command.** `eval/confirm.ts` takes two run folders, uses their pinned server copies, runs the confirmation set at k>=8 on both arms, scores offline, prints aggregates only, estimates cost first and refuses over the cap, enforces the look limits and appends to `runs/confirm-log.jsonl`.
6. **Rotation.** `eval/rotate.ts` checks the total looks, promotes spent held-out tasks into dev (rewriting `split` in `task.json`, because `loadTasks` filters on it), moves reserve tasks into held-out, logs it, resets counters, and refuses a reserve under 8.
7. **Audit.** `eval/audit.ts` builds the forbidden set from all private folders and scans run folders, logs and bundles outside `private/`; known old hits are covered by `eval/audit-allow.json` (path plus content hash); non-zero exit on anything else.
8. **Authoring.** Confirmation and reserve tasks written by a fresh agent session given the family list, the check helpers and the authoring rules, not any result data.

## Touch points

Existing (verified present):
- `eval/compare.ts`: the look counter keyed by run id, the held-out pooling, the tolerance, `renderComparison`.
- `eval/score.ts`: `writeScores`, `renderReport`, the private-file logic (all use `split !== "heldout"`).
- `eval/run.ts`: the run folder logic (only `heldout` goes to `heldout-private/`), the manifest writer (task ids, `server_hash`), the log lines that print task ids, `parseArgs`.
- `eval/patch-lint.ts` (`forbiddenTerms` roots), `eval/bundle.ts` (dev-only allowlist).
- `eval/lib/fixture.ts`: `loadTasks` (filters by `def.split`).
- `eval/lib/types.ts`: `Split`.
- `.gitignore`; `eval/loop.md`; `README.md`.
- Tests: `test/eval-score.test.ts`, `test/eval-bundle.test.ts`, `test/eval-lib.test.ts`.

New:
- `eval/confirm.ts`, `eval/rotate.ts`, `eval/audit.ts`, `eval/lib/stats.ts`, `eval/audit-allow.json` (generated).
- `test/eval-confirm.test.ts`, `test/eval-audit.test.ts`, `test/eval-stats.test.ts`.
- `eval/confirm/<id>/` (8+ tasks), `eval/reserve/<id>/` (8+ tasks).

## Data and API changes

- `Split` becomes `dev | heldout | confirm | reserve`; `task.json` gains `author`, `authored_on`.
- `manifest.json`: `lineage`, `arm`, `heldout_hash`; private ids appear only as hashes.
- Run folders: `private/<split>/...` replaces `heldout-private/` for new runs (the reader supports both).
- New files: `runs/confirm-log.jsonl` (append-only), `runs/rotation-log.json`, `eval/audit-allow.json`.
- No change to the server or MCP tools.

## Test strategy

- Privacy: a planted task in each of `heldout`, `confirm`, `reserve` never appears by name in reports, scores, logs, manifests or bundles; aggregates still do.
- Stats: the sign-flip test against hand-computed small cases (all positive, all zero, mixed, ties); the non-inferiority check at its boundaries.
- Lineage: two run ids cut at the same `src/` tree share a budget; a different tree does not; a docs-only commit does not change the tree hash.
- Tolerance: a synthetic baseline pair with a known gap gives the clamped tolerance; one baseline keeps the default.
- Held-out set hash: a mismatch uses the shared tasks only and says how many; no overlap is refused.
- Confirm: refuses without `--final`, over the cost estimate, on a repeated hash, on a repeated lineage and past 3 looks; prints no task or check name; appends to the log; runs against the stub upstream.
- Rotate: refuses a small reserve; moves folders, rewrites `split`, logs, resets counters.
- Audit: finds a planted id in a bundle and a log; honours the allowlist only for a matching hash; clean folders pass; included in `npm test` on synthetic data.

## Risks

- **Authoring leakage.** If an agent that saw dev failures writes the confirmation tasks, they can mirror those failures. Mitigation: a fresh session with a narrow brief; authorship recorded.
- **False security.** The folders sit on the owner's machine; the protection is procedural, stated as a non-goal.
- **Cost.** Confirmation at k>=8 on 8 tasks on two arms is about 128 runs; at the measured mean per run it is under $2 but chain tasks cost more. Mitigation: the estimate gate and cap (AC-6).
- **A tolerance that is too loose.** More baselines can only widen the measured gap. Mitigation: held-out-only measurement, a hard cap of 0.15, and the baselines fixed in advance.
- **Statistical overreach.** Few tasks give a weak test. Mitigation: the paired test reports its p-value with the task count, and the loop treats a small task count as a limit, not a pass.
- **Rotation churn.** Promoting tasks into dev may change difficulty. Mitigation: `Specs/harder-evals/` calibration applies to promoted tasks.
- **Old files.** Existing runs hold private ids. Mitigation: the allowlist with content hashes, no history rewrite.

## Task breakdown rationale

The privacy rule and the statistics come first: they are pure code with clear tests and everything else depends on them. Lineage and set hashes follow, then the commands (confirm, rotate, audit). Authoring is last and in a separate session so the authors are not influenced by tooling output or results.
