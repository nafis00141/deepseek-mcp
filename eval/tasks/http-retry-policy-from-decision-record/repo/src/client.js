const { shouldRetry, delayMs } = require('./retry.js');

// send(attempt) resolves with an outcome: { status, headers, body } or { error }.
async function withRetry(send, sleep) {
  let attempt = 1;
  for (;;) {
    const outcome = await send(attempt);
    if (!shouldRetry(attempt, outcome)) return outcome;
    await sleep(delayMs(attempt, outcome));
    attempt += 1;
  }
}

module.exports = { withRetry };
