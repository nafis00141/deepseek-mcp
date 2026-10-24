/**
 * Startup smoke test: boots the real server over stdio (real MCP SDK + zod),
 * lists its tools and calls `version`. Run it after `npm install` or any dependency bump.
 *   npm run smoke
 * Uses a throwaway git repo and a dummy API key; makes no network calls.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CFG } from "../src/config.js"; // resolves git the same way the server does

const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "server.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsmcp-smoke-"));
const git = (...a) => spawnSync(CFG.git, a, { cwd: tmp, encoding: "utf8" });
git("init", "-q");
fs.writeFileSync(path.join(tmp, "f.txt"), "x\n");
git("add", ".");
git("-c", "user.name=smoke", "-c", "user.email=smoke@example.invalid", "commit", "-qm", "init");

const child = spawn(process.execPath, [server], {
  env: { ...process.env, REPO_ROOT: tmp, DEEPSEEK_API_KEY: "smoke-test-key", GIT_BIN: CFG.git },
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
let buf = "";
const pending = new Map();
child.stderr.on("data", (d) => (stderr += d));
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      pending.get(msg.id)?.(msg);
    } catch {
      /* not a JSON-RPC line */
    }
  }
});

const send = (obj) => child.stdin.write(`${JSON.stringify(obj)}\n`);
const request = (id, method, params) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no reply to ${method} within 15s`)), 15000);
    pending.set(id, (m) => {
      clearTimeout(timer);
      m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result);
    });
    send({ jsonrpc: "2.0", id, method, params });
  });

let ok = false;
try {
  await request(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  const tools = (await request(2, "tools/list", {})).tools.map((t) => t.name);
  const want = ["version", "roles", "ping", "handoff", "job_status", "jobs"];
  const missing = want.filter((n) => !tools.includes(n));
  if (missing.length) throw new Error(`missing tools: ${missing.join(", ")} (got: ${tools.join(", ")})`);

  const handoff = (await request(3, "tools/list", {})).tools.find((t) => t.name === "handoff");
  const props = Object.keys(handoff?.inputSchema?.properties ?? {});
  if (!props.includes("role") || !props.includes("target")) throw new Error(`handoff schema looks wrong: ${JSON.stringify(props)}`);

  const info = JSON.parse((await request(4, "tools/call", { name: "version", arguments: {} })).content[0].text);
  if (!info.keyPresent) throw new Error("version reports no API key");
  console.log(`ok: ${tools.length} tools (${tools.join(", ")}); handoff args: ${props.join(", ")}; server ${info.version}; node ${info.node}`);
  ok = true;
} catch (e) {
  console.error(`SMOKE FAILED: ${e.message}`);
  if (stderr.trim()) console.error(`--- server stderr ---\n${stderr.trim()}`);
} finally {
  child.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
