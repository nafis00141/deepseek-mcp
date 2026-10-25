import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeDir } from "../eval/lib/fixture.ts";
import { readLooks, spendLook } from "../eval/lib/looks.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-looks-")));
after(() => removeDir(root));
let n = 0;
const fresh = (): string => path.join(root, `looks-${n++}.json`);

describe("held-out look budget", () => {
  it("counts per lineage and in total, and says what is left", () => {
    const f = fresh();
    const a = spendLook(f, "tree-A", 4, 12);
    assert.deepEqual([a.allowed, a.lineage_used, a.lineage_left, a.total_used, a.total_left], [true, 1, 3, 1, 11]);
    spendLook(f, "tree-B", 4, 12);
    const a2 = spendLook(f, "tree-A", 4, 12);
    assert.deepEqual([a2.lineage_used, a2.total_used], [2, 3]);
  });

  it("refuses a fifth look for a lineage without spending anything, so a renamed run cannot reset it", () => {
    const f = fresh();
    for (let i = 0; i < 4; i++) assert.equal(spendLook(f, "tree-A", 4, 12).allowed, true);
    const r = spendLook(f, "tree-A", 4, 12);
    assert.deepEqual([r.allowed, r.lineage_left, r.total_used], [false, 0, 4]);
    assert.match(r.reason ?? "", /this lineage has used its 4/);
    assert.equal(readLooks(f).total, 4, "a refused look is not counted");
    // the same lineage under any run name is the same budget; a different lineage starts fresh
    assert.equal(spendLook(f, "tree-A", 4, 12).allowed, false);
    assert.equal(spendLook(f, "tree-B", 4, 12).allowed, true);
  });

  it("the global total is binding across lineages", () => {
    const f = fresh();
    for (let i = 0; i < 6; i++) {
      assert.equal(spendLook(f, `tree-${i % 3}`, 4, 6).allowed, true);
    }
    const r = spendLook(f, "tree-new", 4, 6);
    assert.deepEqual([r.allowed, r.total_left], [false, 0]);
    assert.match(r.reason ?? "", /total of 6/);
  });

  it("upgrades the older per-run-id file: its looks count toward the total", () => {
    const f = fresh();
    fs.writeFileSync(f, JSON.stringify({ "candidate-3": 4, "candidate-1": 1 }));
    assert.deepEqual(readLooks(f), { version: 2, total: 5, by_lineage: {} });
    const r = spendLook(f, "tree-A", 4, 12);
    assert.deepEqual([r.allowed, r.total_used], [true, 6]);
  });

  it("starts empty when the file is missing or unreadable", () => {
    assert.deepEqual(readLooks(path.join(root, "nope.json")), { version: 2, total: 0, by_lineage: {} });
    const f = fresh();
    fs.writeFileSync(f, "{ not json");
    assert.deepEqual(readLooks(f), { version: 2, total: 0, by_lineage: {} });
  });
});
