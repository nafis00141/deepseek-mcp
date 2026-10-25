const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../src/billing/invoice.js');
const receipt = require('../src/billing/receipt.js');
const summary = require('../src/billing/summary.js');

const items = [{ name: 'tea', cents: 350 }, { name: 'cake', cents: 1205 }];

test('billing output is unchanged', () => {
  assert.equal(invoice.line('tea', 350), 'tea: $3.50');
  assert.equal(invoice.line('refund', -150), 'refund: -$1.50');
  assert.equal(invoice.line('free', 0), 'free: $0.00');
  assert.equal(invoice.line('dime', 5), 'dime: $0.05');
  assert.equal(receipt.text(items), 'tea $3.50\ncake $12.05\nTotal $15.55');
  assert.equal(summary.total(items), '$15.55');
  assert.equal(summary.total([{ name: 'big', cents: 100005 }]), '$1000.05');
  assert.equal(summary.total([]), '$0.00');
});

test('money formatting lives in one module', () => {
  assert.equal(typeof require('../src/billing/money.js').formatMoney, 'function');
});
