# ADR-0015: Predictive rules are expiring hypotheses

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

A growing decision toolkit can overfit in two directions: it can turn one outcome into a permanent
rule, and it can retain gates that consume context and attention without changing decisions.
Removing a rarely triggered safety control would create the opposite failure, so efficacy cannot be
measured by firing frequency alone.

## Decision

Separate rules into two classes:

- **Safety invariants and hard preconditions** protect authority, capital, privacy, and data
  integrity. They are not weakened by trading outcomes and are exempt from dead-gate retirement.
- **Investment hypotheses** include patterns, regime assumptions, ranking methods, and tunable
  thresholds. They are falsifiable, regime-tagged, and subject to expiry or retirement.

The weekly retrospective will score load-bearing premises and audit non-safety gates over a
meaningful evidence window. Predictive rules still require two independent same-mode rule errors
before modification. A gate with no unique effect may be consolidated or retired only when doing so
preserves decision and safety behavior. Permanent changes use the normal issue and PR lifecycle.

## Consequences

- The toolkit can reduce redundant context and token cost without weakening safety.
- Reviewers must identify whether a proposed rule is an invariant or a hypothesis.
- Rare-event safety controls are judged by coverage and correctness, not usage count.
- Premise scoring initially relies on disciplined retrospective records; automation may follow only
  after the record shape is stable.

## Alternatives considered

- **Treat every written rule as permanent:** rejected because predictive edges and regimes change.
- **Delete anything that rarely fires:** rejected because safety controls are intentionally quiet.
- **Change a rule after one miss:** rejected because it encodes noise and violates the existing
  two-observation anti-overfitting standard.
