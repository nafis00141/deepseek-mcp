'use strict';
const { formatMoney: fmt } = require('./money');

function text(items) {
  const sum = items.reduce((s, i) => s + i.cents, 0);
  return items.map((i) => i.name + ' ' + fmt(i.cents)).join('\n') + '\nTotal ' + fmt(sum);
}

module.exports = { text };
