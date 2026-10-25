// The "Unreleased" section of CHANGELOG.md must have at least one entry, written as "- <module>: <what changed>."
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lines = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').split(/\r?\n/);

const start = lines.findIndex((l) => l.trim() === '## Unreleased');
if (start < 0) {
  console.error('CHANGELOG.md has no "## Unreleased" section');
  process.exit(1);
}
const entries = [];
for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) if (lines[i].startsWith('- ')) entries.push(lines[i]);

const modules = new Set();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name));
    else if (e.name.endsWith('.js')) modules.add(e.name.replace(/\.js$/, ''));
  }
})(path.join(root, 'src'));

if (!entries.length) {
  console.error('CHANGELOG.md: the Unreleased section has no entries; add one line per change as "- <module>: <what changed>."');
  process.exit(1);
}
const bad = entries.filter((l) => {
  const m = /^- ([a-z]+): .+\.$/.exec(l);
  return !m || !modules.has(m[1]);
});
if (bad.length) {
  console.error('CHANGELOG.md: entries must read "- <module>: <what changed>." with a module name from src/, got: ' + bad.join(' | '));
  process.exit(1);
}
