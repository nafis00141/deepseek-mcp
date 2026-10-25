# Spec: coupon codes

## Goal
Let a customer apply one coupon code at checkout for a percentage discount.

## Non-goals
- The UI for entering a coupon.
- Stacking several coupons.

## Acceptance criteria
- AC-1. A valid coupon reduces the order total by its percentage.
- AC-2. The discount never exceeds 50 percent of the order total.
- AC-3. A second coupon on the same order is rejected.
- AC-4. An expired coupon is rejected with an error.

## Constraints
- Discount is a percentage, capped at 50 percent.

## Open questions
- Do coupons apply to shipping?
