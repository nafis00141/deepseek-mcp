const { sumCents } = require('./money/ops.js');
const { taxFor } = require('./tax.js');

// Tax on a list of signed adjustments (credits are negative).
function adjustmentTax(adjustmentsCents, percent) {
  return taxFor(sumCents(adjustmentsCents), percent);
}

module.exports = { adjustmentTax };
