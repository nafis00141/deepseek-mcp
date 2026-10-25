const test = require('node:test');
const assert = require('node:assert/strict');
const { greet } = require('../src/greet.js');

test('greets with an exclamation mark', () => {
  assert.equal(greet('Ann'), 'Hello, Ann!');
});
