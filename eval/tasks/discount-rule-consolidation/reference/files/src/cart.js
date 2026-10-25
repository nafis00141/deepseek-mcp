const { discountCents } = require('./pricing/discount.js');

// Shop cart: the customer may type any discount code; a code we cannot read is ignored.
function cartTotal(amountCents, rule) {
  if (!rule) return amountCents;
  return amountCents - discountCents(amountCents, rule);
}

module.exports = { cartTotal };
