# 0005 Timeouts

Status: accepted

Connect timeout 3 s, read timeout 10 s. A timeout surfaces as the transport error `ETIMEDOUT` (see 0003). What happens next is decided by the retry policy.
