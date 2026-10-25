---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/clamp.test.js
depends_on: []
---

# Task 01 - implement clamp
## Goal
Implement clamp(n, min, max) in src/clamp.js.

## Acceptance criteria
- AC-1: clamp(5, 0, 3) is 3, clamp(-1, 0, 3) is 0, clamp(2, 0, 3) is 2.

## Out of scope
- Anything outside allowed_paths.
