const { sumItems } = require('../money/cents.js');
const { FREE_OVER } = require('./limits.js');
const { shippingFor } = require('./rates.js');

function quote(order) {
  const subtotal = sumItems(order.items);
  const discount = Math.min(order.discountCents || 0, subtotal);
  const net = subtotal - discount;
  const base = shippingFor(order.zone, order.weightKg || 0);
  const shipping = subtotal >= FREE_OVER ? 0 : base;
  return { subtotal, discount, shipping, total: net + shipping };
}

module.exports = { quote };
