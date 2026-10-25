/**
 * The held-out look budget. A "look" is one comparison that shows the held-out aggregate.
 *
 * It is keyed by lineage (the src/ tree a candidate was cut from, see lineage.ts), so renaming a run or re-cutting a branch
 * from the same code cannot buy a fresh budget. Two limits apply, and the global one is binding: each lineage has its own
 * allowance, and all lineages together have a total since the last rotation of the held-out set.
 */
import fs from "node:fs";

export interface LookState {
  version: 2;
  /** looks since the held-out set was last refreshed, over all lineages */
  total: number;
  by_lineage: Record<string, number>;
}

export interface LookResult {
  allowed: boolean;
  lineage_used: number;
  lineage_budget: number;
  lineage_left: number;
  total_used: number;
  total_budget: number;
  total_left: number;
  /** why a look was refused, when it was */
  reason: string | null;
}

/** Read the state, upgrading the older format ({ "<run id>": count }) by counting its looks into the total. */
export function readLooks(file: string): LookState {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    if (raw.version === 2) return { version: 2, total: Number(raw.total) || 0, by_lineage: (raw.by_lineage ?? {}) as Record<string, number> };
    const legacy = Object.values(raw).reduce<number>((a, v) => a + (typeof v === "number" ? v : 0), 0);
    return { version: 2, total: legacy, by_lineage: {} };
  } catch {
    return { version: 2, total: 0, by_lineage: {} };
  }
}

/** Spend one look for `lineage` if both limits allow it; otherwise change nothing and say why. */
export function spendLook(file: string, lineage: string, perLineage: number, total: number): LookResult {
  const s = readLooks(file);
  const used = s.by_lineage[lineage] ?? 0;
  let reason: string | null = null;
  if (s.total >= total) reason = `the total of ${total} held-out looks since the last rotation is spent`;
  else if (used >= perLineage) reason = `this lineage has used its ${perLineage} held-out looks`;
  if (!reason) {
    s.total += 1;
    s.by_lineage[lineage] = used + 1;
    fs.writeFileSync(file, JSON.stringify(s, null, 2));
  }
  const lineageUsed = reason ? used : used + 1;
  const totalUsed = reason ? s.total : s.total;
  return {
    allowed: !reason, lineage_used: lineageUsed, lineage_budget: perLineage, lineage_left: Math.max(0, perLineage - lineageUsed),
    total_used: totalUsed, total_budget: total, total_left: Math.max(0, total - totalUsed), reason,
  };
}
