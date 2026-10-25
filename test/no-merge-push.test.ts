import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { capsFor } from "../src/engine.ts";
import { ROLES, ROLE_NAMES } from "../src/roles.ts";
import type { Task } from "../src/taskfile.ts";

// Not ./helpers.ts: it starts a mock server that needs an `after(cleanup)`, and this file needs neither a repo nor a model.
const mkTask = (p: Partial<Task>): Task => ({ path: "", rel: "specs/x/tasks/01-x.md", id: "01", allowedPaths: [], dependsOn: [], testCommand: "", body: "", ...p });

const SRC = path.resolve(import.meta.dirname, "..", "src");
const sources = fs.readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => ({ f, text: fs.readFileSync(path.join(SRC, f), "utf8") }));

describe("the server never merges or pushes", () => {
  it("no source file invokes a history-changing or remote git command", () => {
    // a git argument written as a quoted word: "push", "merge", ... ("merge-base" is a different word and is read-only)
    const forbidden = /["'`](push|merge|pull|fetch|rebase|cherry-pick|revert|reset|am|apply|stash|tag|remote|filter-branch|gc|prune|clean|restore)["'`]/;
    for (const { f, text } of sources) {
      const lines = text.split(/\r?\n/).filter((l) => /\bgit\(|execFileSync|spawn(Sync)?\(|runCmd\(/.test(l));
      for (const l of lines) assert.ok(!forbidden.test(l), `${f}: ${l.trim()}`);
    }
  });

  it("the only git subcommands the server issues are the ones it needs, all local", () => {
    const used = new Set<string>();
    for (const { text } of sources) for (const m of text.matchAll(/\bgit\(\s*\[\s*(?:"-c"\s*,\s*"[^"]*"\s*,\s*)*"([a-z-]+)"/g)) used.add(m[1] as string);
    const allowed = new Set(["rev-parse", "checkout", "diff", "log", "status", "add", "commit", "branch", "merge-base", "rev-list", "ls-files", "show", "for-each-ref", "symbolic-ref"]);
    assert.ok(used.size >= 6, `the scan found the git calls (${[...used].join(", ")}), so it is not vacuous`);
    const unexpected = [...used].filter((c) => !allowed.has(c));
    assert.deepEqual(unexpected, [], "a new git subcommand needs to be reviewed against the no-merge, no-push rule");
    assert.ok(!used.has("push") && !used.has("merge"));
  });

  it("no role can run a shell command of its own choosing: the only command tool runs the declared test_command", () => {
    const engine = sources.find((s) => s.f === "engine.ts")!.text;
    const tools = [...engine.matchAll(/^  ([a-z_]+): \{\s*$/gm)].map((m) => m[1]);
    assert.deepEqual(tools.sort(), ["edit_file", "git_diff", "grep", "list_dir", "read_file", "run_tests", "write_file"]);
    for (const name of ROLE_NAMES) {
      const caps = capsFor(name, ROLES[name], name === "do" ? mkTask({ allowedPaths: ["src/lib/**"], testCommand: "npm test" }) : mkTask({ allowedPaths: ["src/**", "tests/**"], testCommand: "npm test" }), "specs/x");
      // a role either cannot run tests at all, or runs exactly the command it was given: there is no free-form command in Caps
      assert.ok(caps.canRunTests === false || caps.testCommand === "npm test", name);
    }
  });
});
