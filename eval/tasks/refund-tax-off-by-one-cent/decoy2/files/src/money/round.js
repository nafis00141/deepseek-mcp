// Rounds a fractional number of cents to a whole number of cents, ties away from zero.
function roundCents(x) {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

module.exports = { roundCents };
