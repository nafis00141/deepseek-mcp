# Research: rate limit

## Question
What per-user rate limit, in requests per minute, does this API enforce, and where is it configured?

## Findings
NOT FOUND: an explicit setting. The default is 60 requests per minute (src/server.js:8).

## Evidence
- src/server.js:8

## Open questions
- Is a rate limit enforced upstream of this service (a gateway or proxy)? Not answerable from this repository.
