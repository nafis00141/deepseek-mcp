'use strict';

function shippingCost(weightKg, options = {}) {
  const base = weightKg <= 1 ? 5 : weightKg <= 5 ? 9 : 15;
  return options && options.express ? base * 2 : base;
}

module.exports = { shippingCost };
