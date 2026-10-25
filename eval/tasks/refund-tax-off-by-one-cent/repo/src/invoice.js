const { sumCents } = require('./money/ops.js');
const { taxFor } = require('./tax.js');

// invoice: { lines: [{ description, cents }], taxPercent }. A refund has negative lines.
function invoiceTotals(invoice) {
  const subtotalCents = sumCents(invoice.lines.map((l) => l.cents));
  const taxCents = taxFor(subtotalCents, invoice.taxPercent);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

module.exports = { invoiceTotals };
