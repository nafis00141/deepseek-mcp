# Spec: price conversion

## Goal
Convert dollar amounts to integer cents.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. toCents(1.5) returns 150.
- AC-2. Amounts are rounded to the nearest whole cent.
- AC-3. toCents always returns an integer.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
