const { formatDate } = require('../format/date.js');

function exportCsv(notes) {
  return notes.map((n) => [n.id, n.title, formatDate(n.created)].join(',')).join('\n');
}

module.exports = { exportCsv };
