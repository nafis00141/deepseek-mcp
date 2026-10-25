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
4. Do not run `graphify claude install` or `graphify hook install` here without asking: they edit `.claude/settings.json` and git hooks.

## Working agreements

- Windows with PowerShell 5.1: no `&&`; write files without a BOM. Git is not on PATH: use `C:\Users\DESKTOP-KONLSGB\AppData\Local\Atlassian\SourceTree\git_local\bin\git.exe`. The remote is named `deepseek-mcp`. The tracked folder is `Specs/` (case matters for `git add`).
- Commit only when asked; end commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never push, merge or delete branches unless asked. The owner merges.
- Never print, log or commit the DeepSeek API key. Anything that spends money (live eval runs, probes) needs the owner's approval of an estimate first.
- Checks before calling a change done: `npm run typecheck`, `npm test`, and `node eval/run.ts --validate --split all` when eval tasks or tooling changed. Source changes need tests.
- Keep the design rules: allowed-path enforcement and denied paths, the server makes the single commit, one writer at a time, an identical failed call is blocked, at most two fix rounds then escalate.
