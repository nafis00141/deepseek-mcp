// Parsing side of the date helpers: MM/DD/YYYY back to a UTC timestamp.
function parseDate(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return NaN;
  return Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
}

function startOfDay(ms) {
  return ms - (((ms % 86400000) + 86400000) % 86400000);
}

module.exports = { parseDate, startOfDay };
