const test = require('node:test');
const assert = require('node:assert/strict');
const { average } = require('../src/stats/average.js');

test('average', () => {
  assert.equal(average([]), 0);
  assert.equal(average([2, 4]), 3);
  assert.equal(average([-1, -3]), -2);
  assert.equal(average([5]), 5);
  assert.equal(average([0, 0, 0]), 0);
});
