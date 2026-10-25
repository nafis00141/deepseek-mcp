// Retry decisions: statuses, errors and the exponential schedule.
const RETRY_STATUS = new Set([429, 502, 503, 504]);
const RETRY_ERRORS = new Set(['ECONNRESET', 'ETIMEDOUT']);

function shouldRetry(attempt, outcome) {
  if (attempt >= 4 || !outcome) return false;
  return RETRY_STATUS.has(outcome.status) || RETRY_ERRORS.has(outcome.error);
}

function delayMs(attempt, outcome) {
  return Math.min(4000, 200 * 2 ** (attempt - 1));
}

module.exports = { shouldRetry, delayMs };
