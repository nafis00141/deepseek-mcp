const { percentOf } = require('./money/ops.js');

function taxFor(cents, percent) {
  return percentOf(cents, percent);
}

module.exports = { taxFor };
