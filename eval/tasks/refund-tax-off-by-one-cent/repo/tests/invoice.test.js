const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotals } = require('../src/index.js');

test('a sale', () => {
  const t = invoiceTotals({ lines: [{ description: 'tea', cents: 1050 }], taxPercent: 5 });
  assert.deepEqual(t, { subtotalCents: 1050, taxCents: 53, totalCents: 1103 });
});

test('a refund is taxed the same way, with the sign kept', () => {
  const t = invoiceTotals({ lines: [{ description: 'return: tea', cents: -1050 }], taxPercent: 5 });
  assert.deepEqual(t, { subtotalCents: -1050, taxCents: -53, totalCents: -1103 });
});
