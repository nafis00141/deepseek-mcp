const test = require('node:test');
const assert = require('node:assert/strict');
const { exportCsv, exportJson, renderList, formatDate, parseDate } = require('../src/index.js');

const t1 = Date.UTC(2026, 2, 4, 5, 6, 7, 890);
const t2 = Date.UTC(2027, 11, 31, 23, 59, 59, 999);

test('both timestamp columns are ISO 8601 UTC', () => {
  const csv = exportCsv([{ id: 7, title: 'a', created: t1, updated: t2 }]);
  assert.equal(csv, 'id,title,created,updated\n7,a,2026-03-04T05:06:07Z,2027-12-31T23:59:59Z\n');
});

test('an epoch-zero timestamp and a missing updated time', () => {
  const csv = exportCsv([
    { id: 1, title: 'x', created: 0, updated: null },
    { id: 2, title: 'y', created: 0, updated: undefined },
  ]);
  assert.equal(csv, 'id,title,created,updated\n1,x,1970-01-01T00:00:00Z,\n2,y,1970-01-01T00:00:00Z,\n');
});

test('quoting still works next to the new columns', () => {
  const csv = exportCsv([{ id: 3, title: 'a, "b"', created: t1, updated: null }]);
  assert.equal(csv, 'id,title,created,updated\n3,"a, ""b""",2026-03-04T05:06:07Z,\n');
});

test('the on-screen list keeps its MM/DD/YYYY dates', () => {
  assert.equal(renderList([{ id: 1, title: 'plan', created: t1, updated: null }, { id: 2, title: 'b', created: t2, updated: null }]), 'plan (03/04/2026)\nb (12/31/2027)');
  assert.equal(formatDate(t1), '03/04/2026');
  assert.equal(parseDate(formatDate(t2)), Date.UTC(2027, 11, 31));
});

test('the JSON export keeps raw milliseconds', () => {
  const out = JSON.parse(exportJson([{ id: 1, title: 'a', created: t1, updated: t2 }]));
  assert.deepEqual(out, [{ id: 1, title: 'a', created: t1, updated: t2 }]);
});
