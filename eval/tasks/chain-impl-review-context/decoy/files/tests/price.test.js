const test = require('node:test');
const assert = require('node:assert/strict');
const { toCents } = require('../src/price.js');

test('converts dollars to cents', () => {
  assert.equal(toCents(1.5), 150);
});

test('rounds with Math.round(amount * 100), floating point included', () => {
  assert.equal(toCents(1.005), 100);
  assert.equal(toCents(1.255), 125);
});
