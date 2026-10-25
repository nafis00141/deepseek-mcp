---
id: 01
allowed_paths: [src/lib/**, tests/lib/**]
test_command: node --test tests/lib/slug.test.js
depends_on: []
---

# Task 01 - core slug function
## Goal
Implement slug(text).

## Acceptance criteria
- AC-1: slug(text) lowercases text and joins words with hyphens.

## Out of scope
- Anything outside allowed_paths.
