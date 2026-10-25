const { add } = require('../src/math.js');
if (add(2, 3) !== 6) {
  console.error('verify failed: add(2, 3) is ' + add(2, 3));
  process.exit(1);
}
