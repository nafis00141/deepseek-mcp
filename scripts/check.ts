/**
 * One command for "is this change done": typecheck, tests, smoke, and (with --eval) the offline eval validation.
 * Prints one line per step and, for a step that fails, only the failing part, so a green run costs a few lines of output.
 *
 *   npm run check              typecheck + tests + smoke
 *   npm run check -- --eval    ... and node eval/run.ts --validate --split all
 *   npm run check -- --fast    typecheck only
 *
 * Steps run one after another: the tests and the eval validation spawn servers and whole fixtures, and running them side by
 * side can pass the 60 s per-command timeout in eval/lib/validate.ts.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

interface Step {
  name: string;
  argv: string[];
  /** One line saying what passed, or null when the step failed; `out` is everything the step printed. */
  summarize: (out: string, code: number | null) => string | null;
  /** The part of the output worth showing when it failed. */
  failure: (out: string) => string;
}

const tail = (out: string, n: number): string => out.trim().split(/\r?\n/).slice(-n).join("\n");
const num = (out: string, label: string): number => Number(new RegExp(`^ℹ ${label} (\\d+)`, "m").exec(out)?.[1] ?? 0);

/** The part of node:test output after "failing tests:" (names and the first assertion lines), capped. */
function failingTests(out: string): string {
  const at = out.indexOf("failing tests:");
  if (at < 0) return tail(out, 30);
  return out.slice(at).split(/\r?\n/).slice(0, 60).join("\n");
}

const steps: Step[] = [
  {
    name: "typecheck",
    argv: [path.join(ROOT, "node_modules", "typescript", "bin", "tsc"), "--noEmit"],
    summarize: (_o, code) => (code === 0 ? "ok" : null),
    failure: (o) => tail(o, 40),
  },
];
if (!args.includes("--fast")) {
  steps.push(
    {
      name: "tests",
      argv: ["--test", "--test-force-exit", "test/*.test.ts"], // node expands the glob itself, on every platform
      summarize: (o, code) => (code === 0 && num(o, "fail") === 0 ? `${num(o, "pass")} pass, ${num(o, "fail")} fail, ${num(o, "skipped")} skipped of ${num(o, "tests")}` : null),
      failure: failingTests,
    },
    {
      name: "smoke",
      argv: [path.join(ROOT, "scripts", "smoke.ts")],
      summarize: (o, code) => (code === 0 ? tail(o, 1).slice(0, 120) : null),
      failure: (o) => tail(o, 15),
    },
  );
}
if (args.includes("--eval") && !args.includes("--fast")) {
  steps.push({
    name: "eval validate",
    argv: [path.join(ROOT, "eval", "run.ts"), "--validate", "--split", "all", "--quiet"],
    summarize: (o, code) => (code === 0 ? tail(o, 1) : null),
    failure: (o) => tail(o, 40),
  });
}

let failed = 0;
for (const s of steps) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, s.argv, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, timeout: 20 * 60 * 1000 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const ok = s.summarize(out, r.status);
  if (ok !== null) console.log(`${s.name.padEnd(14)} ${ok} (${secs}s)`);
  else {
    failed++;
    console.log(`${s.name.padEnd(14)} FAILED (${secs}s)${r.error ? `: ${r.error.message}` : ""}`);
    console.log(s.failure(out));
  }
}
console.log(failed ? `${failed} step(s) failed` : "all checks passed");
process.exit(failed ? 1 : 0);
