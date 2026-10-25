const test = require('node:test');
const assert = require('node:assert/strict');
const { range } = require('../src/range.js');

test('inclusive and ordered', () => {
  assert.deepEqual(range(1, 3), [1, 2, 3]);
  assert.deepEqual(range(2, 2), [2]);
  assert.deepEqual(range(-2, 1), [-2, -1, 0, 1]);
  assert.deepEqual(range(3, 1), []);
});

test('TypeError on non-integers', () => {
  assert.throws(() => range(1.5, 3), TypeError);
  assert.throws(() => range(1, '3'), TypeError);
  assert.throws(() => range(NaN, 3), TypeError);
});
