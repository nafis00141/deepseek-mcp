# Research: rate limit

## Question
What per-user rate limit, in requests per minute, does this API enforce, and where is it configured?

## Findings
NOT FOUND: a per-user rate limit. I read the whole request path (src/server.js:8-12) and the configuration (src/config.js:3); the only limits are the port and a timeout.

## Evidence
- src/server.js:8-12 `function handle(req) {`
- src/config.js:3 is the entire configuration

## Open questions
- Is a rate limit enforced upstream of this service (a gateway or proxy)? Not answerable from this repository.
