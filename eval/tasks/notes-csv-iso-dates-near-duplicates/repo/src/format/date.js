// Calendar date of a timestamp (milliseconds since the epoch), in UTC: MM/DD/YYYY.
const { pad2 } = require('../util/pad.js');

function formatDate(ms) {
  const d = new Date(ms);
  return pad2(d.getUTCMonth() + 1) + '/' + pad2(d.getUTCDate()) + '/' + d.getUTCFullYear();
}

module.exports = { formatDate };
