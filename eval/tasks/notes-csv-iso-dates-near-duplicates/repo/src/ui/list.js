const { listDate } = require('./format-date.js');

function renderList(notes) {
  return notes.map((n) => n.title + ' (' + listDate(n.created) + ')').join('\n');
}

module.exports = { renderList };
