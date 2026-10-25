---
id: 01
allowed_paths: [src/**]
test_command: node --test tests/dates.test.js
depends_on: []
---

# Task 01 - make tests/dates.test.js pass
## Goal
tests/dates.test.js fails (daysInMonth(1900, 2) returns 29). Find the cause in src/ and fix it. Do not change the tests; they are outside allowed_paths.

## Acceptance criteria
- AC-1: tests/dates.test.js passes.
- AC-2: the fix is the general rule, not a special case for one year.

## Out of scope
- Anything outside allowed_paths.
