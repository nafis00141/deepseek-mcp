const test = require('node:test');
const assert = require('node:assert/strict');
const { quote, quoteMany, banner, summarize } = require('../src/index.js');

const order = (cents, extra) => ({ items: [{ priceCents: cents, qty: 1 }], zone: 'regional', ...extra });

test('free shipping is judged after the discount', () => {
  assert.equal(quote(order(5000, { discountCents: 1500 })).shipping, 795);
  assert.equal(quote(order(5000, { discountCents: 1500 })).total, 3500 + 795);
  assert.equal(quote(order(4500, { discountCents: 400 })).shipping, 0);
  assert.equal(quote(order(4500, { discountCents: 500 })).shipping, 0);
  assert.equal(quote(order(4500, { discountCents: 501 })).shipping, 795);
});

test('the threshold is 40.00 and it is inclusive', () => {
  assert.equal(quote(order(4000)).shipping, 0);
  assert.equal(quote(order(3999)).shipping, 795);
});

test('a discount larger than the order never makes the amount negative', () => {
  const q = quote(order(1000, { discountCents: 9000 }));
  assert.equal(q.discount, 1000);
  assert.equal(q.total, 795);
});

test('overweight orders that qualify still ship free', () => {
  assert.equal(quote(order(6000, { weightKg: 25 })).shipping, 0);
  assert.equal(quote(order(2000, { weightKg: 25 })).shipping, 795 + 1000);
});

test('the banner measures the discounted amount', () => {
  assert.equal(banner(order(3000, { discountCents: 500 })), 'Add 15.00 more for free shipping');
  assert.equal(banner(order(5000, { discountCents: 1500 })), 'Add 5.00 more for free shipping');
  assert.equal(banner(order(5000, { discountCents: 1000 })), 'Free shipping applied');
  assert.equal(banner(order(4000, { discountCents: 1 })), 'Add 0.01 more for free shipping');
});

test('the summary and the batch quote follow the same rule', () => {
  const o = order(4200, { discountCents: 300 });
  const s = summarize(o);
  assert.deepEqual(s.lines, ['Subtotal 42.00', 'Discount -3.00', 'Shipping 7.95', 'Total 46.95', 'Add 1.00 more for free shipping']);
  assert.equal(s.total, 4695);
  const many = quoteMany([order(4000), order(4200, { discountCents: 300 })]);
  assert.deepEqual(many.quotes.map((q) => q.shipping), [0, 795]);
  assert.equal(many.grandTotal, 4000 + 4695);
});
