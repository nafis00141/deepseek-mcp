const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseOrdersCsv, exportOrders } = require('../src/index.js');

const orders = [
  { id: 1001, customer: 'Ada Lovelace', totalCents: 12050, paid: true, note: null },
  { id: 1002, customer: 'Hopper, Grace', totalCents: 800, paid: false, note: 'Said "call first"' },
  { id: 1003, customer: 'Alan Turing', totalCents: 99, paid: true, note: 'leave at door' },
];

test('the export of the sample orders is byte for byte the sample file', () => {
  const sample = fs.readFileSync(path.join(__dirname, '..', 'samples', 'orders-import-sample.csv'), 'utf8');
  assert.equal(exportOrders(orders), sample);
});

test('lines end in CRLF, including the last one', () => {
  const out = exportOrders(orders);
  assert.ok(out.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(out));
});

test('money has two decimals and no grouping', () => {
  const out = exportOrders([
    { id: 1, customer: 'a', totalCents: 5, paid: true },
    { id: 2, customer: 'b', totalCents: 100000, paid: false },
    { id: 3, customer: 'c', totalCents: 1000, paid: false },
  ]);
  const rows = out.split('\r\n');
  assert.equal(rows[1], '1,a,0.05,Y,');
  assert.equal(rows[2], '2,b,1000.00,N,');
  assert.equal(rows[3], '3,c,10.00,N,');
});

test('quotes, commas and line breaks survive a round trip', () => {
  const tricky = [
    { id: 7, customer: 'He said "hi", twice', totalCents: 1, paid: false, note: 'line one\nline two' },
    { id: 8, customer: ' padded ', totalCents: 250, paid: true, note: 'a,b' },
  ];
  assert.deepEqual(parseOrdersCsv(exportOrders(tricky)), tricky);
});

test('a missing note is an empty last field, and the list may be empty', () => {
  assert.equal(exportOrders([{ id: 5, customer: 'z', totalCents: 100, paid: true }]).split('\r\n')[1], '5,z,1.00,Y,');
  assert.equal(exportOrders([]), 'order_id,customer,total,paid,note\r\n');
});
