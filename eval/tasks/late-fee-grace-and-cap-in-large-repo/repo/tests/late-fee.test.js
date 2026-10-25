const test = require('node:test');
const assert = require('node:assert/strict');
const { lateFee } = require('../src/index.js');

test('an invoice that is not late has no fee', () => {
  assert.equal(lateFee({ id: 'A', amountCents: 10000, dueDate: '2026-03-01' }, '2026-03-01'), 0);
});

test('the fee stops at a quarter of the amount', () => {
  assert.equal(lateFee({ id: 'A', amountCents: 10000, dueDate: '2026-01-01' }, '2026-06-01'), 2500);
});
