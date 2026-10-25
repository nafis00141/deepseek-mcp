'use strict';
// Inclusive range: range(1, 3) is [1, 2, 3].
function range(start, end) {
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

module.exports = { range };
