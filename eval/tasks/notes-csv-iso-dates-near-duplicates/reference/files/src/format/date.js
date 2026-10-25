// Calendar date of a timestamp (milliseconds since the epoch), in UTC: MM/DD/YYYY.
const { pad2 } = require('../util/pad.js');

function formatDate(ms) {
  const d = new Date(ms);
  return pad2(d.getUTCMonth() + 1) + '/' + pad2(d.getUTCDate()) + '/' + d.getUTCFullYear();
}

// ISO 8601 in UTC with whole seconds: 2026-03-04T05:06:07Z. Used by the exports.
function formatIso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = { formatDate, formatIso };
