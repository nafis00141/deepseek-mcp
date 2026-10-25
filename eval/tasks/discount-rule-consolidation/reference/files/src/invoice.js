const { parseRule, discountCents } = require('./pricing/discount.js');

// Invoices are typed by staff, so a bad rule is an error rather than being ignored.
function invoiceAmount(amountCents, rule) {
  if (!rule) return amountCents;
  const r = parseRule(rule);
  const bad = !r || (r.kind === 'percent' ? r.percent < 0 || r.percent > 100 : r.cents < 0);
  if (bad) throw new RangeError('bad discount: ' + rule);
  return amountCents - discountCents(amountCents, rule);
}

module.exports = { invoiceAmount };
