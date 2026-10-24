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
import { CFG } from "../src/config.ts"; // resolves git the same way the server does

const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "server.ts");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsmcp-smoke-"));
const git = (...a: string[]) => spawnSync(CFG.git, a, { cwd: tmp, encoding: "utf8" });
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
interface RpcReply {
  id: number;
  result?: unknown;
  error?: unknown;
}
const pending = new Map<number, (m: RpcReply) => void>();
child.stderr.on("data", (d: Buffer) => (stderr += d));
child.stdout.on("data", (d: Buffer) => {
  buf += d;
  let i: number;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line) as RpcReply;
      pending.get(msg.id)?.(msg);
    } catch {
      /* not a JSON-RPC line */
    }
  }
});

const send = (obj: unknown): void => void child.stdin.write(`${JSON.stringify(obj)}\n`);
const request = <T = unknown>(id: number, method: string, params: unknown): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no reply to ${method} within 15s`)), 15000);
    pending.set(id, (m) => {
      clearTimeout(timer);
      m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result as T);
    });
    send({ jsonrpc: "2.0", id, method, params });
  });

let ok = false;
try {
  await request(1, "initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  interface ToolInfo {
    name: string;
    inputSchema?: { properties?: Record<string, unknown> };
  }
  const tools = (await request<{ tools: ToolInfo[] }>(2, "tools/list", {})).tools.map((t) => t.name);
  const want = ["version", "roles", "ping", "handoff", "job_status", "job_diff", "discard", "jobs"];
  const missing = want.filter((n) => !tools.includes(n));
  if (missing.length) throw new Error(`missing tools: ${missing.join(", ")} (got: ${tools.join(", ")})`);

  const handoff = (await request<{ tools: ToolInfo[] }>(3, "tools/list", {})).tools.find((t) => t.name === "handoff");
  const props = Object.keys(handoff?.inputSchema?.properties ?? {});
  if (!props.includes("role") || !props.includes("target")) throw new Error(`handoff schema looks wrong: ${JSON.stringify(props)}`);

  const call = await request<{ content: { text: string }[] }>(4, "tools/call", { name: "version", arguments: {} });
  const info = JSON.parse(call.content[0]?.text ?? "{}") as { keyPresent?: boolean; version?: string; node?: string };
  if (!info.keyPresent) throw new Error("version reports no API key");
  console.log(`ok: ${tools.length} tools (${tools.join(", ")}); handoff args: ${props.join(", ")}; server ${info.version}; node ${info.node}`);
  ok = true;
} catch (e) {
  console.error(`SMOKE FAILED: ${(e as Error).message}`);
  if (stderr.trim()) console.error(`--- server stderr ---\n${stderr.trim()}`);
} finally {
  child.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
