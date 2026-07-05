# The Desk Operating System — reference map

**Objective of this desk:** find the **asymmetric, big-money opportunities** — the
early-wave multi-baggers and deep-mispriced quality where the real returns live — while
protecting capital with hard risk discipline. Not 15% swings for their own sake; the aim is
to be *early and right* on the moves that matter, and to say "nothing today" the rest of the
time. Every reference below is a component of that machine.

The run itself (the ordered pipeline that uses these) lives in `SKILL.md`. This file is the
**map**: what each reference is for, how they layer, and how to extend the system.

---

## The stack (layers of the machine)

**Layer 0 — Map & process**
- `README.md` (this file) — the index and extension guide.
- `../SKILL.md` — the end-to-end run: objective → selection funnel → pipeline → report.
  Includes **"Portability & capability detection"** — the per-runtime fallback map so the same
  skill runs in Claude Code, Claude Desktop, and Codex.
- `../AGENTS.md` — the portable entry point for Codex / any AGENTS.md-aware agent; points back
  to `SKILL.md` (no duplicated instructions).
- `../PORTABILITY.md` — how one source folder mirrors to every runtime (symlink / AGENTS.md /
  regenerated bundle), and the one-time setup.

**Layer 1 — Where the money is (edge doctrine)** — *the money-making thesis engine*
- `skills/edge/variant-perception.md` — the core edge: find what isn't priced yet; the required
  variant-perception statement, the edge taxonomy, the deep-research playbook.
- `skills/edge/thematic-waves.md` — the secular-wave / capital-rotation lens; the AI wave-map; the
  historical pattern library; how to find/time/size the multi-bagger.
- `skills/edge/smart-money.md` — insider Form-4 & institutional flows as weighted evidence
  (buys at bottoms vs. selling into strength).

**Layer 2 — How to analyze a name (analysis engines)**
- `skills/analysis/sector-playbooks.md` + `sectors/` — per-industry "what actually sets the price + where the
  catalyst hides." Scalable folder, one file per sector.
- `skills/analysis/quant-levels.md` — the technical/level engine: support/resistance pressure map, ADX,
  momentum, ATR stops, RR/EV (drives `scripts/indicators.py`).
- `skills/analysis/chip-distribution.md` — the institutional-footprint lens: Wyckoff phase, chip /
  cost-basis distribution (筹码), accumulation vs. distribution tells, and anticipating the
  shakeouts ("chip washes"/洗盘) before a markup. Feeds the Quant role's phase/timing read.
- `skills/analysis/macro-regime.md` — the top-down weather: Fed path, rates, VIX, breadth; regime tilt.
- `skills/analysis/crisis-playbook.md` — the *extreme-weather* manual: when the regime is a crash/regime-shock,
  how to survive (protect the base) and hunt the generational trade (phase map + case studies:
  2000, 2008, COVID, 2025 trade war, 2026 geopolitical). Invoked by `skills/analysis/macro-regime.md`.

**Layer 3 — Decide, size, protect (discipline)**
- `skills/decision/review-rubric.md` — scoring, hard gates, sleeves, position sizing, asymmetric-bet sizing.
- `skills/decision/strategies.md` — exit discipline, rank-and-rotate, validation patterns.
- `skills/decision/stress-test.md` — the adversarial questioning mechanism: premise/"if→then" audit,
  two-sided catalysts, load-bearing-assumption inventory, disconfirming-evidence hunt,
  non-price invalidation, pre-mortem; drives the Red Team and the CIO gate's sizing.
- `skills/decision/research-debate.md` — the **structured multi-round Bull-vs-Bear debate** + Research-Manager
  adjudication (commit to a stance, don't default to Hold) that upgrades Step 5. The
  stress-test is the bear's ammunition. *(Adapted from TradingAgents' researcher team.)*
- `skills/decision/risk-committee.md` — the **three-lens risk debate** (aggressive/neutral/conservative) + Risk-Judge
  adjudication that upgrades Step 7; still bound by the rubric's gates and the mentor caps.
  *(Adapted from TradingAgents' risk-management team.)*
- `skills/decision/reflection-memory.md` — the **learning loop**: log every call, score raw + alpha-vs-SPY
  when it matures, write one reusable lesson, and recall past lessons into future runs. In-repo
  journal shared across runtimes. *(Adapted from TradingAgents' reflection mechanism.)*
- `skills/decision/tax-aware.md` — holding-period, wash-sale, tax-loss-harvest rules.
- `skills/decision/roles.md` — the charter for each desk role (who does what, independently).

**Layer 4 — The user's playbook & context**
- `skills/playbook/mentor-casebook.md` — the mentor's distilled philosophy, operating mechanics, and dated
  3-year track record (a pattern library that calibrates the desk's judgment).
- `skills/playbook/mentor-method.md` — the mentor method (undervalued quality + 2x/multi-bagger path,
  management read, 25% concentration cap).
- `skills/playbook/house-views.md` — the user's own macro/technical heuristics.
- `skills/playbook/watchlist-theses.md` — specific names the user tracks; re-validate before acting.
- `skills/playbook/options.md` — preferred option structures + account option-level constraint.
- `skills/playbook/private-deals.md` — venture DD framework (separate, non-tradable-account track).

**Layer 5 — Data & execution**
- `skills/execution/data-and-execution.md` — Robinhood connector tool map, account/watchlist IDs, the
  confirm-before-every-order guardrails.

**Scripts**
- `../scripts/indicators.py` — quant/technical engine (levels, ADX/RSI/MACD/ATR/OBV).
- `../scripts/new_report.py` — dated report scaffold writer.
- `../scripts/track_record.py` — the decision journal + reflection engine (log / recall / score-vs-SPY / reflect / calibration report); stores in `../journal/`.
- `../scripts/package_skill.py` — regenerates the Claude Desktop bundle (`dist/trading-desk.zip`) from this folder.
- `../scripts/install_mirrors.sh` — one-time wiring: symlinks Claude Code + Codex back to this source folder.

---

## How to read the flow

1. **Weather & wave** (macro-regime + thematic-waves) set *what kind of ideas belong on the
   page today and where the money is rotating*.
2. **Edge doctrine** (variant-perception) forces *a differentiated, evidenced thesis* — no
   consensus restatements.
3. **Analysis engines** (sector-playbook for the industry + quant levels + insider flows)
   *build and time* the thesis with primary-source depth and scenario valuation.
4. **Discipline** (rubric + strategies + tax + risk) *decides, sizes, and protects*.
5. **User context** (mentor-method + house-views) *tilts and personalizes* throughout.

---

## Extending the system (keep it scalable)

- **New sector** → add `sectors/<name>.md` using `sectors/_TEMPLATE.md`, then register it in
  the table in `skills/analysis/sector-playbooks.md`. Don't grow one monolith.
- **New theme/wave** → add a layer/section to `skills/edge/thematic-waves.md` (the wave-map is meant to
  evolve as new bottlenecks emerge).
- **New signal/evidence source** (e.g. a new data edge) → new top-level reference in Layer 1
  or 2; register it here and wire it into `skills/decision/roles.md` + the rubric.
- **Every reference should be self-contained, skimmable, and structured** — lead with its
  purpose, then the actionable framework, then guardrails/sources. Update this map when you
  add one.
