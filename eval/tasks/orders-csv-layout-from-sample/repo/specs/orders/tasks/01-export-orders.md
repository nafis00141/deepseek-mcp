---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/export.test.js
depends_on: []
---

# Task 01 - export orders as CSV in the layout the nightly import already reads
## Goal
Add exportOrders(orders) to src/export.js. It returns the orders as CSV text in the usual layout, the one the nightly import file uses, so that parsing the export with src/importer.js gives back the same orders. An order is { id, customer, totalCents, paid, note }; note may be missing.

## Acceptance criteria
- AC-1: exportOrders returns CSV text in the same layout as the nightly import file.
- AC-2: parseOrdersCsv(exportOrders(orders)) returns the original orders, whatever the customer name or note contains.
- AC-3: An empty list exports as just the header.

## Out of scope
- The importer.
