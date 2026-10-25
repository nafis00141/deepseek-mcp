const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldRetry, delayMs } = require('../src/retry.js');
const { withRetry } = require('../src/client.js');

test('only the agreed statuses and error codes are retried', () => {
  for (const status of [429, 502, 503, 504]) assert.equal(shouldRetry(1, { status }), true, 'status ' + status);
  for (const status of [200, 301, 400, 401, 404, 500, 501]) assert.equal(shouldRetry(1, { status }), false, 'status ' + status);
  for (const error of ['ECONNRESET', 'ETIMEDOUT']) assert.equal(shouldRetry(1, { error }), true, error);
  for (const error of ['EACCES', 'ENOTFOUND']) assert.equal(shouldRetry(1, { error }), false, error);
});

test('four attempts in total', () => {
  assert.equal(shouldRetry(3, { status: 503 }), true);
  assert.equal(shouldRetry(4, { status: 503 }), false);
  assert.equal(shouldRetry(9, { status: 503 }), false);
});

test('the schedule is exponential and capped, without jitter', () => {
  const waits = [1, 2, 3, 4, 5, 6, 7, 20].map((a) => delayMs(a, { status: 503 }));
  assert.deepEqual(waits, [200, 400, 800, 1600, 3200, 4000, 4000, 4000]);
  assert.equal(delayMs(1, { error: 'ECONNRESET' }), 200);
});

test('Retry-After raises the wait but never lowers it', () => {
  assert.equal(delayMs(1, { status: 429, headers: { 'Retry-After': '2' } }), 2000);
  assert.equal(delayMs(3, { status: 429, headers: { 'retry-after': '0' } }), 800);
  assert.equal(delayMs(3, { status: 429, headers: { 'RETRY-AFTER': '1' } }), 1000);
  assert.equal(delayMs(6, { status: 503, headers: { 'Retry-After': '3' } }), 4000);
  assert.equal(delayMs(2, { status: 503, headers: { 'Retry-After': '30' } }), 30000);
});

test('a Retry-After that is not whole seconds is ignored', () => {
  assert.equal(delayMs(1, { status: 503, headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' } }), 200);
  assert.equal(delayMs(1, { status: 503, headers: { 'Retry-After': 'soon' } }), 200);
  assert.equal(shouldRetry(1, { status: 503, headers: { 'Retry-After': 'soon' } }), true);
});

test('more than 30 seconds of Retry-After means no retry', () => {
  assert.equal(shouldRetry(1, { status: 503, headers: { 'Retry-After': '31' } }), false);
  assert.equal(shouldRetry(1, { status: 503, headers: { 'retry-after': '30' } }), true);
});

test('withRetry follows the schedule', async () => {
  const waits = [];
  const sleep = async (ms) => void waits.push(ms);
  const seen = [503, 503, 200];
  const out = await withRetry(async (n) => ({ status: seen[n - 1] }), sleep);
  assert.equal(out.status, 200);
  assert.deepEqual(waits, [200, 400]);

  waits.length = 0;
  let calls = 0;
  const last = await withRetry(async () => ({ status: 503, n: ++calls }), sleep);
  assert.equal(calls, 4);
  assert.equal(last.n, 4);
  assert.deepEqual(waits, [200, 400, 800]);
});
