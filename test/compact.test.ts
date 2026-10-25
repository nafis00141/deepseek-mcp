import "./helpers.ts";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { bodies, CFG, cleanup, finalDone, put, resetRepo, script, tmp, toolCall } from "./helpers.ts";
import { KEEP_CHARS, compactLegacy, createCompactor } from "../src/compact.ts";
import { capsFor, runAgent } from "../src/engine.ts";
import type { ChatMessage } from "../src/engine.ts";
import { mkTask } from "./helpers.ts";
import { ROLES } from "../src/roles.ts";

after(cleanup);
beforeEach(resetRepo);

/** The original `compact()` from src/engine.ts before it moved, frozen here as the oracle. Do not edit it. */
function oracleCompact(messages: ChatMessage[], budget = 220000): ChatMessage[] {
  let size = JSON.stringify(messages).length;
  if (size <= budget) return messages;
  for (let i = 2; i < messages.length - 6 && size > budget; i++) {
    const m = messages[i] as ChatMessage;
    if (m.role === "tool" && typeof m.content === "string" && m.content.length > 3000) {
      const cut = m.content.length - 3000;
      m.content = m.content.slice(0, 3000) + `\n[truncated ${cut} chars]`;
      size -= cut;
    }
  }
  return messages;
}

/** A conversation the way the loop grows it: system, task, then (assistant tool call, tool result)* and sometimes a user repair. */
function growth(resultSizes: number[], extras: { repairAt?: number[]; shortFinalAt?: number[] } = {}): ChatMessage[][] {
  const steps: ChatMessage[][] = [[{ role: "system", content: "sys" }, { role: "user", content: "do the task" }]];
  resultSizes.forEach((n, i) => {
    steps.push([
      { role: "assistant", content: null, tool_calls: [{ id: `c${i}`, type: "function", function: { name: "read_file", arguments: "{}" } }], ...(i % 3 === 0 ? { reasoning_content: "thinking ".repeat(40) } : {}) },
      { role: "tool", tool_call_id: `c${i}`, content: JSON.stringify({ content: "x".repeat(n) }) },
    ]);
    if (extras.repairAt?.includes(i)) steps.push([{ role: "user", content: "repair please" }]);
    if (extras.shortFinalAt?.includes(i)) steps.push([{ role: "assistant", content: "ok" }]);
  });
  return steps;
}

/** Run the oracle and the new compactor the way the engine does: the same growing array, called every turn, return value ignored. */
function runBoth(steps: ChatMessage[][], budget: number): { oracle: ChatMessage[]; mine: ChatMessage[]; turnsCompared: number } {
  const oracle: ChatMessage[] = [];
  const mine: ChatMessage[] = [];
  const compactor = createCompactor({ contextMode: "legacy", compactChars: budget });
  let turns = 0;
  for (const step of steps) {
    for (const m of step) {
      oracle.push(structuredClone(m));
      mine.push(structuredClone(m));
    }
    const a = oracleCompact(oracle, budget);
    const b = compactor(mine);
    assert.strictEqual(a, oracle, "the oracle returns the array it was given");
    assert.strictEqual(b, mine, "so does the new compactor");
    assert.equal(JSON.stringify(mine), JSON.stringify(oracle), `arrays differ after turn ${turns}`);
    turns++;
  }
  return { oracle, mine, turnsCompared: turns };
}

describe("legacy compaction is the original, unchanged", () => {
  const shapes: [string, number[], number, Parameters<typeof growth>[1]][] = [
    ["a short conversation under the budget", [100, 200, 50], 220000, {}],
    ["results just under and just over the 3,000 boundary", [2990, 3000, 3001, 3002, 3100, 2999, 3001, 3001, 3001, 3001], 6000, {}],
    ["many large results with a small budget", Array.from({ length: 25 }, (_, i) => 5000 + i * 700), 20000, {}],
    ["the default budget, long conversation", Array.from({ length: 30 }, (_, i) => 20000 + (i % 4) * 5000), 220000, {}],
    ["repair turns and short assistant messages mixed in", Array.from({ length: 14 }, (_, i) => 4000 + i * 300), 15000, { repairAt: [3, 9], shortFinalAt: [5] }],
    ["the smallest allowed budget", Array.from({ length: 12 }, () => 3500), 1000, {}],
    ["one huge result", [900000, 100, 100, 100, 100, 100, 100, 100], 220000, {}],
    ["fewer messages than the protected tail", [50000, 50000], 1000, {}],
  ];
  for (const [name, sizes, budget, extras] of shapes) {
    it(`identical on every turn: ${name}`, () => {
      const r = runBoth(growth(sizes, extras), budget);
      assert.ok(r.turnsCompared > 1);
    });
  }

  it("really cuts, re-cuts and lets the marker drift as before (so the oracle comparison is not vacuous)", () => {
    const r = runBoth(growth(Array.from({ length: 12 }, () => 8000)), 30000);
    const tools = r.mine.filter((m) => m.role === "tool").map((m) => String(m.content));
    const cut = tools.filter((c) => c.includes("[truncated "));
    assert.ok(cut.length >= 3, "several results were cut");
    assert.ok(cut.every((c) => c.startsWith(JSON.stringify({ content: "x".repeat(8000) }).slice(0, 100))), "cut results keep their first characters");
    assert.ok(cut.some((c) => c.length > KEEP_CHARS), "a cut message is still over the limit, which is why the old code re-cuts it");
    assert.deepEqual(r.mine.slice(0, 2).map((m) => m.role), ["system", "user"]);
    assert.ok(r.mine.slice(-6).every((m) => !String(m.content ?? "").includes("[truncated ")), "the last six messages are never cut");
  });

  it("compactLegacy takes the budget as given", () => {
    const msgs = growth([6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000]).flat();
    const copy = structuredClone(msgs);
    assert.equal(JSON.stringify(compactLegacy(structuredClone(msgs), 10_000_000)), JSON.stringify(copy), "under the budget nothing changes");
    assert.notEqual(JSON.stringify(compactLegacy(structuredClone(msgs), 20_000)), JSON.stringify(copy));
  });

  it("only the legacy mode exists until the extended modes are built", () => {
    assert.throws(() => createCompactor({ contextMode: "extended", compactChars: 220000 }), /not built yet/);
  });
});

describe("COMPACT_CHARS is the legacy budget, wired through the agent loop", () => {
  const logPath = () => path.join(tmp, "compact.log");
  const caps = () => capsFor("impl", ROLES.impl, mkTask({ allowedPaths: ["src/**"], testCommand: "echo ok" }));
  const bigLine = (i: number) => `line ${i} ${"y".repeat(60)}`;

  async function run(compactChars: number) {
    put("src/big.txt", Array.from({ length: 300 }, (_, i) => bigLine(i)).join("\n")); // about 20,000 characters, read in one call
    script.push(
      ...Array.from({ length: 6 }, () => toolCall("read_file", { path: "src/big.txt" })),
      finalDone,
    );
    const saved = CFG.compactChars;
    CFG.compactChars = compactChars;
    try {
      return await runAgent({ prompt: "go", caps: caps(), logPath: logPath() });
    } finally {
      CFG.compactChars = saved;
    }
  }

  it("a small budget makes the loop send cut tool results; the default does not", async () => {
    const out = await run(30000);
    assert.equal(out.exhausted, false);
    const last = JSON.stringify(bodies.at(-1));
    assert.match(last, /\[truncated \d+ chars\]/);
    resetRepo();
    const calm = await run(220000);
    assert.equal(calm.exhausted, false);
    assert.doesNotMatch(JSON.stringify(bodies.at(-1)), /\[truncated \d+ chars\]/, "six 20,000-character reads fit under the default budget");
  });
});
