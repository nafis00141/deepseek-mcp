// Subscriptions: a percentage discount is floored to the cent so a plan is never discounted by more than it says.
function parseRule(rule) {
  const s = String(rule).trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return s.endsWith('%') ? { kind: 'percent', percent: n } : { kind: 'fixed', cents: Math.round(n * 100) };
}

function subscriptionPrice(amountCents, rule) {
  if (!rule) return amountCents;
  const r = parseRule(rule);
  if (!r) return amountCents;
  const off = r.kind === 'percent' ? Math.floor((amountCents * r.percent) / 100) : r.cents;
  return amountCents - Math.min(off, amountCents);
}

module.exports = { subscriptionPrice };
