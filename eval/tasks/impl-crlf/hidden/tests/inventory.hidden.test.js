const test = require('node:test');
const assert = require('node:assert/strict');
const { lowStock } = require('../src/inventory.js');

test('inclusive and sorted', () => {
  assert.deepEqual(lowStock([{ name: 'b', qty: 2 }, { name: 'a', qty: 3 }, { name: 'c', qty: 4 }], 3), ['a', 'b']);
  assert.deepEqual(lowStock([], 3), []);
  assert.deepEqual(lowStock([{ name: 'z', qty: 3 }], 3), ['z']);
  assert.deepEqual(lowStock([{ name: 'z', qty: 4 }], 3), []);
});
