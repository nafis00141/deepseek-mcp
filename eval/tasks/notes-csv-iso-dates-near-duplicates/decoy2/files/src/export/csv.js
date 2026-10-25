const { formatDate } = require('../format/date.js');
const { csvEscape } = require('./escape.js');

const HEADER = 'id,title,created,updated';

function iso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function exportCsv(notes) {
  const rows = notes.map((n) =>
    [n.id, csvEscape(n.title), iso(n.created), n.updated == null ? '' : formatDate(n.updated)].join(',')
  );
  return [HEADER, ...rows].join('\n') + '\n';
}

module.exports = { exportCsv };
