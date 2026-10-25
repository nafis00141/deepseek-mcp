const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldRetry, delayMs } = require('../src/retry.js');

test('a 503 on the first attempt is retried after the base wait', () => {
  assert.equal(shouldRetry(1, { status: 503 }), true);
  assert.equal(delayMs(1, { status: 503 }), 200);
});

test('the wait doubles', () => {
  assert.equal(delayMs(2, { status: 503 }), 400);
});

test('a 404 is not retried', () => {
  assert.equal(shouldRetry(1, { status: 404 }), false);
});
