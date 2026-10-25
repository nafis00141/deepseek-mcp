import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { bodies, CFG, cleanup, finalDone, gitOut, mkJob, mkRes, mkTask, put, resetRepo, script, sh, tmp, toolCall } from "./helpers.ts";
import { CONTEXT_MARGIN_TOKENS, loadContextSettings } from "../src/config.ts";
import { capsFor, executeTool, packResult, runAgent } from "../src/engine.ts";
import { gate } from "../src/gates.ts";
import { commit, snapshot } from "../src/repo.ts";
import { ROLES } from "../src/roles.ts";

after(cleanup);
beforeEach(resetRepo);

const logPath = () => path.join(tmp, "context.log");
const implCaps = () => capsFor("impl", ROLES.impl, mkTask({ allowedPaths: ["src/**"], testCommand: "echo ok" }));

/** Run `fn` with some CFG fields changed, and put them back whatever happens. */
async function withCfg<T>(over: Partial<typeof CFG>, fn: () => Promise<T> | T): Promise<T> {
  const saved = Object.fromEntries(Object.keys(over).map((k) => [k, (CFG as unknown as Record<string, unknown>)[k]]));
  Object.assign(CFG, over);
  try {
    return await fn();
  } finally {
    Object.assign(CFG, saved);
  }
}

describe("context settings: loading and validation", () => {
  it("with nothing set, every limit is the value that used to be hard-coded", () => {
    assert.deepEqual(loadContextSettings({}, 32000), {
      contextMode: "legacy", compactChars: 220000, compactLow: 0, contextTokens: 0, contextWindow: 0,
      readBudgetChars: 30000, readMaxLines: 400, resultLimitChars: 45000, maxRequestBytes: 0, jobInputTokenCap: 0,
    });
    // the running server was started with the test environment, which sets none of them
    assert.deepEqual([CFG.contextMode, CFG.compactChars, CFG.readBudgetChars, CFG.readMaxLines, CFG.resultLimitChars, CFG.jobInputTokenCap, CFG.maxRequestBytes], ["legacy", 220000, 30000, 400, 45000, 0, 0]);
  });

  it("an empty variable counts as unset; valid values are read", () => {
    assert.equal(loadContextSettings({ COMPACT_CHARS: "", CONTEXT_MODE: "  " }, 32000).compactChars, 220000);
    const s = loadContextSettings({ CONTEXT_MODE: "Extended", COMPACT_CHARS: "1500000", COMPACT_LOW: "0.7", READ_BUDGET_CHARS: "200000", READ_MAX_LINES: "5000", RESULT_LIMIT_CHARS: "300000", MAX_REQUEST_BYTES: "4000000", JOB_INPUT_TOKEN_CAP: "6000000", CONTEXT_TOKENS: "250000", CONTEXT_WINDOW: "1000000" }, 32000);
    assert.deepEqual([s.contextMode, s.compactChars, s.compactLow, s.readBudgetChars, s.readMaxLines, s.resultLimitChars, s.maxRequestBytes, s.jobInputTokenCap, s.contextTokens, s.contextWindow], ["extended", 1500000, 0.7, 200000, 5000, 300000, 4000000, 6000000, 250000, 1000000]);
  });

  it("refuses bad values and names every one of them", () => {
    const err = (e: Record<string, string>, mt = 32000): string => {
      try {
        loadContextSettings(e, mt);
      } catch (x) {
        return (x as Error).message;
      }
      return "(accepted)";
    };
    assert.match(err({ CONTEXT_MODE: "fast" }), /CONTEXT_MODE="fast" must be legacy or extended/);
    assert.match(err({ COMPACT_CHARS: "12.5" }), /COMPACT_CHARS="12.5" must be an integer/);
    assert.match(err({ COMPACT_CHARS: "0" }), /COMPACT_CHARS="0" must be an integer from 1000/);
    assert.match(err({ READ_MAX_LINES: "-3" }), /READ_MAX_LINES/);
    assert.match(err({ READ_BUDGET_CHARS: "abc" }), /READ_BUDGET_CHARS/);
    assert.match(err({ COMPACT_LOW: "0" }), /COMPACT_LOW="0" must be a number above 0 and at most 1/);
    assert.match(err({ COMPACT_LOW: "1.5" }), /COMPACT_LOW/);
    assert.match(err({ JOB_INPUT_TOKEN_CAP: "-1" }), /JOB_INPUT_TOKEN_CAP/);
    const many = err({ COMPACT_CHARS: "x", READ_MAX_LINES: "y" });
    assert.match(many, /COMPACT_CHARS/);
    assert.match(many, /READ_MAX_LINES/);
    assert.equal(err({ JOB_INPUT_TOKEN_CAP: "0", MAX_REQUEST_BYTES: "0", CONTEXT_TOKENS: "0" }), "(accepted)", "0 means off");
  });

  it("the token budget and the window must be set together and leave room for the reply", () => {
    const err = (e: Record<string, string>, mt = 32000): string => {
      try {
        loadContextSettings(e, mt);
      } catch (x) {
        return (x as Error).message;
      }
      return "(accepted)";
    };
    assert.match(err({ CONTEXT_MODE: "extended", CONTEXT_TOKENS: "250000" }), /must be set together/);
    assert.match(err({ CONTEXT_TOKENS: "250000", CONTEXT_WINDOW: "1000000" }), /CONTEXT_TOKENS needs CONTEXT_MODE=extended/);
    assert.match(err({ CONTEXT_MODE: "extended", CONTEXT_WINDOW: "1000000" }), /must be set together/);
    assert.equal(err({ CONTEXT_MODE: "extended", CONTEXT_TOKENS: "250000", CONTEXT_WINDOW: "1000000" }), "(accepted)");
    assert.equal(err({ CONTEXT_MODE: "extended", CONTEXT_TOKENS: String(1_000_000 - 32000 - CONTEXT_MARGIN_TOKENS), CONTEXT_WINDOW: "1000000" }), "(accepted)", "exactly fits");
    assert.match(err({ CONTEXT_MODE: "extended", CONTEXT_TOKENS: String(1_000_000 - 32000 - CONTEXT_MARGIN_TOKENS + 1), CONTEXT_WINDOW: "1000000" }), /does not fit in CONTEXT_WINDOW/);
    assert.match(err({ CONTEXT_MODE: "extended", CONTEXT_TOKENS: "100000", CONTEXT_WINDOW: "128000" }, 32000), /does not fit/);
  });
});

describe("read and result caps", () => {
  const big = Array.from({ length: 3000 }, (_, i) => `line ${i + 1} ${"x".repeat(20)}`).join("\n");

  it("defaults: 400 lines per call, and paging reaches the end", async () => {
    put("src/big.txt", big);
    const first = await executeTool("read_file", { path: "src/big.txt" }, implCaps());
    assert.deepEqual([first.from, first.to, first.total_lines], [1, 400, 3000]);
    assert.match(String(first.more), /start=401/);
    let at = 1;
    let calls = 0;
    for (;;) {
      const r = await executeTool("read_file", { path: "src/big.txt", start: at }, implCaps());
      calls++;
      if (!r.more) break;
      at = Number(r.to) + 1;
    }
    assert.equal(calls, 8);
  });

  for (const factor of [5, 20]) {
    it(`raised caps (${factor}x) read more per call and paging still reaches the end`, async () => {
      put("src/big.txt", big);
      await withCfg({ readMaxLines: 400 * factor, readBudgetChars: 30000 * factor }, async () => {
        const first = await executeTool("read_file", { path: "src/big.txt" }, implCaps());
        assert.equal(first.from, 1);
        assert.ok(Number(first.to) > 400, `to=${String(first.to)}`);
        let at = 1;
        let last = 0;
        for (let i = 0; i < 20; i++) {
          const r = await executeTool("read_file", { path: "src/big.txt", start: at }, implCaps());
          last = Number(r.to);
          if (!r.more) break;
          at = last + 1;
        }
        assert.equal(last, 3000);
      });
    });
  }

  it("a single over-long line is sliced in legacy mode and cut with a visible marker in extended mode", async () => {
    put("src/long.txt", `${"y".repeat(500)}\nshort\n`);
    await withCfg({ readBudgetChars: 100 }, async () => {
      const legacy = String((await executeTool("read_file", { path: "src/long.txt" }, implCaps())).content);
      assert.equal(legacy.split("\n")[0], `1\t${"y".repeat(98)}`, "legacy slices the numbered line at the budget");
    });
    await withCfg({ readBudgetChars: 100, contextMode: "extended" }, async () => {
      const ext = String((await executeTool("read_file", { path: "src/long.txt" }, implCaps())).content);
      assert.match(ext.split("\n")[0] ?? "", /\[line cut at 100 chars\]$/);
    });
  });

  it("the tool result limit is a setting; an oversize result stays valid JSON", async () => {
    const parsed = JSON.parse(packResult({ x: "a".repeat(60000) })) as { error: string };
    assert.match(parsed.error, /result too large/);
    await withCfg({ resultLimitChars: 100000 }, () => {
      assert.equal(JSON.parse(packResult({ x: "a".repeat(60000) })).x.length, 60000);
    });
  });
});

describe("job input-token guard and request size check", () => {
  const usage = (n: number) => ({ prompt_tokens: n, completion_tokens: 1 });

  it("off by default: the loop is limited by turns only", async () => {
    script.push({ ...toolCall("list_dir", { path: "." }), usage: usage(900000) }, { ...finalDone, usage: usage(900000) });
    const out = await runAgent({ prompt: "go", caps: implCaps(), logPath: logPath() });
    assert.deepEqual([out.exhausted, out.exhaustedReason, out.turns], [false, undefined, 2]);
  });

  it("stops before the next request once the reported input tokens reach the cap, with the reason", async () => {
    script.push({ ...toolCall("list_dir", { path: "." }), usage: usage(20) }, { ...toolCall("list_dir", { path: "." }), usage: usage(20) }, { ...toolCall("list_dir", { path: "." }), usage: usage(20) }, finalDone);
    const out = await withCfg({ jobInputTokenCap: 30 }, () => runAgent({ prompt: "go", caps: implCaps(), logPath: logPath() }));
    assert.deepEqual([out.exhausted, out.exhaustedReason, out.turns, out.usage.input], [true, "input_tokens", 2, 40]);
    assert.equal(bodies.length, 2, "no third request was sent");
  });

  it("an exhausted code job still reaches the gate and is failed with the cap named; nothing else about the commit rules changes", async () => {
    sh("git", ["checkout", "-q", "-b", "do/abc12345-x"]);
    const startedSha = gitOut("rev-parse", "HEAD");
    const startedChanges = snapshot();
    put("src/lib/a.js", "export const a = 1;\n");
    commit(["src/lib/a.js"], "task-do: do");
    const job = mkJob({ role: "do", mode: "code", targetRel: "src/lib", branch: "do/abc12345-x", synthetic: true, allowedPaths: ["src/lib/**"], testCommand: "node --version", startedSha, startedChanges, commit: "x", commitError: null });
    const out = await withCfg({ jobInputTokenCap: 30 }, () => gate(job, mkRes({ exhausted: true, exhaustedReason: "input_tokens", usage: { input: 40, output: 1 } })));
    assert.equal(out.status, "failed");
    assert.match((out.reasons ?? []).join("|"), /hit JOB_INPUT_TOKEN_CAP \(30 input tokens, 40 used\) without finishing/);
    assert.doesNotMatch((out.reasons ?? []).join("|"), /MAX_TURNS/);
    const turns = await gate(job, mkRes({ exhausted: true, exhaustedReason: "turns" }));
    assert.match((turns.reasons ?? []).join("|"), /hit MAX_TURNS/);
  });

  it("refuses to send a request body over MAX_REQUEST_BYTES, and sends nothing", async () => {
    script.push(finalDone);
    const refused = await withCfg({ maxRequestBytes: 1000 }, () => runAgent({ prompt: "z".repeat(5000), caps: implCaps(), logPath: logPath() }));
    assert.deepEqual([refused.exhausted, refused.exhaustedReason, refused.turns], [true, "request_size", 0], "the job ends as exhausted, so it is scored as a failure and not dropped as infrastructure");
    assert.equal(bodies.length, 0);
    const ok = await runAgent({ prompt: "z".repeat(5000), caps: implCaps(), logPath: logPath() });
    assert.equal(ok.exhausted, false, "with the check off the same request is sent");
    const gateOut = await withCfg({ maxRequestBytes: 1000 }, async () => {
      sh("git", ["checkout", "-q", "-b", "do/abc12345-y"]);
      const startedSha = gitOut("rev-parse", "HEAD");
      const startedChanges = snapshot();
      put("src/lib/b.js", "export const b = 1;\n");
      commit(["src/lib/b.js"], "task-do: do");
      return gate(mkJob({ role: "do", mode: "code", targetRel: "src/lib", branch: "do/abc12345-y", synthetic: true, allowedPaths: ["src/lib/**"], testCommand: "node --version", startedSha, startedChanges, commit: "x", commitError: null }), mkRes({ exhausted: true, exhaustedReason: "request_size" }));
    });
    assert.match((gateOut.reasons ?? []).join("|"), /next request would exceed MAX_REQUEST_BYTES \(1000 bytes\)/);
  });
});
