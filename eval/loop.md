# The improvement loop

One candidate at a time. Every step is a command you can read, and **you approve every merge**. Nothing here merges, pushes or commits for you.

## 0. Set up once

- The key is in `DEEPSEEK_API_KEY` (environment) or `eval/.env` (gitignored). It never goes in a file that is committed.
- Held-out tasks live in `eval/heldout/` (gitignored). The loop and the reviewer never read them.
- Prices are in `eval/pricing.json`; the runner uses the peak rates for caps.

## 1. Baseline

```powershell
node eval/run.ts --split all --k 5 --max-tokens 6000000 --max-cost 1.5 --run-id baseline-N --yes
node eval/score.ts baseline-N
```

Run the baseline at least twice (`baseline-N`, `baseline-N+1`) before the first candidate: two baselines tell you how far identical code already differs from itself (the "noise" column in the comparison). A live run needs a hard cap and `--yes`; it prints the plan and an estimate first.

## 2. Ask the reviewer for a proposal

```powershell
node eval/bundle.ts baseline-N
```

Give `eval/review-prompt.md` and `runs/baseline-N/reviewer-bundle.md` to a separate Claude pass. It returns patterns and up to three patches. It proposes only.

Check each patch before using it:

```powershell
node eval/patch-lint.ts patch.diff
```

A patch that names a task, a fixture file or text from an instruction is rejected: it is fitted to the eval, not general.

## 3. ONE candidate edit, on a branch

```powershell
git checkout -b candidate-N-<short-name>
```

Apply exactly one patch (one idea). Add or update a test in `test/` for any change in `src/`, then:

```powershell
npm run typecheck; npm test; npm run smoke
node eval/run.ts --validate --split all
```

## 4. Rerun both arms, interleaved

Pin the baseline code and the candidate code, and run them at the same time so API drift hits both. The runner pins `src/` into `runs/<id>/server/` when a run starts, so: start the baseline run while the working tree still holds baseline code, wait for `runs/<id>/server/` to appear, switch the working tree to the candidate, start the candidate run.

```powershell
node eval/run.ts --split all --k 5 --max-tokens 6000000 --max-cost 1.5 --run-id baseline-M --yes
# once runs\baseline-M\server\src exists, switch to the candidate branch
node eval/run.ts --split all --k 5 --max-tokens 6000000 --max-cost 1.5 --run-id candidate-N --yes
```

If a run is interrupted or capped, `--resume --run-id <id>` reruns only the incomplete runs with the same pinned server code.

## 5. Compare and decide

```powershell
node eval/score.ts baseline-M; node eval/score.ts candidate-N
node eval/compare.ts --baseline baseline-M,baseline-K --candidate candidate-N
```

The rule is fixed in advance and printed in the report:

- A dev task is a **gain** when its hidden-pass mean rises by at least 0.4, a **loss** when it falls by at least 0.4 (`--delta`).
- **KEEP** needs net (gains minus losses) of at least 2 (`--min-net`) and a held-out hidden-pass mean not below baseline by more than the tolerance (see below).
- **REJECT** on a negative net, a held-out regression, or losses with no gain.
- Anything else is **INCONCLUSIVE**: the direction may be right but the evidence is too thin. Add tasks or repeats; do not loosen the rule after seeing the result.

**The held-out guard.**

- Held-out rows are pooled only over the tasks both sides ran. The report says how many were common and how many were left out; with none in common the guard is not applied and the result cannot be KEEP.
- The tolerance is **measured, not chosen**: from the baselines you name on the command line that ran identical server code (equal `server_hash`), take the standard error of the per-task held-out gap, multiply by 1.5 and keep it between 0.05 and 0.15. With fewer than two such baselines it falls back to 0.10. `--heldout-tol` overrides it explicitly and the report says so. Name the baselines before you look at the candidate.
- Looks are **keyed by lineage**: each comparison that shows the held-out aggregate spends one look, counted under the `src/` tree the candidate was cut from (recorded in its manifest as `lineage`), not under its run name. A lineage gets `--heldout-budget` looks (default 4) and all lineages together get `--heldout-total` (default 12) since the held-out set was last refreshed; the total binds. When either is spent the guard is not applied and the result cannot be KEEP. `runs/heldout-looks.json` holds the counts; the report prints looks used and left.

**The final decision** (`--final`). Run it once, when you intend to act on the result. It adds two paired tests over tasks, because repeats of one task are not independent: the unit is each task's change in hidden-pass mean.

- **Dev improvement:** an exact sign-flip test of "the mean per-task change is above zero", one-sided, alpha **0.10**. With few dev tasks this needs most of them to improve: two gains among five tasks gives p = 0.25, which is not significant.
- **Held-out non-inferiority:** an exact sign-flip test of "the mean per-task change is above minus the tolerance", one-sided, alpha **0.10**. One common held-out task, or none, cannot show it.
- A KEEP from the plain rule stays KEEP only if both tests pass; otherwise it becomes INCONCLUSIVE with the reason printed. A REJECT stays REJECT.

A separate confirmation set for final decisions is specified in `Specs/fresh-holdout-exam/` and is not built yet. Until it exists, treat a KEEP as strong evidence, not proof, and say so in the merge request.

Read `report.md` for false accepts and false rejects before you read the verdict: a candidate that improves pass rate but adds false accepts is not an improvement.

## 6. You decide

KEEP means "worth your review", nothing more. Read the diff, the comparison, and the false-accept list. If you agree, merge the branch yourself. If not, delete the branch and note why in `Specs/eval-system/`.

Then the new code is the baseline for the next candidate: go back to step 1.

## Adding a task

If a failure class has no task, add one under `eval/tasks/<id>/` with hidden checks, a reference and a decoy, and make `node eval/run.ts --validate` pass. A task written after seeing a result is allowed but must be disclosed as such, and cannot be the only evidence for a KEEP.
