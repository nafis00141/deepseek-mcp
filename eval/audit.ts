/**
 * Leak audit: finds private task ids, instruction text and private-only fixture paths in files where they must not be.
 *
 *   node eval/audit.ts [--write-allow]      exit 1 on any hit that is not allowlisted
 *
 * "Private" means held-out, confirm and reserve. They may appear only under a run's `private/` folder (or the older
 * `heldout-private/`). Everything else in runs/ is scanned: logs, manifests, scores, reports, reviewer bundles. The pinned `server/`
 * copies and `node_modules` are not part of any report and are skipped.
 *
 * What is reported is a hashed label, never the private term itself, so the audit's own output cannot leak.
 * Files written before the privacy rule existed are covered by eval/audit-allow.json: path plus content hash, so an allowlisted
 * file that changes afterwards is audited again.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTasks, taskRoots } from "./lib/fixture.ts";
import { isPrivate, privateLabel } from "./lib/privacy.ts";

export interface AuditHit {
  /** path relative to the runs folder */
  file: string;
  kind: "task id" | "instruction text" | "private fixture path";
  /** hashed label of the private task the match belongs to */
  label: string;
}

export interface AllowEntry {
  file: string;
  sha1: string;
}

interface Term {
  term: string;
  kind: AuditHit["kind"];
  label: string;
}

/** Words in a run of instruction text that counts as evidence of a leak: short runs of ordinary English occur in model output by chance. */
const RUN = 8;
const GENERIC = new Set(["package.json", "readme.md", ".gitignore", "src/index.js"]);
const words = (s: string): string[] => s.toLowerCase().replace(/[^a-z0-9_./-]+/g, " ").split(" ").filter(Boolean);

function listFiles(dir: string, base = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).replace(/\\/g, "/")]));
}

/** What identifies a private task: its id, eight-word runs of its instructions, and fixture paths no public task also has. */
export function privateTerms(evalDir: string): Term[] {
  const all = loadTasks(taskRoots(evalDir), ["dev", "heldout", "confirm", "reserve"]);
  const owners = new Map<string, Set<string>>();
  for (const t of all) for (const f of listFiles(path.join(t.dir, "repo"))) owners.set(f.toLowerCase(), (owners.get(f.toLowerCase()) ?? new Set()).add(isPrivate(t.split) ? "private" : "public"));
  // An eight-word run that a public task's instruction or the role prompts also contain says nothing about a private task when found
  // in a public file, so those runs are not forbidden: only wording unique to a private task counts as evidence of a leak.
  const common = new Set<string>();
  const addShingles = (text: string): void => {
    const w = words(text);
    for (let i = 0; i + RUN <= w.length; i++) common.add(w.slice(i, i + RUN).join(" "));
  };
  for (const t of all.filter((x) => !isPrivate(x.split))) for (const s of t.steps) addShingles(s.instruction ?? "");
  try {
    addShingles(fs.readFileSync(path.join(evalDir, "..", "src", "roles.ts"), "utf8"));
  } catch {
    /* no sources next to the eval folder (a synthetic one in a test) */
  }
  const out: Term[] = [];
  for (const t of all.filter((x) => isPrivate(x.split))) {
    const label = privateLabel(t.id);
    out.push({ term: t.id.toLowerCase(), kind: "task id", label });
    for (const f of listFiles(path.join(t.dir, "repo"))) {
      const key = f.toLowerCase();
      if (key.length >= 8 && !GENERIC.has(key) && !owners.get(key)!.has("public")) out.push({ term: key, kind: "private fixture path", label });
    }
    for (const s of t.steps) {
      const w = words(s.instruction ?? "");
      for (let i = 0; i + RUN <= w.length; i++) {
        const run = w.slice(i, i + RUN).join(" ");
        if (!common.has(run)) out.push({ term: run, kind: "instruction text", label });
      }
    }
  }
  return out;
}

const sha1 = (b: Buffer): string => crypto.createHash("sha1").update(b).digest("hex");

/** Files under the runs folder that a report or a person could read: everything outside private folders, pinned servers and dependencies. */
function publicFiles(runsDir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (["private", "heldout-private", "server", "node_modules", "shelved"].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  if (fs.existsSync(runsDir)) walk(runsDir);
  return out;
}

export function audit(runsDir: string, terms: Term[], allow: AllowEntry[] = []): { hits: AuditHit[]; allowed: number; scanned: number } {
  const allowed = new Map(allow.map((a) => [a.file, a.sha1]));
  const hits: AuditHit[] = [];
  let allowedCount = 0;
  const files = publicFiles(runsDir);
  for (const f of files) {
    let buf: Buffer;
    try {
      if (fs.statSync(f).size > 5_000_000) continue;
      buf = fs.readFileSync(f);
    } catch {
      continue;
    }
    const raw = buf.toString("utf8").toLowerCase();
    const flat = words(raw).join(" ");
    const rel = path.relative(runsDir, f).replace(/\\/g, "/");
    const found = new Map<string, AuditHit>();
    for (const t of terms) {
      if ((t.kind === "instruction text" ? flat : raw).includes(t.term)) found.set(`${t.kind}|${t.label}`, { file: rel, kind: t.kind, label: t.label });
    }
    if (!found.size) continue;
    if (allowed.get(rel) === sha1(buf)) {
      allowedCount += found.size;
      continue;
    }
    hits.push(...found.values());
  }
  return { hits, allowed: allowedCount, scanned: files.length };
}

/** An allowlist entry for every file that currently has a hit, to be written once for files that predate the privacy rule. */
export function allowlistFor(runsDir: string, hits: AuditHit[]): AllowEntry[] {
  const seen = new Set<string>();
  const out: AllowEntry[] = [];
  for (const h of hits) {
    if (seen.has(h.file)) continue;
    seen.add(h.file);
    out.push({ file: h.file, sha1: sha1(fs.readFileSync(path.join(runsDir, h.file))) });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const runsDir = path.resolve(here, "..", "runs");
  const allowFile = path.join(here, "audit-allow.json");
  let allow: AllowEntry[] = [];
  try {
    allow = JSON.parse(fs.readFileSync(allowFile, "utf8")) as AllowEntry[];
  } catch {
    /* no allowlist yet */
  }
  const r = audit(runsDir, privateTerms(here), allow);
  if (process.argv.includes("--write-allow")) {
    const merged = [...allow, ...allowlistFor(runsDir, r.hits)];
    fs.writeFileSync(allowFile, JSON.stringify(merged, null, 2) + "\n");
    console.log(`allowlist written: ${merged.length} file(s) (${r.hits.length} new hit(s) recorded)`);
  } else {
    for (const h of r.hits.slice(0, 40)) console.error(`${h.file}: ${h.kind} of private task ${h.label}`);
    console.log(`audit: scanned ${r.scanned} file(s); ${r.hits.length} hit(s)${r.allowed ? `, ${r.allowed} allowlisted` : ""}`);
    if (r.hits.length) process.exit(1);
  }
}
