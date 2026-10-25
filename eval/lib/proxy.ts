/**
 * Pass-through proxy between the server under test and DeepSeek.
 *  - holds the real API key; the server child only ever sees a random per-run bearer
 *  - counts tokens and cost, and enforces a hard cap (402, non-retryable, so the run is marked "capped")
 *  - injects per-run faults (status codes for the first requests, a max_tokens override)
 * Never logs headers. Cap overshoot is at most one request.
 */
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Pricing, UsageStats } from "./types.ts";

/** How long the proxy waits for one upstream reply unless told otherwise. */
export const DEFAULT_UPSTREAM_TIMEOUT_MS = 330000;

export interface ProxyOpts {
  /** Base URL that /chat/completions is appended to, e.g. https://api.deepseek.com */
  upstream: string;
  apiKey: string;
  maxTokens?: number;
  maxCost?: number;
  pricing?: Pricing;
  /** How long to wait for one upstream reply (default 330000). A near-limit request can take longer. */
  upstreamTimeoutMs?: number;
}

export interface ProxySession {
  bearer: string;
  stats: UsageStats;
}

export interface Proxy {
  url: string;
  totals: UsageStats;
  session(faults?: { fail_first?: number[]; max_tokens?: number }): ProxySession;
  close(): Promise<void>;
}

const empty = (): UsageStats => ({ requests: 0, prompt: 0, completion: 0, reasoning: 0, cache_hit: 0, cost: 0, capped: false, upstream_failures: 0 });

export function costOf(pricing: Pricing | undefined, prompt: number, hit: number, completion: number): number {
  if (!pricing) return 0;
  const p = pricing.per_million_tokens[pricing.use];
  return (hit * p.input_cache_hit + Math.max(0, prompt - hit) * p.input_cache_miss + completion * p.output) / 1e6;
}

export async function startProxy(opts: ProxyOpts): Promise<Proxy> {
  const sessions = new Map<string, { stats: UsageStats; fail: number[]; maxTokens?: number | undefined }>();
  const totals = empty();
  const overCap = (): boolean => (opts.maxTokens !== undefined && totals.prompt + totals.completion >= opts.maxTokens) || (opts.maxCost !== undefined && totals.cost >= opts.maxCost);

  const server = http.createServer((req, res) => {
    const reply = (status: number, body: string): void => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body);
    };
    const m = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""));
    const s = m?.[1] ? sessions.get(m[1]) : undefined;
    if (!s) return reply(401, '{"error":"unknown bearer"}');
    if (req.method !== "POST" || !String(req.url).endsWith("/chat/completions")) return reply(404, '{"error":"only POST /chat/completions"}');

    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        if (overCap()) {
          s.stats.capped = totals.capped = true;
          return reply(402, '{"error":"eval cap reached"}');
        }
        const fault = s.fail.shift();
        s.stats.requests++;
        totals.requests++;
        if (fault) return reply(fault, '{"error":"injected fault"}');
        let body = Buffer.concat(chunks).toString("utf8");
        if (s.maxTokens !== undefined) {
          try {
            body = JSON.stringify({ ...(JSON.parse(body) as Record<string, unknown>), max_tokens: s.maxTokens });
          } catch {
            /* forward as is */
          }
        }
        try {
          const up = await fetch(`${opts.upstream.replace(/\/+$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
            body,
            signal: AbortSignal.timeout(opts.upstreamTimeoutMs ?? DEFAULT_UPSTREAM_TIMEOUT_MS),
          });
          const text = await up.text();
          try {
            const u = (JSON.parse(text) as { usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_cache_hit_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } } }).usage;
            if (u) {
              const prompt = u.prompt_tokens ?? 0;
              const completion = u.completion_tokens ?? 0;
              const hit = u.prompt_cache_hit_tokens ?? 0;
              const reasoning = u.completion_tokens_details?.reasoning_tokens ?? 0;
              const cost = costOf(opts.pricing, prompt, hit, completion);
              for (const t of [s.stats, totals]) {
                t.prompt += prompt;
                t.completion += completion;
                t.reasoning += reasoning;
                t.cache_hit += hit;
                t.cost += cost;
              }
            }
          } catch {
            /* not JSON: relay as is */
          }
          reply(up.status, text);
        } catch (e) {
          // No usage came back, but a timed-out request may still be billed: charge an estimate (about 4 bytes a token, all cache misses) against the cap.
          const est = costOf(opts.pricing, Math.ceil(Buffer.byteLength(body) / 4), 0, 0);
          for (const t of [s.stats, totals]) {
            t.upstream_failures = (t.upstream_failures ?? 0) + 1;
            t.cost += est;
          }
          reply(502, JSON.stringify({ error: `proxy upstream failure: ${(e as Error).message.slice(0, 200)}` }));
        }
      })();
    });
  });
  // The server under test allows 300s per request.
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    url,
    totals,
    session(faults) {
      const bearer = `ev-${crypto.randomBytes(18).toString("hex")}`;
      const stats = empty();
      sessions.set(bearer, { stats, fail: [...(faults?.fail_first ?? [])], maxTokens: faults?.max_tokens });
      return { bearer, stats };
    },
    close: () => new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
