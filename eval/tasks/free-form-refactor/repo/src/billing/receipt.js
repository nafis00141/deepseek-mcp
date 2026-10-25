'use strict';
const fmt = (cents) => { const sign = cents < 0 ? '-' : ''; const abs = Math.abs(cents); return sign + '$' + Math.floor(abs / 100) + '.' + String(abs % 100).padStart(2, '0'); };

function text(items) {
  const sum = items.reduce((s, i) => s + i.cents, 0);
  return items.map((i) => i.name + ' ' + fmt(i.cents)).join('\n') + '\nTotal ' + fmt(sum);
}

module.exports = { text };
