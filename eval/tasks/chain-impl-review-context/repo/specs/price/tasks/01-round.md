---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/price.test.js
depends_on: []
---

# Task 01 - dollars to cents
## Goal
Implement toCents(amount) in src/price.js and cover it in tests/price.test.js.

## Acceptance criteria
- AC-1: toCents(1.5) returns 150.
- AC-2: amounts are rounded to the nearest whole cent.
- AC-3: the result is always an integer.

## Out of scope
- Anything outside allowed_paths.
