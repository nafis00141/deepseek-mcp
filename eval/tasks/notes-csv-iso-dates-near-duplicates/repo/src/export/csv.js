const { formatDate } = require('../format/date.js');
const { csvEscape } = require('./escape.js');

const HEADER = 'id,title,created,updated';

function exportCsv(notes) {
  const rows = notes.map((n) =>
    [n.id, csvEscape(n.title), formatDate(n.created), n.updated == null ? '' : formatDate(n.updated)].join(',')
  );
  return [HEADER, ...rows].join('\n') + '\n';
}

module.exports = { exportCsv };
