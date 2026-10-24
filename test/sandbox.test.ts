import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { cleanup, exists, mkTask, put, read, repo, resetRepo, sh } from "./helpers.ts";
import { capsFor, executeTool } from "../src/engine.ts";
import type { ToolOutput } from "../src/engine.ts";
import { ROLES } from "../src/roles.ts";
import { detectRepoEol } from "../src/repo.ts";

after(cleanup);
beforeEach(resetRepo);

const task = mkTask({ allowedPaths: ["src/**", "tests/**"], testCommand: "echo ok" });
const caps = capsFor("impl", ROLES.impl, task);
const refused = (out: ToolOutput, re: RegExp) => assert.match(out.error ?? "(no error)", re);

describe("write_file sandbox", () => {
  it("writes inside allowed paths and normalises ./", async () => {
    assert.deepEqual(await executeTool("write_file", { path: "src/p.txt", content: "hello" }, caps), { written: "src/p.txt", bytes: 5 });
    assert.deepEqual(await executeTool("write_file", { path: "./src/q.txt", content: "y" }, caps), { written: "src/q.txt", bytes: 1 });
  });

  it("refuses paths outside the allowed set, including traversal", async () => {
    const before = read("package.json");
    refused(await executeTool("write_file", { path: "package.json", content: "{}" }, caps), /not permitted/);
    refused(await executeTool("write_file", { path: "../escape.txt", content: "x" }, caps), /not permitted/);
    refused(await executeTool("write_file", { path: "src/../package.json", content: "PWNED" }, caps), /not permitted/);
    assert.equal(read("package.json"), before);
  });

  it("never writes env files, and code roles cannot write specs/", async () => {
    refused(await executeTool("write_file", { path: "src/.env", content: "x" }, caps), /not permitted/);
    const specsTask = capsFor("impl", ROLES.impl, mkTask({ allowedPaths: ["specs/**"] }));
    refused(await executeTool("write_file", { path: "specs/x.md", content: "x" }, specsTask), /not permitted/);
  });

  it("refuses to write through a symlink that leaves the repo", { skip: process.platform === "win32" }, async () => {
    const outside = path.join(repo, "..", "outside");
    fs.mkdirSync(outside, { recursive: true });
    fs.symlinkSync(outside, path.join(repo, "src", "link"));
    refused(await executeTool("write_file", { path: "src/link/x.txt", content: "x" }, caps), /symlink/);
  });
});

describe("read-side tools", () => {
  it("edit_file replaces an exact string and reports a miss", async () => {
    put("src/p.txt", "hello");
    assert.deepEqual(await executeTool("edit_file", { path: "src/p.txt", old: "hello", new: "world" }, caps), { edited: "src/p.txt", bytes: 5 });
    refused(await executeTool("edit_file", { path: "src/p.txt", old: "zzz", new: "y" }, caps), /not found/);
    refused(await executeTool("edit_file", { path: "src/p.txt", old: "", new: "z" }, caps), /must not be empty/);
  });

  it("read_file numbers lines and refuses .env", async () => {
    put("src/p.txt", "world");
    assert.equal((await executeTool("read_file", { path: "src/p.txt" }, caps)).content, "1\tworld");
    refused(await executeTool("read_file", { path: ".env" }, caps), /not permitted/);
  });

  it("grep and list_dir never surface .env", async () => {
    put("src/p.txt", "world");
    assert.equal((await executeTool("grep", { pattern: "world", path: "src" }, caps)).count, 1);
    assert.equal((await executeTool("grep", { pattern: "hunter2" }, caps)).count, 0);
    assert.ok(!((await executeTool("list_dir", { path: "." }, caps)).entries as string[]).includes(".env"));
  });

  it("run_tests runs the declared command", async () => {
    assert.equal((await executeTool("run_tests", {}, caps)).pass, true);
  });
});

describe("line endings", () => {
  it("a multi-line edit matches a CRLF file and leaves it pure CRLF", async () => {
    put("src/crlf.js", "a\r\nb\r\nc\r\n");
    assert.equal((await executeTool("edit_file", { path: "src/crlf.js", old: "a\nb", new: "x\ny" }, caps)).edited, "src/crlf.js");
    assert.equal(read("src/crlf.js"), "x\r\ny\r\nc\r\n");
  });

  it("an LF file stays LF", async () => {
    put("src/lf.js", "a\nb\n");
    await executeTool("edit_file", { path: "src/lf.js", old: "a\nb", new: "x\ny" }, caps);
    assert.equal(read("src/lf.js"), "x\ny\n");
  });

  it("a mixed file is matched exactly, keeps both endings and is never guessed at", async () => {
    put("src/mix.js", "a\r\nb\nc\n");
    assert.equal((await executeTool("edit_file", { path: "src/mix.js", old: "b\nc", new: "B\nC" }, caps)).edited, "src/mix.js");
    assert.equal(read("src/mix.js"), "a\r\nB\nC\n");
    refused(await executeTool("edit_file", { path: "src/mix.js", old: "a\nB", new: "z" }, caps), /not found/);
  });

  it("overwriting a CRLF file keeps CRLF; a new file follows the repo (LF here)", async () => {
    put("src/crlf.js", "a\r\nb\r\n");
    await executeTool("write_file", { path: "src/crlf.js", content: "p\nq\n" }, caps);
    assert.equal(read("src/crlf.js"), "p\r\nq\r\n");
    await executeTool("write_file", { path: "src/fresh.js", content: "n\n" }, caps);
    assert.equal(read("src/fresh.js"), "n\n");
  });

  it("repo EOL detection picks CRLF when most tracked files use it", () => {
    for (let i = 0; i < 12; i++) put(`src/crlf${i}.js`, "a\r\nb\r\n");
    sh("git", ["add", "src"]);
    assert.equal(detectRepoEol(), "\r\n");
  });
});

describe("per-role capabilities", () => {
  it("review is read-only and has no test command", async () => {
    const ro = capsFor("review", ROLES.review, null);
    refused(await executeTool("write_file", { path: "specs/x.md", content: "x" }, ro), /read-only/);
    refused(await executeTool("run_tests", {}, ro), /no test command/);
  });

  it("doc roles write only under specs/", async () => {
    const doc = capsFor("spec", ROLES.spec, null);
    assert.deepEqual(await executeTool("write_file", { path: "specs/demo/spec.md", content: "# x" }, doc), { written: "specs/demo/spec.md", bytes: 3 });
    refused(await executeTool("write_file", { path: "src/nope.ts", content: "x" }, doc), /not permitted/);
    assert.ok(exists("specs/demo/spec.md"));
  });

  it("test role writes tests/ only, and is read-only when the task has no test glob", async () => {
    const t = capsFor("test", ROLES.test, task);
    assert.equal((await executeTool("write_file", { path: "tests/a.test.ts", content: "x" }, t)).error, undefined);
    refused(await executeTool("write_file", { path: "src/a.ts", content: "x" }, t), /not permitted/);
    const noGlob = capsFor("test", ROLES.test, mkTask({ allowedPaths: ["src/**"] }));
    refused(await executeTool("write_file", { path: "src/a.ts", content: "x" }, noGlob), /read-only/);
  });
});
