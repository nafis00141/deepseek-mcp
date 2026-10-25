const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSettings, loadLegacy } = require('../src/index.js');

const defaults = { name: 'app', debug: false, tags: ['a', 'b'], server: { port: 80, hosts: ['h1', 'h2'], tls: { ciphers: ['x', 'y'], on: false } } };

test('lists replace at every depth', () => {
  const r = resolveSettings(defaults, { tags: ['c'], server: { hosts: ['h3'], tls: { ciphers: ['z'] } } }, {});
  assert.deepEqual(r.tags, ['c']);
  assert.deepEqual(r.server.hosts, ['h3']);
  assert.deepEqual(r.server.tls.ciphers, ['z']);
  assert.equal(r.server.tls.on, false);
  assert.equal(r.server.port, 80);
});

test('an empty list replaces too', () => {
  assert.deepEqual(resolveSettings(defaults, { tags: [] }, {}).tags, []);
});

test('lists from the environment replace', () => {
  const r = resolveSettings(defaults, { tags: ['c'] }, { APP_TAGS: 'p, q', APP_SERVER__HOSTS: 'only' });
  assert.deepEqual(r.tags, ['p', 'q']);
  assert.deepEqual(r.server.hosts, ['only']);
});

test('empty environment variables are ignored', () => {
  const r = resolveSettings(defaults, { name: 'file' }, { APP_SERVER__PORT: '', APP_NAME: '', APP_DEBUG: '', APP_TAGS: '', APP_SERVER__TLS__CIPHERS: '' });
  assert.equal(r.server.port, 80);
  assert.equal(r.name, 'file');
  assert.equal(r.debug, false);
  assert.deepEqual(r.tags, ['a', 'b']);
  assert.deepEqual(r.server.tls.ciphers, ['x', 'y']);
});

test('the rest keeps working', () => {
  const r = resolveSettings(defaults, { name: undefined, debug: null, server: { port: 8080 } }, { APP_DEBUG: 'true', OTHER: '1', APP_SERVER__TLS__ON: 'true', APP_SERVER__PORT: '9001' });
  assert.equal(r.name, 'app');
  assert.equal(r.debug, true);
  assert.equal(r.server.port, 9001);
  assert.equal(r.server.tls.on, true);
  assert.ok(!('other' in r));
  const cleared = resolveSettings(defaults, { debug: null, tags: null }, {});
  assert.equal(cleared.debug, null);
  assert.equal(cleared.tags, null);
});

test('the inputs are not modified', () => {
  const file = { tags: ['c'], server: { hosts: ['h3'] } };
  resolveSettings(defaults, file, { APP_SERVER__PORT: '1' });
  assert.deepEqual(defaults.tags, ['a', 'b']);
  assert.deepEqual(defaults.server.hosts, ['h1', 'h2']);
  assert.equal(defaults.server.port, 80);
  assert.deepEqual(file, { tags: ['c'], server: { hosts: ['h3'] } });
});

test('the archived-config loader still appends lists', () => {
  assert.deepEqual(loadLegacy(defaults, { tags: ['c'] }).tags, ['a', 'b', 'c']);
  assert.deepEqual(loadLegacy(defaults, { server: { hosts: ['h3'] } }).server.hosts, ['h1', 'h2', 'h3']);
  assert.equal(loadLegacy(defaults, { name: 'x' }).name, 'x');
});
