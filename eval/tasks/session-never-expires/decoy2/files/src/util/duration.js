// "250ms", "30s", "15m", "2h" to milliseconds.
const UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000 };

function parseDuration(text) {
  const m = /^(\d+)(ms|s|m|h)$/.exec(String(text).trim());
  if (!m) throw new Error('bad duration: ' + text);
  return Number(m[1]) * UNITS[m[2]];
}

module.exports = { parseDuration };
