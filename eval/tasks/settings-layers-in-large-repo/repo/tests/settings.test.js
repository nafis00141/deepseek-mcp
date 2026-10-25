const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveSettings } = require('../src/index.js');

const defaults = { name: 'app', tags: ['a', 'b'], server: { port: 80, hosts: ['h1'] } };

test('a list in the file replaces the default list', () => {
  assert.deepEqual(resolveSettings(defaults, { tags: ['c'] }, {}).tags, ['c']);
});

test('objects merge and env converts', () => {
  const r = resolveSettings(defaults, { server: { hosts: ['h2'] } }, { APP_SERVER__PORT: '9000' });
  assert.equal(r.server.port, 9000);
  assert.equal(r.name, 'app');
});
