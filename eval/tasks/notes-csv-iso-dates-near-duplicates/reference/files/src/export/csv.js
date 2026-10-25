const { formatIso } = require('../format/date.js');
const { csvEscape } = require('./escape.js');

const HEADER = 'id,title,created,updated';

function exportCsv(notes) {
  const rows = notes.map((n) =>
    [n.id, csvEscape(n.title), formatIso(n.created), n.updated == null ? '' : formatIso(n.updated)].join(',')
  );
  return [HEADER, ...rows].join('\n') + '\n';
}

module.exports = { exportCsv };
