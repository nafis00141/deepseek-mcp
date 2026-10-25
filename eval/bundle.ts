/**
 * Builds the single input for the reviewer pass (eval/review-prompt.md): scores plus, for every dev task that
 * failed or was falsely accepted, the failing checks, the model's final text, a compact trace and the diff.
 *
 *   node eval/bundle.ts <run-id | path>  [--max-runs-per-task 3]  ->  runs/<id>/reviewer-bundle.md
 *
 * Allowlist, not blocklist: only dev-split records are opened. Held-out runs are never read; the report embedded here
 * shows them as one aggregate row, exactly as score.ts publishes it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReport, scoreRun } from "./score.ts";
import type { RunRow } from "./score.ts";
import type { RunRecord } from "./run.ts";

/** The files a candidate edit may change, and what each controls. */
export const HARNESS_SURFACES: [file: string, controls: string][] = [
  ["src/roles.ts", "role prompts (COMMON rules, one builder per role), caps and gates per role"],
  ["src/engine.ts", "system prompt, tool descriptions, request body (thinking/effort), loop and repair wiring"],
  ["src/gates.ts", "acceptance gates, the repair messages sent back to the model, review verdict rules"],
  ["src/context.ts", "the context pack added to every prompt"],
  ["src/server.ts", "how instructions and artifacts flow between roles; per-role settings"],
];

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}\n... [${s.length - n} more chars]` : s);
const read = (f: string): string => {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return "";
  }
};

/** One line per interesting trace event; refusals, repairs, truncations and retries are what a harness patch is about. */
export function compactTrace(dir: string, limit = 60): string[] {
  const out: string[] = [];
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => /^step\d+\.trace\.jsonl$/.test(n)).sort() : [];
  for (const f of files) {
    out.push(`[${f.replace(".trace.jsonl", "")}]`);
    for (const line of read(path.join(dir, f)).split(/\r?\n/)) {
      if (!line.trim()) continue;
      let e: Record<string, unknown>;
      try {
        e = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (e.type === "job_start") out.push(`  start role=${String(e.role)} effort=${String(e.effort)} prompt=${String(e.prompt_chars)} chars`);
      else if (e.type === "turn") out.push(`  turn ${String(e.n)} finish=${String(e.finish_reason)} in=${String(e.prompt_tokens)} out=${String(e.completion_tokens)} reasoning=${String(e.reasoning_tokens)} tool_calls=${String(e.tool_calls)}`);
      else if (e.type === "tool") out.push(`    ${e.ok ? "ok " : "ERR"} ${String(e.name)} ${JSON.stringify(e.args)}${e.denied ? ` DENIED(${String(e.denied)})` : ""}${e.error ? ` -> ${String(e.error).slice(0, 120)}` : ""}`);
      else if (e.type === "repair") out.push(`  REPAIR ${String(e.n)}: ${String(e.why)}`);
      else if (e.type === "truncated") out.push(`  TRUNCATED (${String(e.kind)}) at turn ${String(e.turn)}`);
      else if (e.type === "api_retry") out.push(`  api retry ${String(e.attempt)} status=${String(e.status)}`);
      else if (e.type === "gate") out.push(`  GATE ${String(e.status)} reasons=${JSON.stringify(e.reasons)}`);
      else if (e.type === "job_end") out.push(`  end state=${String(e.state)} ${String(e.elapsed_ms)}ms`);
    }
  }
  return out.length > limit ? [...out.slice(0, limit), `  ... [${out.length - limit} more lines]`] : out;
}

export function buildBundle(runDir: string, maxRunsPerTask = 3): string {
  const r = scoreRun(runDir);
  const out: string[] = [`# Reviewer bundle - ${r.run_id}`, "", "Dev-set evidence only. Held-out tasks appear solely as the aggregate row in the summary.", ""];
  out.push("## Harness files you may propose patches to", "", ...HARNESS_SURFACES.map(([f, c]) => `- \`${f}\`: ${c}`), "");
  out.push(renderReport(r), "");

  const bad = (x: RunRow): boolean => x.split === "dev" && (!x.hidden_pass || x.false_accept);
  const byTask = new Map<string, RunRow[]>();
  for (const x of r.rows.filter(bad)) byTask.set(x.task, [...(byTask.get(x.task) ?? []), x]);

  out.push("## Failure index (dev)", "");
  if (!byTask.size) out.push("No dev run failed its hidden checks.", "");
  else {
    out.push("| task | failing runs | of | false accepts | failing checks (count) |", "|---|---|---|---|---|");
    for (const [task, rows] of [...byTask.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const total = r.rows.filter((x) => x.task === task && x.split === "dev").length;
      const tally = new Map<string, number>();
      for (const x of rows) for (const c of x.failing_checks) tally.set(c, (tally.get(c) ?? 0) + 1);
      out.push(`| ${task} | ${rows.length} | ${total} | ${rows.filter((x) => x.false_accept).length} | ${[...tally.entries()].map(([c, n]) => `${c} x${n}`).join(", ")} |`);
    }
    out.push("");
  }

  out.push("## Failing dev runs", "");
  for (const [task, rows] of [...byTask.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const x of rows.slice(0, maxRunsPerTask)) {
      const dir = path.join(runDir, task, String(x.k));
      const rec = JSON.parse(read(path.join(dir, "checks.json")) || "null") as RunRecord | null;
      if (!rec || rec.split !== "dev") continue; // never open anything that is not a dev record
      out.push(`### ${task}#${x.k}  (gate ${rec.gate_status}, expected ${rec.expect.gate}${x.false_accept ? ", FALSE ACCEPT" : ""})`, "");
      out.push("Failing checks:", ...rec.checks.filter((c) => !c.pass).map((c) => `- ${c.name}${c.compliance ? " [instruction compliance]" : ""}: ${c.detail}`), "");
      const final = read(path.join(dir, "step" + rec.steps.length + ".final.txt")) || read(path.join(dir, "step1.final.txt"));
      if (final) out.push("Model's final message (last step):", "```", clip(final.trim(), 1500), "```", "");
      const trace = compactTrace(dir);
      if (trace.length) out.push("Trace:", "```", ...trace, "```", "");
      const patch = fs.readdirSync(dir).filter((n) => /\.diff\.patch$/.test(n)).sort().map((n) => read(path.join(dir, n))).join("\n");
      if (patch.trim()) out.push("Committed diff:", "```diff", clip(patch.trim(), 2500), "```", "");
      out.push(`Files: \`${path.relative(path.dirname(runDir), dir).replace(/\\/g, "/")}/\` (step prompts are in step<N>.prompt.txt)`, "");
    }
  }
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = args[0];
  if (!arg) {
    console.error("usage: node eval/bundle.ts <run-id | path> [--max-runs-per-task 3]");
    process.exit(1);
  }
  const dir = fs.existsSync(arg) ? path.resolve(arg) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "runs", arg);
  const i = args.indexOf("--max-runs-per-task");
  const text = buildBundle(dir, i >= 0 ? Number(args[i + 1]) : 3);
  const file = path.join(dir, "reviewer-bundle.md");
  fs.writeFileSync(file, text);
  console.log(`written: ${file} (${text.length} chars)`);
}
