const { roundCents } = require('./round.js');

function sumCents(values) {
  return values.reduce((a, b) => a + b, 0);
}

// percent of an amount of cents, rounded to a whole cent
function percentOf(cents, percent) {
  return roundCents((cents * percent) / 100);
}

module.exports = { sumCents, percentOf };
