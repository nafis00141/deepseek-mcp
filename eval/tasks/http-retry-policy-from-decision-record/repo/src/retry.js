// Retry decisions. Placeholder: nothing is retried yet.

function shouldRetry(attempt, outcome) {
  return false;
}

function delayMs(attempt, outcome) {
  return 0;
}

module.exports = { shouldRetry, delayMs };
