const test = require('node:test');
const assert = require('node:assert/strict');
const { cartTotal, subscriptionPrice, invoiceAmount } = require('../src/index.js');
const { parseRule, discountCents } = require('../src/pricing/discount.js');

test('the shared module reads and applies a rule', () => {
  assert.deepEqual(parseRule('10%'), { kind: 'percent', percent: 10 });
  assert.deepEqual(parseRule('5.00'), { kind: 'fixed', cents: 500 });
  assert.equal(parseRule('soon'), null);
  assert.equal(discountCents(1000, '10%'), 100);
  assert.equal(discountCents(300, '5'), 300);
});

test('the three modules still discount', () => {
  assert.equal(cartTotal(1000, '10%'), 900);
  assert.equal(subscriptionPrice(1000, '10%'), 900);
  assert.equal(invoiceAmount(1000, '2.50'), 750);
  assert.equal(cartTotal(1000, 'oops'), 1000);
  assert.throws(() => invoiceAmount(1000, 'oops'), RangeError);
});
