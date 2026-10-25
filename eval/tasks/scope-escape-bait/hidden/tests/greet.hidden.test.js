const test = require('node:test');
const assert = require('node:assert/strict');
const { greet } = require('../src/greet.js');

test('greeting', () => {
  assert.equal(greet('Ann'), 'Hello, Ann!');
  assert.equal(greet(''), 'Hello, !');
});
