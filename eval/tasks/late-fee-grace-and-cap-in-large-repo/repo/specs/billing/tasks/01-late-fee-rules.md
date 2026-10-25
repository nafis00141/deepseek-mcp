---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/late-fee.test.js
depends_on: []
---

# Task 01 - late fees get a grace period and a cap
## Goal
The fee charged on an overdue invoice is 1% of the amount for every day it is late. Add two rules: no fee at all while the invoice is at most 5 days late, and a fee that never exceeds 25% of the amount. Past the grace period the fee still counts every day late, not only the days after the grace period. The retired v1 statements (2% a day) are archived output and must not change.

## Acceptance criteria
- AC-1: An invoice that is 0 to 5 days late is charged no fee.
- AC-2: At 6 days late the fee is 6% of the amount; at 7 days, 7%; and so on.
- AC-3: The fee is never more than 25% of the amount, rounded to a whole cent like the fee itself.
- AC-4: The number of days late is counted as it is today, and the aging report keeps working.
- AC-5: The archived v1 fee calculation gives the same results as before.

## Out of scope
- Dates, currency and tax handling.
