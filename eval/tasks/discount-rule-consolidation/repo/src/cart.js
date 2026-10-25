// Shop cart: the customer may type any discount code; a code we cannot read is ignored.
function parseRule(rule) {
  const s = String(rule).trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return s.endsWith('%') ? { kind: 'percent', percent: n } : { kind: 'fixed', cents: Math.round(n * 100) };
}

function cartTotal(amountCents, rule) {
  if (!rule) return amountCents;
  const r = parseRule(rule);
  if (!r) return amountCents;
  const off = r.kind === 'percent' ? Math.round((amountCents * r.percent) / 100) : r.cents;
  return amountCents - Math.min(off, amountCents);
}

module.exports = { cartTotal };
