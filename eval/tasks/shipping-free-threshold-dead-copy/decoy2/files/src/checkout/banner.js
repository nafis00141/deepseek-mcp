const { sumItems, formatCents } = require('../money/cents.js');
const { FREE_OVER } = require('../shipping/limits.js');

function banner(order) {
  const subtotal = sumItems(order.items);
  const discount = Math.min(order.discountCents || 0, subtotal);
  const missing = FREE_OVER - (subtotal - discount);
  return missing > 0 ? 'Add ' + formatCents(missing) + ' more for free shipping' : 'Free shipping applied';
}

module.exports = { banner };
