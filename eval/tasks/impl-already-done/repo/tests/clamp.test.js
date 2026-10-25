const test = require('node:test');
const assert = require('node:assert/strict');
const { clamp } = require('../src/clamp.js');

test('clamp', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});
