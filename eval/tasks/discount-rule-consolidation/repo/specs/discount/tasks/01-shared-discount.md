---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/pricing.test.js
depends_on: []
---

# Task 01 - move the discount-rule code that three modules copied into one shared module
## Goal
src/cart.js, src/subscription.js and src/invoice.js each carry their own copy of the discount-rule parsing and arithmetic. Move it into a new src/pricing/discount.js and make the three modules use it. This is a refactor: what cartTotal, subscriptionPrice and invoiceAmount return or throw must not change for any input.

## Acceptance criteria
- AC-1: src/pricing/discount.js exports parseRule(text), returning { kind: 'percent', percent } or { kind: 'fixed', cents } for a rule such as '10%' or '5.00', and null when the text is not a number.
- AC-2: src/pricing/discount.js exports discountCents(amountCents, ruleText, options): the discount in whole cents, never more than the amount, 0 when the rule cannot be parsed; options.rounding is 'nearest' (the default) or 'floor'.
- AC-3: cart.js, subscription.js and invoice.js use modules under src/pricing/ and no longer parse rules themselves.
- AC-4: The public functions of the three modules behave exactly as before.

## Out of scope
- Changing any behaviour.
