# CLAUDE.md - deepseek-mcp

An MCP server (Node, TypeScript run by Node type stripping) that hands coding work to DeepSeek behind acceptance gates, plus an offline-scored eval system in `eval/`. The README describes the roles and settings; `Specs/STATUS.md` says what is built and what is open.

## Code graph (graphify)

The repo has a code knowledge graph in `graphify-out/` (built by [graphify](https://github.com/Graphify-Labs/graphify), PyPI package `graphifyy` with two y's, installed with `uv tool install graphifyy`). Code is parsed locally with tree-sitter; with `GRAPHIFY_BACKEND=none` nothing is sent to any model.

1. **Search with graphify before grep.** To find where something is defined, who calls it, what a change touches or how two things connect, ask the graph first:
   - `graphify explain "<symbol or file>"` - what it is, where, and its callers and imports
   - `graphify affected "<symbol>"` - what depends on it (use before changing a signature)
   - `graphify path "A" "B"` - how two nodes connect
   - `graphify query "<question>"` - fuzzy; start from a symbol with `--seed <name>` and raise `--budget` if it says TRUNCATED
   Exit code 3 means the name is ambiguous (the candidates are listed), 4 means no match. Use Grep/Glob only when graphify cannot answer: exact strings, regexes, text inside non-code files, or after exit 4. Read the file before relying on any answer: the graph points, the code decides.
2. **Run `graphify update .` after code changes.** When a task that changed code, tests or specs is finished (before the final answer, and before committing), refresh the graph so the next search is not stale. In PowerShell: `$env:GRAPHIFY_BACKEND = "none"; graphify update .` (code only, no model). If a refactor deleted code and graphify refuses to shrink the graph, add `--force`.
3. **Never index the private eval sets, and never commit the graph.** `.graphifyignore` excludes `eval/heldout/`, `eval/confirm/`, `eval/reserve/`, `runs/`, `specs/.jobs/` and the task fixtures. Do not remove those lines and do not point graphify at those folders: a graph answers questions, and a question about a private task must not be answered from here (see the privacy rule in `eval/loop.md`). `graphify-out/` is derived output and is git-ignored.
4. A graphify git hook (post-commit, post-checkout, post-merge, post-rewrite; installed with `graphify hook install`, check with `graphify hook status`) rebuilds the graph in the background after every commit and branch switch, from any tool. It does not see uncommitted edits, so rule 2 still applies. The hooks live in this clone's `.git/hooks`, so a fresh clone needs `graphify hook install` again. Do not run `graphify claude install` here without asking: it edits `.claude/settings.json`.

## Saving tokens

1. **Orient from the graph report, not by browsing.** For a first look at an unfamiliar area, read `graphify-out/GRAPH_REPORT.md` once (about 13 KB) and then `graphify explain` the symbols it points to. Do not open a dozen files to find the shape.
2. **Read only the part you need.** `Read` with `offset` and `limit` for big files (`src/engine.ts`, `eval/run.ts`, `eval/compare.ts` and the tests are long); get the line number from graphify or from a grep hit first.
3. **Use `Edit` for changes and `Write` only for new files.** A rewrite of a whole file resends every line; never paste a whole file into a command to change two lines of it.
4. **Keep command output small.** Run tests, `--validate` and eval runs through `npm run check` (one line per step, failures only) or filter the output; add `--quiet` to `node eval/run.ts --validate`. Start anything that takes minutes in the background and wait for its notification: do not poll or sleep.
5. **Start from `Specs/STATUS.md`.** It says what is built and what is open. Open a folder's `spec.md`, `plan.md` or `tasks.md` only for the task at hand, not all five folders.
6. **Give independent tasks their own session.** A long conversation resends its whole history on every turn. For a task that does not need this conversation, start a fresh session with a short brief (files, what done looks like) instead of continuing here.

## Working agreements

- Windows with PowerShell 5.1: no `&&`; write files without a BOM. Git is not on PATH: use `C:\Users\DESKTOP-KONLSGB\AppData\Local\Atlassian\SourceTree\git_local\bin\git.exe`. The remote is named `deepseek-mcp`. The tracked folder is `Specs/` (case matters for `git add`).
- Commit only when asked; end commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push, merge or delete branches unless asked. The owner merges.
- Never print, log or commit the DeepSeek API key. Anything that spends money (live eval runs, probes) needs the owner's approval of an estimate first.
- Keep the design rules: allowed-path enforcement and denied paths, the server makes the single commit, one writer at a time, an identical failed call is blocked, at most two fix rounds then escalate.

## Editing files and git hygiene

- **Edit with the Edit tool, not with scripted find-and-replace.** Twice a PowerShell replace helper given a single old/new pair treated the pair as an array of characters and rewrote every "s" as "i" in one file and every hyphen as a space in another. If you must script a replacement, use one explicit `old`/`new` pair per call and check the result.
- **After any scripted or bulk edit, read `git diff --stat` and skim `git diff` before staging.** A diff that is much larger than the change, or that touches a file you did not mean to, is the sign of a bad edit. Restore with `git checkout -- <file>` only after looking at what would be lost.
- **Stage explicit paths. Never `git add -A`, `git add .` or a whole folder such as `git add eval`.** Other sessions work in the same checkout, and a broad add commits their half-finished edits under your message. Run `git status --short` first and add only the files you changed.
- **Do not run two heavy test files at once.** The eval tests spawn servers and validate whole fixtures, and under load one test command can pass the 60 s timeout in `eval/lib/validate.ts`. Run the focused test file first (`node --test --test-force-exit test/<file>.test.ts`), then the full `npm test`, one at a time.

## Adding a setting

A new server setting (an environment variable read in `src/config.ts`) follows one pattern, so that an unset environment behaves exactly as before:

1. The default equals the value that was hard-coded before. A test proves it.
2. It is validated in `loadContextSettings` (or the matching loader) with its own type and range. A bad value is reported by `configProblem` and refused at server start-up, not at import.
3. If the eval may pass it to the server under test, add it to `eval/lib/proc.ts`: `ARM_SETTINGS` when an arm may change it, `CONTEXT_SETTINGS` for context-window settings. A task's own `env` must not be able to set an arm's settings (the loader refuses it).
4. If it only matters once a not-yet-built mode exists, refuse it until then (see `COMPACTION_BUILT`) so that no run records a setting that did nothing.
5. Document it in the README settings table and in the spec that introduced it.

## Specs workflow

New work gets a folder `Specs/<name>/` with `spec.md` (goal, non-goals, numbered acceptance criteria AC-n, constraints, open questions), `plan.md` and `tasks.md` (ordered, each with "Done when" and its AC ids). Before implementing, have it reviewed read-only by a sub-agent on Opus 5.5 at high effort, fix every finding, and repeat until the review finds no blockers. When a task lands, update the status block at the top of that `tasks.md` and `Specs/STATUS.md` (done, what changed from the plan, what is not done). A task is not done while a "Done when" item is missing: mark it partial instead.

## Definition of done

A change is done when all of these hold. Report any that do not, with the output, instead of claiming it is done.

1. `npm run check` passes (typecheck, all tests, smoke), and `npm run check -- --eval` when eval tasks or tooling changed (it adds `node eval/run.ts --validate --split all`); source changes have tests.
2. `graphify update .` has been run (rule 2 above).
3. The status docs match the code (`tasks.md` status block, `Specs/STATUS.md`, README when a setting or role changed).
4. `git status` shows only the files meant to change, and nothing is committed or pushed unless the owner asked.
