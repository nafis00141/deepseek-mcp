const test = require('node:test');
const assert = require('node:assert/strict');
const { daysInMonth } = require('../src/dates.js');

test('february in leap and common years', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2023, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
  assert.equal(daysInMonth(1900, 2), 28);
});
