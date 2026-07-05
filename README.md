<div align="center">

# 📈 AI Trader

**An open-source, multi-agent trading-research desk you run with an AI coding agent —
and an open knowledge commons where traders pool their industry playbooks.**

*It's built like a trading company and runs like a winning team: independent analyst roles ·
structured bull-vs-bear debate · a three-lens risk committee · a quant engine with
support/resistance & chip-distribution · and a memory loop that learns from its own calls —
tuned to surface only the few ideas with genuine edge.*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![Status](https://img.shields.io/badge/status-alpha-orange)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![Agent](https://img.shields.io/badge/agent-Claude%20Code%20%7C%20Codex-8A2BE2)
![Not financial advice](https://img.shields.io/badge/⚠️-not%20financial%20advice-red)

🧭 [Overview](#-overview) ·
🏛️ [The Desk](#️-the-desk) ·
🌍 [Knowledge Commons](#-the-knowledge-commons) ·
📄 [Sample](#-sample-report) ·
⚡ [Quickstart](#-quickstart) ·
🧩 [Make It Yours](#-make-it-yours) ·
🔌 [Brokers](#-broker-support) ·
🔒 [Privacy Gate](#-privacy--the-pii-gate) ·
🤝 [Contributing](#-contributing) ·
🙏 [Credits](#-acknowledgements--citation)

</div>

> ⚠️ **Not financial advice.** This is research tooling. It **never auto-executes** — you confirm and
> place every order yourself. Markets carry risk; you alone are responsible for your trades.

> 🔗 **A broker connection is required.** You must connect **at least one Robinhood agentic-trading
> account** — most of the desk's research runs through it (live quotes, ~1yr historicals,
> fundamentals, earnings, positions, buying power). **Another brokerage connector with equivalent
> data + agentic functions works too** (IBKR/Futu adapters planned). Without a connector,
> the desk falls back to web + manually-supplied data, which is materially more limited. Set it up
> from a **CLI agent, not a desktop app** (see [Brokers](#-broker-support)).

---

## 🧭 Overview

Most "AI stock picker" projects optimize for *more* signals. A real trading desk makes money by
being **selective** and **managing risk**. AI Trader encodes that discipline as a pipeline of
independent roles that argue, stress-test, and vote — and that mostly answers *"nothing clears the
bar today."*

It is **agent-driven**: the intelligence lives in prompt/skill files an AI coding agent reads
([`SKILL.md`](SKILL.md) + [`skills/`](skills/)), backed by pure-Python engines for the
deterministic math. Run it under whatever model and coding agent you like — **no LLM API key required**
for the default mode (you do need a broker connection for market data — see below).

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
- **It compounds community knowledge.** Sector playbooks — how semis, biotech, fintech, and power
  *actually* price — are written by people who know the industry, reviewed in the open, and read by
  every desk that forks this repo. Each merged playbook makes everyone's desk smarter
  ([Knowledge Commons](#-the-knowledge-commons)).
- **Privacy by construction.** A PII gate blocks account numbers, keys, and personal data from ever
  reaching a public branch.

---

## 🏛️ The Desk

AI Trader is organized like a real trading company, and it runs like a winning team: every seat
has a written charter, nobody grades their own homework, and even the star idea has to survive the
committee. Specialists produce independent work, a research committee debates it, a risk committee
sizes it, and a CIO gate lets only high-edge ideas through — the same separation of duties that
keeps a professional desk honest.

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
- **Fundamental** — business quality, valuation, strategy & product pipeline, management read, scenario targets.
- **Quant** — trend/momentum/volume, the **support & resistance ("pressure") map**, ATR-scaled RR, and the **chip / cost-basis distribution** + Wyckoff phase.
- **Sentiment / News** — dated catalysts, positioning, insider flows, and *what isn't in the narrative yet*.
- **Macro / Regime** — Fed path, yields, VIX, breadth; a crisis playbook when the tape breaks.

### ⚔️ Research Debate  *(bull vs bear → Research Manager)*
A **multi-round** debate ([`skills/decision/research-debate.md`](skills/decision/research-debate.md)): the bull argues the variant thesis, the bear runs the stress-test as live ammunition, each must rebut the other's strongest point — then a Research Manager **commits to a stance** (Strong Buy … Sell) and never defaults to "Hold."

### 🛡️ Risk Committee  *(three lenses → Risk Judge)*
Aggressive, Neutral, and Conservative lenses debate the *trade plan* ([`skills/decision/risk-committee.md`](skills/decision/risk-committee.md)); the Risk Judge adjudicates to **approve / resize / veto**, enforcing hard gates (RR ≥ 2, ≤ 2% risk/idea, ≤ 25% per-name, regime tilt).

### 🧠 Reflection & Memory  *(the desk learns)*
Every call is logged; when it matures it's scored **raw + alpha vs SPY** and distilled to one reusable lesson, recalled on the next similar setup ([`skills/decision/reflection-memory.md`](skills/decision/reflection-memory.md)). *(Inspired by TradingAgents' reflection loop.)*

---

## 📄 Sample report

See what a run produces: **[`reports/sample-report.html`](reports/sample-report.html)** — a real desk
run (sanitized), one self-contained HTML file with charts inlined. Open it in a browser, or view it
rendered without cloning via a raw-HTML previewer (e.g. prepend
`https://htmlpreview.github.io/?` to the file's GitHub URL once your repo is public).

That sample (a July 2026 run over **INTC · MRVL · NKE · SOFI · KMX**) shows the format:

- **Summary → Action → Breakdown**, written for a non-finance reader.
- Colour-coded **callouts** — green ACTION (the trade), amber WATCH (wait-for-a-level), RISK (what kills it), NOTE (cash/sizing).
- Per-name **charts** — price/volume with the support/resistance ladder, the **chip-distribution** histogram (profit vs. trapped supply), and RSI/Stochastic/ADX gauges.
- The **quant read** (support/resistance, trend, momentum, volume), the **variant-perception** edge, **short- vs long-run** calls, a sized **trade plan** (entry / stop / target / % risk), and cash management around the CPI date.
- The **discipline**: what to buy, what to *wait* for, and where it holds cash instead of forcing a trade.

> Illustrative only — a demo of the output format, not investment advice.

## ⚡ Quickstart

> 🤖 **Easiest path: hand this README to your AI agent.** Share this file (and [`SKILL.md`](SKILL.md))
> with your CLI agent — Claude Code or Codex — and say *"read this and set it up, then run a desk
> run for me."* The whole toolkit is designed to be **operated by an agent reading these docs**: it
> can install the PII gate, wire your config, connect the broker, and drive the desk end-to-end.
> The steps below are the same thing done by hand.

### Agent-driven (the default — no API key)

```bash
git clone <your-fork-url> ai-trader && cd ai-trader
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

## 🌍 The Knowledge Commons

No single trader knows how every industry — or every name — prices. A semis veteran reads node
yields and design wins; a biotech specialist reads trial design and cash runway; a bank analyst
reads credit cycles and book-value quality. This repo collects that craft in one open place, and
every desk built on it reads the result on its next run.

Contributed knowledge lives at three levels:

- **Sector / industry playbooks** — [`skills/analysis/sectors/`](skills/analysis/sectors/): how an
  industry prices (drivers, catalysts, valuation lens, red flags, variant angle).
- **Stock playbooks** — [`skills/analysis/stocks/`](skills/analysis/stocks/): how a specific name
  trades — repeating setups, catalyst calendar, dated episodes. Knowledge, never a live call.
- **Trading & analysis skills** — strategy patterns (`skills/decision/`), edge signals
  (`skills/edge/`), engine improvements.

**The loop:** write it from the matching `_TEMPLATE.md` → it's reviewed in the open against a
[named quality bar](CONTRIBUTING.md#the-playbook-quality-bar) (**specific, falsifiable,
primary-sourced, dated, illustrated, general**) → it merges, and every fork's analyst team picks
it up on its next run. Coverage maps and the wanted list (banks, REITs, oil & gas, industrials,
healthcare services, mining, …) are in
[`skills/analysis/sectors/README.md`](skills/analysis/sectors/README.md) and
[`skills/analysis/stocks/README.md`](skills/analysis/stocks/README.md).

Nothing here is a black box: every rule the desk follows — the debate protocol, the risk gates,
the sizing math — is plain markdown you can read, audit, and edit. Contributions carry knowledge,
never positions (the PII gate enforces it), and the desk journals and scores its own calls against
SPY, so the process keeps a track record.

---

## 🔌 Broker Support

**A connected broker is required.** At least one **Robinhood agentic account** (or an equivalent
connector with the same data + agentic functions) must be linked — the desk pulls quotes,
historicals, fundamentals, positions, and buying power through it, and that data drives most of the
research. The web + manual-data fallback works without one but is materially more limited.

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
See [`CONTRIBUTING.md`](CONTRIBUTING.md).

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

## 🤝 Contributing

Issues and PRs welcome. The highest-leverage contribution is a playbook — sector/industry or
single-stock (see [The Knowledge Commons](#-the-knowledge-commons)); broker adapters, engine
improvements, and docs are close behind. Open a **playbook proposal** issue to claim one, and run
`python3 scripts/scan_pii.py` before pushing. Full guide + quality bar:
[`CONTRIBUTING.md`](CONTRIBUTING.md).

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

AI Trader is for **research and education only** and is **not financial or tax advice**. It does
not auto-trade; you approve and place every order and own every outcome. Past performance and
backtests do not guarantee future results.

Licensed under the terms in [`LICENSE`](LICENSE).

