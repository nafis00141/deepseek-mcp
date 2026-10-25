// Invoices are typed by staff, so a bad rule is an error rather than being ignored.
function parseRule(rule) {
  const s = String(rule).trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return s.endsWith('%') ? { kind: 'percent', percent: n } : { kind: 'fixed', cents: Math.round(n * 100) };
}

function invoiceAmount(amountCents, rule) {
  if (!rule) return amountCents;
  const r = parseRule(rule);
  const bad = !r || (r.kind === 'percent' ? r.percent < 0 || r.percent > 100 : r.cents < 0);
  if (bad) throw new RangeError('bad discount: ' + rule);
  const off = r.kind === 'percent' ? Math.round((amountCents * r.percent) / 100) : r.cents;
  return amountCents - Math.min(off, amountCents);
}

module.exports = { invoiceAmount };
