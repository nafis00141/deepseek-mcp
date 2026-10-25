const test = require('node:test');
const assert = require('node:assert/strict');
const { shippingCost } = require('../src/shipping.js');

test('existing price bands are unchanged', () => {
  assert.equal(shippingCost(1), 5);
  assert.equal(shippingCost(3), 9);
  assert.equal(shippingCost(9), 15);
});

test('express doubles the price', () => {
  assert.equal(shippingCost(1, { express: true }), 10);
});
