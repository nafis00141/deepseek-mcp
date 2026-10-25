# 0002 Structured log lines

Status: accepted

Every log line is one JSON object with `level`, `msg` and `ts`. Retries are logged at `warn` with the attempt number.
