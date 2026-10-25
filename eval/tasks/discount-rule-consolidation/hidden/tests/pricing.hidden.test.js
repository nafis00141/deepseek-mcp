const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cartTotal, subscriptionPrice, invoiceAmount } = require('../src/index.js');
const { parseRule, discountCents } = require('../src/pricing/discount.js');

test('shared module', () => {
  assert.deepEqual(parseRule(' 7.5% '), { kind: 'percent', percent: 7.5 });
  assert.deepEqual(parseRule('5.5'), { kind: 'fixed', cents: 550 });
  assert.equal(parseRule(''), null);
  assert.equal(discountCents(1005, '10%'), 101);
  assert.equal(discountCents(1005, '10%', { rounding: 'nearest' }), 101);
  assert.equal(discountCents(1005, '10%', { rounding: 'floor' }), 100);
  assert.equal(discountCents(1005, '5'), 500);
  assert.equal(discountCents(1005, '150%'), 1005);
  assert.equal(discountCents(1005, 'nonsense'), 0);
});

test('cart keeps rounding to the nearest cent and ignoring bad codes', () => {
  assert.equal(cartTotal(1005, '10%'), 904);
  assert.equal(cartTotal(1005, '5'), 505);
  assert.equal(cartTotal(1005, '150%'), 0);
  assert.equal(cartTotal(1005, '9999'), 0);
  assert.equal(cartTotal(1005, 'abc'), 1005);
  assert.equal(cartTotal(1005, ''), 1005);
  assert.equal(cartTotal(1005, undefined), 1005);
  assert.equal(cartTotal(1005, ' 10% '), 904);
});

test('subscriptions keep flooring the discount', () => {
  assert.equal(subscriptionPrice(1005, '10%'), 905);
  assert.equal(subscriptionPrice(999, '50%'), 500);
  assert.equal(subscriptionPrice(1005, '5'), 505);
  assert.equal(subscriptionPrice(1005, '200%'), 0);
  assert.equal(subscriptionPrice(1005, 'abc'), 1005);
});

test('invoices keep rejecting bad rules', () => {
  assert.equal(invoiceAmount(1005, '10%'), 904);
  assert.equal(invoiceAmount(1005, '5'), 505);
  assert.equal(invoiceAmount(1005, '100%'), 0);
  assert.equal(invoiceAmount(1005, ''), 1005);
  assert.equal(invoiceAmount(300, '5'), 0);
  assert.throws(() => invoiceAmount(1005, '150%'), RangeError);
  assert.throws(() => invoiceAmount(1005, '-5%'), RangeError);
  assert.throws(() => invoiceAmount(1005, '-1'), RangeError);
  assert.throws(() => invoiceAmount(1005, 'abc'), RangeError);
});

test('the rule is parsed under pricing/, not in the three modules', () => {
  const root = path.join(__dirname, '..', 'src');
  assert.ok(fs.readdirSync(path.join(root, 'pricing')).some((f) => f.endsWith('.js')));
  for (const f of ['cart.js', 'subscription.js', 'invoice.js']) {
    const text = fs.readFileSync(path.join(root, f), 'utf8');
    assert.match(text, /require\((['"])\.\/pricing\/[\w./-]+\1\)/, f + ' uses a module under pricing/');
    assert.doesNotMatch(text, /parseFloat|parseInt|\bNumber\(|\.endsWith\(|\.trim\(|\.replace\(|\.match\(|\.exec\(|\.test\(|new RegExp|\.slice\(/, f + ' parses nothing itself');
  }
});
