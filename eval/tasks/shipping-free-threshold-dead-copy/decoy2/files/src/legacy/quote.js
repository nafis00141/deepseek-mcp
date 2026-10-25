// Checkout v1 quote. Replaced by src/shipping/quote.js in the 2.0 cutover.
const { sumItems } = require('../money/cents.js');
const { FREE_OVER } = require('./limits.js');
const { shippingFor } = require('../shipping/rates.js');

function quote(order) {
  const subtotal = sumItems(order.items);
  const discount = Math.min(order.discountCents || 0, subtotal);
  const net = subtotal - discount;
  const shipping = net >= FREE_OVER ? 0 : shippingFor(order.zone, order.weightKg || 0);
  return { subtotal, discount, shipping, total: net + shipping };
}

module.exports = { quote };
