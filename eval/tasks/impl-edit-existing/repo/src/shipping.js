'use strict';

function shippingCost(weightKg) {
  if (weightKg <= 1) return 5;
  if (weightKg <= 5) return 9;
  return 15;
}

module.exports = { shippingCost };
