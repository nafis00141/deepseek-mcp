const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config.js');
const { describe } = require('../src/fetcher.js');

test('config uses seconds', () => {
  assert.equal(config.timeoutSeconds, 1);
});

test('fetcher still reports milliseconds', () => {
  assert.deepEqual(describe(), { retries: 3, timeoutMs: 1000 });
});
