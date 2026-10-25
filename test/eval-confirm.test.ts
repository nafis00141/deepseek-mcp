import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { CFG } from "../src/config.ts";
import { looksSinceRotation, readConfirmLog, renderConfirm, runConfirm } from "../eval/confirm.ts";
import type { ConfirmLogEntry, ConfirmOpts } from "../eval/confirm.ts";
import { removeDir } from "../eval/lib/fixture.ts";
import type { Pricing } from "../eval/lib/types.ts";
import { findSecret } from "../eval/run.ts";

const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsev-confirm-")));
const open: (() => Promise<void>)[] = [];
after(async () => {
  for (const c of open) await c();
  removeDir(root);
});

const REPO = path.resolve(import.meta.dirname, "..");
const put = (rel: string, content: string): void => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
};

const SECRET_TASKS = ["zz-conf-alpha", "zz-conf-beta", "zz-conf-gamma", "zz-conf-delta"];

async function stub(): Promise<{ url: string; seen: number }> {
  const state = { url: "", seen: 0 };
  const server = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      state.seen++;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: 'src/a.js:1 an answer long enough.\n```json\n{"status":"done","did":[],"not_done":[],"notes":""}\n```' }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  state.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  open.push(() => new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()); }));
  return state;
}

/** An eval dir with four confirmation tasks, and a runs dir with a candidate and a baseline that each carry a pinned server copy. */
function world(name: string, opts: { lineage?: string | null; cost?: number | null; tasks?: string[] } = {}) {
  const evalDir = path.join(root, name, "eval");
  const runsDir = path.join(root, name, "runs");
  for (const id of opts.tasks ?? SECRET_TASKS) {
    put(`${name}/eval/confirm/${id}/task.json`, JSON.stringify({ id, family: "ask", split: "confirm", title: `${id} title`, steps: [{ role: "ask", target: "src", instruction: "What is in a.js?" }], checks: [{ type: "tree_clean", name: `${id}-check` }], expect: { gate: "done" } }));
    put(`${name}/eval/confirm/${id}/repo/src/a.js`, "export const a = 1;\n");
  }
  for (const [run, hash] of [["cand", "hash-cand"], ["base", "hash-base"]] as const) {
    put(`${name}/runs/${run}/manifest.json`, JSON.stringify({ server_hash: hash, ...(opts.lineage === null ? {} : { lineage: opts.lineage ?? "tree-L1" }) }));
    fs.cpSync(path.join(REPO, "src"), path.join(runsDir, run, "server", "src"), { recursive: true });
    fs.copyFileSync(path.join(REPO, "package.json"), path.join(runsDir, run, "server", "package.json"));
  }
  if (opts.cost !== null) put(`${name}/runs/last-usage.json`, JSON.stringify({ runs: 3, mean_tokens: 1000, mean_cost: opts.cost ?? 0.01 }));
  return { evalDir, runsDir };
}

const PRICING: Pricing = { per_million_tokens: { peak: { input_cache_hit: 0, input_cache_miss: 0.3, output: 1.2 }, off_peak: { input_cache_hit: 0, input_cache_miss: 0.15, output: 0.6 } }, use: "peak" };

const baseOpts = (w: { evalDir: string; runsDir: string }, over: Partial<ConfirmOpts> = {}): ConfirmOpts => ({
  rootDir: REPO, evalDir: w.evalDir, runsDir: w.runsDir, candidate: "cand", baseline: "base", final: true, k: 1, maxCost: 2.5, margin: 0.1, yes: true, pricing: PRICING,
  apiKey: "sk-REAL-CONFIRM-KEY-77", upstream: "http://127.0.0.1:9", gitBin: CFG.git, taskTimeoutS: 120, log: () => {}, ...over,
});

describe("refusals (nothing is run, nothing is logged)", () => {
  it("needs --final, --yes, a lineage, pinned server copies, tasks, a cost estimate within the cap, and an unused hash and lineage", async () => {
    const w = world("refuse");
    await assert.rejects(runConfirm(baseOpts(w, { final: false })), /pass --final/);
    await assert.rejects(runConfirm(baseOpts(w, { yes: false })), /--yes/);
    await assert.rejects(runConfirm(baseOpts(w, { maxCost: 0.05 })), /estimated cost \$0\.08 is over the cap \$0\.05/);
    await assert.rejects(runConfirm(baseOpts(w, { candidate: "missing" })), /need a manifest/);
    await assert.rejects(runConfirm(baseOpts(w, { pricing: undefined })), /needs eval\/pricing\.json/);
    await assert.rejects(runConfirm(baseOpts(world("nolineage", { lineage: null }))), /no lineage/);
    await assert.rejects(runConfirm(baseOpts(world("nocost", { cost: null }))), /no cost estimate/);
    await assert.rejects(runConfirm(baseOpts(world("notasks", { tasks: [] }))), /no confirmation tasks/);
    fs.rmSync(path.join(w.runsDir, "base", "server"), { recursive: true });
    await assert.rejects(runConfirm(baseOpts(w)), /no pinned server\/ copy/);
    assert.equal(fs.existsSync(path.join(w.runsDir, "confirm-log.jsonl")), false);
  });

  it("refuses an already confirmed server hash, a lineage that has used its look, and a spent total; a rotation marker restores the total", async () => {
    const entry = (over: Partial<ConfirmLogEntry>): string => JSON.stringify({ ts: "2026-01-01T00:00:00Z", type: "look", lineage: "other", candidate_hash: "x", ...over }) + "\n";
    const w1 = world("seen-hash");
    put("seen-hash/runs/confirm-log.jsonl", entry({ candidate_hash: "hash-cand", lineage: "elsewhere" }));
    await assert.rejects(runConfirm(baseOpts(w1)), /already been confirmed/);
    const w2 = world("seen-lineage");
    put("seen-lineage/runs/confirm-log.jsonl", entry({ lineage: "tree-L1", candidate_hash: "older-hash" }));
    await assert.rejects(runConfirm(baseOpts(w2)), /lineage has already used its 1 confirmation look/);
    const w3 = world("spent");
    put("spent/runs/confirm-log.jsonl", [1, 2, 3].map((i) => entry({ lineage: `l${i}`, candidate_hash: `h${i}` })).join(""));
    await assert.rejects(runConfirm(baseOpts(w3)), /3 confirmation looks since the last rotation are spent/);
    const log = readConfirmLog(path.join(w3.runsDir, "confirm-log.jsonl"));
    assert.equal(looksSinceRotation(log).length, 3);
    const withRotation: ConfirmLogEntry[] = [...log, { ts: "t", type: "rotation" }, { ts: "t", type: "look", lineage: "z" }];
    assert.equal(looksSinceRotation(withRotation).length, 1, "only looks after the last rotation count");
  });
});

describe("a confirmation run", () => {
  it("runs both arms from the pinned copies, reports aggregates only, logs the look, and leaks no task or check name", async () => {
    const w = world("run");
    const up = await stub();
    const lines: string[] = [];
    const r = await runConfirm(baseOpts(w, { upstream: up.url, log: (l) => lines.push(l) }));
    const text = renderConfirm(r);
    assert.deepEqual([r.tasks, r.k, r.baseline.hidden_pass, r.candidate.hidden_pass, r.mean_task_change], [4, 1, 1, 1, 0]);
    assert.equal(r.improvement_significant, false);
    assert.equal(r.non_inferiority.non_inferior, true, "four unchanged tasks with a 0.1 margin show non-inferiority (p = 1/16)");
    assert.match(text, /Confirmation \(aggregate only\): 4 task\(s\), k=1, two arms/);
    assert.ok(up.seen >= 8, "every task ran on both arms through the stub (one request each)");

    const everything = [text, lines.join("\n"), fs.readFileSync(path.join(w.runsDir, "confirm-log.jsonl"), "utf8"), JSON.stringify(r)].join("\n");
    for (const name of [...SECRET_TASKS, ...SECRET_TASKS.map((t) => `${t}-check`), ...SECRET_TASKS.map((t) => `${t} title`)]) assert.ok(!everything.includes(name), `${name} must not appear in the output, console log or confirm log`);

    const log = readConfirmLog(path.join(w.runsDir, "confirm-log.jsonl"));
    assert.equal(log.length, 1);
    assert.deepEqual([log[0]?.type, log[0]?.lineage, log[0]?.candidate_hash, log[0]?.baseline_hash, log[0]?.tasks, log[0]?.k], ["look", "tree-L1", "hash-cand", "hash-base", 4, 1]);
    assert.equal(log[0]?.result?.non_inferior, true);

    const confirmRuns = fs.readdirSync(w.runsDir).filter((n) => n.startsWith("confirm-") && !n.endsWith(".jsonl"));
    assert.equal(confirmRuns.length, 2);
    for (const run of confirmRuns) assert.ok(fs.existsSync(path.join(w.runsDir, run, "private", "confirm")), `${run} keeps its details under private/confirm/`);
    for (const run of confirmRuns) {
      const outside: string[] = [];
      const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (e.name === "private" || e.name === "server" || e.name === "node_modules") continue;
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (SECRET_TASKS.some((t) => fs.readFileSync(p, "utf8").includes(t))) outside.push(e.name);
        }
      };
      walk(path.join(w.runsDir, run));
      assert.deepEqual(outside, [], `${run}: no file outside private/ names a confirmation task`);
    }
    assert.equal(findSecret([w.runsDir], "sk-REAL-CONFIRM-KEY-77"), null, "the key reaches no file");

    // the same candidate again is refused now that its hash is in the log
    await assert.rejects(runConfirm(baseOpts(w, { upstream: up.url })), /already been confirmed/);
  });
});
