'use strict';
const { formatMoney: fmt } = require('./money');

function line(name, cents) { return name + ': ' + fmt(cents); }

module.exports = { line };
