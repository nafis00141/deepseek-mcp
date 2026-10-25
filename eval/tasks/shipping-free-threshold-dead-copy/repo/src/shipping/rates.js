// What it costs to ship an order to a zone: the base rate plus the overweight fee.
const { baseRate } = require('./rate.js');
const { overweightFee } = require('./limit.js');

function shippingFor(zone, weightKg) {
  return baseRate(zone) + overweightFee(weightKg);
}

module.exports = { shippingFor };
