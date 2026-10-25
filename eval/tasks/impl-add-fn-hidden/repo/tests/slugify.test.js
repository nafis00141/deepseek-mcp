const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../src/slugify.js');

test('lowercases and hyphenates', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
  assert.equal(slugify('Foo'), 'foo');
});
