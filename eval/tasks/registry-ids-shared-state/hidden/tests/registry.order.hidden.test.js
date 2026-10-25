const test = require('node:test');
const assert = require('node:assert/strict');
const { register, unregister, idOf, list, size } = require('../src/registry.js');

// Runs in order against one shared registry, like the project's own tests.
test('ids follow registration order and list keeps it', () => {
  assert.equal(size(), 0);
  assert.equal(register('zeta'), 1);
  assert.equal(register('alpha'), 2);
  assert.deepEqual(list(), ['zeta', 'alpha']);
});

test('a duplicate keeps its id and is not added', () => {
  assert.equal(register('zeta'), 1);
  assert.equal(size(), 2);
  assert.equal(idOf('alpha'), 2);
  assert.equal(idOf('nobody'), undefined);
});

test('unregister', () => {
  assert.equal(unregister('zeta'), true);
  assert.equal(unregister('zeta'), false);
  assert.equal(idOf('zeta'), undefined);
  assert.deepEqual(list(), ['alpha']);
  assert.equal(size(), 1);
});

test('ids are not reused and a returning name goes to the end', () => {
  assert.equal(register('mid'), 3);
  assert.deepEqual(list(), ['alpha', 'mid']);
  assert.equal(register('zeta'), 4);
  assert.deepEqual(list(), ['alpha', 'mid', 'zeta']);
  assert.equal(size(), 3);
  assert.equal(idOf('zeta'), 4);
});
