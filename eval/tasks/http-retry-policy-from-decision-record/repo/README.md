# fixture-client

A tiny HTTP client wrapper. `src/client.js` sends a request through a caller-supplied `send` function and uses `src/retry.js` to decide whether to try again.

Written decisions live in `docs/decisions/`.
