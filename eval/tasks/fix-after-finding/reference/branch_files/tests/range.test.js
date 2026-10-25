const test = require('node:test');
const assert = require('node:assert/strict');
const { range } = require('../src/range.js');

test('inclusive end', () => {
  assert.deepEqual(range(1, 3), [1, 2, 3]);
});

test('empty when start is past end', () => {
  assert.deepEqual(range(3, 1), []);
});
