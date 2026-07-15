# ADR-0034: Pending-ticket talk is a natural conversation

Date: 2026-07-15 · Status: Accepted

## Context

Trying to parse every trade discussion as fixed command grammar makes ordinary questions and
revision requests brittle. Only the safety-critical commit actions need deterministic resolution.

## Decision

- Explicit approve and close actions remain deterministic.
- Other messages while a ticket is pending run the selected agent with trusted bridge context that
  contains the exact proposed tickets, current state, approval boundary, and anti-loop guidance.
- A revision emits new numbered tickets with private `ORDER_TICKET` markers and re-enters approval.
- If the conversational run fails, a concise factual fallback lists the pending tickets and exact
  ways to approve or close them.

The original authenticated message remains the user turn; injected ticket state is runtime control
context and cannot manufacture user authorization.

## Consequences

Users can ask why, resize, change a price, park, or drop a proposal in ordinary language while
placement remains exact and mode-gated.

## Alternatives considered

- Add more regex verbs—rejected as an unbounded and ambiguous command grammar.
- Send approval itself to the model—rejected because placement must stay deterministic.
