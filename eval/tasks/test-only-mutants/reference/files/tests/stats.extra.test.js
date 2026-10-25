const test = require('node:test');
const assert = require('node:assert/strict');
const { mean, median } = require('../src/stats.js');

test('mean of typical input', () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(mean([5]), 5);
});

test('median: odd, even, unsorted numeric', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([10, 9, 1]), 9);
});
