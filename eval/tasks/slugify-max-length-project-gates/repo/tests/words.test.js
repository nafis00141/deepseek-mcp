const test = require('node:test');
const assert = require('node:assert/strict');
const { words, clamp } = require('../src/index.js');

test('words and clamp', () => {
  assert.deepEqual(words(' a  b '), ['a', 'b']);
  assert.equal(clamp(5, 0, 3), 3);
});
