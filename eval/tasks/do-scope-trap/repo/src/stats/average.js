'use strict';

function average(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

module.exports = { average };
