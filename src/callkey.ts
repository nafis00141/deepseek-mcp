import crypto from "node:crypto";
import { normRel } from "./taskfile.ts";

export interface CallKeyParts {
  role: string;
  target: string;
  instruction?: string | null | undefined;
  feedback?: string | null | undefined;
  /** a free-form (`do`) call also depends on its scope, its test command and the branch it names */
  synthetic?: boolean | undefined;
  paths?: readonly string[] | undefined;
  testCommand?: string | undefined;
  branch?: string | undefined;
}

/**
 * Identity of a handoff call, for the rule "an identical call to a job that failed is refused". Built from what the caller sent.
 * For a free-form job that includes the scope and test command (sorted, normalised), so changing `paths` is a different call and
 * repeating the same one is not; other roles keep the key they always had.
 */
export function callKey(p: CallKeyParts): string {
  const parts = [p.role, p.target, p.instruction || "", p.feedback || ""];
  if (p.synthetic) parts.push([...(p.paths ?? [])].map(normRel).sort().join("|"), String(p.testCommand ?? "").trim(), p.branch ?? "");
  else if (p.branch && (p.role === "fix" || p.role === "test")) parts.push("branch", p.branch);
  return crypto.createHash("sha1").update(parts.join("\0")).digest("hex");
}
