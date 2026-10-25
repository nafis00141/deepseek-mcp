'use strict';

function mean(a) {
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

module.exports = { mean, median };
