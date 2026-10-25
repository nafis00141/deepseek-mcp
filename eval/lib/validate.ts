/**
 * --validate: prove every task's hidden checks discriminate, offline, with no model call.
 *
 * Each task folder may carry simulated outcomes:
 *   unsolved/  (optional)  nothing done                       -> some check must FAIL
 *   reference/             a correct outcome                   -> every check passes, gate == expect.gate
 *   decoy/                 passes the server gate, still wrong -> some check FAILS, gate done/noop
 * An outcome folder holds outcome.json ({ branch?, steps: [{ status, result }] }) and an optional files/ overlay.
 * With `branch`, the overlay is committed on that branch (as a code job would); otherwise it is written to the working tree.
 * `validate.visible_test` (task.json) must pass on both reference and decoy: that is what lets a decoy slip past the real gate.
 */
import fs from "node:fs";
import path from "node:path";
import { runChecks } from "./checks.ts";
import { makeRepo, runSetup } from "./fixture.ts";
import { allowlistEnv, runProc } from "./proc.ts";
import type { LoadedTask, StepResult } from "./types.ts";

interface Outcome {
  branch?: string;
  steps: { status: string; job_id?: string; result?: Record<string, unknown> }[];
}

export interface ValidationRow {
  task: string;
  variant: "unsolved" | "reference" | "decoy";
  ok: boolean;
  problems: string[];
  checks: string;
}

async function simulate(task: LoadedTask, variant: ValidationRow["variant"], gitBin: string): Promise<ValidationRow> {
  const dir = path.join(task.dir, variant);
  const problems: string[] = [];
  const outFile = path.join(dir, "outcome.json");
  if (!fs.existsSync(outFile) && variant !== "unsolved") return { task: task.id, variant, ok: false, problems: [`missing ${variant}/outcome.json`], checks: "" };
  const outcome: Outcome = fs.existsSync(outFile) ? (JSON.parse(fs.readFileSync(outFile, "utf8")) as Outcome) : { steps: task.steps.map(() => ({ status: "failed" })) };

  const fx = makeRepo(task, gitBin);
  try {
    await runSetup(task, fx);
    // With `branch`, branch_files/ (or files/ when there is no branch_files/) is committed on that branch; with branch_files/
    // present, files/ is instead written to the working tree afterwards (docs a doc-role step leaves uncommitted).
    const files = path.join(dir, "files");
    const branchFiles = fs.existsSync(path.join(dir, "branch_files")) ? path.join(dir, "branch_files") : files;
    const splitOverlay = branchFiles !== files;
    if (outcome.branch) fx.git("checkout", "-q", "-b", outcome.branch);
    if (fs.existsSync(outcome.branch ? branchFiles : files)) fs.cpSync(outcome.branch ? branchFiles : files, fx.repo, { recursive: true });
    if (outcome.branch) {
      fx.git("add", "-A");
      fx.git("commit", "-qm", "simulated job");
    }
    let visible = "";
    if (task.validate?.visible_test && variant !== "unsolved" && (task.validate.visible_test_on ?? ["reference", "decoy"]).includes(variant)) {
      const [cmd, ...args] = task.validate.visible_test.split(/\s+/);
      const r = await runProc(cmd === "node" ? process.execPath : cmd!, args, { cwd: fx.repo, env: allowlistEnv(), timeoutMs: 60000 });
      visible = r.code === 0 ? "" : `visible test failed: ${r.out.split(/\r?\n/).slice(-3).join(" | ").slice(0, 200)}`;
      if (visible) problems.push(visible);
    }
    if (outcome.branch) fx.git("checkout", "-q", "main");
    if (outcome.branch && splitOverlay && fs.existsSync(files)) fs.cpSync(files, fx.repo, { recursive: true });
    const steps: StepResult[] = outcome.steps.map((s, i) => ({ step: i + 1, role: task.steps[i]?.role ?? "?", job_id: s.job_id ?? null, status: s.status, result: { status: s.status, ...(s.result ?? {}) } }));
    const results = await runChecks(task.checks, { repo: fx.repo, gitBin, hiddenDir: path.join(task.dir, "hidden"), steps });
    const failing = results.filter((r) => !r.pass);
    const gate = steps[steps.length - 1]?.status ?? "";
    if (variant === "reference") {
      if (failing.length) problems.push(`reference fails: ${failing.map((f) => `${f.name} (${f.detail})`).join("; ")}`);
      if (!task.expect.gate.split("|").includes(gate)) problems.push(`reference gate is "${gate}", task expects "${task.expect.gate}"`);
    } else if (variant === "decoy") {
      if (!failing.length) problems.push("decoy passes every hidden check, so it proves nothing");
      if (!["done", "noop"].includes(gate)) problems.push(`decoy gate is "${gate}": a decoy must be accepted by the gate (done/noop)`);
    } else if (!failing.length) problems.push("the unsolved fixture already passes every check");
    return { task: task.id, variant, ok: problems.length === 0, problems, checks: `${results.length - failing.length}/${results.length} pass` };
  } finally {
    fx.remove();
  }
}

export async function validateTasks(tasks: LoadedTask[], gitBin: string, log: (l: string) => void): Promise<ValidationRow[]> {
  const rows: ValidationRow[] = [];
  for (const t of tasks) {
    if (t.needs_role) {
      log(`  N/A ${t.id} (needs role "${t.needs_role}")`);
      continue;
    }
    for (const v of ["unsolved", "reference", "decoy"] as const) {
      const row = await simulate(t, v, gitBin).catch((e: Error) => ({ task: t.id, variant: v, ok: false, problems: [`validation crashed: ${e.message.slice(0, 200)}`], checks: "" }));
      rows.push(row);
      log(`  ${row.ok ? "ok  " : "FAIL"} ${t.id} / ${v}${row.checks ? ` [${row.checks}]` : ""}${row.problems.map((p) => `\n         ${p}`).join("")}`);
    }
  }
  return rows;
}
