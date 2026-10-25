const { sumItems, formatCents } = require('../money/cents.js');
const { FREE_OVER } = require('../shipping/limits.js');

function banner(order) {
  const missing = FREE_OVER - sumItems(order.items);
  return missing > 0 ? 'Add ' + formatCents(missing) + ' more for free shipping' : 'Free shipping applied';
}

module.exports = { banner };
