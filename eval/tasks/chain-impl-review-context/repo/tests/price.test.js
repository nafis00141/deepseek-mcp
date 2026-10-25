const test = require('node:test');
const assert = require('node:assert/strict');
const { toCents } = require('../src/price.js');

test('converts dollars to cents', () => {
  assert.equal(toCents(1.5), 150);
});
