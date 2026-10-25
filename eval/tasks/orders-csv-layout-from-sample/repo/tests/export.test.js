const test = require('node:test');
const assert = require('node:assert/strict');
const { exportOrders } = require('../src/index.js');

test('header and a simple row', () => {
  const out = exportOrders([{ id: 1001, customer: 'Ada Lovelace', totalCents: 12050, paid: true }]);
  const lines = out.split(/\r?\n/);
  assert.equal(lines[0], 'order_id,customer,total,paid,note');
  assert.equal(lines[1], '1001,Ada Lovelace,120.50,Y,');
});
