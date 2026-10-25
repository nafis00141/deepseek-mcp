const test = require('node:test');
const assert = require('node:assert/strict');
const { daysLate, lateFee, legacyLateFee, agingRow } = require('../src/index.js');

const inv = (amountCents) => ({ id: 'X', amountCents, dueDate: '2026-02-01' });
const on = (d) => '2026-02-' + String(d).padStart(2, '0');

test('grace period: nothing is charged up to 5 days late', () => {
  for (const d of [1, 2, 3, 4, 5, 6]) assert.equal(lateFee(inv(10000), on(d)), 0, 'day ' + d);
});

test('from the sixth day late every day counts', () => {
  assert.equal(lateFee(inv(10000), on(7)), 600);
  assert.equal(lateFee(inv(10000), on(8)), 700);
  assert.equal(lateFee(inv(10000), on(11)), 1000);
  assert.equal(lateFee(inv(999), on(7)), 60);
});

test('the cap is a quarter of the amount, rounded', () => {
  assert.equal(lateFee(inv(10000), '2026-02-26'), 2500);
  assert.equal(lateFee(inv(10000), '2026-02-27'), 2500);
  assert.equal(lateFee(inv(10000), '2027-02-01'), 2500);
  assert.equal(lateFee(inv(999), '2026-03-05'), 250);
  assert.equal(lateFee(inv(0), '2026-03-05'), 0);
});

test('a due date in the future is not late', () => {
  assert.equal(lateFee(inv(10000), '2026-01-20'), 0);
  assert.equal(daysLate('2026-02-01', '2026-01-20'), 0);
});

test('daysLate counts calendar days, leap years included', () => {
  assert.equal(daysLate('2026-01-01', '2026-01-04'), 3);
  assert.equal(daysLate('2028-02-28', '2028-03-01'), 2);
  assert.equal(daysLate('2027-02-28', '2027-03-01'), 1);
  assert.throws(() => daysLate('soon', '2026-01-01'), /bad date/);
});

test('the archived v1 statements are unchanged', () => {
  assert.equal(legacyLateFee(inv(10000), on(4)), 600);
  assert.equal(legacyLateFee(inv(10000), on(11)), 2000);
  assert.equal(legacyLateFee(inv(10000), '2026-06-01'), 24000);
  assert.equal(legacyLateFee(inv(10000), '2026-01-20'), 0);
});

test('the aging report follows the rules', () => {
  assert.deepEqual(agingRow({ id: 'A1', amountCents: 20000, dueDate: '2026-02-01' }, '2026-02-04'), { id: 'A1', daysLate: 3, fee: 0, label: 'No fee' });
  assert.deepEqual(agingRow({ id: 'A2', amountCents: 20000, dueDate: '2026-02-01' }, '2026-02-11'), { id: 'A2', daysLate: 10, fee: 2000, label: 'Late fee: 20.00' });
  assert.deepEqual(agingRow({ id: 'A3', amountCents: 20000, dueDate: '2026-01-01' }, '2026-06-01'), { id: 'A3', daysLate: 151, fee: 5000, label: 'Late fee: 50.00' });
});
