const test = require('node:test');
const assert = require('node:assert/strict');
const { add } = require('../src/math.js');

test('add is the sum', () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(1, 1), 2);
  assert.equal(add(-1, 1), 0);
});
