import fs from "node:fs";
import path from "node:path";

/** A branch the server's impl job "made" (server-style commit subject) with an off-by-one, and the review file that found it. */
export default function setup(ctx: { repo: string; git: (...args: string[]) => string }): void {
  const write = (rel: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(ctx.repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(ctx.repo, rel), text);
  };
  ctx.git("checkout", "-q", "-b", "impl/01-range");
  write("src/range.js", "'use strict';\n// Inclusive range: range(1, 3) is [1, 2, 3].\nfunction range(start, end) {\n  const out = [];\n  for (let i = start; i < end; i++) out.push(i);\n  return out;\n}\n\nmodule.exports = { range };\n");
  write("tests/range.test.js", "const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { range } = require('../src/range.js');\n\ntest('inclusive end', () => {\n  assert.deepEqual(range(1, 3), [1, 2, 3]);\n});\n\ntest('empty when start is past end', () => {\n  assert.deepEqual(range(3, 1), []);\n});\n");
  ctx.git("add", "-A");
  ctx.git("commit", "-qm", "task-01: impl");
  ctx.git("checkout", "-q", "main");
  // specs/review/ is git-ignored in the fixture, so the review file sits on disk beside the repo's other files
  write("specs/review/01.md", "# impl review - specs/rng\n\n- F1 blocker, src/range.js line 5, AC-1: the loop stops one short, so the end of the range is missing (range(1, 3) is [1, 2]). Fix: iterate while i <= end.\n- F2 major, src/range.js, AC-3: range(1.5, 3) and range('a', 3) must throw TypeError but return a list. Fix: check Number.isInteger on both arguments first.\n");
}
