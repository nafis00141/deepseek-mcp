// Every function a module under src/ exports must be listed in api/surface.json with its parameter names, and the other way round.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const surface = JSON.parse(fs.readFileSync(path.join(root, 'api', 'surface.json'), 'utf8'));

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.js') && e.name !== 'index.js') out.push(p);
  }
  return out;
}

function params(fn) {
  const src = Function.prototype.toString.call(fn);
  const open = src.indexOf('(');
  let depth = 0;
  let i = open;
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) break;
  }
  return src
    .slice(open + 1, i)
    .split(',')
    .map((s) => s.replace(/=[\s\S]*$/, '').trim())
    .filter(Boolean)
    .join(', ');
}

const problems = [];
const seen = new Set();
for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  seen.add(rel);
  const listed = surface[rel] || {};
  const mod = require(file);
  for (const [name, value] of Object.entries(mod)) {
    if (typeof value !== 'function') continue;
    if (!(name in listed)) problems.push(rel + ': ' + name + '(' + params(value) + ') is exported but not listed in api/surface.json');
    else if (listed[name] !== params(value)) problems.push(rel + ': ' + name + ' takes (' + params(value) + ') but api/surface.json says (' + listed[name] + ')');
  }
  for (const name of Object.keys(listed)) {
    if (typeof mod[name] !== 'function') problems.push(rel + ': api/surface.json lists ' + name + ' but the module does not export it');
  }
}
for (const rel of Object.keys(surface)) if (!seen.has(rel)) problems.push('api/surface.json lists ' + rel + ', which does not exist');

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
