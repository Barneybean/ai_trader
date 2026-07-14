# scripts/ — the desk toolkit (pure Python stdlib, no install step)

Grouped by what the script serves. Every CLI is run from the repo root
(`python3 scripts/<group>/<name>.py`); shared modules resolve via a small
`sys.path` header in each entry point, so there is no package/install step.

## analysis/ — market & quant engines (read the tape)

| Script | What it answers |
|---|---|
| `indicators.py` | Full indicator stack on a bars file: trend, momentum, volatility, volume, S/R ladder, chip/cost-basis distribution (筹码), ATR trade scaffold |
| `flow_anomaly.py` | Unusual-money-movement read: flow_pressure, coil_energy, divergence → COILED_* verdict + trigger |
| `forecast.py` | Quantified odds when coiled/testing: squeeze percentile, historical analogs, Monte-Carlo cone, first-passage |
| `value_radar.py` | ≥30%-undervaluation finder: fair value = median of ≥2 legs, washed+basing gate → BUY-CANDIDATE / WAIT-KNIFE / PASS |
| `exit_radar.py` | Sell-timing on winners/spikers: six distribution tells → RIDE / TIGHTEN / TRIM / EXIT + chandelier stop ladder |
| `rotation_radar.py` | Sector-ETF sweep vs SPY → COOLING (trim review) / TURNING (hunt) labels |
| `reverse_dcf.py` | What growth the current price implies (the expectations bar) |
| `quality_gate.py` | Is the business good enough to underwrite? (margins/returns/balance-sheet gates, with justified exemptions) |
| `mentor_overlay.py` | Portfolio vs the mentor book: CONFLICT / ALIGNED audit |
| `mentor_history.py` | Append-only mentor snapshots, position deltas, and per-symbol conviction history |

## journal/ — track record, alerts & the weekly loop (keep score)

| Script | What it answers |
|---|---|
| `track_record.py` | Log / score / reflect / recall every desk call (`journal/decisions.jsonl`) |
| `score_insights.py` | Per-method hit rates; mark open insights to market (`journal/insights.jsonl`) |
| `check_alerts.py` | Action-levels registry sweep: TRIGGERED / expiring levels (`journal/action-levels.jsonl`) |
| `weekly_review.py` | The weekly pack: open book marked to market vs SPY, score-ready commands, archive re-read list |
| `desk_memory.py` | Unified pre-analysis recall across reports, decisions, insights, levels, and methodology refs |

## report/ — the deliverable (bilingual HTML deck)

| Script | Role |
|---|---|
| `new_report.py` | Scaffold the dated `.md` source in `reports/.build/` (stamps date, market state, trading mode) |
| `charts.py` | Per-name SVGs: scorecard, price/volume, chips, gauges, forecast fan |
| `build_report.py` | Markdown → self-contained styled HTML with EN/中文 toggle (the portable deliverable) |
| `organize_reports.py` | Lifecycle helper invoked by scaffold/build: current week at root, older reports archived by ISO week |

## ops/ — desk state, safety gates & install (run the shop)

| Script | Role |
|---|---|
| `desk_mode.py` | Trading mode (manual / semi / full): show, `set <mode>`, `--json` — see `skills/decision/trading-modes.md` |
| `scan_pii.py` | PII/account-identifier gate; runs from `.githooks/` pre-commit & pre-push. Denylists live here (`*_denylist.*`; `.local.txt` are git-ignored) |
| `check_consistency.py` | Pre-push integrity gate: links, registrations, ADRs, collisions, context budgets |
| `smoke_test.py` | Significant-change smoke gate: targeted syntax + behavior checks, then a human review request |
| `sync_audit.py` | Read-only source/public inventory: remote firewall, boundary classification, public invariants, and review plan |
| `change_traceability.py` / `test_change_traceability.py` | PR gate and regression suite: verify same-repository issues, rationale, and acceptance criteria through read-only GitHub metadata |
| `new_adr.py` | Scaffold an Architecture Decision Record in `docs/adr/` |
| `package_skill.py` | Zip the skill (SKILL.md + skills/ + scripts/) for Claude Desktop upload |
| `install_hooks.sh` / `install_mirrors.sh` | One-time setup: git hooks, runtime mirrors |

## lib/ — shared modules (imported by the above; also runnable)

| Module | Role |
|---|---|
| `yahoo.py` | Multi-year daily bars from Yahoo (stdlib, no key) in the exact shape every engine parses |
| `desk_log.py` | Unified activity logging (`logs/desk.log` + `logs/activity.jsonl`); every CLI wraps its `main` in `desk_log.run` — `python3 scripts/lib/desk_log.py tail` shows recent activity |
| `jsonl.py` | Tolerant shared JSONL reader used by journal recall/review tools; internal library, not a user CLI |

## Lifecycle classes

- **Every run:** recall/alerts plus the candidate-specific analysis engines selected by `SKILL.md`.
- **Scheduled:** weekly review, rotation/value scans, insight scoring, and report lifecycle organization.
- **Triggered:** crisis, sell-timing, options, tax, private-deal, and sector/stock playbooks only when their gate fires.
- **Maintenance:** hooks, smoke checks, consistency checks, ADR scaffolding, packaging, and runtime mirrors. Rare use is expected; these preserve safety and portability and should not be forced into a desk run.

Conventions: new engines take `--json` for machine use and log via the two-line
`desk_log.run(main)` entry pattern; anything user-runnable gets a usage docstring
(it doubles as `--help` text). Adding a script? Put it in the group it serves,
and reference it from the relevant skill in `skills/`.

## Compatibility paths

The grouped paths above are canonical. Thin launchers remain at the former flat paths (for
example, `scripts/indicators.py`) so existing user commands and integrations keep working. New
code and documentation should use `scripts/analysis/indicators.py` and the other grouped paths.
