# ADR-0033: Ticket lifecycle is closeable, non-carrying, and reconciled

Date: 2026-07-15 · Status: Accepted

## Context

A stale proposed ticket could remain in the local queue after the user no longer wanted it or after
a new report stopped recommending it. A market move could also turn an approved limit into a
non-marketable order and invite repeated clarification loops.

## Decision

- `close N`, `close all`, and unambiguous dismissal wording deterministically remove local queued
  tickets. Dismissal never places, changes, or cancels a broker order.
- A reconciled report that does not re-propose an older pending ticket marks it superseded.
- Approval fixes side, symbol, size, and intent. After live reconciliation, one limit adjustment
  toward marketability of at most 0.3% is allowed and logged. Any larger or risk-worsening change
  becomes one corrected numbered ticket requiring fresh approval.
- A live protective order is not cancelled or weakened until the replacement exit is confirmed.

## Consequences

Users can always end a local ticket thread, stale proposals do not carry indefinitely, and small
market moves have a bounded resolution. The bridge must keep dismissal distinct from a broker
cancel ticket and preserve the exact-approval audit trail.

## Alternatives considered

- Expire solely on a timer—rejected in favor of the next reconciled report.
- Re-price without a bound—rejected as an authority expansion.
