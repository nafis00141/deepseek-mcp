# Research: rate limit

## Question
What per-user rate limit, in requests per minute, does this API enforce, and where is it configured?

## Findings
The API enforces 100 requests per minute per user, configured in src/config.js:3 and enforced in src/server.js:8.

## Evidence
- src/config.js:3
- src/server.js:8
- src/server.js:9

## Open questions
- Is a rate limit enforced upstream of this service (a gateway or proxy)? Not answerable from this repository.
