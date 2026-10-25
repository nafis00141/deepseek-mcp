/**
 * --validate: prove every task's hidden checks discriminate, offline, with no model call.
 *
 * Each task folder may carry simulated outcomes:
 *   unsolved/  (optional)  nothing done                       -> some check must FAIL
 *   reference/             a correct outcome                   -> every check passes, gate == expect.gate
 *   decoy/                 passes the server gate, still wrong -> some check FAILS, gate done/noop
 * An outcome folder holds outcome.json ({ branch?, steps: [{ status, result }] }) and an optional files/ overlay.
 * A task with tier "hard" must have both decoy/ and decoy2/, each saying its "kind", and the kinds must differ.
 * With `branch`, the overlay is committed on that branch (as a code job would); otherwise it is written to the working tree.
 * `validate.visible_test` (task.json) must pass on both reference and decoy: that is what lets a decoy slip past the real gate.
 */
import fs from "node:fs";
import path from "node:path";
import { runChecks } from "./checks.ts";
import { makeRepo, runSetup } from "./fixture.ts";
import { allowlistEnv, runProc } from "./proc.ts";
import { tierOf } from "./types.ts";
import type { LoadedTask, StepResult } from "./types.ts";

interface Outcome {
  /** What a decoy gets wrong (special-case, incomplete, ...). Hard tasks must give it and the two decoys must differ. */
  kind?: string;
  branch?: string;
  steps: { status: string; job_id?: string; result?: Record<string, unknown> }[];
}

export interface ValidationRow {
  task: string;
  /** decoy2 is a second, different decoy; it is validated like the first whenever the task has a decoy2/ folder */
  variant: "unsolved" | "reference" | "decoy" | "decoy2";
  ok: boolean;
  problems: string[];
  checks: string;
}

async function simulate(task: LoadedTask, variant: ValidationRow["variant"], gitBin: string): Promise<ValidationRow> {
  const dir = path.join(task.dir, variant);
  /** the kind of expectation: both decoys must be accepted by the gate and still fail a hidden check */
  const kind = variant === "decoy2" ? "decoy" : variant;
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
    if (task.validate?.visible_test && kind !== "unsolved" && (task.validate.visible_test_on ?? ["reference", "decoy"]).includes(kind)) {
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
    if (kind === "reference") {
      if (failing.length) problems.push(`reference fails: ${failing.map((f) => `${f.name} (${f.detail})`).join("; ")}`);
      if (!task.expect.gate.split("|").includes(gate)) problems.push(`reference gate is "${gate}", task expects "${task.expect.gate}"`);
    } else if (kind === "decoy") {
      if (!failing.length) problems.push(`${variant} passes every hidden check, so it proves nothing`);
      if (!["done", "noop"].includes(gate)) problems.push(`${variant} gate is "${gate}": a decoy must be accepted by the gate (done/noop)`);
    } else if (!failing.length) problems.push("the unsolved fixture already passes every check");
    return { task: task.id, variant, ok: problems.length === 0, problems, checks: `${results.length - failing.length}/${results.length} pass` };
  } finally {
    fx.remove();
  }
}

/** What kind of wrong a decoy is, as its outcome.json says; null when the file or the field is missing. */
function decoyKind(task: LoadedTask, variant: "decoy" | "decoy2"): string | null {
  try {
    const o = JSON.parse(fs.readFileSync(path.join(task.dir, variant, "outcome.json"), "utf8")) as Outcome;
    return typeof o.kind === "string" && o.kind.trim() ? o.kind.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function validateTasks(tasks: LoadedTask[], gitBin: string, log: (l: string) => void): Promise<ValidationRow[]> {
  const rows: ValidationRow[] = [];
  for (const t of tasks) {
    if (t.needs_role) {
      log(`  N/A ${t.id} (needs role "${t.needs_role}")`);
      continue;
    }
    const hard = tierOf(t) === "hard";
    const variants: ValidationRow["variant"][] = ["unsolved", "reference", "decoy", ...(hard || fs.existsSync(path.join(t.dir, "decoy2")) ? (["decoy2"] as const) : [])];
    for (const v of variants) {
      const row = await simulate(t, v, gitBin).catch((e: Error) => ({ task: t.id, variant: v, ok: false, problems: [`validation crashed: ${e.message.slice(0, 200)}`], checks: "" }));
      if (hard && v === "decoy2" && row.problems.some((p) => p.startsWith("missing "))) row.problems.unshift("a hard task needs two decoys of different kinds (decoy/ and decoy2/)");
      if (hard && (v === "decoy" || v === "decoy2")) {
        const kind = decoyKind(t, v);
        if (!kind) {
          row.ok = false;
          row.problems.push(`a hard task's ${v}/outcome.json must say what kind of wrong it is ("kind", for example "special-case" or "incomplete")`);
        }
      }
      rows.push(row);
      log(`  ${row.ok ? "ok  " : "FAIL"} ${t.id} / ${v}${row.checks ? ` [${row.checks}]` : ""}${row.problems.map((p) => `\n         ${p}`).join("")}`);
    }
    if (hard) {
      const a = decoyKind(t, "decoy");
      const b = decoyKind(t, "decoy2");
      if (a && b && a === b) {
        const row: ValidationRow = { task: t.id, variant: "decoy2", ok: false, problems: [`decoy and decoy2 are both of kind "${a}": the two decoys must differ`], checks: "" };
        rows.push(row);
        log(`  FAIL ${t.id} / decoy kinds\n         ${row.problems[0]}`);
      }
    }
  }
  return rows;
}
