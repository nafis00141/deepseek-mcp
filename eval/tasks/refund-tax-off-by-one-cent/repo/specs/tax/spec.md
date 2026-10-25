# Spec: make tests/invoice.test.js pass: the refund tax is one cent off

## Goal
tests/invoice.test.js fails: the tax on a refund invoice is one cent too high (-52 instead of -53 for a 5% tax on -10.50). Find the cause in src/ and fix it. Do not change the tests.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. tests/invoice.test.js passes.
- AC-2. A half cent rounds away from zero for negative amounts as it already does for positive ones, and a zero result is plain 0, never -0.
- AC-3. Every amount that goes through the money helpers gets the same rounding, not only invoices.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
