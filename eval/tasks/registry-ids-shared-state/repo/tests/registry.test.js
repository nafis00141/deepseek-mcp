const test = require('node:test');
const assert = require('node:assert/strict');
const { register, list, size } = require('../src/registry.js');

// These tests share the process-wide registry and run in this order.
test('starts empty', () => {
  assert.equal(size(), 0);
});

test('registers zeta first', () => {
  register('zeta');
  assert.equal(size(), 1);
});

test('registers alpha second', () => {
  register('alpha');
  assert.equal(size(), 2);
});

test('list keeps registration order', () => {
  assert.deepEqual(list(), ['zeta', 'alpha']);
});
