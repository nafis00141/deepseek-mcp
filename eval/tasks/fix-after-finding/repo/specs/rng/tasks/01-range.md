---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/range.test.js
depends_on: []
---

# Task 01 - range
## Goal
Implement range(start, end).

## Acceptance criteria
- AC-1: both ends are included.
- AC-2: [] when start is greater than end.
- AC-3: TypeError on a non-integer argument.

## Out of scope
- Anything outside allowed_paths.
