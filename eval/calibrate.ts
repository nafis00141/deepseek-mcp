/**
 * Calibrate the hard dev tier from baseline calibration runs.
 *
 *   node eval/calibrate.ts <run-id>[,<run-id>...] [--note "what structural change this follows"]
 *
 * Writes eval/calibration.json (band per hard dev task, one entry per round) and eval/frozen.json (hash of the hard dev tasks).
 * Accepts only runs made with --arm baseline --purpose calibration, at least 10 runs per hard task, at most 3 rounds.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calibrate } from "./lib/calibration.ts";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const args = process.argv.slice(2);
  const noteAt = args.indexOf("--note");
  const note = noteAt >= 0 ? args[noteAt + 1] : undefined;
  const ids = args.filter((a, i) => !a.startsWith("--") && i !== noteAt + 1).flatMap((a) => a.split(",")).map((s) => s.trim()).filter(Boolean);
  if (!ids.length) {
    console.error('usage: node eval/calibrate.ts <run-id>[,<run-id>...] [--note "..."]');
    process.exit(1);
  }
  const runs = path.join(here, "..", "runs");
  try {
    const f = calibrate({ evalDir: here, runDirs: ids.map((id) => (fs.existsSync(id) ? path.resolve(id) : path.join(runs, id))), ...(note ? { note } : {}) });
    const last = f.rounds[f.rounds.length - 1]!;
    console.log(`calibration round ${last.round} of 3 from ${last.run_ids.join(", ")}`);
    for (const [id, t] of Object.entries(f.tasks)) console.log(`  ${t.band.padEnd(10)} ${id}  ${Math.round(t.pass_rate * 100)}% over ${t.runs} runs`);
    const n = Object.values(f.tasks).filter((t) => t.band === "calibrated").length;
    console.log(`${n}/${Object.keys(f.tasks).length} calibrated; froze the hard dev task set`);
  } catch (e) {
    console.error(`calibrate failed: ${(e as Error).message}`);
    process.exit(1);
  }
}
