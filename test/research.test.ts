import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { cleanup, exists, finalDone, mkJob, mkRes, put, read, resetRepo, script, sh, tmp, toolCall } from "./helpers.ts";
import { capsFor, executeTool, runAgent } from "../src/engine.ts";
import { citationProblems, gate } from "../src/gates.ts";
import { buildPrompt, ROLES } from "../src/roles.ts";
import { snapshot } from "../src/repo.ts";
import type { ExecResult, Job } from "../src/types.ts";

after(cleanup);
beforeEach(resetRepo);

const refused = (out: { error?: string }, re: RegExp) => assert.match(out.error ?? "(no error)", re);
const SOURCE = ["'use strict';", "const MAX_RETRIES = 5;", "const BASE_DELAY_MS = 250;", "function wait(n) { return BASE_DELAY_MS * 2 ** n; }", "module.exports = { MAX_RETRIES, wait };"].join("\n") + "\n";

describe("research caps", () => {
  const caps = capsFor("research", ROLES.research, null, "specs/topic");

  it("can write exactly <target>/research.md, and nothing else, not even other files under specs/", async () => {
    assert.equal((await executeTool("write_file", { path: "specs/topic/research.md", content: "# x" }, caps)).error, undefined);
    assert.equal((await executeTool("edit_file", { path: "specs/topic/research.md", old: "# x", new: "# y" }, caps)).error, undefined);
    assert.equal(read("specs/topic/research.md"), "# y");
    for (const p of ["specs/topic/notes.md", "specs/other/research.md", "specs/topic/sub/research.md", "specs/.jobs/aaaaaaaa.json", "src/a.js", "package.json", "../escape.md"]) {
      refused(await executeTool("write_file", { path: p, content: "x" }, caps), /not permitted/);
    }
    assert.ok(!exists("specs/topic/notes.md") && !exists("specs/other/research.md"));
  });

  it("reads the repository but never .env, and has no test command", async () => {
    put("src/retry.js", SOURCE);
    const read1 = await executeTool("read_file", { path: "src/retry.js" }, caps);
    assert.equal(read1.error, undefined);
    refused(await executeTool("read_file", { path: ".env" }, caps), /not permitted/);
    refused(await executeTool("run_tests", {}, caps), /no test command/);
  });

  it("fails closed: with no target it gets no write access at all", async () => {
    const none = capsFor("research", ROLES.research, null);
    assert.deepEqual(none.write, []);
    refused(await executeTool("write_file", { path: "specs/topic/research.md", content: "x" }, none), /read-only/);
  });

  it("a trailing slash or backslashes in the target do not widen the scope", () => {
    assert.deepEqual(capsFor("research", ROLES.research, null, "specs/topic/").write, ["specs/topic/research.md"]);
    assert.deepEqual(capsFor("research", ROLES.research, null, "specs\\topic").write, ["specs/topic/research.md"]);
  });

  it("the prompt states the one writable file, the citation form, the quote rule and the NOT FOUND outcome", () => {
    const p = buildPrompt("research", { target: "specs/topic", instruction: "What is the retry limit?" });
    for (const piece of ["Question: What is the retry limit?", "exactly one file: specs/topic/research.md", "## Evidence", "path:line", "at least 3 distinct citations", "NOT FOUND:"]) assert.ok(p.includes(piece), piece);
  });
});

describe("research through the agent loop (mock model)", () => {
  it("writes research.md, is refused when it tries to write source or a sibling file, and the trace marks both refusals as write denials", async () => {
    put("src/retry.js", SOURCE);
    const events: { type: string; denied?: unknown; name?: string }[] = [];
    script.push(
      toolCall("read_file", { path: "src/retry.js" }),
      toolCall("write_file", { path: "src/retry.js", content: "// rewritten\n" }),
      toolCall("write_file", { path: "specs/topic/notes.md", content: "scratch" }),
      toolCall("write_file", { path: "specs/topic/research.md", content: "# R\n" }),
      finalDone,
    );
    const out = await runAgent({ prompt: "go", caps: capsFor("research", ROLES.research, null, "specs/topic"), logPath: path.join(tmp, "research.log"), trace: (e) => void events.push(e as never) });
    assert.equal(out.exhausted, false);
    assert.equal(read("src/retry.js"), SOURCE, "the source file is untouched");
    assert.ok(exists("specs/topic/research.md") && !exists("specs/topic/notes.md"));
    assert.deepEqual(events.filter((e) => e.type === "tool").map((e) => [e.name, e.denied]), [["read_file", false], ["write_file", "write"], ["write_file", "write"], ["write_file", false]]);
  });
});

describe("citation check", () => {
  beforeEach(() => put("src/retry.js", SOURCE));

  it("resolves path:line and path:start-end, counting a citation once however often it is repeated", () => {
    const c = citationProblems("Retries are capped at src/retry.js:2, again src/retry.js:2, and `src/retry.js:3`; the wait is src/retry.js:4-5.");
    assert.deepEqual([c.total, c.distinct, c.unresolved.length], [4, 3, 0]);
    assert.deepEqual(c.resolved, ["src/retry.js:2", "src/retry.js:3", "src/retry.js:4-5"]);
  });

  it("flags a line past the end, a missing file, a read-denied file, an escape, and a bad range", () => {
    put("config/.env.local", "SECRET=1\n");
    const c = citationProblems("a src/retry.js:99 b src/none.js:1 c config/.env.local:1 d src/retry.js:5-2 e ../outside.txt:1 f src/retry.js:0");
    const why = Object.fromEntries(c.unresolved.map((u) => [u.cite, u.why]));
    assert.match(why["src/retry.js:99"] ?? "", /line outside the file \(5 lines\)/);
    assert.match(why["src/none.js:1"] ?? "", /no such file/);
    assert.match(why["config/.env.local:1"] ?? "", /not readable/);
    assert.match(why["src/retry.js:5-2"] ?? "", /line outside/);
    assert.match(why["../outside.txt:1"] ?? "", /escapes the repo/);
    assert.match(why["src/retry.js:0"] ?? "", /line outside/);
    assert.equal(c.distinct, 0);
  });

  it("a quote straight after a citation must be on the cited line; a wrong quote is reported, a right one is not", () => {
    const c = citationProblems("Evidence: src/retry.js:2 `const MAX_RETRIES = 5;` and src/retry.js:3 `const MAX_RETRIES = 9;` and `src/retry.js:4` - `BASE_DELAY_MS * 2 ** n`");
    assert.deepEqual(c.quote_mismatches, ["src/retry.js:3"]);
    assert.equal(c.distinct, 3);
  });

  it("quote matching ignores whitespace differences, and a range may carry its quote on any of its lines", () => {
    const c = citationProblems("src/retry.js:2-3 `BASE_DELAY_MS    =   250`");
    assert.deepEqual(c.quote_mismatches, []);
  });

  it("ignores URLs and things that only look like citations", () => {
    const c = citationProblems("See https://example.com/docs/a.js:10 and http://localhost:3000/x.html:2, time 10:30, node:test, or v1.2:3.");
    assert.equal(c.total, 0);
  });

  it("recognises a NOT FOUND line (bullets and bold included) and nothing else", () => {
    assert.equal(citationProblems("## Findings\nNOT FOUND: a rate limit; searched src/retry.js:1").not_found, true);
    assert.equal(citationProblems("- **NOT FOUND:** nothing").not_found, true);
    assert.equal(citationProblems("- NOT FOUND: x").not_found, true);
    assert.equal(citationProblems("NOT FOUND without the colon").not_found, false, "the marker needs its colon");
    assert.equal(citationProblems("this was not found anywhere").not_found, false);
    assert.equal(citationProblems("a sentence that says NOT FOUND: mid-line").not_found, false, "the marker starts a line");
  });
});

describe("research gate", () => {
  const job = (over: Partial<Job> = {}) => mkJob({ role: "research", mode: "doc", targetRel: "specs/topic", artifact: "research.md", headings: ROLES.research.headings ?? [], startedChanges: snapshot(), ...over });
  const run = (j: Job, res: Partial<ExecResult> = {}) => gate(j, mkRes({ summary: { status: "done" }, ...res }));
  const doc = (findings: string, evidence: string) => ["# Research", "", "## Question", "What is the retry policy, and where is it set? ".repeat(3), "", "## Findings", findings, "", "## Evidence", evidence, "", "## Open questions", "None.", ""].join("\n");
  const good = doc("The client retries five times (src/retry.js:2); the base wait is 250 ms (src/retry.js:3) and doubles (src/retry.js:4).", "- src/retry.js:2 `MAX_RETRIES = 5`\n- src/retry.js:3 `BASE_DELAY_MS = 250`\n- src/retry.js:4 `2 ** n`");
  // the source file is part of the repo, as it would be in real use: committed, so only the research document counts as a change
  beforeEach(() => {
    put("src/retry.js", SOURCE);
    sh("git", ["add", "-A"]);
    sh("git", ["commit", "-qm", "add retry module"]);
  });

  it("passes a document with the sections and three distinct resolving citations, and reports the counts", async () => {
    const j = job();
    put("specs/topic/research.md", good);
    const out = await run(j);
    assert.deepEqual([out.status, out.reasons], ["done", []]);
    const c = out.citations as { total: number; distinct: number; unresolved: unknown[] };
    assert.deepEqual([c.distinct, c.unresolved.length], [3, 0]);
  });

  it("fails on missing sections, a short document, and no file", async () => {
    const j = job();
    put("specs/topic/research.md", "# R\n## Question\nq\n## Findings\nsrc/retry.js:2 src/retry.js:3 src/retry.js:4\n");
    const out = await run(j);
    assert.match((out.reasons ?? []).join("|"), /missing sections: ## Evidence, ## Open questions/);
    assert.match((out.reasons ?? []).join("|"), /suspiciously short \(\d+ bytes; need 400\)/);
    const none = await run(job({ targetRel: "specs/none" }));
    assert.match((none.reasons ?? []).join("|"), /expected artifact not created/);
  });

  it("fails on an unresolved citation even when three others resolve", async () => {
    const j = job();
    put("specs/topic/research.md", doc(good, "- src/retry.js:2\n- src/retry.js:3\n- src/retry.js:4\n- src/gone.js:7"));
    const out = await run(j);
    assert.equal(out.status, "failed");
    assert.match((out.reasons ?? []).join("|"), /unresolved citation\(s\): src\/gone\.js:7 \(no such file\)/);
  });

  it("fails when the same citation is repeated three times (one distinct citation is not enough)", async () => {
    const j = job();
    put("specs/topic/research.md", doc("It retries (src/retry.js:2).", "src/retry.js:2 src/retry.js:2 src/retry.js:2 " + "padding ".repeat(30)));
    const out = await run(j);
    assert.match((out.reasons ?? []).join("|"), /only 1 distinct resolving citation\(s\); need at least 3/);
  });

  it("fails on a quote that is not on the cited line, even when the same citation was used bare earlier in the document", async () => {
    const j = job();
    put("specs/topic/research.md", good.replace("`MAX_RETRIES = 5`", "`MAX_RETRIES = 50`"));
    const out = await run(j);
    assert.match((out.reasons ?? []).join("|"), /quote not on the cited line: src\/retry\.js:2/);
    assert.equal((out.citations as { distinct: number }).distinct, 3, "the citation still resolves; only its quote is wrong");
  });

  it("an honest NOT FOUND needs only one resolving citation (the place searched), and still none unresolved", async () => {
    const j = job();
    const notFound = doc("NOT FOUND: a per-user rate limit. I searched the retry module (src/retry.js:1-5) and found only the retry cap.", "- src/retry.js:1-5 is the whole module " + "searched thoroughly ".repeat(10));
    put("specs/topic/research.md", notFound);
    assert.equal((await run(j)).status, "done");
    put("specs/topic/research.md", notFound + "\nsee also src/nowhere.js:3\n");
    assert.match(((await run(j)).reasons ?? []).join("|"), /unresolved citation/);
  });

  it("does not commit, and a write outside research.md is still caught by the existing outside-specs check", async () => {
    const j = job();
    put("specs/topic/research.md", good);
    put("src/sneaky.js", "x\n");
    const out = await run(j);
    assert.match((out.reasons ?? []).join("|"), /touched files outside specs\//);
  });
});
