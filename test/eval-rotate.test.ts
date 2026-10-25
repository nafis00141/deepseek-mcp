import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { looksSinceRotation, readConfirmLog } from "../eval/confirm.ts";
import { loadTasks, removeDir, taskRoots } from "../eval/lib/fixture.ts";
import { readLooks } from "../eval/lib/looks.ts";
import { privateLabel } from "../eval/lib/privacy.ts";
import { rotate } from "../eval/rotate.ts";
import type { RotateOpts } from "../eval/rotate.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-rotate-")));
after(() => removeDir(root));

const put = (rel: string, content: string): void => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
const def = (id: string, split: string) => JSON.stringify({ id, family: "x", split, title: id, steps: [], checks: [], expect: { gate: "done" } });

let n = 0;
/** A fresh eval dir with 3 dev, 3 held-out and `reserve` reserve tasks, and a runs dir whose held-out looks total is `looks`. */
function world(over: { reserve?: number; looks?: number; clashWithDev?: boolean } = {}) {
  const name = `w${n++}`;
  const evalDir = path.join(root, name, "eval");
  const runsDir = path.join(root, name, "runs");
  for (const id of ["dev-a", "dev-b", "dev-c"]) put(`${name}/eval/tasks/${id}/task.json`, def(id, "dev"));
  for (const id of ["held-1", "held-2", "held-3"]) {
    put(`${name}/eval/heldout/${id}/task.json`, def(id, "heldout"));
    put(`${name}/eval/heldout/${id}/repo/src/x.js`, "x\n");
  }
  for (let i = 1; i <= (over.reserve ?? 8); i++) put(`${name}/eval/reserve/res-${i}/task.json`, def(`res-${i}`, "reserve"));
  if (over.clashWithDev) put(`${name}/eval/reserve/dev-a/task.json`, def("dev-a", "reserve"));
  put(`${name}/runs/heldout-looks.json`, JSON.stringify({ version: 2, total: over.looks ?? 12, by_lineage: { L: 4 } }));
  return { evalDir, runsDir };
}
const opts = (w: { evalDir: string; runsDir: string }, over: Partial<RotateOpts> = {}): RotateOpts => ({ ...w, lookTotal: 12, minReserve: 8, yes: true, now: () => new Date("2026-11-01T10:00:00Z"), log: () => {}, ...over });

describe("rotation refusals", () => {
  it("refuses when the held-out set is not worn out, when the reserve is too small, and when ids would collide; nothing moves", () => {
    const a = world({ looks: 5 });
    assert.throws(() => rotate(opts(a)), /only 5 of the 12 held-out looks are spent/);
    const b = world({ reserve: 5 });
    assert.throws(() => rotate(opts(b)), /reserve holds 5 task\(s\) and a rotation needs at least 8/);
    const c = world({ clashWithDev: true });
    assert.throws(() => rotate(opts(c)), /would collide after the move/);
    for (const w of [a, b, c]) {
      assert.deepEqual(loadTasks(taskRoots(w.evalDir), ["heldout"]).map((t) => t.id), ["held-1", "held-2", "held-3"]);
      assert.equal(fs.existsSync(path.join(w.runsDir, "rotation-log.json")), false);
    }
    assert.equal(readLooks(path.join(a.runsDir, "heldout-looks.json")).total, 5, "counters untouched");
  });
});

describe("rotation", () => {
  it("a dry run reports and changes nothing", () => {
    const w = world();
    const lines: string[] = [];
    const r = rotate(opts(w, { yes: false, log: (l) => lines.push(l) }));
    assert.deepEqual([r.applied, r.promoted, r.refilled], [false, 3, 8]);
    assert.ok(lines.some((l) => l.includes("dry run")));
    assert.deepEqual(loadTasks(taskRoots(w.evalDir), ["heldout"]).map((t) => t.id), ["held-1", "held-2", "held-3"]);
    assert.equal(loadTasks(taskRoots(w.evalDir), ["reserve"]).length, 8);
  });

  it("promotes held-out into dev, refills held-out from the reserve, rewrites splits, resets the counters and logs only hashed labels", () => {
    const w = world();
    const r = rotate(opts(w));
    assert.deepEqual([r.applied, r.promoted, r.refilled, r.looks_before], [true, 3, 8, 12]);
    const roots = taskRoots(w.evalDir);
    assert.deepEqual(loadTasks(roots, ["dev"]).map((t) => t.id), ["dev-a", "dev-b", "dev-c", "held-1", "held-2", "held-3"]);
    assert.deepEqual(loadTasks(roots, ["heldout"]).map((t) => t.id), Array.from({ length: 8 }, (_, i) => `res-${i + 1}`));
    assert.equal(loadTasks(roots, ["reserve"]).length, 0);
    const promoted = JSON.parse(fs.readFileSync(path.join(w.evalDir, "tasks", "held-1", "task.json"), "utf8")) as { split: string; rotated: { from: string; on: string } };
    assert.deepEqual([promoted.split, promoted.rotated.from, promoted.rotated.on], ["dev", "heldout", "2026-11-01T10:00:00.000Z"]);
    assert.ok(fs.existsSync(path.join(w.evalDir, "tasks", "held-1", "repo", "src", "x.js")), "the whole folder moved, fixture included");

    assert.deepEqual(readLooks(path.join(w.runsDir, "heldout-looks.json")), { version: 2, total: 0, by_lineage: {} });
    const clog = readConfirmLog(path.join(w.runsDir, "confirm-log.jsonl"));
    assert.deepEqual(clog.map((e) => e.type), ["rotation"]);
    assert.equal(looksSinceRotation(clog).length, 0);

    const history = fs.readFileSync(path.join(w.runsDir, "rotation-log.json"), "utf8");
    assert.ok(!history.includes("res-1") && !history.includes("held-1"), "the rotation log names no task");
    assert.ok(history.includes(privateLabel("res-1")) && history.includes(privateLabel("held-1")));

    assert.throws(() => rotate(opts(w)), /only 0 of the 12 held-out looks are spent/, "a second rotation right away is refused");
  });
});
