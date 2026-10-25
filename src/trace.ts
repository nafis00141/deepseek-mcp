/**
 * Structured per-job trace: specs/.jobs/<jobId>.trace.jsonl, one JSON object per line.
 * Diagnostics only - a write failure never fails a job, and nothing here ever sees the API key
 * (tool arguments are summarised from a whitelist: paths, sizes and counts, never file contents).
 */
import fs from "node:fs";
import path from "node:path";
import { CFG } from "./config.ts";
import type { TraceEvent, TraceSink } from "./types.ts";

export const tracePath = (jobId: string): string => path.join(CFG.jobs, `${jobId}.trace.jsonl`);

/** A sink that appends timestamped events for one job. */
export function traceSink(jobId: string): TraceSink {
  const file = tracePath(jobId);
  return (event: TraceEvent): void => {
    try {
      fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n");
    } catch {
      /* never fail a request over tracing */
    }
  };
}

const WRITE_TOOLS = new Set(["write_file", "edit_file"]);
const str = (v: unknown): string => String(v ?? "");
const len = (v: unknown): number => str(v).length;

/** Tool arguments reduced to what is safe and useful to keep: paths, sizes, counts. */
export function summarizeArgs(name: string, args: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const a = args || {};
  switch (name) {
    case "read_file": return { path: a.path, start: a.start, end: a.end };
    case "list_dir": return { path: a.path };
    case "grep": return { pattern_chars: len(a.pattern), path: a.path, max: a.max };
    case "write_file": return { path: a.path, content_chars: len(a.content) };
    case "edit_file": return { path: a.path, old_chars: len(a.old), new_chars: len(a.new) };
    case "git_diff": return { base: a.base, offset: a.offset };
    case "run_tests": return {};
    default: return { keys: Object.keys(a).slice(0, 8) };
  }
}

/**
 * Was this tool call refused by a capability or path rule? Classified from the existing error text, so the
 * model-visible tool output is unchanged. "write" counts only attempts by write tools; a refused read is "read".
 */
export function classifyDenied(name: string, error: string | undefined): "write" | "read" | false {
  if (!error) return false;
  const refused = /^not permitted to /.test(error) || /^path escapes the repo/.test(error) || /^this role is read-only/.test(error) || /^no test command/.test(error);
  if (!refused) return false;
  return WRITE_TOOLS.has(name) ? "write" : "read";
}

/** One short line describing a tool result (no file contents). */
export function summarizeResult(out: Record<string, unknown> & { error?: string }): string {
  if (out.error) return `ERROR ${String(out.error).slice(0, 160)}`;
  const bits: string[] = [];
  for (const k of ["written", "edited", "bytes", "count", "total_lines", "from", "to", "pass"]) if (out[k] !== undefined) bits.push(`${k}=${String(out[k]).slice(0, 80)}`);
  return bits.join(" ") || `ok (${JSON.stringify(out).length} chars)`;
}
