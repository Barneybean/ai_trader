# Architecture Decision Records (ADRs)

Key decisions about **how this desk works** — method, pipeline, toolkit architecture, data
contracts, privacy posture, runtime/broker support — get recorded here as short, numbered,
immutable documents. The reports capture what the desk *concluded*; ADRs capture why the
machine is *built the way it is*, so an iteration six months from now doesn't re-litigate
(or silently undo) a decision whose rationale lived only in a chat session.

## When to write one

Write an ADR when a change:

- alters the **desk method** (a new gate, a changed funnel step, a scoring change),
- changes **toolkit architecture** or a **data contract** (storage formats, journal schemas,
  what a script consumes/emits),
- changes the **privacy posture** (what may be logged, committed, or published),
- adds/drops a **runtime or broker** integration,
- rejects a significant alternative someone is likely to propose again.

Routine bug fixes, copy edits, and new reference content don't need one.

## Process

1. Scaffold: `python3 scripts/ops/new_adr.py "Short decision title"` → creates the next
   `NNNN-slug.md` from [`template.md`](template.md) with status **Proposed**.
2. Fill in Context / Decision / Consequences / Alternatives. Keep it under a page.
3. Land it in the same commit/PR as the change it explains. Flip status to **Accepted** when
   the change ships.
4. Never rewrite an accepted ADR's decision. To change course, write a new ADR and mark the
   old one **Superseded by ADR-NNNN**. Numbers are never reused.
5. This directory is public — the PII gate applies. No account data, no personal identifiers;
   run `python3 scripts/ops/scan_pii.py` before pushing, like everything else.

`python3 scripts/ops/new_adr.py --list` prints the index (number, status, title).

## Index

- [ADR-0001](0001-record-key-decisions-as-adrs.md) — Record key decisions as ADRs — Accepted
- [ADR-0002](0002-toolkit-activity-log.md) — Toolkit activity log in `journal/toolkit.jsonl` — Superseded by ADR-0004
- [ADR-0003](0003-contribution-self-review-gate.md) — Contribution self-review: condensed wording + consistency gate — Accepted
- [ADR-0004](0004-structured-runtime-activity-logs.md) — Structured runtime activity logs — Accepted
- [ADR-0005](0005-universal-messenger-and-agent-bridge.md) — Universal messenger and agent bridge — Accepted
- [ADR-0006](0006-grouped-scripts-with-compatibility-launchers.md) — Grouped scripts with compatibility launchers — Accepted
- [ADR-0007](0007-significant-change-smoke-gate.md) — Significant-change smoke gate with human review — Accepted
- [ADR-0008](0008-read-only-source-sync-audit.md) — Read-only source sync audit before public ports — Accepted
- [ADR-0009](0009-book-state-reconciliation-gate-and-forward-act-when-triggers.md) — Book-state reconciliation gate and forward Act-when triggers — Accepted
- [ADR-0010](0010-modular-phone-bridge-re-architecture.md) — Modular phone-bridge re-architecture — Accepted
- [ADR-0011](0011-public-default-trading-mode-is-semi.md) — Public default trading mode is `semi` — Accepted
- [ADR-0012](0012-manual-phone-agent-picker-is-independent-of-availability-fal.md) — Manual phone agent picker is independent of availability fallback — Accepted
- [ADR-0013](0013-verified-issue-traceability-and-explicit-owner-admin-override.md) — Verified issue traceability and explicit owner-admin override — Accepted
- [ADR-0014](0014-full-auto-starts-as-a-validate-only-shadow.md) — Full-auto starts as a validate-only shadow — Accepted
- [ADR-0015](0015-predictive-rules-are-expiring-hypotheses.md) — Predictive rules are expiring hypotheses — Accepted
- [ADR-0016](0016-phone-bridge-recovery-and-delivery-are-deterministic.md) — Phone bridge recovery and delivery are deterministic — Accepted
- [ADR-0031](0031-canonical-time-utc-record-pacific-display.md) — Canonical time: record in UTC, display in Pacific, always labeled — Accepted
