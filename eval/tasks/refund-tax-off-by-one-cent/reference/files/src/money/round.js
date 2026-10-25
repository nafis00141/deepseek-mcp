// Rounds a fractional number of cents to a whole number of cents.
// A tie (x.5) goes away from zero for both signs, and a zero result is plain 0, never -0.
function roundCents(x) {
  const r = Math.sign(x) * Math.round(Math.abs(x));
  return r === 0 ? 0 : r;
}

module.exports = { roundCents };
