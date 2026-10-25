# Spec: make tests/sessions.test.js pass: a session with a short ttl never expires

## Goal
tests/sessions.test.js fails: with sessionTtl '500ms' a session is still active a second later. Find the cause in src/ and fix it. Do not change the tests.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. tests/sessions.test.js passes.
- AC-2. A session is active strictly before createdAt + ttl and expired at exactly that moment.
- AC-3. Every duration string the project reads (ms, s, m, h) means what it says wherever it is read.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
