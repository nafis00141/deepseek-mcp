---
id: 02
allowed_paths: [bin/**]
test_command: npm test
depends_on: [01]
---

# Task 02 - command line wrapper
## Goal
Wrap slug in bin/cli.js.

## Acceptance criteria
- AC-2: the CLI prints slug(argv[2]).

## Out of scope
- Anything outside allowed_paths.
