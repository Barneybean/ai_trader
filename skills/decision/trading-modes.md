# Trading Modes — the desk's execution-authority switch

The desk has three levels of execution authority, set by the user and persisted in a local
`desk-mode.json` file at the repo root. This is core desk state, not a channel feature:
every session — terminal, phone bridge, and scheduled run — reads the same file and obeys
the same mode. The bridge `/mode` command and the `scripts/ops/desk_mode.py` CLI are two doors
to the same switch.

Read the mode at the start of every run and shape the orders section of the output accordingly.
A mode change applies from the very next message/action and the next scheduled run. Default
when the file is missing or unreadable: `semi`.

## The three modes

### `full` — validate-only autonomous shadow

The desk may decide what it would do, but it does not place an order. Every fully specified ticket
must pass `scripts/execution/gateway.py`; allowed tickets are reported as validated proposals and
rejects are written to the private operational issue log. This lets users test autonomous decisions
without granting autonomous broker authority.

Live placement stays disabled until broker integration, pre/post-trade reconciliation, durable
idempotency, kill-switch verification, and sandbox tests are complete. See
`docs/plans/full-auto.md` and ADR-0014.

### `semi` — numbered tickets, the user approves

The desk ends every actionable report/analysis with numbered, fully-specified tickets
(side, symbol, qty, order type, limit, session/TIF). Execution happens only on the user's
explicit approval in a later message — `approve 1`, `yes to 2`, `approve all` — and covers
exactly the tickets named, nothing more. An ad-hoc order the user requests directly still
gets one confirm round-trip.

### `manual` — advise-only (the kill switch)

Nothing executes without the full per-order confirm flow of
`skills/execution/data-and-execution.md`: restate the exact ticket → broker preview → the
user's explicit, order-specific `yes` in a separate message → place. Switching to manual is
the kill switch: it halts all autonomous and batch-approved execution from the next action
onward.

## Invariants

- Only accounts explicitly included in local execution scope are agent-tradable; every other
  visible account is read-only.
- Never move money — no transfers, deposits, withdrawals, or ACH.
- The ticket discipline is mode-independent: whoever pulls the trigger, every order is fully
  specified, previewed via the broker's review call, placed as specified, logged to the track
  record, and reported with fill status.
- If broker tools are unavailable, say so and mark tickets `execution pending broker auth` —
  never pretend an order was placed.
- Every report states the active mode in its orders section, so the reader knows whether tickets
  require per-order confirmation (`manual`), numbered approval (`semi`), or are validate-only
  autonomous proposals (`full`).

## Switching

| From | How |
|---|---|
| Phone bridge | `/mode full` · `/mode semi` · `/mode manual` — `/mode` alone shows current |
| Terminal session | `python3 scripts/ops/desk_mode.py` and `python3 scripts/ops/desk_mode.py set <mode>` |

Mode changes are event-logged by the bridge / local desk logger, and the `desk-mode.json`
file records what was set and when. When the user asks a session to switch modes, restate what
the new mode authorizes before writing it—especially that `full` does not authorize placement.

Cross-links: execution mechanics in `skills/execution/data-and-execution.md` · sizing and
review bar in `skills/decision/review-rubric.md` + `sufficiency-gate.md` · channel phrasing
injected by `chat-bot-bridge/chat-rules.js` (a consumer of this protocol, not the source).
