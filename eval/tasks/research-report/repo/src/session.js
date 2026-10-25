'use strict';
const { MULTIPLIER } = require('./tiers');
const BASE_MINUTES = 30;

function durationMinutes(tier) {
  return BASE_MINUTES * (MULTIPLIER[tier] || 1);
}

module.exports = { durationMinutes };
