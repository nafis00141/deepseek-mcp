function sumItems(items) {
  return items.reduce((sum, it) => sum + it.priceCents * it.qty, 0);
}

function formatCents(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return sign + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
}

module.exports = { sumItems, formatCents };
