// Retry decisions.
const DELAYS = { 1: 200, 2: 400, 3: 800 };

function shouldRetry(attempt, outcome) {
  return (outcome.status === 429 || outcome.status === 503) && attempt < 4;
}

function delayMs(attempt, outcome) {
  return DELAYS[attempt] || 0;
}

module.exports = { shouldRetry, delayMs };
