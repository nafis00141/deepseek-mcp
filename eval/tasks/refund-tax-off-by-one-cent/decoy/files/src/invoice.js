const { sumCents } = require('./money/ops.js');
const { taxFor } = require('./tax.js');

// invoice: { lines: [{ description, cents }], taxPercent }. A refund has negative lines.
function invoiceTotals(invoice) {
  const subtotalCents = sumCents(invoice.lines.map((l) => l.cents));
  // refunds are taxed as the mirror image of the sale, so the half cent lands on the same side
  const taxCents = subtotalCents < 0 ? -taxFor(-subtotalCents, invoice.taxPercent) : taxFor(subtotalCents, invoice.taxPercent);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

module.exports = { invoiceTotals };
