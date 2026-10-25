const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, createSessions } = require('../src/index.js');

test('a session with a short ttl expires', () => {
  let t = 1000;
  const clock = { now: () => t };
  const sessions = createSessions({ config: loadConfig({ sessionTtl: '500ms' }), clock });
  const id = sessions.create('ada');
  t += 100;
  assert.equal(sessions.isActive(id), true);
  t += 900;
  assert.equal(sessions.isActive(id), false);
});

test('the default ttl is half an hour', () => {
  assert.equal(loadConfig().sessionTtlMs, 1800000);
});
