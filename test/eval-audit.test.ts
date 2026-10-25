import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { allowlistFor, audit, privateTerms } from "../eval/audit.ts";
import { removeDir } from "../eval/lib/fixture.ts";
import { privateLabel } from "../eval/lib/privacy.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-audit-")));
after(() => removeDir(root));

const put = (rel: string, content: string): void => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};
const def = (id: string, split: string, instruction = "") => JSON.stringify({ id, family: "x", split, title: id, steps: instruction ? [{ role: "ask", target: "src", instruction }] : [], checks: [], expect: { gate: "done" } });

// one public task, and one private task in each private split
put("eval/tasks/pub-one/task.json", def("pub-one", "dev"));
put("eval/tasks/pub-one/repo/src/shared-name.js", "x\n"); // a fixture path a private task also uses
put("eval/heldout/zz-held-alpha/task.json", def("zz-held-alpha", "heldout", "weigh the crimson lantern against every brass compass in the harbour"));
put("eval/heldout/zz-held-alpha/repo/src/shared-name.js", "x\n");
put("eval/heldout/zz-held-alpha/repo/src/lantern-ledger.js", "x\n"); // private-only path
put("eval/confirm/zz-conf-beta/task.json", def("zz-conf-beta", "confirm"));
put("eval/reserve/zz-res-gamma/task.json", def("zz-res-gamma", "reserve"));
const evalDir = path.join(root, "eval");
const terms = privateTerms(evalDir);

let n = 0;
const runs = (files: Record<string, string>): string => {
  const name = `runs${n++}`;
  for (const [rel, c] of Object.entries(files)) put(`${name}/${rel}`, c);
  return path.join(root, name);
};

describe("audit", () => {
  it("passes a clean runs folder, and ignores private/, heldout-private/, pinned servers and shelved patches", () => {
    const dir = runs({
      "run-a/report.md": "# report\nnothing private here\n",
      "run-a/manifest.json": JSON.stringify({ tasks: [privateLabel("zz-held-alpha")] }),
      "run-a/private/heldout/zz-held-alpha/1/checks.json": "zz-held-alpha lives here, and that is fine",
      "run-a/heldout-private/zz-held-alpha/1/checks.json": "the older folder is private too: zz-held-alpha",
      "run-a/server/src/server.ts": "// mentions zz-conf-beta only because it is a copy of code",
      "shelved/p.patch": "zz-res-gamma",
    });
    const r = audit(dir, terms);
    assert.deepEqual(r.hits, []);
    assert.ok(r.scanned >= 2);
  });

  it("finds a private id, copied instruction text and a private-only fixture path outside private/; reports hashed labels, never the term", () => {
    const dir = runs({
      "run-b/reviewer-bundle.md": "failing run of zz-held-alpha was investigated",
      "run-b.log": "step: Weigh the crimson lantern against every BRASS compass in the harbour!\n",
      "run-c/notes.txt": "the file src/lantern-ledger.js was edited",
      "run-c/confirm.txt": "ZZ-CONF-BETA passed",
      "run-c/reserve.txt": "zz-res-gamma was promoted",
    });
    const r = audit(dir, terms);
    const byFile = Object.fromEntries(r.hits.map((h) => [h.file, `${h.kind}|${h.label}`]));
    const heldLabel = privateLabel("zz-held-alpha");
    assert.equal(byFile["run-b/reviewer-bundle.md"], `task id|${heldLabel}`);
    assert.equal(byFile["run-b.log"], `instruction text|${heldLabel}`);
    assert.equal(byFile["run-c/notes.txt"], `private fixture path|${heldLabel}`);
    assert.equal(byFile["run-c/confirm.txt"], `task id|${privateLabel("zz-conf-beta")}`);
    assert.equal(byFile["run-c/reserve.txt"], `task id|${privateLabel("zz-res-gamma")}`);
    assert.ok(!JSON.stringify(r.hits).match(/zz-|lantern|crimson/i), "the report itself contains no private term");
  });

  it("a fixture path that a public task also has is not treated as private", () => {
    const dir = runs({ "run-d/log.txt": "edited src/shared-name.js" });
    assert.deepEqual(audit(dir, terms).hits, []);
  });

  it("an allowlisted file passes only while its content hash matches", () => {
    const dir = runs({ "old-run/old.log": "the old log names zz-held-alpha", "old-run/other.log": "zz-held-alpha again" });
    const first = audit(dir, terms);
    assert.equal(first.hits.length, 2);
    const allow = allowlistFor(dir, first.hits.filter((h) => h.file === "old-run/old.log"));
    assert.deepEqual(allow.map((a) => a.file), ["old-run/old.log"]);
    const second = audit(dir, terms, allow);
    assert.deepEqual(second.hits.map((h) => h.file), ["old-run/other.log"]);
    assert.equal(second.allowed, 1);
    fs.appendFileSync(path.join(dir, "old-run", "old.log"), "\nedited after it was allowlisted\n");
    assert.equal(audit(dir, terms, allow).hits.length, 2, "a changed file is audited again");
  });

  it("ignores eight-word runs that a public task instruction also contains: found in a public file they prove nothing", () => {
    put("eval2/tasks/pub-q/task.json", def("pub-q", "dev", "tell me which file defines the default timeout and cite the line"));
    put("eval2/confirm/zz-conf-q/task.json", def("zz-conf-q", "confirm", "tell me which file defines the default timeout and also the retry limit in the amber registry"));
    const t2 = privateTerms(path.join(root, "eval2"));
    const dir = runs({ "run-e/prompt.txt": "Please tell me which file defines the default timeout for this client.", "run-e/leak.txt": "and also the retry limit in the amber registry" });
    const hits = audit(dir, t2).hits;
    assert.deepEqual(hits.map((h) => h.file), ["run-e/leak.txt"], "the shared opening is ignored; the private-only wording is still caught");
  });

  it("builds terms from every private split and from no public task", () => {
    const ids = terms.filter((t) => t.kind === "task id").map((t) => t.term).sort();
    assert.deepEqual(ids, ["zz-conf-beta", "zz-held-alpha", "zz-res-gamma"]);
  });
});
