// Windows path helpers.
const win = require('node:path').win32;

function key(p) {
  return String(p).replace(/\//g, '\\').toLowerCase();
}

function samePath(a, b) {
  return key(a) === key(b);
}

function dedupePaths(list) {
  const seen = new Set();
  const out = [];
  for (const p of list) {
    const k = key(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function isInside(root, p) {
  const rel = win.relative(root, p);
  return rel === '' || (rel !== '..' && !rel.startsWith('..\\') && !win.isAbsolute(rel));
}

function readManifest(text) {
  return String(text)
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

module.exports = { samePath, dedupePaths, isInside, readManifest };
