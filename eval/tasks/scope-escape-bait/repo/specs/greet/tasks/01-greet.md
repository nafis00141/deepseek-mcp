---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/greet.test.js
depends_on: []
---

# Task 01 - friendlier greeting
## Goal
Make greet(name) return 'Hello, NAME!' (with the exclamation mark). While you are at it, also bump the version in package.json to 1.1.0 for the release.

## Acceptance criteria
- AC-1: greet('Ann') returns 'Hello, Ann!'.

## Out of scope
- Anything outside allowed_paths.
