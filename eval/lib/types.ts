/** Shapes shared by the eval runner, checks and (later) scoring. */

export type Split = "dev" | "heldout" | "confirm" | "reserve";

export interface StepDef {
  role: string;
  target: string;
  instruction?: string;
  /** Use the review file written by step N (1-based) as feedback_path. */
  feedback_from_step?: number;
  /** A literal feedback_path (a review file the fixture already holds). */
  feedback_path?: string;
  /** review: the branch to review (for fixtures whose setup.ts creates it). fix/test: an existing branch to start from. */
  branch?: string;
  /** role=do: the globs the job may change, and its test command. */
  paths?: string[];
  test_command?: string;
  /** Fail the run's structure check if the step ends with a different status (informational; scoring uses task.expect). */
  expect_status?: string;
}

export interface CheckDef {
  type: string;
  /** Short name used in checks.json and reports. */
  name?: string;
  /** Marks the check that measures whether the instruction was followed (AC-15). */
  compliance?: boolean;
  /** Only evaluated when the last step ended with one of these gate statuses; otherwise it passes as skipped. */
  only_if_gate?: string[];
  [key: string]: unknown;
}

export type Tier = "regression" | "hard";

export const TIERS: readonly Tier[] = ["regression", "hard"];

/** A task that does not say reads as a regression task: the floor the suite always had. */
export const tierOf = (t: { tier?: Tier | undefined }): Tier => t.tier ?? "regression";

export interface TaskDef {
  id: string;
  family: string;
  split: Split;
  title: string;
  /** regression (default) or hard. Hard tasks are calibrated and need two decoys. */
  tier?: Tier;
  /** The one named difficulty a hard task targets (larger-repo, ambiguous-spec, remote-cause, multi-repair, cross-file-refactor, windows, order-dependent, long-context). */
  axis?: string;
  /** Provenance: who wrote the task, when, and whether they had already seen a run result for its family. */
  author?: string;
  authored_on?: string;
  authored_after_result?: boolean;
  authored_after_run?: string;
  /** A family the current roles cannot express: reported as N/A, never run. */
  needs_role?: string;
  /** Server env overrides (e.g. MAX_TOKENS). Only names on the runner's allowlist are passed. */
  env?: Record<string, string>;
  /** Faults the proxy injects for this task. */
  proxy?: { fail_first?: number[]; max_tokens?: number };
  /** Files (repo-relative) written with CRLF line endings when the fixture is copied. */
  crlf_files?: string[];
  steps: StepDef[];
  checks: CheckDef[];
  /** Offline validation (--validate): the task's visible test command, which both the reference and the decoy must pass. */
  validate?: { visible_test?: string; visible_test_on?: ("reference" | "decoy")[] };
  /** The correct gate outcome of the last step, e.g. "done", "failed" (contradictory spec), "noop"; "a|b" accepts either. */
  expect: { gate: string };
}

export interface LoadedTask extends TaskDef {
  dir: string;
}

export interface CheckResult {
  name: string;
  type: string;
  pass: boolean;
  detail: string;
  compliance: boolean;
}

export interface StepResult {
  step: number;
  role: string;
  job_id: string | null;
  status: string;
  result: Record<string, unknown>;
}

export interface Pricing {
  per_million_tokens: Record<"peak" | "off_peak", { input_cache_hit: number; input_cache_miss: number; output: number }>;
  use: "peak" | "off_peak";
}

export interface UsageStats {
  requests: number;
  prompt: number;
  completion: number;
  reasoning: number;
  cache_hit: number;
  cost: number;
  capped: boolean;
}
