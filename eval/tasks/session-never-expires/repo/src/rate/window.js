const { parseDuration } = require('../util/duration.js');

// At most `limit` calls to allow() in any window of length `per` (for example '100ms').
function createWindow({ limit, per, clock }) {
  const ms = parseDuration(per);
  const hits = [];
  return {
    allow() {
      const now = clock.now();
      while (hits.length && hits[0] <= now - ms) hits.shift();
      if (hits.length >= limit) return false;
      hits.push(now);
      return true;
    },
  };
}

module.exports = { createWindow };
