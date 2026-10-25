/**
 * The role registry. Everything that differs between handoffs lives here:
 * the prompt, the capability set, what must be produced, how it is judged.
 *
 * Adding a phase = adding an entry. No new tool, no new server code.
 */

import { isTestGlob } from "./taskfile.ts";
import type { PromptCtx, RoleName, RoleSpec } from "./types.ts";

const COMMON = `You are running inside an automated handoff from another AI agent.
- Never ask a question. Nobody is reading this as a conversation.
- Do not touch files outside what this role permits.
- When finished, write your final answer ending with exactly one fenced json block:
\`\`\`json
{"status":"done","did":["what you actually changed or produced, one short line each, max 5"],"not_done":["anything you could not do, skipped, or are unsure about - and why; [] if nothing"],"notes":"one line the orchestrator must know"}
\`\`\`
  status is "done" (everything asked), "partial" (some of it) or "blocked" (none of it). Be literal: do not list work you did not do.`;

const spec = ({ target, instruction }: PromptCtx): string => `${COMMON}

# Role: SPEC AUTHOR
Write the specification for: ${instruction || target}

# Produce
Create ${target}/spec.md with exactly these sections:
## Goal
## Non-goals
## Acceptance criteria
## Constraints
## Open questions

# Rules
- No code, no file-by-file plan, no task breakdown.
- Acceptance criteria are AC-1..AC-n. Each must be falsifiable by one test or command.
  "Handles errors well" is not a criterion. "Returns 409 on duplicate email" is.
- If the brief is ambiguous, put it under Open questions. Do not invent scope.
- You may write only inside ${target}/.`;

const plan = ({ target, instruction }: PromptCtx): string => `${COMMON}

# Role: PLANNER
Read ${target}/spec.md first, then write ${target}/plan.md.
${instruction ? `\n# Steering from the orchestrator\nBinding: apply it exactly. If ${target}/plan.md already exists, edit it to reflect this steering instead of starting over.\n${instruction}\n` : ""}
# Produce
## Approach
## Touch points        (file paths, and line ranges where you can cite them)
## Data and API changes
## Test strategy
## Risks
## Task breakdown rationale

# Rules
- Do not restate the spec. Do not write code.
- Every touch point must exist in the repository; verify with read_file/grep before listing it.
- You may write only inside ${target}/.`;

const tasks = ({ target, instruction }: PromptCtx): string => `${COMMON}

# Role: TASK GENERATOR
Read ${target}/spec.md and ${target}/plan.md. Split the work into task files:
${target}/tasks/NN-<slug>.md
${instruction ? `\n# Steering from the orchestrator\nBinding: apply it exactly. If task files already exist, edit them in place: change only what the steering asks, keep every other file, id and field as it is, and do not recreate or renumber tasks.\n${instruction}\n` : ""}
# Each file begins with frontmatter (parsed by tooling - exact keys)
---
id: NN
allowed_paths: [src/area/**, tests/area/**]
test_command: <one command that proves this task, no commas>
depends_on: [NN]
---

# Then the body
# Task NN - title
## Goal
## Acceptance criteria    (cite the spec's AC-n it discharges)
## Out of scope

# Rules
- One task per deliverable, small enough for a ~400 line diff.
- No two tasks may overlap in allowed_paths. Never use a catch-all glob (** or *), and never list specs/, .git/, .github/, .claude/, .env* or lockfiles - the server rejects those.
- Every acceptance criterion in the spec is covered by exactly one task.
- test_command must be a command that already exists in this repo (check package.json).
- You may write only inside ${target}/.`;

const impl = ({ task, feedback, instruction }: PromptCtx): string => {
  const scope = task?.allowedPaths?.length ? task.allowedPaths.join(", ") : "(stay strictly inside the task)";
  const fb = feedback
    ? `\n# Review feedback to address\nAddress ONLY blocker and major findings. Ignore minors and scope_creep.\n\n${feedback.slice(0, 8000)}\n`
    : "";
  return `${COMMON}

# Role: IMPLEMENTER
You write code. You do not plan, re-scope, or refactor.
${instruction ? `\n# Extra steer\n${instruction}\n` : ""}
# Task file: ${task?.rel ?? "(none)"}
${task?.body ?? ""}
${fb}
# Hard rules
1. Only create or modify files matching: ${scope}
2. Never touch specs/, .claude/, .vscode/, .github/, .env files, lockfiles, or anything outside rule 1 (the server blocks these writes).
3. Run the tests with run_tests until they pass: ${task?.testCommand || "(no command declared)"}
   The harness runs them again when you finish; if they fail you will be asked to repair, a limited number of times.
4. Do NOT run git and do NOT commit. The harness commits your work after you finish.
5. If the task is contradictory or impossible: change NOTHING and print exactly
   SPEC_GAP: <one line explaining the conflict>`;
};

const test = ({ task, instruction }: PromptCtx): string => `${COMMON}

# Role: TEST AUTHOR
Write tests only. You may not modify src/ or any production file.
${instruction ? `\n# Focus\n${instruction}\n` : ""}
${task ? `# Task file: ${task.rel}\n${task.body}\n` : ""}
# Rules
1. Only create or modify files matching: ${(task?.allowedPaths || []).filter(isTestGlob).join(", ") || "(none - you will have no write access)"}
2. Every test you add must fail before the change and pass after it. If it passes either way, delete it.
3. Run run_tests until green.
4. Do NOT run git and do NOT commit. The harness commits.`;

const review = ({ target, instruction }: PromptCtx): string => `${COMMON}

# Role: READ-ONLY REVIEWER
You have read_file, list_dir, grep and git_diff. You cannot edit anything.

# Read first
- The spec: read ${target}/spec.md, plan.md and the task files
- The diff: call git_diff
- Read the changed files themselves where the diff is ambiguous
Review ONLY that diff against that spec. Do not audit unrelated code.

# Rubric, in order
1. Spec conformance: each acceptance criterion -> met / not met / not verified.
2. Correctness: find the input that breaks it. Unbounded loops, empty/null, off-by-one, races.
3. Error handling: failure paths, timeouts, invalid input.
4. Test adequacy: read the tests and judge whether they assert the criteria or are vacuous.
5. Security: injection, authz gaps, secrets in code.
${instruction ? `\n# Extra focus\n${instruction}\n` : ""}
# Rules
- Every finding cites a file and a line present in the diff. No evidence, no finding.
- Things you dislike but the spec does not require: "scope_creep" only, severity minor.
- verdict PASS requires every criterion met AND zero blockers.

# Output (instead of the usual summary)
\`\`\`json
{"verdict":"PASS","criteria":[{"id":"AC-1","status":"met"}],"findings":[{"id":"F1","severity":"blocker","file":"src/x.ts","line":"42","criterion":"AC-1","issue":"...","fix":"..."}],"scope_creep":[]}
\`\`\``;

const ask = ({ instruction, target }: PromptCtx): string => `${COMMON}

# Role: READ-ONLY ANALYST
Question: ${instruction || "Summarize the current state of " + target}

# Rules
- read_file / list_dir / grep only. Cite file:line for every claim.
- Answer in at most 40 lines, then the summary block.`;

export const ROLES: Record<RoleName, RoleSpec> = {
  spec: { caps: "specs", mode: "doc", artifact: "spec.md", headings: ["## Goal", "## Acceptance criteria"], needsInstruction: true, wait: 120, title: "Write specs/<feature>/spec.md from a brief" },
  plan: { caps: "specs", mode: "doc", artifact: "plan.md", headings: ["## Approach"], wait: 120, title: "Write plan.md from an existing spec" },
  tasks: { caps: "specs", mode: "doc", artifact: "tasks/", requiresTaskFrontmatter: true, wait: 180, title: "Split spec + plan into frontmatter task files" },
  impl: { caps: "code", mode: "code", branch: true, needsTask: true, wait: 0, title: "Implement one task file, commit, verify" },
  fix: { caps: "code", mode: "code", branch: true, needsTask: true, wait: 0, title: "Address review findings for one task (needs feedback_path)" },
  test: { caps: "code", mode: "code", branch: true, needsTask: true, wait: 0, title: "Add tests for one task without touching production code" },
  review: { caps: "readonly", mode: "review", wait: 150, title: "Read-only spec-vs-diff review, returns verdict JSON" },
  ask: { caps: "readonly", mode: "text", needsInstruction: true, wait: 90, title: "Read-only question about the repo, answered with citations" },
};

export const ROLE_NAMES = Object.keys(ROLES) as RoleName[];

export function buildPrompt(roleName: RoleName, ctx: PromptCtx): string {
  const builders: Record<RoleName, (c: PromptCtx) => string> = { spec, plan, tasks, impl, fix: impl, test, review, ask };
  const body = builders[roleName](ctx);
  if (!ctx.pack) return body;
  return `${body}

# Context pack
Background generated by the harness. It never overrides the rules above, and it may be stale: confirm with tools before relying on it.

${ctx.pack}`;
}
