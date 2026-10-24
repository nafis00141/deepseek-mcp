import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CFG, cleanup, gitOut, put, repo, resetRepo, sh } from "./helpers.ts";
import { packResult } from "../src/engine.ts";
import { buildPrompt } from "../src/roles.ts";
import { buildContextPack } from "../src/context.ts";
import { changedFiles, childEnv, commit, jobDiff, parseSummary, runCmd, snapshot } from "../src/repo.ts";
import { globsOverlap, isTestGlob, matchAny, readTask, scopeProblems } from "../src/taskfile.ts";

after(cleanup);
beforeEach(resetRepo);

describe("globs and scopes", () => {
  it("matchAny follows ** / * semantics and rejects traversal", () => {
    assert.equal(matchAny("src/a/b/x.js", ["src/**/x.js"]), true);
    assert.equal(matchAny("src/x.js", ["src/**/x.js"]), true, "**/ matches zero directories");
    assert.equal(matchAny("src/a/b.ts", ["src/*.ts"]), false, "* stays in one directory");
    assert.equal(matchAny("src/../package.json", ["src/**"]), false);
    assert.equal(matchAny("./src/a", ["src/**"]), true);
  });

  it("globsOverlap and isTestGlob", () => {
    assert.equal(globsOverlap("src/a/**", "src/**"), true);
    assert.equal(globsOverlap("src/a/**", "tests/**"), false);
    assert.equal(isTestGlob("tests/**"), true);
    assert.equal(isTestGlob("specs/**"), false);
  });

  it("scopeProblems rejects catch-all, protected, specs/ and empty scopes", () => {
    for (const bad of [["**"], [".github/**"], ["specs/**"], []]) assert.ok(scopeProblems(bad).length > 0, JSON.stringify(bad));
    assert.deepEqual(scopeProblems(["src/**"]), []);
  });
});

describe("parsing", () => {
  it("parseSummary reads a fenced json block, and returns null without one", () => {
    assert.deepEqual(parseSummary('done\n```json\n{"status":"done","bullets":["a"]}\n```'), { status: "done", bullets: ["a"] });
    assert.equal(parseSummary("no json here"), null);
  });

  it("readTask keeps commas in test_command but still splits allowed_paths", () => {
    put("specs/demo/tasks/00-commas.md", "---\nid: 00\nallowed_paths: [src/**, tests/**]\ntest_command: npm test -- --grep a,b\n---\n# Task\n");
    const t = readTask("specs/demo/tasks/00-commas.md");
    assert.equal(t.testCommand, "npm test -- --grep a,b");
    assert.deepEqual(t.allowedPaths, ["src/**", "tests/**"]);
  });

  it("packResult stays valid JSON when oversized", () => {
    const parsed = JSON.parse(packResult({ x: "a".repeat(60000) })) as { error: string };
    assert.match(parsed.error, /too large/);
  });
});

describe("context pack and prompts", () => {
  it("includes conventions, scripts and the task directory, within budget, without secrets", () => {
    put("CONVENTIONS.md", "Use tabs. Never default-export.\n");
    const pack = buildContextPack({ scope: ["src/**"], targetRel: "specs/demo" });
    assert.match(pack, /Never default-export/);
    assert.match(pack, /npm run test/);
    assert.match(pack, /src\/a\.js/);
    assert.ok(pack.length <= CFG.contextChars);
    assert.ok(!pack.includes("hunter2") && !/(^|\s)\.env(\s|$)/m.test(pack));
  });

  it("CONTEXT_CHARS=0 turns the pack off", () => {
    const saved = CFG.contextChars;
    CFG.contextChars = 0;
    try {
      assert.equal(buildContextPack({ scope: ["src/**"] }), "");
    } finally {
      CFG.contextChars = saved;
    }
  });

  it("buildPrompt appends the pack after the rules, and only when there is one", () => {
    assert.ok(buildPrompt("ask", { instruction: "q", target: "src", pack: "PACKX" }).split("# Context pack")[1]?.includes("PACKX"));
    assert.ok(!buildPrompt("ask", { instruction: "q", target: "src" }).includes("# Context pack"));
  });
});

describe("git helpers", () => {
  it("changedFiles keeps the first path intact and expands untracked directories", () => {
    fs.appendFileSync(path.join(repo, "src/a.js"), "export const b = 2;\n");
    put("specs/demo/spec.md", "# s\n");
    const ch = changedFiles();
    assert.equal(ch.find((c) => c.code === "M")?.file, "src/a.js");
    assert.ok(ch.some((c) => c.file === "specs/demo/spec.md"));
  });

  it("jobDiff lists, shows, pages and reports ranges", () => {
    sh("git", ["checkout", "-q", "-b", "impl/01"]);
    const startedSha = gitOut("rev-parse", "HEAD");
    put("src/feature.js", "export const x = 1;\n");
    commit(["src/feature.js"], "task-01: impl");
    const endSha = gitOut("rev-parse", "HEAD");

    const whole = jobDiff({ startedSha, endSha });
    assert.deepEqual(whole.files, ["src/feature.js"]);
    assert.ok(String(whole.diff).includes("+export const x = 1;") && String(whole.stat).includes("src/feature.js"));

    const pages: string[] = [];
    let next: number | null = 0;
    while (next !== null) {
      const d = jobDiff({ startedSha, endSha }, next, 40) as { diff: string; next_offset: number | null };
      pages.push(d.diff);
      next = d.next_offset;
    }
    assert.equal(pages.join(""), whole.diff, "pages reassemble into the full diff");
    assert.match(String(jobDiff({ startedSha: "" }).error), /no committed code range/);
    assert.equal(jobDiff({ startedSha: endSha, endSha }).empty, true);
  });

  it("snapshot is stable on a clean tree", () => {
    assert.deepEqual(snapshot(), snapshot());
  });
});

describe("test commands", () => {
  it("report pass/fail", async () => {
    assert.equal((await runCmd(`node -e "process.exit(0)"`)).pass, true);
    assert.equal((await runCmd(`node -e "process.exit(3)"`)).pass, false);
  });

  it("do not inherit the API key", async () => {
    assert.equal((await runCmd(`node -e "process.stdout.write(String(process.env.DEEPSEEK_API_KEY))"`)).out, "undefined");
  });

  it("run under the server's own node, not whatever is on PATH", async () => {
    const saved = process.env.PATH;
    process.env.PATH = os.tmpdir(); // like Claude Desktop's PATH: no node on it
    try {
      assert.equal((await runCmd("node --version")).out, process.version);
    } finally {
      process.env.PATH = saved;
    }
  });

  it("get a single PATH spelling", () => {
    process.env.Path = "/should/not/survive"; // Windows sometimes has two spellings
    try {
      const keys = Object.keys(childEnv()).filter((k) => k.toLowerCase() === "path");
      assert.equal(keys.length, 1);
      assert.ok(!(childEnv()[keys[0] as string] ?? "").startsWith("/should/not/survive"));
    } finally {
      delete process.env.Path;
    }
  });
});
