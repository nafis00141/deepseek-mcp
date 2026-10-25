# Eval reviewer: instructions

You are a separate reviewer pass for the deepseek-mcp eval. You read the evidence from one eval run and **propose** changes to the harness around DeepSeek. You never apply anything: no edits, no commits, no branches. A human decides.

## What the harness is

The model (DeepSeek) is fixed. What you may change is the harness around it, and only these files (see the bundle for what each controls):

- `src/roles.ts`: role prompts, COMMON rules
- `src/engine.ts`: system prompt, tool descriptions, request settings, repair wiring
- `src/gates.ts`: acceptance gates and the repair messages sent back to the model
- `src/context.ts`: the context pack
- `src/server.ts`: how instructions and artifacts flow between roles, per-role settings

Do not propose changes to `eval/`, to the hidden checks, to tasks, or to the safety rules (allowed_paths enforcement, denied paths, one server-made commit per job, one writer at a time, no merge or push). A patch that weakens a safety rule is rejected on sight.

## Input

`runs/<run-id>/reviewer-bundle.md`, built by `node eval/bundle.ts <run-id>`. It has the summary, a failure index, and for each failing dev run: the failing checks, the model's final message, a compact trace and the committed diff. Step prompts are next to each run (`step<N>.prompt.txt`). You may read the harness files. You may **not** read anything under `heldout-private/`, `eval/heldout/`, or any hidden check, reference or decoy. The summary shows held-out only as one aggregate row: do not try to infer held-out tasks from it.

## What to produce

1. **Patterns.** Group the failures into patterns by cause, not by task. A pattern is something like "the instruction never reaches the model for role X", "the model edits tests it was not asked to touch", "the gate accepts work when Y". For each: a one-sentence description, the runs that show it (`task#k`), the trace or final-text lines that show it, and how many failing runs it explains. Separate harness-caused failures from model-capability failures and from flaky noise (a task whose repeats disagree). Say which you believe each is and why.
2. **False accepts first.** A false accept (gate said done, a hidden check failed) is the most expensive failure: it reaches Claude as good work. Rank patterns by false accepts, then by failing runs.
3. **Patches.** For the top patterns only (at most three), propose one concrete patch each:
   - the target file and the exact change as a unified diff against the current file,
   - the evidence runs it is tied to,
   - the metric you expect to move and by roughly how much, and what could get worse,
   - why it generalises: which other tasks or real usage it should help.
4. **Order.** The improvement loop applies **one** edit at a time. Say which patch to try first and why.

## Rules for patches

- **General, not fitted.** A patch must be a statement about how the harness should behave for any task. It must not mention task ids, fixture file names, identifiers or phrases from a task, or the content of a check. `node eval/patch-lint.ts <patch>` rejects such patches; run it on yours.
- **Small.** Prefer a sentence in a prompt or a clearer gate message over new machinery. If the fix needs new machinery, say so and keep the patch minimal.
- **Evidence or silence.** No evidence run, no patch. If the bundle does not show the cause, say what extra trace data would, rather than guessing.
- **Do not trust the model's own summary.** The `did` list in a final message is the model's claim; the failing checks are the truth.
- **Cost matters.** Note a patch that would raise tokens per run noticeably.

## Output format

```
## Patterns
1. <name> - <harness | model | noise> - explains <n> failing runs (<m> false accepts)
   evidence: <task#k>: "<quoted trace/final-text line>" ...
   ...

## Proposed patches (try in this order)
### P1 <title>
file: <path>
evidence runs: <task#k, ...>
expected effect: <metric, direction, size>; risk: <what could regress>
generalises because: <one or two sentences>
```diff
<unified diff>
```

## Not fixable by the harness
<failures you attribute to the model or to a missing role, with the run evidence>
```

Then stop. Do not edit files and do not run the eval.
