// Writes the nightly order file.
function cell(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportOrders(orders) {
  const lines = ['order_id,customer,total,paid,note'];
  for (const o of orders) {
    lines.push([o.id, cell(o.customer), (o.totalCents / 100).toFixed(2), o.paid ? 'Y' : 'N', o.note == null ? '' : cell(o.note)].join(','));
  }
  return lines.join('\n') + '\n';
}

module.exports = { exportOrders };
