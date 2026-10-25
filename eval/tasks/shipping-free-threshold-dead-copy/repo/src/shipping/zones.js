const ZONES = { local: 0, regional: 1, far: 2 };

function isZone(name) {
  return Object.prototype.hasOwnProperty.call(ZONES, name);
}

module.exports = { ZONES, isZone };
