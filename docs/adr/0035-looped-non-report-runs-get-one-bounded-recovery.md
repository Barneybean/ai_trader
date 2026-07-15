# ADR-0035: Looped non-report runs get one bounded recovery

Date: 2026-07-15 · Status: Superseded by ADR-0038

## Context

The bridge already bounded repeated tool calls, but an ordinary conversation that tripped the
circuit breaker ended only in an error. Hard-routing around a particular agent would hide the
runtime defect and override user choice.

## Decision

A non-report run that fails specifically on a repeated-tool/tool-budget circuit breaker receives
one retry with the same agent, a small configurable budget (default 10, maximum 20), and explicit
instructions not to repeat the failing call. Report runs retain their separate artifact-completion
path. Broker-execution runs never receive this retry because a blind rerun could duplicate a write.

If the retry fails, the normal error path—including pending-ticket fallback—finishes the run. This
is ordinary bounded reliability, not autonomous diagnosis or self-repair.

## Consequences

Agent choice remains user-controlled and a transient loop usually still produces a direct answer.
The retry cannot recurse or modify the bridge itself.

## Alternatives considered

- Prefer one vendor for trade conversations—rejected because availability and user choice should
  control routing.
- Retry indefinitely—rejected as another loop.
