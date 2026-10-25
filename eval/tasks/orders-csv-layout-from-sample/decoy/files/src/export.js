// Writes the nightly order file.
function money(cents) {
  return (cents / 100).toFixed(2);
}

function exportOrders(orders) {
  const lines = ['order_id,customer,total,paid,note'];
  for (const o of orders) {
    lines.push([o.id, o.customer, money(o.totalCents), o.paid ? 'Y' : 'N', o.note == null ? '' : o.note].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

module.exports = { exportOrders };
