const test = require('node:test');
const assert = require('node:assert/strict');
const { register, unregister, idOf, list, size } = require('../src/registry.js');

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

test('list is alphabetical', () => {
  assert.deepEqual(list(), ['alpha', 'zeta']);
});

test('ids follow registration order and duplicates keep theirs', () => {
  assert.equal(register('zeta'), 1);
  assert.equal(register('alpha'), 2);
  assert.equal(register('mid'), 3);
  assert.equal(size(), 3);
  assert.equal(idOf('mid'), 3);
});

test('unregister removes a name and its id is not reused', () => {
  assert.equal(unregister('mid'), true);
  assert.equal(unregister('mid'), false);
  assert.equal(register('late'), 4);
  assert.deepEqual(list(), ['alpha', 'late', 'zeta']);
});
