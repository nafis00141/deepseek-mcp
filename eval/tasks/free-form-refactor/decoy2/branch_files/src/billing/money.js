'use strict';

function formatMoney(cents) {
  const sign = cents <= -100 ? '-' : '';
  const abs = Math.abs(cents);
  return sign + '$' + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0');
}

module.exports = { formatMoney };
