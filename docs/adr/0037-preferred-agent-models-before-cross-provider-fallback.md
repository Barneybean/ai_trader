# ADR-0037: Try preferred-agent models before cross-provider fallback

Date: 2026-07-15 · Status: Accepted

## Context

An availability failure can be isolated to one model rather than the whole provider. Crossing to a
different agent immediately discards provider-specific session continuity and requires a more
expensive context handoff even when another eligible model from the preferred agent is available.
Ambiguous final output can also hide an explicit provider rate-limit event.

## Decision

Automatic availability routing tries up to three eligible models from the preferred agent before
trying the alternate agent. Explicit provider availability events take precedence over ambiguous
final output, and a model change starts a fresh provider session while preserving completed
filesystem work and the original objective.

Automatic fallback remains limited to scheduled requests and the public validate-only `full` mode.
Ordinary failures do not advance the plan, and an empty filtered plan is reported as exhausted.

## Consequences

Transient model limits preserve the preferred provider when possible, while genuine provider-wide
unavailability still crosses agents. Session boundaries are explicit, and no fallback weakens broker
confirmation or turns validate-only behavior into live autonomous execution.

## Alternatives considered

- Interleave providers after every model failure—rejected because it crosses the session boundary
  before exhausting lower-cost same-agent choices.
- Treat every failed tool or command as provider unavailability—rejected because task failures must
  remain visible and must not quarantine a healthy model.
