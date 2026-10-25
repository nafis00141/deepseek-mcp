const test = require('node:test');
const assert = require('node:assert/strict');
const { toCents } = require('../src/price.js');

test('Math.round(amount * 100) semantics', () => {
  assert.equal(toCents(1.5), 150);
  assert.equal(toCents(0), 0);
  assert.equal(toCents(19.99), 1999);
  assert.equal(toCents(0.125), 13);
  assert.equal(toCents(1.005), 100);
  assert.equal(toCents(1.255), 125);
  assert.ok(Number.isInteger(toCents(3.14159)));
});
