---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/config.test.js
depends_on: []
---

# Task 01 - rename the timeout key
## Goal
Switch the config to timeoutSeconds and update every consumer in src/.

## Acceptance criteria
- AC-1: config exports timeoutSeconds and not timeoutMs.
- AC-2: fetcher.describe() still reports timeoutMs, derived.
- AC-3: report.line() returns 'retries=3 timeout=1s'.

## Out of scope
- Anything outside allowed_paths.
