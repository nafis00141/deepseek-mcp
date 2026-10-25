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
- **KEEP** needs net (gains minus losses) of at least 2 (`--min-net`) and a held-out hidden-pass mean no more than 0.10 below baseline (`--heldout-tol`).
- **REJECT** on a negative net, a held-out regression, or losses with no gain.
- Anything else is **INCONCLUSIVE**: the direction may be right but the evidence is too thin. Add tasks or repeats; do not loosen the rule after seeing the result.

Two guards against overfitting to held-out:

- Each comparison that shows the held-out aggregate spends one **look** for that candidate (`runs/heldout-looks.json`). After `--heldout-budget` looks (default 4) the held-out guard is not applied and the result cannot be KEEP.
- A final confirmation set is not built yet. Until it exists, treat a KEEP as strong evidence, not proof, and say so in the merge request.

Read `report.md` for false accepts and false rejects before you read the verdict: a candidate that improves pass rate but adds false accepts is not an improvement.

## 6. You decide

KEEP means "worth your review", nothing more. Read the diff, the comparison, and the false-accept list. If you agree, merge the branch yourself. If not, delete the branch and note why in `Specs/eval-system/`.

Then the new code is the baseline for the next candidate: go back to step 1.

## Adding a task

If a failure class has no task, add one under `eval/tasks/<id>/` with hidden checks, a reference and a decoy, and make `node eval/run.ts --validate` pass. A task written after seeing a result is allowed but must be disclosed as such, and cannot be the only evidence for a KEEP.
