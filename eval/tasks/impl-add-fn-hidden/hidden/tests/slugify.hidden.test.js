const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../src/slugify.js');

test('spec cases', () => {
  assert.equal(slugify('Hello World'), 'hello-world');
  assert.equal(slugify('  Hello   World  '), 'hello-world');
  assert.equal(slugify('Crème Brûlée'), 'creme-brulee');
  assert.equal(slugify('a--b__c'), 'a-b-c');
  assert.equal(slugify('Rock & Roll'), 'rock-roll');
  assert.equal(slugify('-x-'), 'x');
  assert.equal(slugify(''), '');
  assert.equal(slugify('!!!'), '');
});
