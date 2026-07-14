# ADR-0016: Phone bridge recovery and delivery are deterministic

- **Status:** Accepted
- **Date:** 2026-07-14
- **Deciders:** Repository owner and toolkit maintainer

## Context

A report-producing agent can finish an artifact but fail before naming it, hit a bounded tool cap
after doing most of the research, or be replaced after an observed model limit. Explicit and
automatically discovered attachments can also refer to the same file. Scheduled retries and
ambiguous approval text add duplicate-execution and duplicate-delivery risk.

The public implementation must provide these reliability controls without publishing a user's
models, reset times, sessions, report history, filesystem paths, or broker/account configuration.

## Decision

The bridge will use a configurable agent registry plus a bounded, git-ignored availability ledger.
Automatic routing skips current observed failures and considers no more than three models per agent.

Report delivery is based on a before/after artifact snapshot. Complete HTML reports are detected,
resolved through repository file guards, and deduplicated against explicit attachments and archive
copies. A report that alone reaches its tool cap may receive one bounded fresh-session completion
attempt. Recovery retains repeated-call protection, prohibits broker writes, and never recurses.

Scheduled runs are idempotent per kind and local calendar day, with an explicit force bypass. Queue
rejection does not consume the idempotency slot. Ticket parsing and post-report action summaries use
deterministic stored items rather than guessing from conversational history.

## Consequences

Users receive completed reports despite common agent-exit paths and do not receive duplicate files.
Known unavailable models stop consuming automatic attempts. Runtime state remains local and may be
discarded safely, at the cost of forgetting temporary availability and delivery observations.
Recovery is deliberately incomplete: it does not retry ordinary failures or obtain execution
authority, and a report that remains incomplete is withheld.

## Alternatives considered

- **Require every agent to emit `FILE:` correctly** — rejected because delivery should not depend on
  final-response formatting after the artifact already exists.
- **Retry an unfinished report without a bound** — rejected because repeated research can burn tokens
  indefinitely and create side effects.
- **Persist availability inside committed configuration** — rejected because reset history and local
  model choices are user-specific runtime data.
- **Deduplicate scheduled runs by UTC date** — rejected because reports follow the operator's local
  trading calendar.
