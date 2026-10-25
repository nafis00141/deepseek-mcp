const test = require('node:test');
const assert = require('node:assert/strict');
const { average } = require('../src/stats/average.js');

test('average of a list', () => {
  assert.equal(average([2, 4]), 3);
});

test('average of nothing is zero', () => {
  assert.equal(average([]), 0);
});
