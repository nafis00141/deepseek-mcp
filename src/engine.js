/**
 * DeepSeek agent loop. Talks to the OpenAI-compatible API directly, so there is
 * no Claude Code dependency: Node + an API key is the whole runtime.
 *
 * Capabilities are enforced here, in code, on every tool call.
 */
import fs from "node:fs";
import path from "node:path";
import { CFG } from "./config.js";
import { SKIP_DIRS, detectRepoEol, git, rel, runCmd, resolveInRepo, toPosix } from "./repo.js";
import { isDeniedRead, isDeniedWrite, matchAny, scopeFor } from "./taskfile.js";

const SYSTEM = `You are a coding agent working inside a repository. You act by calling tools.
Rules:
- Use tools to inspect files. Never guess at file contents or paths.
- Stay inside the directories you are permitted to change.
- Do not run git commands that rewrite history. You do not need to commit; the harness does that.
- When the task is complete, stop calling tools and write your final answer.
- Your final answer must end with a single fenced json block and nothing after it.`;

const READ_BUDGET = 30000; // chars of file content per read_file call
const RESULT_LIMIT = 45000; // chars of any one tool result kept in the conversation
const DIFF_CHUNK = 30000; // chars of diff per git_diff call

/* --------------------------------------------------------------- line endings */

const toLf = (s) => s.replace(/\r\n/g, "\n");
const withEol = (s, eol) => (eol === "\r\n" ? toLf(s).replace(/\n/g, "\r\n") : toLf(s));
const eolStats = (txt) => {
  const crlf = (txt.match(/\r\n/g) || []).length;
  return { crlf, lf: (txt.match(/\n/g) || []).length - crlf };
};
let repoEol = null;
const newFileEol = () => (repoEol ??= detectRepoEol());

/* --------------------------------------------------------------- capabilities */

export function capsFor(roleName, role, task) {
  if (role.caps === "specs") return { write: ["specs/**"], denySpecs: false, canRunTests: false, baseRef: null };
  if (role.caps === "readonly") return { write: [], denySpecs: true, canRunTests: false, baseRef: CFG.baseRef };

  return {
    // The test role is narrowed to test globs; if the task has none it gets no write access at all.
    write: scopeFor(roleName, task),
    denySpecs: true,
    canRunTests: Boolean(task?.testCommand),
    testCommand: task?.testCommand || null,
    baseRef: CFG.baseRef,
  };
}

function canWrite(file, caps) {
  return caps.write.length > 0 && matchAny(file, caps.write) && !isDeniedWrite(file, { denySpecs: caps.denySpecs });
}

/**
 * Resolve first, then match: the glob is tested against the path that will actually
 * be written, so `src/../package.json` cannot sneak past `src/**`.
 */
function checkedWriteTarget(p, caps, verb) {
  let abs;
  try {
    abs = resolveInRepo(p);
  } catch (e) {
    return { error: `not permitted to ${verb} ${toPosix(p)}: ${e.message}` };
  }
  const file = rel(abs);
  if (!canWrite(file, caps)) return { error: `not permitted to ${verb} ${file}; allowed: ${caps.write.join(", ") || "(none)"}` };
  return { file, abs };
}

/* --------------------------------------------------------------------- tools */

const TOOL_DEFS = {
  read_file: {
    description: "Read a UTF-8 file. Returns numbered lines. Use start/end to page.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        start: { type: "integer", description: "1-based first line" },
        end: { type: "integer", description: "1-based last line" },
      },
      required: ["path"],
    },
    run: ({ path: p, start, end }) => {
      const abs = resolveInRepo(p);
      if (isDeniedRead(rel(abs))) return { error: `not permitted to read ${toPosix(p)}` };
      const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
      const a = Math.max(1, start || 1);
      const last = Math.min(lines.length, end || a + 399, a + 399);
      // Stop at a character budget so the tool result is never cut mid-line by the transport.
      const out = [];
      let size = 0;
      let b = a - 1;
      for (let i = a; i <= last; i++) {
        const l = `${i}\t${lines[i - 1]}`;
        if (size + l.length > READ_BUDGET && out.length) break;
        out.push(l.slice(0, READ_BUDGET));
        size += l.length + 1;
        b = i;
      }
      return { path: toPosix(p), total_lines: lines.length, from: a, to: b, content: out.join("\n"), more: b < lines.length ? `call again with start=${b + 1}` : undefined };
    },
  },
  list_dir: {
    description: "List a directory (names only, no recursion).",
    parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
    run: ({ path: p }) => {
      const abs = resolveInRepo(p || ".");
      const entries = fs.readdirSync(abs, { withFileTypes: true })
        .filter((e) => !SKIP_DIRS.has(e.name) && !isDeniedRead(e.name))
        .slice(0, 300)
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
      return { path: toPosix(p || "."), entries };
    },
  },
  grep: {
    description: "Regex search across the repo. Returns file:line: text. Skips build and dependency dirs.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", description: "Directory to search, default '.'" },
        max: { type: "integer" },
      },
      required: ["pattern"],
    },
    run: ({ pattern, path: p, max }) => {
      const root = resolveInRepo(p || ".");
      if (String(pattern).length > 200) return { error: "pattern too long (max 200 chars)" };
      const re = new RegExp(pattern, "i");
      const hits = [];
      const limit = Math.min(max || 50, 200);
      const walk = (dir) => {
        if (hits.length >= limit) return;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (hits.length >= limit) return;
          if (SKIP_DIRS.has(e.name) || isDeniedRead(e.name)) continue;
          const abs = path.join(dir, e.name);
          if (e.isDirectory()) walk(abs);
          else {
            try {
              if (fs.statSync(abs).size > 1_000_000) continue;
              const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
              for (let i = 0; i < lines.length && hits.length < limit; i++) {
                if (lines[i].length < 2000 && re.test(lines[i])) hits.push(`${toPosix(path.relative(CFG.repo, abs))}:${i + 1}: ${lines[i].trim().slice(0, 200)}`);
              }
            } catch {
              /* binary or unreadable */
            }
          }
        }
      };
      walk(root);
      return { matches: hits, count: hits.length, truncated: hits.length >= limit };
    },
  },
  write_file: {
    description: "Create or overwrite a file. Parent directories are created.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
    run: ({ path: p, content }, caps) => {
      const target = checkedWriteTarget(p, caps, "write");
      if (target.error) return target;
      const { file, abs } = target;
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      // Keep the file's own line endings (or the repo's, for a new file); leave mixed files untouched.
      let data = content ?? "";
      if (fs.existsSync(abs)) {
        const { crlf, lf } = eolStats(fs.readFileSync(abs, "utf8"));
        if (!(crlf > 0 && lf > 0)) data = withEol(data, crlf > lf ? "\r\n" : "\n");
      } else data = withEol(data, newFileEol());
      fs.writeFileSync(abs, data);
      return { written: file, bytes: Buffer.byteLength(data) };
    },
  },
  edit_file: {
    description: "Replace an exact string in a file. `old` must occur exactly once.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" }, old: { type: "string" }, new: { type: "string" } },
      required: ["path", "old", "new"],
    },
    run: ({ path: p, old, new: neu }, caps) => {
      const target = checkedWriteTarget(p, caps, "edit");
      if (target.error) return target;
      const { file, abs } = target;
      if (!old) return { error: "`old` must not be empty" };
      const txt = fs.readFileSync(abs, "utf8");
      // read_file shows lines without \r, so match on LF text and write back in the file's own EOL.
      // A file that mixes both endings is matched byte-for-byte and left as it is.
      const { crlf, lf } = eolStats(txt);
      const mixed = crlf > 0 && lf > 0;
      const parts = (mixed ? txt : toLf(txt)).split(mixed ? old : toLf(old));
      if (parts.length === 1) return { error: "`old` not found - read the file again and copy the exact text" };
      if (parts.length > 2) return { error: `\`old\` occurs ${parts.length - 1} times; include more context` };
      let out = parts.join(mixed ? neu : toLf(neu));
      if (!mixed) out = withEol(out, crlf > lf ? "\r\n" : "\n");
      fs.writeFileSync(abs, out);
      return { edited: file, bytes: Buffer.byteLength(out) };
    },
  },
  run_tests: {
    description: "Run the task's declared test command and return the tail of its output.",
    parameters: { type: "object", properties: {} },
    run: async (_args, caps) => {
      if (!caps.canRunTests) return { error: "no test command is available for this role" };
      const r = await runCmd(caps.testCommand);
      return { pass: r.pass, command: caps.testCommand, output: r.out.split(/\r?\n/).slice(-60).join("\n") };
    },
  },
  git_diff: {
    description: "Show the committed diff of this branch against the base branch, plus a stat summary.",
    parameters: {
      type: "object",
      properties: {
        base: { type: "string" },
        offset: { type: "integer", description: "Character offset into the diff; use next_offset from the previous call" },
      },
      required: [],
    },
    run: ({ base, offset }, caps) => {
      const ref = base || caps.baseRef || "main";
      const stat = git(["diff", "--stat", `${ref}...HEAD`]);
      const full = git(["diff", `${ref}...HEAD`]);
      const from = Math.max(0, offset || 0);
      const end = Math.min(full.out.length, from + DIFF_CHUNK);
      return {
        base: ref,
        stat: stat.out.slice(0, 4000),
        total_chars: full.out.length,
        offset: from,
        diff: full.out.slice(from, end),
        next_offset: end < full.out.length ? end : null,
        hint: stat.ok ? undefined : "diff failed - try base 'master', or read files directly",
      };
    },
  },
};

const SAFE_FS_TOOLS = new Set(["read_file", "list_dir", "grep"]);

function toolSchema(name, caps) {
  const def = TOOL_DEFS[name];
  return { type: "function", function: { name, description: def.description, parameters: def.parameters } };
}

function availableTools(caps) {
  const names = new Set([...SAFE_FS_TOOLS]);
  if (caps.write.length) {
    names.add("write_file");
    names.add("edit_file");
  }
  if (caps.canRunTests) names.add("run_tests");
  if (caps.baseRef) names.add("git_diff");
  return [...names].map((n) => toolSchema(n, caps));
}

/** Keep a tool result as valid JSON under the limit, instead of slicing it mid-string. */
export function packResult(out, limit = RESULT_LIMIT) {
  const s = JSON.stringify(out);
  if (s.length <= limit) return s;
  return JSON.stringify({ error: `result too large (${s.length} chars); narrow the request or page it`, preview: s.slice(0, limit - 300) });
}

export async function executeTool(name, args, caps) {
  const def = TOOL_DEFS[name];
  if (!def) return { error: `unknown tool: ${name}` };
  if (name === "write_file" || name === "edit_file") {
    if (!caps.write.length) return { error: "this role is read-only" };
  }
  if (name === "run_tests" && !caps.canRunTests) return { error: "no test command for this role" };
  try {
    return await def.run(args || {}, caps);
  } catch (e) {
    return { error: e.message };
  }
}

/* ---------------------------------------------------------------------- loop */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, headers, body, timeoutMs, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => ctrl.abort(new Error("aborted"));
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
    return { status: res.status, text: await res.text() };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * The request body. Thinking mode is explicit either way; sampling temperature is only sent when thinking
 * is off (it has no effect while thinking), and reasoning_effort only while it is on.
 */
export function requestBody(messages, tools, cfg = CFG) {
  const body = { model: cfg.model, messages, max_tokens: cfg.maxTokens };
  if (cfg.thinking === "enabled") {
    body.thinking = { type: "enabled" };
    body.reasoning_effort = cfg.effort;
  } else {
    body.thinking = { type: "disabled" };
    body.temperature = cfg.temperature;
  }
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  return body;
}

async function chat(messages, tools, signal) {
  const body = requestBody(messages, tools);
  const headers = { "content-type": "application/json", authorization: `Bearer ${CFG.key}` };
  const payload = JSON.stringify(body);

  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (signal?.aborted) throw new Error("aborted");
    try {
      const res = await post(`${CFG.baseUrl}/chat/completions`, headers, payload, CFG.requestTimeoutMs, signal);
      if (res.status < 200 || res.status >= 300) {
        const err = new Error(`DeepSeek HTTP ${res.status}: ${res.text.slice(0, 500)}`);
        err.retryable = res.status === 429 || res.status >= 500;
        throw err;
      }
      return JSON.parse(res.text);
    } catch (e) {
      const retryable = !signal?.aborted && e.retryable !== false && !(e instanceof SyntaxError);
      if (attempt >= attempts || !retryable) throw e;
      await sleep(2000 * 2 ** (attempt - 1)); // 2s, 4s, 8s
    }
  }
  throw new Error("unreachable");
}

function compact(messages, budget = 220000) {
  let size = JSON.stringify(messages).length;
  if (size <= budget) return messages;
  for (let i = 2; i < messages.length - 6 && size > budget; i++) {
    const m = messages[i];
    if (m.role === "tool" && typeof m.content === "string" && m.content.length > 3000) {
      const cut = m.content.length - 3000;
      m.content = m.content.slice(0, 3000) + `\n[truncated ${cut} chars]`;
      size -= cut;
    }
  }
  return messages;
}

export async function ping() {
  const data = await chat([{ role: "user", content: "Reply with exactly: PONG" }], []);
  return { reply: data.choices?.[0]?.message?.content ?? "", usage: data.usage ?? null };
}

/**
 * `verify(finalText)` runs when the model stops calling tools. It returns null (accept) or
 * { why, message }: the message goes back to the model as a new user turn - at most
 * CFG.maxRepairs times - so cheap self-checks happen here rather than as a round trip to Claude.
 */
export async function runAgent({ prompt, caps, logPath, onProgress, signal, verify }) {
  const tools = availableTools(caps);
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: prompt },
  ];
  const usage = { input: 0, output: 0 };
  const repairs = [];
  let turns = 0;
  const logLine = (s) => {
    try {
      fs.appendFileSync(logPath, `${new Date().toISOString()} ${s}\n`);
    } catch {
      /* ignore */
    }
  };

  while (turns < CFG.maxTurns) {
    if (signal?.aborted) return { finalText: "", turns, usage, exhausted: false, aborted: true, repairs };
    turns++;
    const data = await chat(compact(messages), tools, signal);
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("empty response from model");
    usage.input += data.usage?.prompt_tokens ?? 0;
    usage.output += data.usage?.completion_tokens ?? 0;
    messages.push(msg);

    const calls = msg.tool_calls || [];
    if (calls.length && data.choices[0].finish_reason === "length") {
      // The reply hit max_tokens mid tool call, so the arguments are cut off: do not run them.
      logLine(`turn ${turns}: reply truncated at max_tokens mid tool call`);
      for (const call of calls) messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "your reply was cut off before this call was complete, so it was not run; repeat it with less text in one call" }) });
      continue;
    }
    if (!calls.length) {
      logLine(`final (turn ${turns}): ${String(msg.content || "").slice(0, 200).replace(/\s+/g, " ")}`);
      if (verify && repairs.length < CFG.maxRepairs && turns < CFG.maxTurns && !signal?.aborted) {
        const problem = await verify(msg.content || "");
        if (problem) {
          repairs.push({ turn: turns, why: String(problem.why).replace(/\s+/g, " ").slice(0, 160) });
          logLine(`repair ${repairs.length}: ${problem.why}`.slice(0, 300));
          onProgress?.(`repair ${repairs.length}: ${problem.why}`.slice(0, 140));
          messages.push({ role: "user", content: problem.message });
          continue;
        }
      }
      return { finalText: msg.content || "", turns, usage, exhausted: false, repairs };
    }
    for (const call of calls) {
      if (signal?.aborted) return { finalText: "", turns, usage, exhausted: false, aborted: true, repairs };
      const name = call.function?.name;
      let args = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }
      const out = await executeTool(name, args, caps);
      const preview = out?.error ? `ERROR ${out.error}` : JSON.stringify(out).slice(0, 160);
      logLine(`tool ${name} ${JSON.stringify(args).slice(0, 120)} -> ${preview}`);
      onProgress?.(`${name}: ${out?.error ? out.error : preview.slice(0, 120)}`);
      messages.push({ role: "tool", tool_call_id: call.id, content: packResult(out) });
    }
  }
  logLine(`max turns (${CFG.maxTurns}) reached`);
  return { finalText: "", turns, usage, exhausted: true, repairs };
}
