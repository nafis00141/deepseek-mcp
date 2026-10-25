# Research: session length

## Question
How many minutes does a session last for a premium user, and which file and line set the base length and the premium multiplier?

## Findings
A premium session lasts 120 minutes (src/session.js:3, src/session.js:5, src/session.js:6): the module multiplies the base length by the tier multiplier.

## Evidence
- src/session.js:3
- src/session.js:5
- src/session.js:6

## Open questions
- None; the README sentence is stale and was not used.
