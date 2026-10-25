# Research: session length

## Question
How many minutes does a session last for a premium user, and which file and line set the base length and the premium multiplier?

## Findings
A premium session lasts 120 minutes: the base length is 30 minutes (src/session.js:3) and the premium multiplier is 4 (src/tiers.js:6), combined in durationMinutes (src/session.js:6).

## Evidence
- src/session.js:3 `const BASE_MINUTES = 30;`
- src/tiers.js:6 `premium: 4,`
- src/session.js:6 `BASE_MINUTES * (MULTIPLIER[tier] || 1)`

## Open questions
- None; the README sentence is stale and was not used.
