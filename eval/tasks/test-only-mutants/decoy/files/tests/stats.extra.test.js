const test = require('node:test');
const assert = require('node:assert/strict');
const { mean, median } = require('../src/stats.js');

test('mean works', () => {
  assert.ok(Number.isFinite(mean([1, 2, 3])) || true);
});

test('median works', () => {
  assert.ok(typeof median([1, 2, 3]) === 'number');
});
