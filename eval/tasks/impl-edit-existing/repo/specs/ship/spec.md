# Spec: express shipping

## Goal
Add an express option to shippingCost.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. shippingCost(w, { express: true }) returns double the normal price.
- AC-2. Without options, or with express false, the existing bands (<=1kg 5, <=5kg 9, else 15) are unchanged.
- AC-3. A weight that is not a positive number throws RangeError.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
