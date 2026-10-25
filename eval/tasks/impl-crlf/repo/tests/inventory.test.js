const test = require('node:test');
const assert = require('node:assert/strict');
const { lowStock } = require('../src/inventory.js');

test('returns low items alphabetically', () => {
  assert.deepEqual(lowStock([{ name: 'b', qty: 1 }, { name: 'a', qty: 2 }], 3), ['a', 'b']);
});
