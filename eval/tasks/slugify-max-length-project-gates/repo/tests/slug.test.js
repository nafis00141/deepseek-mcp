const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify, isSlug } = require('../src/index.js');

test('slugify without options', () => {
  assert.equal(slugify('Hello  World!'), 'hello-world');
  assert.equal(isSlug('hello-world'), true);
});

test('maxLength fits whole words', () => {
  assert.equal(slugify('Hello brave new world', { maxLength: 11 }), 'hello-brave');
});
