const test = require('node:test');
const assert = require('node:assert/strict');
const { samePath, dedupePaths, isInside, readManifest } = require('../src/index.js');

test('case and separator direction do not matter', () => {
  assert.equal(samePath('C:\\Proj\\SRC\\a.js', 'c:/proj/src/a.js'), true);
  assert.equal(samePath('C:\\proj\\a.js', 'C:\\proj\\b.js'), false);
});

test('dedupe keeps the first spelling', () => {
  assert.deepEqual(dedupePaths(['C:\\Proj\\A.js', 'c:/proj/a.js', 'C:\\proj\\b.js']), ['C:\\Proj\\A.js', 'C:\\proj\\b.js']);
});

test('a folder contains its files', () => {
  assert.equal(isInside('C:\\proj', 'C:\\proj\\src\\a.js'), true);
  assert.equal(isInside('C:\\proj', 'D:\\other\\a.js'), false);
});

test('manifest lines', () => {
  assert.deepEqual(readManifest('# files\r\nC:\\a.txt\r\n\r\nC:\\b.txt\r\n'), ['C:\\a.txt', 'C:\\b.txt']);
});
