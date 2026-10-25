# Spec: CSV export dates in ISO 8601 UTC without touching the screens that share the formatter

## Goal
The CSV export of notes writes the created and updated columns as ISO 8601 UTC timestamps with whole seconds, for example 2026-03-04T05:06:07Z. A note that was never updated still has an empty updated column. Nothing else may change: the notes list on screen and the JSON export keep their current output.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. exportCsv writes created and updated as YYYY-MM-DDTHH:MM:SSZ in UTC, dropping milliseconds.
- AC-2. A note with no updated time has an empty updated column.
- AC-3. The on-screen list and the JSON export produce exactly what they produce today.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
