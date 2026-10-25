# Spec: range

## Goal
An inclusive integer range helper.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. range(start, end) includes both ends: range(1, 3) is [1, 2, 3].
- AC-2. range(start, end) is [] when start is greater than end.
- AC-3. range throws TypeError when start or end is not an integer.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
