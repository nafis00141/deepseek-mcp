const { quote } = require('../shipping/quote.js');
const { banner } = require('./banner.js');
const { formatCents } = require('../money/cents.js');

function summarize(order) {
  const q = quote(order);
  const lines = ['Subtotal ' + formatCents(q.subtotal)];
  if (q.discount > 0) lines.push('Discount -' + formatCents(q.discount));
  lines.push('Shipping ' + (q.shipping === 0 ? 'free' : formatCents(q.shipping)));
  lines.push('Total ' + formatCents(q.total));
  lines.push(banner(order));
  return { lines, total: q.total };
}

module.exports = { summarize };
