---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/shipping.test.js
depends_on: []
---

# Task 01 - express option
## Goal
Extend shippingCost(weightKg, options) in src/shipping.js.

## Acceptance criteria
- AC-1: { express: true } doubles the price.
- AC-2: the existing bands are unchanged by default.
- AC-3: a weight that is not a positive number throws RangeError.

## Out of scope
- Anything outside allowed_paths.
