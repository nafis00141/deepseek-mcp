# 0004 Retry policy for outbound requests

Status: accepted

## Decision

- Attempts are counted from 1. `attempt` is the number of the attempt that just failed.
- A request makes at most 4 attempts in total (the first try and 3 retries).
- Retry when the outcome is an HTTP status 429, 502, 503 or 504, or a transport error with code `ECONNRESET` or `ETIMEDOUT`. Never retry any other status (a 500 is a bug on the other side, not weather) or any other error code.
- The wait before the next attempt is `min(4000, 200 * 2^(attempt - 1))` milliseconds. There is no jitter: services are tested against exact waits.
- If the response carries a `Retry-After` header with a whole number of seconds, wait at least that long: the wait is the larger of the backoff and the header. A header that is not a whole number of seconds (an HTTP date, text) is ignored.
- If `Retry-After` asks for more than 30 seconds, do not retry at all; the caller reports the failure.
- Header names are case-insensitive.

## Consequences

All services see the same schedule: 200 ms, 400 ms, 800 ms between the four attempts.
