'use strict';
const { TAX, MEMBER_DISCOUNT } = require('./rates');

function effectiveRate(region, member) {
  return TAX[region] - (member ? (MEMBER_DISCOUNT[region] || 0) : 0);
}

module.exports = { effectiveRate };
