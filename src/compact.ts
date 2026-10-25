/**
 * How a long conversation is shortened before each request (Specs/long-context).
 *
 * `legacy` is the original behaviour, kept exactly: once the JSON of the whole conversation passes the budget, old tool results are
 * cut to their first 3,000 characters, one message after another and only as far as needed. It edits the persistent message array in
 * place and the engine ignores the return value, so the array it is given must be the one the loop keeps.
 * A cut message is still over 3,000 characters (3,000 plus a marker), so later passes cut it again and the marker text drifts; this is
 * the behaviour the cache-friendly `extended` mode (not built yet) replaces.
 */
import type { ChatMessage } from "./engine.ts";
import type { ContextSettings } from "./config.ts";

export const KEEP_CHARS = 3000; // what is left of a cut tool result
const KEEP_FIRST = 2; // the system message and the task prompt are never cut
const KEEP_LAST = 6; // nor are the most recent messages

/** The original `compact()`, unchanged apart from the budget being a parameter without a default. */
export function compactLegacy(messages: ChatMessage[], budget: number): ChatMessage[] {
  let size = JSON.stringify(messages).length;
  if (size <= budget) return messages;
  for (let i = KEEP_FIRST; i < messages.length - KEEP_LAST && size > budget; i++) {
    const m = messages[i] as ChatMessage;
    if (m.role === "tool" && typeof m.content === "string" && m.content.length > KEEP_CHARS) {
      const cut = m.content.length - KEEP_CHARS;
      m.content = m.content.slice(0, KEEP_CHARS) + `\n[truncated ${cut} chars]`;
      size -= cut;
    }
  }
  return messages;
}

export type Compactor = (messages: ChatMessage[]) => ChatMessage[];

/** One compactor per job: the modes that need memory between turns (the extended mode) keep it here. */
export function createCompactor(settings: Pick<ContextSettings, "contextMode" | "compactChars">): Compactor {
  if (settings.contextMode !== "legacy") throw new Error(`CONTEXT_MODE=${settings.contextMode} is not built yet`);
  return (messages) => compactLegacy(messages, settings.compactChars);
}
