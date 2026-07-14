# Full-auto execution plan

## Current phase: validate-only shadow

Experimental `full` mode can decide and validate proposed equity limit tickets, but it cannot
place an order. `scripts/execution/gateway.py` is deliberately broker-free. It returns the same
allow/deny decision for the same ticket, context, and configured limits; rejected tickets are
written to the git-ignored operational issue log for human review.

The public default remains `semi`, where the user approves numbered tickets. `manual` remains the
per-order-confirm kill switch.

Regression contracts live in `scripts/execution/test_gateway.py` and
`scripts/lib/test_issue_log.py`; the append-only implementation is `scripts/lib/issue_log.py`.

## Required before live autonomy

Live full-auto placement stays disabled until one reviewed change demonstrates all of the following:

1. a broker adapter that cannot bypass the gateway;
2. fresh pre-trade account, position, quote, and open-order reconciliation;
3. durable, concurrency-safe idempotency across retries and restarts;
4. post-placement status and fill reconciliation with user notification;
5. a kill switch checked immediately before every broker-side action;
6. paper/sandbox integration tests covering duplicate, stale, oversized, wrong-account, partial-fill,
   cancellation, timeout, and restart cases;
7. privacy-safe audit logs and operational recovery instructions;
8. a separate issue, ADR, security review, and explicit human approval.

Until then, an allowed result means only “this proposal passed the current deterministic checks.”
It is not authorization and is not evidence that an order was placed.
