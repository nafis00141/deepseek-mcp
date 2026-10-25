---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/inventory.test.js
depends_on: []
---

# Task 01 - inclusive, sorted low stock
## Goal
Change lowStock in src/inventory.js.

## Acceptance criteria
- AC-1: qty equal to the threshold counts as low.
- AC-2: names are sorted alphabetically.
- AC-3: the file keeps CRLF line endings.

## Out of scope
- Anything outside allowed_paths.
