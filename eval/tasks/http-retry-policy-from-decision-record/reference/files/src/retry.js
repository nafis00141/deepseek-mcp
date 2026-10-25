// Retry decisions, following docs/decisions/0004-retry-policy.md.
const RETRY_STATUS = new Set([429, 502, 503, 504]);
const RETRY_ERRORS = new Set(['ECONNRESET', 'ETIMEDOUT']);
const MAX_ATTEMPTS = 4;
const BASE_MS = 200;
const CAP_MS = 4000;
const MAX_RETRY_AFTER_MS = 30000;

function retryAfterMs(outcome) {
  const headers = (outcome && outcome.headers) || {};
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'retry-after') {
      const v = String(headers[name]).trim();
      return /^\d+$/.test(v) ? Number(v) * 1000 : null;
    }
  }
  return null;
}

function retryable(outcome) {
  if (!outcome) return false;
  return RETRY_STATUS.has(outcome.status) || RETRY_ERRORS.has(outcome.error);
}

function shouldRetry(attempt, outcome) {
  if (attempt >= MAX_ATTEMPTS || !retryable(outcome)) return false;
  const wait = retryAfterMs(outcome);
  return wait === null || wait <= MAX_RETRY_AFTER_MS;
}

function delayMs(attempt, outcome) {
  const backoff = Math.min(CAP_MS, BASE_MS * 2 ** (attempt - 1));
  const asked = retryAfterMs(outcome);
  return asked === null ? backoff : Math.max(backoff, asked);
}

module.exports = { shouldRetry, delayMs };
