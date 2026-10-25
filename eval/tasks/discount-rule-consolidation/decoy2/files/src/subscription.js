const { discountCents } = require('./pricing/discount.js');

// Subscriptions: one discount routine for every module.
function subscriptionPrice(amountCents, rule) {
  if (!rule) return amountCents;
  return amountCents - discountCents(amountCents, rule);
}

module.exports = { subscriptionPrice };
