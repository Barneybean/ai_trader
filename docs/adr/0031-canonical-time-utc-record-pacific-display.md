# ADR-0031 — Canonical time: record in UTC, display in Pacific, always labeled

**Status:** Accepted
**Date:** 2026-07-14

## Context

The bridge stored timestamps in UTC while Python tools could write local-offset
times. User-facing schedule dates and model-reset messages also depended on
machine-local rendering and could omit their time zone. This makes event
correlation and phone instructions unnecessarily ambiguous, especially around
daylight-saving transitions.

## Decision

New records use ISO-8601 UTC with a trailing `Z`. Human-facing report dates and
clock times render in `America/Los_Angeles` and include `PT`, `PST`, or `PDT`.
The shared helpers are `scripts/lib/clock.py` and `chat-bot-bridge/clock.js`.
Report filenames use the Pacific calendar day; schedule triggers remain the
operator's configured local wall-clock time.

Historical records remain unchanged. New record sites should use the helpers
rather than serializing local time directly.

## Consequences

- JS and Python records sort and correlate consistently.
- A phone message such as a model reset time is no longer an unlabeled clock.
- Regression tests verify UTC serialization and DST-correct Pacific display.

## Alternatives considered

- Store local time everywhere: rejected because offsets change across DST.
- Display UTC to every user: rejected because it adds daily conversion friction.
