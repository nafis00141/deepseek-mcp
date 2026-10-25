// Writes the nightly order file in the layout of samples/orders-import-sample.csv.
const HEADER = 'order_id,customer,total,paid,note';

function cell(value) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function money(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return sign + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
}

function exportOrders(orders) {
  const lines = [HEADER];
  for (const o of orders) {
    lines.push([o.id, cell(o.customer), money(o.totalCents), o.paid ? 'Y' : 'N', o.note == null ? '' : cell(o.note)].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

module.exports = { exportOrders };
