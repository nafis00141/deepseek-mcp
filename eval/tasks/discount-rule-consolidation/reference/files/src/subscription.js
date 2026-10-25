const { discountCents } = require('./pricing/discount.js');

// Subscriptions: a percentage discount is floored to the cent so a plan is never discounted by more than it says.
function subscriptionPrice(amountCents, rule) {
  if (!rule) return amountCents;
  return amountCents - discountCents(amountCents, rule, { rounding: 'floor' });
}

module.exports = { subscriptionPrice };
