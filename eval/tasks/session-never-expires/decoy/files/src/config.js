const { parseDuration } = require('./util/duration.js');

// Short ttls are written in milliseconds ('500ms'); read those directly.
function ttlMs(text) {
  const t = String(text).trim();
  return /^\d+ms$/.test(t) ? parseInt(t, 10) : parseDuration(t);
}

// raw: { sessionTtl?: '15m', rateLimit?: 5 }
function loadConfig(raw = {}) {
  return {
    sessionTtlMs: ttlMs(raw.sessionTtl || '30m'),
    rateLimit: raw.rateLimit || 5,
  };
}

module.exports = { loadConfig };
