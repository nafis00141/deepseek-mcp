# 0003 Error shape returned by the client

Status: accepted

The client never throws for an HTTP status. It resolves with `{ status, headers, body }`. Transport failures resolve with `{ error: <code> }`, where `<code>` is the Node error code (`ECONNRESET`, `ETIMEDOUT`, `EACCES`, ...).
