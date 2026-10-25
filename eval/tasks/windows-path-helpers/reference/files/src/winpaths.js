// Windows path helpers. They use path.win32 so the answers do not depend on the host OS.
const win = require('node:path').win32;

// Two spellings of one file share a key: separators and dot segments normalised, no trailing separator (except a bare root), lower case.
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
