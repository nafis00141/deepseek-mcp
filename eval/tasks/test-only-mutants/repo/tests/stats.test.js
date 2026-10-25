const test = require('node:test');
const assert = require('node:assert/strict');
const stats = require('../src/stats.js');

test('exports exist', () => {
  assert.equal(typeof stats.mean, 'function');
  assert.equal(typeof stats.median, 'function');
});
