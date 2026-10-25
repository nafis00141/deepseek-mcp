# Spec: slugify gets a maxLength option; the project's CI command must pass

## Goal
slugify(text, options) accepts options.maxLength. The slug never gets longer than maxLength, is cut between words when it can be, and never ends in a hyphen. Without the option nothing changes. The test_command is the project's CI script and has to pass.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. slugify('Hello brave new world', { maxLength: 11 }) is 'hello-brave'; with maxLength 10 it is 'hello'.
- AC-2. If the first word alone is longer than maxLength it is cut at maxLength.
- AC-3. A maxLength that is not a positive integer throws a RangeError.
- AC-4. Without options the output is exactly what it is today.
- AC-5. node scripts/ci.js passes.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
