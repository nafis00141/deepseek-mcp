/**
 * One rule for what may be shown. A split is private when its tasks must never appear by name outside a
 * `private/<split>/` folder: held-out (the regression guard), confirm (the final decision set) and reserve (unseen tasks).
 */
import crypto from "node:crypto";

export const PRIVATE_SPLITS = ["heldout", "confirm", "reserve"] as const;

export const isPrivate = (split: string): boolean => (PRIVATE_SPLITS as readonly string[]).includes(split);

/** Where a task's per-run details live inside a run folder. Older runs used `heldout-private/`; readers accept both. */
export const runSubdir = (split: string): string => (isPrivate(split) ? `private/${split}` : ".");

/** A stable, non-reversible stand-in for a private task id, safe to write to logs and manifests. */
export const privateLabel = (id: string): string => `p-${crypto.createHash("sha1").update(id).digest("hex").slice(0, 8)}`;

/** What to print or record for a task: its id when public, a hash when private. */
export const labelOf = (t: { id: string; split: string }): string => (isPrivate(t.split) ? privateLabel(t.id) : t.id);
