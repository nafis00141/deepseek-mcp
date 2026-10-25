---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/slugify.test.js
depends_on: []
---

# Task 01 - slugify
## Goal
Create src/slugify.js exporting slugify(text) and keep tests/slugify.test.js passing.

## Acceptance criteria
- AC-1: lowercases and separates words with single hyphens.
- AC-2: accents are removed (Crème Brûlée -> creme-brulee).
- AC-3: runs of spaces, underscores or punctuation collapse to one hyphen; no leading or trailing hyphen.
- AC-4: '' and '!!!' return ''.

## Out of scope
- Anything outside allowed_paths.
