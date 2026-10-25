const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotals, adjustmentTax, roundCents, percentOf } = require('../src/index.js');

test('halves round away from zero in both directions', () => {
  assert.equal(roundCents(2.5), 3);
  assert.equal(roundCents(-2.5), -3);
  assert.equal(roundCents(0.5), 1);
  assert.equal(roundCents(-0.5), -1);
  assert.equal(roundCents(-1.5), -2);
  assert.equal(roundCents(1.4), 1);
  assert.equal(roundCents(-1.4), -1);
  assert.equal(roundCents(-1.6), -2);
});

test('zero is plain zero', () => {
  assert.equal(roundCents(0), 0);
  assert.equal(roundCents(-0), 0);
  assert.equal(roundCents(-0.2), 0);
  assert.equal(percentOf(-1, 10), 0);
  assert.equal(invoiceTotals({ lines: [{ description: 'x', cents: -1 }], taxPercent: 10 }).taxCents, 0);
});

test('percentages of negative amounts', () => {
  assert.equal(percentOf(-1050, 5), -53);
  assert.equal(percentOf(1050, 5), 53);
  assert.equal(percentOf(-3, 50), -2);
  assert.equal(percentOf(-250, 10), -25);
});

test('adjustments go through the same rounding', () => {
  assert.equal(adjustmentTax([-1050], 5), -53);
  assert.equal(adjustmentTax([-1000, -50], 5), -53);
  assert.equal(adjustmentTax([2000, -950], 5), 53);
});

test('mixed invoices', () => {
  const t = invoiceTotals({
    lines: [
      { description: 'a', cents: 500 },
      { description: 'b', cents: -1550 },
    ],
    taxPercent: 5,
  });
  assert.deepEqual(t, { subtotalCents: -1050, taxCents: -53, totalCents: -1103 });
});
