/** Synchronous test environment: the throwaway repo path and the variables src/config.ts reads at import. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dsmcp-"));
export const repo = path.join(tmp, "repo");
fs.mkdirSync(repo);

Object.assign(process.env, {
  REPO_ROOT: repo,
  BASE_REF: "main",
  DEEPSEEK_API_KEY: "test-key",
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
});
