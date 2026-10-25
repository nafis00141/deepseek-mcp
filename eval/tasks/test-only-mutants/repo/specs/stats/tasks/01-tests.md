---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/*.test.js
depends_on: []
---

# Task 01 - tests for mean and median
## Goal
Write tests for src/stats.js. Do not change src/.

## Acceptance criteria
- AC-1: mean and median are covered.
- AC-2: odd, even and unsorted numeric inputs are covered.
- AC-3: only files under tests/ change.

## Out of scope
- Anything outside allowed_paths.
