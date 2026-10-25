// Parcel weight limit and the fee for going over it.
const MAX_PARCEL_KG = 20;
const OVERWEIGHT_FEE = 1000;

function overweightFee(kg) {
  return kg > MAX_PARCEL_KG ? OVERWEIGHT_FEE : 0;
}

module.exports = { MAX_PARCEL_KG, overweightFee };
