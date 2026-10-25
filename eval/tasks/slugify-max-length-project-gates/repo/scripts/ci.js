// The CI command. Runs its stages in order and stops at the first failure.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const tests = fs
  .readdirSync(path.join(root, 'tests'))
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('tests', f));

const stages = [
  ['unit tests', ['--test', ...tests]],
  ['api surface', ['scripts/check-surface.js']],
  ['changelog', ['scripts/check-changelog.js']],
];

for (const [name, args] of stages) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    console.error('ci: stage "' + name + '" failed');
    process.exit(1);
  }
  console.log('ci: stage "' + name + '" ok');
}
