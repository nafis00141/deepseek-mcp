# Specs status (converged 2026-10-26, second pass)

One page for all five spec folders: what is done, what changed from the written plan, and what is not done. Each folder's `tasks.md` carries the same status at its top. If this page and a spec disagree, this page is newer.

Code state: `master`, server 0.9.0. Last full run: 305 tests (304 pass, none fail, 1 skipped); `node eval/run.ts --validate --split all` passes for 43 tasks (147 variants). Pushed up to `3b2958c`. Local and not pushed: `e692cab` (CLAUDE.md and graphify setup). Uncommitted: the `CLAUDE.md` additions, `npm run check` (`scripts/check.ts`), `--quiet` for `--validate`, and these spec updates.

## 1. eval-system (`Specs/eval-system/`) - done

Done: trace, runner with key-holding proxy and pinned server copy, hidden checks in throwaway worktrees, `--validate` (reference and decoy), offline scoring and report, compare with the keep rule, the improvement loop (`eval/loop.md`), reviewer bundle, baselines.

Candidates measured through the loop:

| candidate | outcome |
|---|---|
| #1 plan/tasks prompts carry the instruction | merged to `master` |
| #2 | accepted by the owner as a human override of an INCONCLUSIVE verdict; merged by the owner. Its comparison (`runs/candidate-2/compare.md`, earlier suite): hidden pass 79% to 97%, held-out 77% to 95%, false accepts 22% to 3%, net +2 (the minimum) |
| P2, P3 | shelved on their own branches, not merged |

Changed from the plan: the suite grew from the first 8 tasks to a dev set plus held-out; scoring, held-out guard and look budget were reworked by `fresh-holdout-exam`.

Not done: nothing open. The regression suite sits near its ceiling (about 95-97% hidden pass), which is why `harder-evals` exists.

## 2. fresh-holdout-exam (`Specs/fresh-holdout-exam/`) - done except live confirmation

Done (T1-T14): one privacy rule (`isPrivate`) for held-out, confirm and reserve; gitignored folders and loader; exact paired sign-flip and non-inferiority tests; lineage and held-out set hash in the manifest; lineage-keyed look budget (4 per lineage, 12 total); shared held-out set with noise-derived tolerance; `compare --final`; `confirm.ts`; `rotate.ts`; `audit.ts` with allowlist; docs in `eval/loop.md` and the README. Local folders hold 9 confirm tasks and 8 reserve tasks (gitignored).

Changed: `--arm` and `--purpose` were added here as optional flags; `harder-evals` T2 made them required. Since then `confirm.ts` also refuses two runs of the same server code (settings arms are screened, never confirmed) and takes `--upstream-timeout`.

Not done: no live confirmation has been run (it needs the owner's go-ahead and spends money). The four hard reserve tasks that `harder-evals` T16 asks for are not written.

## 3. new-roles (`Specs/new-roles/`) - done and measured

Done (T1-T12): `specs/.jobs` write deny; `research` (read-only, one writable file, citation gate); `do` (free-form change with `paths` and `test_command`, synthetic task, gate trusts the job record); `fix`/`test` from an existing server-made branch; call key includes paths and test command; safety regression tests; eval runner support, `citations_resolve`, second decoy; README; six eval tasks.

Measured (k=5, hidden-check pass): `do-scope-trap` 1/5 -> 5/5, `research-not-found` 4/5 -> 5/5, `free-form-refactor` 5/5, `research-report` 5/5.

Changed from the plan after the first measurement: the `do` prompt separates a wholly contradictory task (SPEC_GAP, change nothing) from a partly out-of-reach one (do the in-scope part, finish "partial"); research citations are checked and repaired inside the job instead of only at the gate.

Not done: `fix-after-finding` and `fix-refuses-handmade-branch` were 5/5 before these two edits and were not rerun after them; the edits do not touch their path.

## 4. harder-evals (`Specs/harder-evals/`) - tooling and tasks written, not calibrated

Done:

| task | result |
|---|---|
| T1-T4 | `tier`, `axis` and provenance fields; live runs need `--arm` and `--purpose`; by-tier score table and tier on the compare table; hard tasks need `decoy/` and `decoy2/` with different declared `kind`s |
| T5 | `calibrate.ts`: baseline calibration runs only, 10+ runs per hard task, 20-80% band, `calibration.json` and `frozen.json`, 3 rounds, a note required after round 1 |
| T6 | compare: ceiling gains and floor losses shown, not counted; a ceiling task that falls still counts; KEEP needs the net with and without `authored_after_result` tasks; a calibration run is refused as baseline |
| T7 | `chance.ts`: ordered pairs of identical-code comparison baselines, the keep rule on dev tasks, exit 1 above 10% |
| T8-T15 | 12 hard dev tasks written by a separate author session blind to results (commits 75f3807, 6a95631, 4f97c39, 1a4967f): axes larger-repo 2, ambiguous-spec 2, remote-cause 2, long-context 2, multi-repair, cross-file-refactor, windows, order-dependent 1 each. Reviewed by Opus 5.5 (high): 7 ready, 5 needed fixes; the fixes are in (long-context targets buried among near-duplicates, stronger `registry-ids-shared-state` checks, a different second decoy for the shipping task, a wider discount check, a less arbitrary `null` rule, less spelled-out slugify gates) |

Changed from the spec text: decoy "kind" is a recorded field; band display moved from T3 to T6; the chance check compares ordered pairs on dev tasks only; compare warns when `eval/frozen.json` no longer matches the hard tasks; the extra-large tasks of `long-context` are to be outside the AC-11/12/14 counts (amendments made in long-context T9).

Not done:
- The optional variation of `refund-tax-off-by-one-cent` and `session-never-expires` (they share one template).
- A live pilot at k=1 of each hard task. The `slugify-max-length-project-gates` task needs it to show whether the baseline really repairs twice; if not, retag its axis.
- T16 (4 hard reserve tasks), T17 (calibrate, freeze, fresh baselines, chance check; spends money, needs approval), T18 (cost and speed; `--validate` for all 35 dev tasks took about 194 s, over the 3-minute limit of AC-14), T19 (docs for tiers, bands, chance check, provenance).

## 5. long-context (`Specs/long-context/`) - specified (spec v5), part built

Spec, plan and 13+1 tasks after five Opus 5.5 reviews (19 + 12 + 10 + 13 + 13 findings, all addressed). Idea: make the server's context limits settings with unchanged defaults, add token-aware cache-friendly compaction, a job input-token guard and metrics, build six generated extra-large eval tasks, and measure four setting arms with one pre-registered decision comparison.

Built (commits 889b749, 42ec8bc, aa11cf9, 5902dc0, 97d8816, 3b2958c):
- T1 settings (`loadContextSettings`, `configProblem`; a bad value stops the server before it touches the jobs folder; settings the new modes would read are refused until they exist).
- T2 legacy compaction in `src/compact.ts` with a frozen-oracle test; `COMPACT_CHARS` works as the legacy budget.
- T4 caps from settings; T5 job input-token guard and request-size check (a size refusal ends the job as exhausted `request_size`).
- T7 runner, proxy and compare support: `--dev-only` (a SCREEN PASS is not a KEEP), `--axis`, `--exclude-axis`, `--tasks`, a REFUSED decision (capped arm, unequal exclusions, unlike manifests), timeouts and effective settings in the manifest, the pinned server copy checks the arm (`--check-config`), resume with other settings refused, only timed-out calls charged, `confirm.ts` refuses identical server code.

Not done: T3 (extended compaction, `context_budget`, `CHARS_PER_TOKEN`), T6 (metrics; peak prompt tokens, cache-hit share, repeat reads, longest turn latency), T7b (interleaved arms), T8/T9 (generator and six extra-large tasks), T10-T12 (transport probe, pilot, experiment; these spend money), T13 (docs). The experiment's biggest risks, per the last review: run order (so arms are to be interleaved) and a time estimate of 75-300 hours if run one after another.

## Tooling added outside the specs

- `CLAUDE.md`: graphify rules (search the graph before grep, `graphify update .` after code changes, never index private eval sets), editing and git hygiene, how to add a setting, the specs workflow, a definition of done, and token-saving rules.
- graphify installed (`graphifyy` 0.9.95) with a `.graphifyignore` that keeps held-out, confirm, reserve, `runs/` and fixtures out of the graph; the git hooks are installed in this clone.
- `npm run check` (typecheck, tests, smoke; `-- --eval` adds the offline eval validation; `-- --fast` is typecheck only) prints one line per step; `node eval/run.ts --validate --quiet` prints failures and a summary only.

## Is it ready for production work?

For supervised use on small, well-scoped tasks with every diff reviewed: yes. For unattended production work: not yet. The evidence is on small synthetic repositories, one model, small samples, and no confirmation look has been taken. A shadow trial on one real repository (the owner does the work, compares with the tool, tracks pass rate, review time and cost per task) is proposed but not planned or started.

## Order from here

1. Commit the tooling and spec updates when the owner says; push when asked.
2. `harder-evals`: pilot the 12 hard tasks at k=1 (spends a little), then T16, T17 (needs approval), T18, T19.
3. `long-context`: T3, T6, T7b, T8/T9, then T10-T12 with the owner's approval of an estimate. Note T8/T9 must land before the `harder-evals` calibration freeze, or the freeze is redone.
4. A first live confirmation run and a shadow trial are the owner's calls.
