// Calendar date of a timestamp (milliseconds since the epoch), in UTC, ISO 8601.
function formatDate(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = { formatDate };
