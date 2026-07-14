# AGENTS.md — AI Trader

**This repository *is* the AI Trader skill.** It is one source of truth, read by several
agent runtimes (Claude Code, Claude Desktop, Codex, and any other AGENTS.md-aware agent). Do
not fork or copy the instructions — read them in place.

## Your operating instructions

1. **Read [`SKILL.md`](SKILL.md) in full and follow it.** It is the complete charter for this
   desk: objective, the stock-selection funnel, operating principles, the pipeline, and the
   report format. Everything below is just wiring so the same `SKILL.md` runs anywhere.
2. **Reference library:** [`skills/`](skills/) — start at
   [`skills/README.md`](skills/README.md), the map of the whole machine.
3. **Tools:** [`scripts/`](scripts/) — pure-Python-stdlib, no dependencies, run on any
   `python3`. `indicators.py` is the quant engine; `charts.py`/`build_report.py` render the
   report; `new_report.py` scaffolds it.
4. **Public/private development boundary:** before moving, publishing, or generalizing a feature,
   read [`docs/open-source-boundary.md`](docs/open-source-boundary.md). Significant changes must
   review whether that living standard also needs an update. For any source repo, fork, or user
   branch, begin with its read-only `python3 scripts/ops/sync_audit.py --source <path>` workflow.
5. **Change lifecycle:** every feature, bug fix, or behavior change must start from an issue that
   states the use case or reason, be implemented on a branch, and reach the default branch only
   through a reviewed MR/PR that closes the issue. Follow [`DEVELOPMENT.md`](DEVELOPMENT.md); do not
   make or merge permanent direct-to-default changes.

## Before you run: detect your environment

This skill was born in Claude Code (with a Robinhood connector and subagents). It is written
to **degrade gracefully** when those aren't present. Read **"Portability & capability
detection"** in `SKILL.md` and follow the branch that matches what you actually have:

- **Market data** — if Robinhood MCP tools are loaded, use them (`skills/execution/data-and-execution.md`).
  If not (the usual case in Codex), use the **web + manual-data fallback**: pull quotes /
  fundamentals / news via web search, and have the user save ~1yr of daily OHLCV as JSON or CSV
  for `scripts/analysis/indicators.py`. The scripts never call the broker themselves.
- **Roles** — if you can spawn subagents, run the desk roles in parallel. If not, play them
  sequentially yourself but keep the bull case, bear case, and risk review genuinely separate.
- **Delivery** — if you have a writable git remote, build and push the HTML report. Otherwise
  deliver the markdown/HTML locally or inline.
- **Execution** — read `skills/decision/trading-modes.md` before any order. The public default is
  `manual`: preview and obtain an explicit, order-specific confirmation. `semi` and experimental
  `full` require explicit user opt-in and remain bounded by previews, account scope, sufficiency,
  risk gates, logging, and the kill switch. With no connector, output an unplaced exact ticket.

## Not financial advice

This desk analyzes and recommends; the user approves and places every order. Always state the
key risks.
