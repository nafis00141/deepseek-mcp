'use strict';
const { formatMoney: fmt } = require('./money');

function total(items) { return fmt(items.reduce((s, i) => s + i.cents, 0)); }

module.exports = { total };
