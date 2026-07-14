# ADR-0014: Full-auto starts as a validate-only shadow

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Documentation described autonomous execution before the public toolkit had a deterministic code
gate, durable reconciliation, or sandbox proof. A model instruction alone is not a sufficient
authority boundary, and a source-repository implementation cannot be copied without explicit
classification and sanitization.

## Decision

Publish a broker-free execution gateway and private operational issue log. Experimental `full`
mode is a validate-only shadow: it may form and evaluate tickets but may not call broker placement.
The gateway fails closed on malformed tickets, unconfigured or wrong account scope, unsupported
instruments, missing sell inventory, risk and concentration limits, a tripped daily-loss breaker,
duplicate identity, and stale context.

Live autonomy requires a later ADR and the integration, reconciliation, durable idempotency,
kill-switch, privacy, and paper/sandbox gates in `docs/plans/full-auto.md`.

## Consequences

- Users can inspect deterministic decisions without granting autonomous broker authority.
- `semi` remains the normal approved-ticket workflow and `manual` remains the kill switch.
- An allowed gateway result is a validated proposal, never placement authorization or fill proof.
- The JSONL issue log is suitable for a single local process; a live concurrent system must replace
  it with durable concurrency-safe storage before autonomy can be considered.

## Alternatives considered

- **Document full autonomy without code enforcement:** rejected because prompts are not hard gates.
- **Port the source tree wholesale:** rejected by the source-sync boundary and privacy policy.
- **Remove full mode entirely:** rejected because shadow operation provides useful integration and
  decision-quality evidence without live-order risk.
