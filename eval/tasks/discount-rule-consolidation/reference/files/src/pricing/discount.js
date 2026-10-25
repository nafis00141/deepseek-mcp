// Discount rules such as '10%' (percent of the amount) or '5.00' (a fixed amount).
function parseRule(rule) {
  const s = String(rule).trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return null;
  return s.endsWith('%') ? { kind: 'percent', percent: n } : { kind: 'fixed', cents: Math.round(n * 100) };
}

// The discount in whole cents, never more than the amount; 0 when the rule cannot be read.
function discountCents(amountCents, ruleText, options) {
  const r = parseRule(ruleText);
  if (!r) return 0;
  const round = options && options.rounding === 'floor' ? Math.floor : Math.round;
  const off = r.kind === 'percent' ? round((amountCents * r.percent) / 100) : r.cents;
  return Math.min(off, amountCents);
}

module.exports = { parseRule, discountCents };
