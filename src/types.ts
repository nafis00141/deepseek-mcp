import type { Task } from "./taskfile.ts";

export type RoleName = "spec" | "plan" | "tasks" | "impl" | "fix" | "test" | "review" | "ask" | "research" | "do";
export type Mode = "doc" | "code" | "review" | "text";

/** What the harness knows about one role: how it is run and how it is judged. */
export interface RoleSpec {
  /** `research`: read-only, plus one writable file, <target>/research.md. */
  caps: "specs" | "code" | "readonly" | "research";
  mode: Mode;
  artifact?: string;
  headings?: string[];
  needsInstruction?: boolean;
  needsTask?: boolean;
  /** Free-form code role: no task file; the call supplies `paths` and `test_command`, and the instruction is the task. */
  synthetic?: boolean;
  requiresTaskFrontmatter?: boolean;
  branch?: boolean;
  wait: number;
  title: string;
}

/** Everything a role's tools are allowed to do. */
export interface Caps {
  write: string[];
  denySpecs: boolean;
  canRunTests: boolean;
  testCommand?: string | null;
  baseRef: string | null;
}

export interface PromptCtx {
  target: string;
  instruction?: string | null | undefined;
  feedback?: string | null | undefined;
  task?: Task | null | undefined;
  pack?: string | undefined;
}

/** `reasoning` is a subset of `output` (not additional); absent when the API never reported it. */
export interface Usage {
  input: number;
  output: number;
  reasoning?: number;
  cacheHit?: number;
}

/** One line of a job's trace.jsonl (the writer adds `ts`). */
export type TraceEvent =
  | { type: "job_start"; role: string; model: string; effort: string | null; thinking: string; prompt_chars: number; pack_chars: number; target: string }
  | { type: "turn"; n: number; ms: number; finish_reason: string | null; prompt_tokens: number | null; completion_tokens: number | null; reasoning_tokens: number | null; cache_hit_tokens: number | null; tool_calls: number; content_chars: number }
  | { type: "tool"; turn: number; name: string; args: Record<string, unknown>; ok: boolean; error?: string; result: string; denied: "write" | "read" | false; ms: number }
  | { type: "repair"; n: number; turn: number; why: string }
  | { type: "truncated"; turn: number; kind: "tool_call" | "final" }
  | { type: "api_retry"; attempt: number; status: number | null; error: string }
  | { type: "gate"; status: string; reasons: string[]; verdict: string | null; infra: boolean }
  | { type: "job_end"; state: string; elapsed_ms: number; turns: number | null; crashed?: boolean };

export type TraceSink = (event: TraceEvent) => void;

export interface Repair {
  turn: number;
  why: string;
}

/** The model's closing JSON block. Fields are checked by the gates, not trusted here. */
export interface Summary {
  status?: string;
  did?: unknown;
  bullets?: unknown;
  not_done?: unknown;
  notes?: unknown;
  verdict?: string;
  criteria?: unknown;
  findings?: unknown;
  scope_creep?: unknown;
  [key: string]: unknown;
}

export interface AgentOutput {
  finalText: string;
  turns: number;
  usage: Usage;
  exhausted: boolean;
  aborted?: boolean;
  repairs: Repair[];
}

/** What executeJob hands to a gate. */
export interface ExecResult {
  isError: boolean;
  turns: number;
  usage: Usage | null;
  result: string;
  summary: Summary | null;
  gap: string | null;
  exhausted?: boolean;
  repairs?: Repair[];
  error?: string;
  aborted?: boolean;
}

/** A gate's verdict. Extra fields (files, tests, report, ...) are role-specific. */
export interface JobResult {
  status: string;
  reasons?: string[];
  infra?: boolean;
  role?: string;
  job_id?: string;
  verdict?: string;
  [key: string]: unknown;
}

/** One job record, as stored in specs/.jobs/<id>.json. */
export interface Job {
  jobId: string;
  key: string;
  role: RoleName;
  mode: Mode;
  artifact: string | null;
  headings: string[];
  targetRel: string;
  branch: string | null;
  reviewBranch: string | null;
  baseBranch: string;
  baseSha: string;
  switched: boolean;
  createdBranch: boolean;
  startedFrom: string | null;
  task: string | null;
  allowedPaths: string[];
  startedSha: string;
  startedChanges: Record<string, string>;
  logPath: string;
  promptPath: string;
  packChars: number;
  startedAt: string;
  state: string;
  result?: JobResult;
  finishedAt?: string;
  commit?: string | null;
  commitError?: string | null;
  endSha?: string;
  /** A free-form job: its scope (`allowedPaths`) and test command live here, and the gate trusts these, not a file on the branch. */
  synthetic?: boolean;
  testCommand?: string | null;
  discardedAt?: string;
}

export interface GitResult {
  ok: boolean;
  out: string;
}

export interface ChangedFile {
  code: string;
  file: string;
}
