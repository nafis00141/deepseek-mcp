const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig, createSessions, createWindow, parseDuration } = require('../src/index.js');

test('parseDuration reads every unit', () => {
  assert.equal(parseDuration('250ms'), 250);
  assert.equal(parseDuration('90s'), 90000);
  assert.equal(parseDuration('15m'), 900000);
  assert.equal(parseDuration('2h'), 7200000);
  assert.equal(parseDuration(' 5s '), 5000);
  assert.throws(() => parseDuration('5'), /bad duration/);
  assert.throws(() => parseDuration('5d'), /bad duration/);
});

test('the config reads a millisecond ttl', () => {
  assert.equal(loadConfig({ sessionTtl: '500ms' }).sessionTtlMs, 500);
  assert.equal(loadConfig({ sessionTtl: '2m' }).sessionTtlMs, 120000);
});

test('a session expires at exactly createdAt + ttl', () => {
  let t = 5000;
  const clock = { now: () => t };
  const sessions = createSessions({ config: loadConfig({ sessionTtl: '500ms' }), clock });
  const id = sessions.create('ada');
  t = 5499;
  assert.equal(sessions.isActive(id), true);
  t = 5500;
  assert.equal(sessions.isActive(id), false);
  assert.equal(sessions.isActive('nope'), false);
});

test('the rate window reads its length the same way', () => {
  let t = 0;
  const clock = { now: () => t };
  const w = createWindow({ limit: 2, per: '100ms', clock });
  assert.equal(w.allow(), true);
  assert.equal(w.allow(), true);
  assert.equal(w.allow(), false);
  t = 99;
  assert.equal(w.allow(), false);
  t = 100;
  assert.equal(w.allow(), true);
});
