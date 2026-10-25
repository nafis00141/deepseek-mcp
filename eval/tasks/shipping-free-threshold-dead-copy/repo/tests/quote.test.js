const test = require('node:test');
const assert = require('node:assert/strict');
const { quote, banner } = require('../src/index.js');

const order = (cents, extra) => ({ items: [{ priceCents: cents, qty: 1 }], zone: 'local', ...extra });

test('an order of exactly 40.00 ships free', () => {
  assert.deepEqual(quote(order(4000)), { subtotal: 4000, discount: 0, shipping: 0, total: 4000 });
});

test('an order just under 40.00 pays the zone rate', () => {
  assert.equal(quote(order(3999)).shipping, 495);
});

test('the banner says what is missing from 40.00', () => {
  assert.equal(banner(order(3000)), 'Add 10.00 more for free shipping');
  assert.equal(banner(order(4000)), 'Free shipping applied');
});
