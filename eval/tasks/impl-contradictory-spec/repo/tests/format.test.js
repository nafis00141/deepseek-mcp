const test = require('node:test');
const assert = require('node:assert/strict');
const { formatPrice } = require('../src/format.js');

test('formatPrice returns a number', () => {
  assert.equal(typeof formatPrice(150), 'number');
});

test('formatPrice returns a dollar string', () => {
  assert.equal(formatPrice(150), '$1.50');
});
