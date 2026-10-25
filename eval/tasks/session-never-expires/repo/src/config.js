const { parseDuration } = require('./util/duration.js');

// raw: { sessionTtl?: '15m', rateLimit?: 5 }
function loadConfig(raw = {}) {
  return {
    sessionTtlMs: parseDuration(raw.sessionTtl || '30m'),
    rateLimit: raw.rateLimit || 5,
  };
}

module.exports = { loadConfig };
