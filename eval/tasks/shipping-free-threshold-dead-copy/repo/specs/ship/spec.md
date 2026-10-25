# Spec: free shipping threshold: change the live rule in every place that applies it

## Goal
Free shipping now starts at 40.00 (it was 50.00) and is judged on the order amount after the discount (it was judged before the discount). The cart banner that tells the customer how much is missing must follow the same rule.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. An order whose amount after discount is 40.00 or more ships free; below that it pays the zone rate.
- AC-2. The banner says how much is missing from 40.00, measured after the discount, and says 'Free shipping applied' once the order qualifies.
- AC-3. Totals, discounts and the summary lines keep their current format.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
