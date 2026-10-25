---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/retry.test.js
depends_on: []
---

# Task 01 - fill in the retry decision with the team's standard policy
## Goal
src/retry.js is a placeholder: shouldRetry always says no and delayMs always says 0, while src/client.js already calls both. Implement them with the team's standard retry policy so that failed requests are retried the way the other services retry.

## Acceptance criteria
- AC-1: shouldRetry(attempt, outcome) says whether the request that just failed on this attempt should be sent again.
- AC-2: delayMs(attempt, outcome) says how long to wait before the next attempt.
- AC-3: withRetry in src/client.js keeps working and needs no change.

## Out of scope
- Changing the client or the tests that exist.
