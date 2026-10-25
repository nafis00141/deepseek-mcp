---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/format.test.js
depends_on: []
---

# Task 01 - format a price
## Goal
Implement formatPrice(cents) in src/format.js so that tests/format.test.js passes.

## Acceptance criteria
- AC-1: formatPrice(150) returns the number 150 (type number).
- AC-2: formatPrice(150) returns the string '$1.50'.

## Out of scope
- Anything outside allowed_paths.
