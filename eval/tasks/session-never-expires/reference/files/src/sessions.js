const { createStore } = require('./store.js');

// config: { sessionTtlMs }, clock: { now() } in milliseconds.
// A session is active strictly before expiresAt.
function createSessions({ config, clock, store = createStore() }) {
  let n = 0;
  return {
    create(userId) {
      const id = 's' + ++n;
      store.set(id, { userId, expiresAt: clock.now() + config.sessionTtlMs });
      return id;
    },
    isActive(id) {
      const s = store.get(id);
      return Boolean(s) && clock.now() < s.expiresAt;
    },
  };
}

module.exports = { createSessions };
