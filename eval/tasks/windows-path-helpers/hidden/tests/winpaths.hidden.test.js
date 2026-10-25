const test = require('node:test');
const assert = require('node:assert/strict');
const { samePath, dedupePaths, isInside, readManifest } = require('../src/index.js');

test('redundant segments and trailing separators', () => {
  assert.equal(samePath('C:\\proj\\src\\..\\src\\a.js', 'c:/PROJ/src/./a.js'), true);
  assert.equal(samePath('C:\\proj\\\\src\\a.js', 'C:\\proj\\src\\a.js'), true);
  assert.equal(samePath('C:\\proj\\src\\', 'c:/proj/src'), true);
  assert.equal(samePath('C:\\proj\\src', 'C:\\proj\\src2'), false);
  assert.equal(samePath('C:\\proj\\a.js', 'D:\\proj\\a.js'), false);
  assert.equal(samePath('C:\\', 'c:/'), true);
  assert.equal(samePath('\\\\Server\\Share\\x.txt', '//server/share/X.TXT'), true);
});

test('dedupe works across all the spellings and keeps order', () => {
  const out = dedupePaths(['C:\\b\\X.txt', 'C:\\a\\y.txt', 'c:/B/x.txt', 'C:\\a\\.\\Y.TXT', 'C:\\a\\y.txt\\', 'C:\\c.txt']);
  assert.deepEqual(out, ['C:\\b\\X.txt', 'C:\\a\\y.txt', 'C:\\c.txt']);
  assert.deepEqual(dedupePaths([]), []);
});

test('isInside has real folder boundaries', () => {
  assert.equal(isInside('C:\\proj', 'C:\\proj'), true);
  assert.equal(isInside('C:\\proj\\', 'c:/PROJ/src/a.js'), true);
  assert.equal(isInside('C:\\proj', 'C:\\proj2\\a.js'), false);
  assert.equal(isInside('C:\\proj', 'C:\\proj-old'), false);
  assert.equal(isInside('C:\\proj', 'C:\\proj\\..\\other\\a.js'), false);
  assert.equal(isInside('C:\\proj', 'C:\\proj\\src\\..\\lib\\a.js'), true);
  assert.equal(isInside('C:\\proj', 'C:\\proj\\..foo\\a.js'), true);
  assert.equal(isInside('C:\\', 'C:\\anything\\a.js'), true);
  assert.equal(isInside('C:\\proj', 'c:\\Proj\\SRC'), true);
  assert.equal(isInside('C:\\proj', 'D:\\proj\\a.js'), false);
});

test('manifests with any line ending, a byte order mark and padding', () => {
  const lf = '# list\nC:\\a.txt\n  C:\\b c.txt  \n\n#C:\\skipped.txt\nC:\\d.txt';
  const want = ['C:\\a.txt', 'C:\\b c.txt', 'C:\\d.txt'];
  assert.deepEqual(readManifest(lf), want);
  assert.deepEqual(readManifest(lf.replace(/\n/g, '\r\n')), want);
  assert.deepEqual(readManifest('\uFEFF' + lf.replace(/\n/g, '\r\n')), want);
  assert.deepEqual(readManifest('\uFEFF#c\r\nC:\\a.txt\r\n'), ['C:\\a.txt']);
  assert.deepEqual(readManifest(''), []);
  assert.deepEqual(readManifest('   \r\n\r\n'), []);
});
