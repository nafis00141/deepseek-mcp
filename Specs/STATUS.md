# Specs status (converged 2026-10-26)

One page for all four spec folders: what is done, what changed from the written plan, and what is not done. Each folder's `tasks.md` carries the same status at its top. If this page and a spec disagree, this page is newer.

Code state: `master`, server 0.9.0. 257 tests (256 pass, none fail), `--validate` 99/99 variants ok. `harder-evals` T1-T7 are committed locally (df6a586, 972f9c4) and not yet pushed.

## 1. eval-system (`Specs/eval-system/`) - done

Done: trace, runner with key-holding proxy and pinned server copy, hidden checks in throwaway worktrees, `--validate` (reference and decoy), offline scoring and report, compare with the keep rule, the improvement loop (`eval/loop.md`), reviewer bundle, baselines.

Candidates measured through the loop:

| candidate | outcome |
|---|---|
| #1 plan/tasks prompts carry the instruction | merged to `master` |
| #2 | accepted by the owner as a human override of an INCONCLUSIVE verdict; merged by the owner |
| P2, P3 | shelved on their own branches, not merged |

Changed from the plan: the suite grew from the first 8 tasks to a dev set plus held-out; scoring, held-out guard and look budget were reworked by `fresh-holdout-exam`.

Not done: nothing open. The suite sits near its ceiling (about 95-97% hidden pass), which is why `harder-evals` exists.

## 2. fresh-holdout-exam (`Specs/fresh-holdout-exam/`) - done except live confirmation

Done (T1-T14): one privacy rule (`isPrivate`) for held-out, confirm and reserve; gitignored folders and loader; exact paired sign-flip and non-inferiority tests; lineage and held-out set hash in the manifest; lineage-keyed look budget (4 per lineage, 12 total); shared held-out set with noise-derived tolerance; `compare --final`; `confirm.ts`; `rotate.ts`; `audit.ts` with allowlist; docs in `eval/loop.md` and the README. Local folders hold 9 confirm tasks and 8 reserve tasks (gitignored).

Changed: `--arm` and `--purpose` were added here as optional flags; `harder-evals` T2 made them required.

Not done: no live confirmation has been run (it needs the owner's go-ahead and spends money). The four hard reserve tasks that `harder-evals` T16 asks for are not written; the current reserve pool predates the hard tier.

## 3. new-roles (`Specs/new-roles/`) - done and measured

Done (T1-T12): `specs/.jobs` write deny; `research` (read-only, one writable file, citation gate); `do` (free-form change with `paths` and `test_command`, synthetic task, gate trusts the job record); `fix`/`test` from an existing server-made branch; call key includes paths and test command; safety regression tests; eval runner support, `citations_resolve`, second decoy; README; six eval tasks.

Measured (k=5, hidden-check pass): `do-scope-trap` 1/5 -> 5/5, `research-not-found` 4/5 -> 5/5, `free-form-refactor` 5/5, `research-report` 5/5.

Changed from the plan after the first measurement: the `do` prompt now separates a wholly contradictory task (SPEC_GAP, change nothing) from a partly out-of-reach one (do the in-scope part, finish "partial"); research citations are checked and repaired inside the job instead of only at the gate.

Not done: `fix-after-finding` and `fix-refuses-handmade-branch` were 5/5 before these two edits and were not rerun after them; the edits do not touch their path.

## 4. harder-evals (`Specs/harder-evals/`) - tooling done, tasks not written

Done (T1-T7):

| task | result |
|---|---|
| T1 | `tier`, `axis` and provenance fields; a missing tier reads as `regression`; a hard task must name its axis |
| T2 | live runs refuse to start without `--arm` and `--purpose`; dry run, `--validate` and `--resume` are exempt |
| T3 | by-tier table in the score report (dev tasks only, so a tier cut cannot leak private-split mix); tier on the compare table |
| T4 | hard tasks need `decoy/` and `decoy2/`, each with a declared `kind`, and the kinds must differ |
| T5 | `calibrate.ts`: baseline calibration runs only, 10+ runs per hard task, 20-80% band, `calibration.json` and `frozen.json`, 3 rounds, note required after round 1 |
| T6 | compare: ceiling gains and floor losses shown, not counted; a ceiling task that falls still counts; KEEP needs the net with and without `authored_after_result` tasks; a calibration run is refused as baseline; band shown on the table |
| T7 | `chance.ts`: ordered pairs of identical-code comparison baselines, real keep rule, exit 1 above 10% |

Changed from the spec text:
- Decoy "kind" is a recorded field in `outcome.json` (the spec only said "different kinds").
- Band display moved from T3 to T6, where calibration data exists.
- The chance check compares ordered pairs (both directions) and runs the keep rule on dev tasks only (`devOnly`), since the held-out guard cannot be applied to two baselines and must not spend looks. With two baselines the rate can only be 0, 50% or 100%; the tool says so and wants three or more.
- Compare warns when `eval/frozen.json` no longer matches the hard dev tasks.

Not done: T8-T15 (the 12 hard dev tasks), T16 (4 hard reserve tasks), T17 (calibrate, freeze, fresh baselines, chance check; needs the owner's go-ahead to spend), T18 (cost and speed measurement), T19 (docs for tiers, bands, chance check, provenance). Open question Q3 stands: who writes the hard tasks. The spec prefers a session that has not seen candidate results.

## Order from here

1. Push the local `harder-evals` commits when the owner says.
2. T8-T15, then T16, then T17 (spend), T18, T19. T17 now follows `new-roles` landing, as the spec required.
3. A first live confirmation run is the owner's call.

## 5. long-context (`Specs/long-context/`) - specified and reviewed, nothing built

Spec v2, plan and 13 tasks written 2026-10-26 and reviewed by Opus 5.5 (high); all 19 findings addressed. Idea: make the server's context limits settings with unchanged defaults, add token-aware cache-friendly compaction, a job input-token guard and metrics, build six generated extra-large eval tasks, and measure four setting arms (baseline, caps-only, 250K-token primary, top) with one pre-registered decision comparison. Not done: all tasks (T1-T13). Anything that spends (T10-T12) needs the owner's approval of an estimate.