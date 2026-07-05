<div align="center">

# 📈 Trading Desk

**An open-source, multi-agent trading-research desk you run with an AI coding agent.**

*Independent analyst roles · structured bull-vs-bear debate · a three-lens risk committee · a quant
engine with support/resistance & chip-distribution · and a memory loop that learns from its own
calls — tuned to surface only the few ideas with genuine edge.*

![License](https://img.shields.io/badge/license-see%20LICENSE-blue)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![Status](https://img.shields.io/badge/status-alpha-orange)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![Agent](https://img.shields.io/badge/agent-Claude%20Code%20%7C%20Codex-8A2BE2)
![Not financial advice](https://img.shields.io/badge/⚠️-not%20financial%20advice-red)

🧭 [Overview](#-overview) ·
🏛️ [The Desk](#️-the-desk) ·
⚡ [Quickstart](#-quickstart) ·
🧩 [Make It Yours](#-make-it-yours) ·
🔌 [Brokers](#-broker-support) ·
🔒 [Privacy Gate](#-privacy--the-pii-gate) ·
🗺️ [Roadmap](#️-roadmap) ·
🤝 [Contributing](#-contributing) ·
🙏 [Credits](#-acknowledgements--citation)

</div>

> ⚠️ **Not financial advice.** This is research tooling. It **never auto-executes** — you confirm and
> place every order yourself. Markets carry risk; you alone are responsible for your trades.

---

## 🧭 Overview

Most "AI stock picker" projects optimize for *more* signals. A real trading desk makes money by
being **selective** and **managing risk**. Trading Desk encodes that discipline as a pipeline of
independent roles that argue, stress-test, and vote — and that mostly answers *"nothing clears the
bar today."*

It is **agent-driven**: the intelligence lives in prompt/skill files an AI coding agent reads
([`SKILL.md`](SKILL.md) + [`skills/`](skills/)), backed by pure-Python engines for the
deterministic math. Run it under whatever model and coding agent you like — **no API key required**
for the default mode.

> 🌱 **This is the open-source starter.** It ships **general trading knowledge and one example
> skill** — no personal positions, no proprietary edge. **Fork it and make it yours:** plug in your
> own watchlist, house views, mentor method, and broker. Your customizations live in git-ignored
> overlays, so a private, personalized desk sits on top of a public base.

**What makes it different**

- **Bring your own edge.** The framework supplies the *process*; you supply the *variant perception*.
  Consensus ideas ("great company, cheap P/E") are filtered out by design.
- **Structured disagreement.** A multi-round bull/bear debate and a three-lens risk committee mean
  no thesis wins by assertion. *(Architecture inspired by [TradingAgents](#-acknowledgements--citation).)*
- **It learns.** Every call is journaled, scored against SPY (alpha, not just raw), and distilled to
  one reusable lesson that's recalled on the next similar setup.
- **Privacy by construction.** A PII gate blocks account numbers, keys, and personal data from ever
  reaching a public branch.

---

## 🏛️ The Desk

A multi-agent system that mirrors a real trading firm: specialists produce independent work, a
research committee debates it, a risk committee sizes it, and a CIO gate lets only high-edge ideas
through.

```
        your AI coding agent  (Claude Code / Codex / any AGENTS.md agent)
                          │  reads
                          ▼
   ┌───────────────────────────────────────────────────────────────┐
   │  THE BRAIN  —  SKILL.md + skills/                          │
   │  edge doctrine → analysis engines → discipline → execution    │
   └───────────────┬───────────────────────────────────────────────┘
                   │  orchestrates the pipeline
                   ▼
   Macro/Regime ─► Thematic Wave ─► Data + Quant/Chip Engine ─► Analyst Team
        │                                                            │
        ▼                                                            ▼
   Recall past lessons                                  ┌── Research Debate (Bull ⚔ Bear → Manager)
        (memory loop)                                   └── Risk Committee (Aggressive·Neutral·Conservative → Judge)
                                                                     │
                                                                     ▼
                                                     CIO Gate ─► Report ─► Log & Reflect
                   │  data / orders via
                   ▼
   ┌───────────────────────────────────────────────────────────────┐
   │  THE BROKER  —  Robinhood today · IBKR / Futu next             │
   │  read-only data  +  confirm-before-order execution            │
   └───────────────────────────────────────────────────────────────┘
```

### 👥 Analyst Team
Four independent lenses, each doing primary-source work (details in [`skills/decision/roles.md`](skills/decision/roles.md)):
- **Fundamental** — business quality, valuation, strategy & roadmap, management read, scenario targets.
- **Quant** — trend/momentum/volume, the **support & resistance ("pressure") map**, ATR-scaled RR, and the **chip / cost-basis distribution (筹码)** + Wyckoff phase.
- **Sentiment / News** — dated catalysts, positioning, insider flows, and *what isn't in the narrative yet*.
- **Macro / Regime** — Fed path, yields, VIX, breadth; a crisis playbook when the tape breaks.

### ⚔️ Research Debate  *(bull vs bear → Research Manager)*
A **multi-round** debate ([`skills/decision/research-debate.md`](skills/decision/research-debate.md)): the bull argues the variant thesis, the bear runs the stress-test as live ammunition, each must rebut the other's strongest point — then a Research Manager **commits to a stance** (Strong Buy … Sell) and never defaults to "Hold."

### 🛡️ Risk Committee  *(three lenses → Risk Judge)*
Aggressive, Neutral, and Conservative lenses debate the *trade plan* ([`skills/decision/risk-committee.md`](skills/decision/risk-committee.md)); the Risk Judge adjudicates to **approve / resize / veto**, enforcing hard gates (RR ≥ 2, ≤ 2% risk/idea, ≤ 25% per-name, regime tilt).

### 🧠 Reflection & Memory  *(the desk learns)*
Every call is logged; when it matures it's scored **raw + alpha vs SPY** and distilled to one reusable lesson, recalled on the next similar setup ([`skills/decision/reflection-memory.md`](skills/decision/reflection-memory.md)). *(Inspired by TradingAgents' reflection loop.)*

---

## ⚡ Quickstart

> 🤖 **Easiest path: hand this README to your AI agent.** Share this file (and [`SKILL.md`](SKILL.md))
> with your CLI agent — Claude Code or Codex — and say *"read this and set it up, then run a desk
> run for me."* The whole toolkit is designed to be **operated by an agent reading these docs**: it
> can install the PII gate, wire your config, connect the broker, and drive the desk end-to-end.
> The steps below are the same thing done by hand.

### Agent-driven (the default — no API key)

```bash
git clone <your-fork-url> trading-desk && cd trading-desk
cp config.example.toml config.local.toml   # add your broker/account (git-ignored)
cp .env.example .env                        # only if you use an API-key feature
bash scripts/install_hooks.sh                 # install the PII gate (recommended)
```

Then point your agent at the skill and ask for a run:

- **Claude Code** — the repo's [`SKILL.md`](SKILL.md) *is* the skill.
- **Codex / any AGENTS.md agent** — [`AGENTS.md`](AGENTS.md) routes it in.
- See [`PORTABILITY.md`](PORTABILITY.md) to wire every runtime to one source folder.

> 💡 **Use a CLI agent (Claude Code or Codex), not a desktop app.** Desktop apps run in a
> restricted sandbox that limits broker connectors, shell/script execution, and order placement — so
> the agentic-trading loop often **won't work** there. The CLI can run the engines, hold the broker
> connection, and place confirmed orders end-to-end. Run the desk from a terminal.

> *"Do a desk run on NVDA."*  ·  *"Review my watchlist."*  ·  *"Short- and long-run call on INTC?"*

The desk pulls data, runs the pipeline, and returns a ranked, risk-checked report — or an honest
"nothing clears the bar." If no broker connector is present, it falls back to web data + a
historicals JSON you supply (see *Portability & capability detection* in `SKILL.md`).

### Use the engines standalone (no agent)

```bash
# Indicators + S/R map + chip distribution:
python3 scripts/indicators.py path/to/historicals.json --price 128.40 --float 4100000000

# The learning journal:
python3 scripts/track_record.py recall --symbol NVDA
python3 scripts/track_record.py report            # win rate + avg alpha + recent lessons
```

Pure Python standard library — no dependencies, runs anywhere `python3` does.

---

## 🧩 Make It Yours

The repo ships **generic starter templates** — replace them with your own edge:

| File | Put here |
|---|---|
| `skills/playbook/house-views.md` | Your macro/technical heuristics |
| `skills/playbook/watchlist-theses.md` | Names you track + thesis + invalidation |
| `skills/playbook/mentor-method.md` · `skills/playbook/mentor-casebook.md` | The method/investor you study |
| `skills/analysis/sectors/` | Add a sector playbook via `sectors/_TEMPLATE.md` |

**Keep private content private.** Anything under `skills/private/` is **git-ignored** — put a
confidential watchlist, a paid newsletter's live book, or a private deal there and it never lands in
your fork's public history.

---

## 🔌 Broker Support

| Broker | Status | Notes |
|---|---|---|
| **Robinhood** | ✅ working (via connector) | Quotes, historicals, fundamentals, positions, confirm-before-order execution. |
| **Interactive Brokers** | 🔌 planned | Adapter interface + config slot ship now; implementation welcome. |
| **Futu / moomoo** | 🔌 planned | Same. |

### Robinhood: connect your AI agent (agentic trading)

Robinhood exposes an **agentic trading** connector that lets an AI agent read your data and place
orders (with confirmation). Follow Robinhood's official setup:

➡️ **[Robinhood — Agentic Trading Overview → *Connect your AI agent*](https://robinhood.com/us/en/support/articles/agentic-trading-overview/#ConnectyourAIagent)**

> 💡 **Do this from a CLI agent (Claude Code or Codex), not a desktop app.** The desktop sandbox
> commonly blocks the connector and order placement, so agentic trading may not work there at all.
> Enable the connector, then put the account you authorize into `config.local.toml` (git-ignored).
> The desk still **confirms every order with you before placing it.**

The design goal is **one broker-adapter interface** — add a broker by implementing a single class.
See the [roadmap](#️-roadmap) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## 🔒 Privacy & the PII Gate

Publishing trading tooling means **never leaking your account or positions.** This repo enforces it:

- **Secrets live only in git-ignored files** — `config.local.toml`, `.env`, `skills/private/`.
- **A scanner** — [`scripts/scan_pii.py`](scripts/scan_pii.py) — flags account numbers, keys, connector
  UUIDs, and personal identifiers in tracked files.
- **A three-layer gate** blocks PII from reaching the public branch:
  1. **pre-commit** hook — refuses to stage PII on a public branch,
  2. **pre-push** hook — refuses to push it,
  3. **CI** ([`.github/workflows/pii-scan.yml`](.github/workflows/pii-scan.yml)) — the server-side
     backstop that can't be skipped.

```bash
bash scripts/install_hooks.sh          # turn on the local gate
python3 scripts/scan_pii.py            # scan on demand before publishing
```

Add your exact private strings to `scripts/pii_denylist.local.txt` (git-ignored) for hard blocking.

---

## 🗺️ Roadmap

- [ ] `tradingdesk` **CLI** (`pip install`) wrapping the engines, journal, and a data-pack builder.
- [ ] **Broker-adapter layer** (`base` protocol + Robinhood / IBKR / Futu) — broker-agnostic desk.
- [ ] Optional **autonomous LLM runner** for a fully code-native desk run.
- [ ] More sector playbooks, a test suite, and example reports.

---

## 🤝 Contributing

Issues and PRs welcome — new broker adapters, sector playbooks, engine improvements, and docs. Please
run `python3 scripts/scan_pii.py` before pushing. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## 🙏 Acknowledgements & Citation

The structured **bull/bear research debate**, **multi-perspective risk committee**, and
**reflection/memory** design are inspired by **TradingAgents** (Tauric Research). If you build on this
work, please also credit theirs:

```bibtex
@misc{xiao2025tradingagents,
  title        = {TradingAgents: Multi-Agents LLM Financial Trading Framework},
  author       = {Xiao, Yijia and Sun, Edward and Luo, Di and Wang, Wei},
  year         = {2025},
  eprint       = {2412.20138},
  archivePrefix= {arXiv},
  primaryClass = {q-fin.TR}
}
```

---

## ⚖️ Disclaimer & License

Trading Desk is for **research and education only** and is **not financial or tax advice**. It does
not auto-trade; you approve and place every order and own every outcome. Past performance and
backtests do not guarantee future results.

Licensed under the terms in [`LICENSE`](LICENSE).
