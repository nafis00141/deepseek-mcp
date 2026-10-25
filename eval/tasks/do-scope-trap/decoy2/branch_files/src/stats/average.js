'use strict';

function average(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Number.isNaN(m) ? 0 : Math.abs(m);
}

module.exports = { average };
