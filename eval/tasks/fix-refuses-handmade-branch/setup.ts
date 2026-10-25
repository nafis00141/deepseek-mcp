import fs from "node:fs";
import path from "node:path";

/** A branch a person made (no server-style commit), and a review file asking for a fix on it. */
export default function setup(ctx: { repo: string; git: (...args: string[]) => string }): void {
  const write = (rel: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(ctx.repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(ctx.repo, rel), text);
  };
  ctx.git("checkout", "-q", "-b", "impl/hand-made");
  write("src/lib.js", "module.exports = { double: (n) => n + n + 1 };\n");
  ctx.git("add", "-A");
  ctx.git("commit", "-qm", "wip: quick attempt");
  ctx.git("checkout", "-q", "main");
  write("specs/review/01.md", "# review\n- F1 blocker: double(2) returns 5, expected 4.\n");
}
