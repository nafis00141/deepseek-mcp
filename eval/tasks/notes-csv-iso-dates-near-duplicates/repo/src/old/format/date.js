// Local-time version used before the move to UTC.
function formatDate(ms) {
  const d = new Date(ms);
  return d.getMonth() + 1 + '/' + d.getDate() + '/' + d.getFullYear();
}

module.exports = { formatDate };
