/** Minimal MCP-over-stdio client (JSON-RPC lines), factored from scripts/smoke.ts. */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { killTree } from "./proc.ts";

interface RpcReply {
  id?: number;
  result?: unknown;
  error?: unknown;
}

export class McpClient {
  private child: ChildProcess;
  private buf = "";
  private nextId = 1;
  private pending = new Map<number, (m: RpcReply) => void>();
  stderr = "";

  constructor(script: string, env: NodeJS.ProcessEnv, cwd: string) {
    this.child = spawn(process.execPath, [script], { env, cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    this.child.stderr?.on("data", (d: Buffer) => {
      this.stderr += d;
      if (this.stderr.length > 200_000) this.stderr = this.stderr.slice(-100_000);
    });
    this.child.stdout?.on("data", (d: Buffer) => {
      this.buf += d;
      let i: number;
      while ((i = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as RpcReply;
          if (msg.id !== undefined) this.pending.get(msg.id)?.(msg);
        } catch {
          /* not a JSON-RPC line */
        }
      }
    });
    this.child.on("exit", () => {
      for (const [id, fn] of this.pending) fn({ id, error: "server exited" });
    });
  }

  private send(obj: unknown): void {
    this.child.stdin?.write(`${JSON.stringify(obj)}\n`);
  }

  private request<T>(method: string, params: unknown, timeoutMs: number): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`no reply to ${method} within ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
      this.pending.set(id, (m) => {
        clearTimeout(timer);
        this.pending.delete(id);
        m.error ? reject(new Error(`${method}: ${typeof m.error === "string" ? m.error : JSON.stringify(m.error)}`)) : resolve(m.result as T);
      });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  async start(): Promise<void> {
    await this.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "deepseek-mcp-eval", version: "0" } }, 30000);
    this.send({ jsonrpc: "2.0", method: "notifications/initialized" });
  }

  /** Call a tool and parse the JSON text it returns. */
  async call(name: string, args: Record<string, unknown>, timeoutMs = 120000): Promise<Record<string, unknown>> {
    const res = await this.request<{ content?: { text?: string }[]; isError?: boolean }>("tools/call", { name, arguments: args }, timeoutMs);
    const text = res.content?.[0]?.text ?? "{}";
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { status: "bad_reply", text: text.slice(0, 500) };
    }
  }

  close(): void {
    killTree(this.child);
  }
}
