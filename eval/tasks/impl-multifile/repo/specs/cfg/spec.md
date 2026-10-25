# Spec: timeout in seconds

## Goal
Store the timeout in seconds instead of milliseconds.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. src/config.js exports timeoutSeconds (1) and no longer exports timeoutMs.
- AC-2. fetcher.describe() still returns { retries, timeoutMs } with timeoutMs derived from timeoutSeconds.
- AC-3. report.line() returns 'retries=3 timeout=1s'.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
