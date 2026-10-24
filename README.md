# deepseek-mcp

An MCP server for **Claude Desktop on Windows**. Claude writes the spec and judges the result; DeepSeek does the implementation. The server — not either model — decides whether the work is accepted.

No Claude Code, no CLI, no terminal workflow. Node + a DeepSeek API key is the whole runtime.

```
Claude Desktop (Sonnet)  ──handoff(role, target)──▶  deepseek-mcp  ──▶  DeepSeek API
         ▲                                                 │
         └──────── gated result (small, structured) ◀──────┘
```

## Roles

The role decides four things: the prompt, the capability set enforced on every tool call, what must be produced, and how it is judged.

| Role | Target | Produces | Gate |
|---|---|---|---|
| `spec` | `specs/<feature>` + instruction | `spec.md` (Goal / Non-goals / AC / Constraints / Open questions) | artifact shape |
| `plan` | `specs/<feature>` | `plan.md` | artifact shape |
| `tasks` | `specs/<feature>` | `tasks/NN-slug.md` with `allowed_paths` + `test_command` frontmatter | frontmatter + AC sections |
| `impl` | a task `.md` | code, one commit | tests, scope, commit count, diff cap |
| `fix` | task `.md` + `feedback_path` | code, one commit | same as impl |
| `test` | a task `.md` | tests only, one commit | same, writes restricted to test paths |
| `review` | `specs/<feature>` | verdict JSON → `specs/review/*.md` | verdict schema |
| `ask` | any path + instruction | cited answer, no writes | non-empty answer |

**Enforced in code, not in prompts:**

- `write_file`/`edit_file` resolve the path first (`src/../x`, `./x`, symlinks) and only then match it against the role's globs. `.git/`, `.github/`, `.claude/`, `.vscode/`, `.env*` and lockfiles are never writable; code roles can't write `specs/`; the `test` role gets test globs only and no write access if the task has none.
- The model can't read `.env*` or `.git/`. `test_command` runs without `DEEPSEEK_*` / `*_API_KEY` / `*_TOKEN` variables in its environment.
- A task whose `allowed_paths` is empty, catch-all (`**`), or points at a protected location is refused before any model call. The `tasks` gate also rejects overlapping scopes and `npm run` scripts that don't exist.
- The review gate re-derives the verdict: a `PASS` with a blocker, an unmet criterion, or no criteria becomes `FAIL`.
- One writer at a time. An identical call to a job that already failed is refused, and a task gets `MAX_FIX_ROUNDS` (default 2) `fix` rounds before the server answers `escalate`.
- The server makes the commit, not the model, and `run_tests` only ever runs the task's declared `test_command`.

## Inside a job

**Repair loop.** When DeepSeek says it is finished, the server checks its work before anything is returned to Claude: the closing summary block must parse, and for code roles the task's `test_command` must pass. If not, the failure output goes back to the model as a new turn, up to `MAX_REPAIRS` (default 2) times. A model that says `SPEC_GAP:`/`BLOCKED:` is not repaired. This costs DeepSeek tokens, not a Claude round trip, and does not count against `MAX_FIX_ROUNDS`.

**Report.** Every finished doc and code job returns a small `report`:

```json
{ "status": "done | partial | blocked", "did": ["…"], "not_done": ["…"], "notes": "…", "repairs": ["tests failed: …"] }
```

`did` and `not_done` are the model's own account (max 5 short lines each); `repairs` is the harness's log of what had to be fixed on the way. A `partial` job can still pass the gate - read `not_done` before accepting it.

**Line endings.** `edit_file` matches on LF text and writes back in the file's own line ending, so a multi-line edit works on CRLF files without turning the whole file into a diff. `write_file` keeps an existing file's ending; new files follow whatever most tracked files use. A file that mixes both is matched byte-for-byte and left as it is.

**Context pack.** Each prompt ends with a short harness-generated block (default 6000 chars, `CONTEXT_CHARS=0` turns it off): the first of `CONVENTIONS.md`, `AGENTS.md` or `.deepseek/context.md`; package name, engines and npm scripts; the repo root plus the directories the task may touch; the last five commit subjects. Secrets (`.env*`) are never included. Put house rules in `CONVENTIONS.md` and every handoff sees them.

## Tools

| Tool | Blocks? | Purpose |
|---|---|---|
| `version` | no | Repo, base ref, model, key presence, Node version. |
| `roles` | no | The registry above, generated from live config. |
| `ping` | ~5s | One tiny DeepSeek call. Proves key + model id. |
| `handoff` | up to `MAX_WAIT_S` (45s) | Delegate one phase. Returns the gated result if it finishes in time, otherwise a `job_id`. |
| `job_status` | optional `wait_s` | Progress while running, gated verdict once done. `wait_s` blocks up to that long for it to finish. |
| `job_diff` | no | The code a finished `impl`/`fix`/`test` job committed, paged (`offset` = `next_offset`). Lets Claude judge the change itself instead of relying on a DeepSeek review. `.env` files are excluded. |
| `discard` | no | Delete the work branch of a finished `impl`/`fix`/`test` job. Refused if the branch has commits not in the base branch, unless `force=true`; a forced discard returns the tip sha and a `git branch <name> <sha>` command to undo it. Never deletes the base branch or the branch you are on. |
| `jobs` | no | Recent handoffs. |

## Requirements

- **Claude Desktop** (Windows)
- **Node.js 18 or newer**
- **Git** for Windows, on `PATH`, with `user.name` and `user.email` set
- A **DeepSeek API key** from platform.deepseek.com

## Install

```powershell
cd <this folder>
npm install
npm test          # capability checks; no key or network needed
```

## Configure Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (create it if absent), then **quit Claude Desktop completely from the tray icon** and reopen it — closing the window is not enough.

```json
{
  "mcpServers": {
    "handoff": {
      "command": "C:\\path\\to\\node.exe",
      "args": ["C:\\path\\to\\deepseek-mcp\\src\\server.js"],
      "env": {
        "REPO_ROOT": "C:\\path\\to\\your\\project",
        "DEEPSEEK_API_KEY": "sk-...",
        "DEEPSEEK_MODEL": "deepseek-chat"
      }
    }
  }
}
```

The `command` **must** be an absolute path to `node.exe`. If you manage Node with **fnm** or **nvm**, the bare string `node` will fail: both inject Node into PATH via a shell profile hook, and Claude Desktop — launched from Explorer — never runs that hook. Find the binary your shell resolves with `(Get-Command node).Source`. A version-pinned path survives `fnm use` switches; `%APPDATA%\fnm\aliases\default\node.exe` follows whichever version is the fnm default.

| Variable | Meaning |
|---|---|
| `REPO_ROOT` | The one repo this server operates on. |
| `DEEPSEEK_API_KEY` | Key. Lives only in the server env. |
| `DEEPSEEK_MODEL` | Pinned model id, e.g. `deepseek-chat`. |
| `GIT_BIN` | Path to `git.exe`. Optional — auto-discovers PATH, SourceTree's bundled copy, then the usual install locations. |
| `DEEPSEEK_BASE_URL` | Default `https://api.deepseek.com`. |
| `MAX_TURNS` | Tool-call rounds per handoff (default 30). |
| `TIMEOUT_MS` | Total budget per handoff (default 900000). |
| `DIFF_CAP` | Max changed lines before a task is rejected (default 600). |
| `BASE_REF` | Branch that `review` diffs against. Default: `main`, then `master`. |
| `MAX_WAIT_S` | Longest a tool call blocks before returning a `job_id` (default 45, under typical client tool timeouts). |
| `MAX_FIX_ROUNDS` | `fix` rounds per task before `escalate` (default 2). |
| `DEEPSEEK_THINKING` | `enabled` (default) or `disabled`. Sent as `thinking: {type}` on every request. |
| `DEEPSEEK_EFFORT` | `low`, `high` (default) or `max`. Sent as `reasoning_effort` while thinking is enabled. `TEMPERATURE` is only sent when thinking is disabled. |
| `MAX_TOKENS` | Reply budget. Default 32000 with thinking (reasoning tokens count against it), 8000 without. |
| `MAX_REPAIRS` | In-job repair attempts after a failed self-check (default 2). |
| `CONTEXT_CHARS` | Size of the context pack in each prompt (default 6000; 0 disables). |

## What to tell Claude in the project instructions

> Never write code or specs yourself when a handoff role covers it. `spec`/`plan`/`tasks` for planning, `impl`/`fix` for code, `review` for judgement. One target per call. After a `failed` gate, read `reasons` and decide — do not re-run the same call hoping for a different answer. After `review`, act only on blockers and majors. Two rounds maximum, then escalate to me. Never merge or push.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Tool icon doesn't list `handoff` | Config JSON is invalid, or the app wasn't fully restarted. Check `%APPDATA%\Claude\logs\`. |
| `DEEPSEEK_API_KEY is not set` | Env block missing from the config, or the app is running the old config. |
| `DeepSeek HTTP 401` | Wrong key. `ping` isolates this from everything else. |
| `DeepSeek HTTP 404` | Wrong model id, or `DEEPSEEK_BASE_URL` pointed at `/anthropic` instead of the OpenAI-compatible root. |
| `REPO_ROOT is not a git repo` | `git init`, commit something, then retry. |
| `working tree not clean` | Commit or stash. Files under `specs/` are ignored by this check. |
| `commit failed: Author identity unknown` | `git config --global user.name` / `user.email`. |
| `hit MAX_TURNS without finishing` | Task too big, or the model is looping. Split the task. |
| `identical to failed job …` | You re-sent a call that already failed. Read `prior_reasons`, then change the instruction, task or feedback. |
| `status: escalate` | The task used its `MAX_FIX_ROUNDS`. Decide yourself; the server won't run another `fix`. |
| `job … is still running` | One writer at a time. `job_status` with `wait_s` until it finishes. |
| `task … is not runnable` | The task's `allowed_paths` is empty, too broad, protected, or `test_command` is missing. |
| Server won't start at all | Run `node src/server.js` in that folder; it prints a clear error on stderr. |

## Layout

```
src/server.js    MCP tools + job orchestration
src/engine.js    DeepSeek loop, tool definitions, capability checks
src/roles.js     Role registry + prompt templates
src/gates.js     Per-mode acceptance gates
src/repo.js      git/fs helpers, job records, summary parsing
src/taskfile.js  Task frontmatter + glob matching
src/context.js   Context pack added to each prompt
src/branching.js Where jobs start, which branch they use, restoring your branch
test/tools.mjs   Offline tests (mock DeepSeek + throwaway git repo; needs git)
```

- Add `specs/.jobs/` and `specs/review/` to your repo's `.gitignore`.
- Doc roles write under `specs/` and do **not** commit; you review and commit them. Jobs left `running` by a previous server process are marked `interrupted` on startup.
## Branches and results

- **No stacking.** Each `impl` starts from your base branch (`main`/`master`, or `BASE_REF`), not from whatever the last job left behind. If the task lists `depends_on` and exactly one dependency is still unmerged, it starts from that branch; two or more unmerged dependencies are refused until you merge them. `fix` and `test` continue the task's own branch, so there is one branch per task.
- **Your branch comes back.** After every job the repo returns to the branch you were on. A branch the job created but never committed to (blocked, or nothing to do) is deleted. If the working tree is dirty the server stays on the work branch and says so in `left_on_branch`.
- **`review`** checks out the newest code branch for the feature (or the one you name with `branch`), reads the diff against the base, and puts your branch back.
- **Discarding.** `discard(job_id)` removes a job's branch (merged branches go freely; unmerged ones need `force`). After a discard, `fix` on that task asks you to run `impl` again.
- **Merging is yours.** The server never merges or pushes. `job_diff(job_id)` shows exactly what a job committed.
- **Statuses:** `done` (gate passed), `failed` (see `reasons`; a model that says `BLOCKED:` is reported with its own explanation), `noop` (no changes, tests green, the model says nothing was left to do: read `report.did` and decide), `escalate` (fix-round cap reached).
