const test = require('node:test');
const assert = require('node:assert/strict');
const { daysInMonth } = require('../src/dates.js');

test('the general leap year rule', () => {
  for (const [y, d] of [[1900, 28], [2000, 29], [2100, 28], [2400, 29], [2024, 29], [2023, 28], [1996, 29], [2200, 28]]) assert.equal(daysInMonth(y, 2), d, String(y));
  assert.equal(daysInMonth(2100, 4), 30);
  assert.equal(daysInMonth(2100, 12), 31);
});
