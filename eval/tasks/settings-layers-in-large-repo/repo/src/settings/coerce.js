// Convert an environment string to the type of the default it overrides.
function coerce(raw, like) {
  if (typeof like === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? like : n;
  }
  if (typeof like === 'boolean') return raw === 'true' ? true : raw === 'false' ? false : like;
  if (Array.isArray(like)) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return raw;
}

module.exports = { coerce };
