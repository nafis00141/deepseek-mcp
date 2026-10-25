import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CFG } from "../src/config.ts";
import { removeDir } from "../eval/lib/fixture.ts";
import { computeLineage, heldoutSetHash } from "../eval/lib/lineage.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-lineage-")));
after(() => removeDir(root));

const put = (base: string, rel: string, content: string): void => {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

describe("lineage", () => {
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo);
  const git = (...args: string[]): string => {
    const r = spawnSync(CFG.git, args, { cwd: repo, encoding: "utf8" });
    assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
    return String(r.stdout).trim();
  };
  const commit = (msg: string): void => {
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", msg);
  };
  git("init", "-q");
  git("symbolic-ref", "HEAD", "refs/heads/main");
  put(repo, "src/a.js", "v1\n");
  put(repo, "README.md", "one\n");
  commit("base");
  const srcTree1 = git("rev-parse", "HEAD:src");

  it("is the src/ tree at the merge-base: candidates cut from the same code share it, whatever else they change", () => {
    git("checkout", "-q", "-b", "cand-a");
    put(repo, "src/a.js", "changed by candidate a\n");
    commit("candidate a");
    const a = computeLineage(CFG.git, repo);
    git("checkout", "-q", "main");
    git("checkout", "-q", "-b", "cand-b");
    put(repo, "src/b.js", "changed by candidate b\n");
    commit("candidate b");
    const b = computeLineage(CFG.git, repo);
    assert.equal(a?.lineage, srcTree1);
    assert.equal(b?.lineage, srcTree1);
    assert.equal(a?.base_branch, "main");
    git("checkout", "-q", "main");
  });

  it("a docs-only commit on the baseline branch moves the merge-base but not the lineage", () => {
    put(repo, "README.md", "two\n");
    commit("docs only");
    git("checkout", "-q", "-b", "cand-c");
    put(repo, "src/a.js", "changed by candidate c\n");
    commit("candidate c");
    const c = computeLineage(CFG.git, repo);
    assert.equal(c?.lineage, srcTree1);
    assert.notEqual(c?.merge_base, git("rev-parse", "main~1"), "the merge-base is the later commit");
    git("checkout", "-q", "main");
  });

  it("a real change to src/ on the baseline branch starts a new lineage", () => {
    put(repo, "src/a.js", "v2\n");
    commit("src change on main");
    const srcTree2 = git("rev-parse", "HEAD:src");
    git("checkout", "-q", "-b", "cand-d");
    put(repo, "src/a.js", "changed by candidate d\n");
    commit("candidate d");
    const d = computeLineage(CFG.git, repo);
    assert.equal(d?.lineage, srcTree2);
    assert.notEqual(srcTree2, srcTree1);
    git("checkout", "-q", "main");
  });

  it("is null when there is no main or master branch", () => {
    const lone = path.join(root, "lone");
    fs.mkdirSync(lone);
    spawnSync(CFG.git, ["init", "-q"], { cwd: lone });
    spawnSync(CFG.git, ["symbolic-ref", "HEAD", "refs/heads/trunk"], { cwd: lone });
    put(lone, "src/a.js", "x\n");
    spawnSync(CFG.git, ["add", "-A"], { cwd: lone });
    spawnSync(CFG.git, ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", "x"], { cwd: lone });
    assert.equal(computeLineage(CFG.git, lone), null);
  });
});

describe("held-out set hash", () => {
  const dir = path.join(root, "heldout");
  const def = (id: string, extra = "") => JSON.stringify({ id, family: "x", split: "heldout", title: `${id}${extra}`, steps: [], checks: [], expect: { gate: "done" } });

  it("is stable, ignores order, and changes when any task or the set changes; null for an empty set", () => {
    assert.equal(heldoutSetHash(path.join(root, "no-such-folder")), null);
    put(dir, "h1/task.json", def("h1"));
    put(dir, "h2/task.json", def("h2"));
    const first = heldoutSetHash(dir)!;
    assert.deepEqual([first.count, heldoutSetHash(dir)?.hash === first.hash], [2, true]);
    put(dir, "h2/task.json", def("h2", " edited"));
    const edited = heldoutSetHash(dir)!;
    assert.notEqual(edited.hash, first.hash);
    put(dir, "h3/task.json", def("h3"));
    const grown = heldoutSetHash(dir)!;
    assert.deepEqual([grown.count, grown.hash !== edited.hash], [3, true]);
    fs.rmSync(path.join(dir, "h3"), { recursive: true });
    assert.equal(heldoutSetHash(dir)?.hash, edited.hash, "removing the added task restores the previous hash");
  });
});
