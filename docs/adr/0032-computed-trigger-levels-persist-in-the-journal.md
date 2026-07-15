# ADR-0032: Computed trigger levels persist in the journal

Date: 2026-07-15 · Status: Accepted

## Context

Forecast and exit tools calculate useful breakout, breakdown, and trailing-stop levels, but those
levels previously disappeared after the process exited. Re-deriving them later loses the original
pre-commitment and can silently change the decision threshold.

## Decision

`scripts/journal/capture_levels.py` promotes selected computed levels into the existing local
`journal/action-levels.jsonl` registry. Automatic rows have `forecast:<report>` or
`exit_radar:<report>` provenance, identical open automatic rows are idempotent, expired rows do not
block a new capture, and an open human-curated row for the same ticker/direction always wins.

This is persistence and alerting only. Capturing a level does not authorize or place an order.

## Consequences

The alert sweep and future analyses can reuse the exact underwritten line, with source and expiry.
The registry remains private runtime state and may grow until expired/acted rows are cleaned up.

## Alternatives considered

- Create another score/level store—rejected because it would split recall.
- Keep every level ephemeral—rejected because it discards pre-commitment.
