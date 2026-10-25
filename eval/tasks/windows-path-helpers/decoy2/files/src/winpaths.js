// Windows path helpers.
const win = require('node:path').win32;

function key(p) {
  let n = win.normalize(String(p));
  if (n.length > 3) n = n.replace(/[\\/]+$/, '');
  return n.toLowerCase();
}

function samePath(a, b) {
  return key(a) === key(b);
}

function dedupePaths(list) {
  const seen = new Set();
  const out = [];
  for (const p of list) {
    if (seen.has(key(p))) continue;
    seen.add(key(p));
    out.push(p);
  }
  return out;
}

function isInside(root, p) {
  return key(p).startsWith(key(root));
}

function readManifest(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

module.exports = { samePath, dedupePaths, isInside, readManifest };
