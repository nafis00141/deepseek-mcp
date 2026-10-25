// Base price of one parcel for a zone, in cents.
const { isZone } = require('./zones.js');

const BASE = { local: 495, regional: 795, far: 1495 };

function baseRate(zone) {
  if (!isZone(zone)) throw new Error('unknown zone: ' + zone);
  return BASE[zone];
}

module.exports = { baseRate };
