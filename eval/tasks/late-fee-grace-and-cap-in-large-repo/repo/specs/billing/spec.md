# Spec: late fees get a grace period and a cap

## Goal
The late fee on an overdue invoice is 1% of the amount for every day it is late. Add two rules: no fee at all while the invoice is at most 5 days late, and a fee that never exceeds 25% of the amount. Past the grace period the fee still counts every day late, not only the days after the grace period.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. lateFee returns 0 for an invoice that is 0 to 5 days late.
- AC-2. At 6 days late the fee is 6% of the amount; at 7 days, 7%; and so on.
- AC-3. The fee is never more than 25% of the amount, rounded to a whole cent like the fee itself.
- AC-4. daysLate keeps meaning what it means today, and the aging report keeps working.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
