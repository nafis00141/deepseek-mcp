const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../src/index.js');

test('cuts between words', () => {
  assert.equal(slugify('Hello brave new world', { maxLength: 10 }), 'hello');
  assert.equal(slugify('Hello brave new world', { maxLength: 11 }), 'hello-brave');
  assert.equal(slugify('Hello brave new world', { maxLength: 17 }), 'hello-brave-new');
  assert.equal(slugify('ab cd ef', { maxLength: 5 }), 'ab-cd');
  assert.equal(slugify('ab cd ef', { maxLength: 6 }), 'ab-cd');
  assert.equal(slugify('ab cd ef', { maxLength: 8 }), 'ab-cd-ef');
});

test('never ends in a hyphen and never exceeds the limit', () => {
  for (let n = 1; n <= 30; n++) {
    const s = slugify('The quick brown fox jumps over the lazy dog', { maxLength: n });
    assert.ok(s.length <= n, 'length at ' + n);
    assert.ok(!s.endsWith('-'), 'trailing hyphen at ' + n);
    assert.ok(!s.startsWith('-'), 'leading hyphen at ' + n);
  }
});

test('a first word longer than the limit is cut hard', () => {
  assert.equal(slugify('supercalifragilistic day', { maxLength: 5 }), 'super');
  assert.equal(slugify('abc', { maxLength: 1 }), 'a');
});

test('a short slug is left alone', () => {
  assert.equal(slugify('Hi there', { maxLength: 50 }), 'hi-there');
  assert.equal(slugify('Hi there', {}), 'hi-there');
});

test('without the option there is no limit', () => {
  const long = 'word '.repeat(40);
  assert.equal(slugify(long), ('word-'.repeat(40)).slice(0, -1));
});

test('a bad maxLength throws a RangeError', () => {
  for (const bad of [0, -3, 1.5, NaN, Infinity, '5', null]) {
    assert.throws(() => slugify('hello world', { maxLength: bad }), RangeError, String(bad));
  }
});
