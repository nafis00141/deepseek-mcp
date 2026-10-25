const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseOrdersCsv } = require('../src/index.js');

const sample = fs.readFileSync(path.join(__dirname, '..', 'samples', 'orders-import-sample.csv'), 'utf8');

test('the nightly sample parses', () => {
  const orders = parseOrdersCsv(sample);
  assert.equal(orders.length, 3);
  assert.deepEqual(orders[1], { id: 1002, customer: 'Hopper, Grace', totalCents: 800, paid: false, note: 'Said "call first"' });
  assert.equal(orders[0].note, null);
});

test('the files the warehouse sends use CRLF line endings', () => {
  assert.ok(sample.includes('\r\n'));
  assert.ok(!/[^\r]\n/.test(sample));
});
