const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config.js');
const { describe } = require('../src/fetcher.js');
const { line } = require('../src/report.js');

test('all three files agree', () => {
  assert.equal(config.timeoutSeconds, 1);
  assert.ok(!('timeoutMs' in config));
  assert.deepEqual(describe(), { retries: 3, timeoutMs: 1000 });
  assert.equal(line(), 'retries=3 timeout=1s');
  assert.deepEqual(describe({ retries: 1, timeoutSeconds: 2 }), { retries: 1, timeoutMs: 2000 });
});
