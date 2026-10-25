const test = require('node:test');
const assert = require('node:assert/strict');
const { exportCsv } = require('../src/index.js');

test('created is an ISO 8601 UTC timestamp without milliseconds', () => {
  const notes = [{ id: 1, title: 'plan', created: Date.UTC(2026, 2, 4, 5, 6, 7, 890), updated: null }];
  assert.equal(exportCsv(notes), 'id,title,created,updated\n1,plan,2026-03-04T05:06:07Z,\n');
});
