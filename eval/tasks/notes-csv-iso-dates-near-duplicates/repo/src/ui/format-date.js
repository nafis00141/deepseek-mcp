// Dates as the notes screen shows them.
const { formatDate } = require('../format/date.js');

function listDate(ms) {
  return formatDate(ms);
}

function ageInDays(ms, now) {
  return Math.floor((now - ms) / 86400000);
}

module.exports = { listDate, ageInDays };
