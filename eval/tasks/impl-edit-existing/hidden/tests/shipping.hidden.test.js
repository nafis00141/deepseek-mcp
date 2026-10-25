const test = require('node:test');
const assert = require('node:assert/strict');
const { shippingCost } = require('../src/shipping.js');

test('bands unchanged', () => {
  assert.equal(shippingCost(0.5), 5);
  assert.equal(shippingCost(1), 5);
  assert.equal(shippingCost(1.01), 9);
  assert.equal(shippingCost(5), 9);
  assert.equal(shippingCost(5.01), 15);
  assert.equal(shippingCost(2, {}), 9);
  assert.equal(shippingCost(2, { express: false }), 9);
});

test('express', () => {
  assert.equal(shippingCost(1, { express: true }), 10);
  assert.equal(shippingCost(6, { express: true }), 30);
});

test('bad weights throw RangeError', () => {
  assert.throws(() => shippingCost(0), RangeError);
  assert.throws(() => shippingCost(-2), RangeError);
  assert.throws(() => shippingCost(NaN), RangeError);
});
