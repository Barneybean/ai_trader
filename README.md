<div align="center">

# 📈 AI Trader

**Turn a terminal coding agent into a disciplined research, risk, and execution desk.**

*Ask about a stock, sector, watchlist, or portfolio. The desk researches, debates, sizes risk,
and returns an auditable HTML report—not a black-box prediction.*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![Status](https://img.shields.io/badge/status-alpha-orange)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![Agent](https://img.shields.io/badge/agent-Claude%20Code%20%7C%20Codex-8A2BE2)
![Not financial advice](https://img.shields.io/badge/⚠️-not%20financial%20advice-red)

💡 [Why It Exists](#-why-ai-trader) ·
🎯 [What It Does](#-what-it-does) ·
🏛️ [The Desk](#️-the-desk) ·
🌍 [Knowledge Commons](#-the-knowledge-commons) ·
📄 [Sample](#-sample-report) ·
✅ [Why Trust It](#-why-trust-the-process) ·
⚙️ [Setup](#️-setup) ·
📖 [Use It](#-use-it) ·
🧩 [Make It Yours](#-make-it-yours) ·
🔌 [Brokers](#-broker-support) ·
🔒 [Privacy Gate](#-privacy--the-pii-gate) ·
🗺️ [Roadmap](#️-product-roadmap) ·
🤝 [Contributing](#-contributing) ·
🙏 [Credits](#-acknowledgements--citation)

</div>

> ⚠️ **Not financial advice.** This is research tooling. You confirm every order and remain
> responsible for every trade.

> 🔗 **A broker connection unlocks the full desk.** Robinhood works today; IBKR and Futu are
> planned. Without a broker, the desk uses limited web and manual-data fallbacks. Set it up from a
> terminal agent (see [Brokers](#-broker-support)).

---

## 💡 Why AI Trader?

Markets produce more information than one person can consistently process. A single AI answer can
be fast but overconfident. AI Trader gives your coding agent a repeatable process:

- **Better decisions, not more predictions.** Every actionable idea needs evidence, a bear case,
  valuation, invalidation, position sizing, and a minimum reward-to-risk threshold.
- **One workflow.** Research, quant analysis, portfolio context, approval, execution, and review
  live in one auditable toolkit.
- **Memory that compounds.** Calls and outcomes are recorded, scored against SPY, distilled into
  lessons, and recalled when a similar setup appears.
- **Readable output.** Each run can produce a bilingual HTML report with the decision first and
  expandable evidence behind it.
- **You stay in control.** Skills are Markdown, engines are Python, private data stays local, and
  every order needs your confirmation.

The open-source starter includes general knowledge only. Add your watchlist and house views in
git-ignored private overlays.

If that is the kind of open trading infrastructure you want to exist, please
**[star it on GitHub](https://github.com/Barneybean/ai_trader_toolbox)** so more traders and
contributors can find it.

## 🎯 What It Does

Four ways to use it:

**1. On-demand analysis**
- *"Do a desk run on NVDA."* · *"How does the semiconductor sector look?"* · *"Review my
  watchlist — anything worth buying?"*
- Covers a sector, stock, watchlist, or portfolio.
- Returns the evidence, entry, stop, target, size, and a clear **buy / wait / pass** call.

**2. Scheduled reports**
- Run recurring reviews of your watchlist and portfolio.
- Receive HTML reports with tactical and long-term actions—or an honest *“nothing clears the bar.”*

**3. Confirmed execution**
- **Agent recommends → you approve → broker places.**
- Nothing is bought or sold without your confirmation.
- [See it in action](#robinhood-connect-your-ai-agent-agentic-trading) — a screenshot of
  agent-placed orders resting in a real Robinhood agentic account.

**4. Learning**
- Log ideas, vetoes, plans, and outcomes.
- Score mature calls by return and alpha versus SPY.
- Recall lessons when similar setups return.

---

## 🏛️ The Desk

Specialists work independently. A research committee debates each idea, a risk committee sizes
it, and a CIO gate passes only the strongest ideas. No role grades its own work.

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/desk-flow-dark.svg">
  <img src="docs/desk-flow.svg" width="820" alt="AI Trader pipeline: your coding agent orchestrates the desk — macro/regime, thematic wave, quant/chip engine, and the analyst team feed a research debate and risk committee; the CIO gate passes only high-edge ideas into a report, which you approve before the broker places any order; lessons are logged and recalled on the next run.">
</picture>
</div>

### 👥 Analyst Team
Four independent, primary-source lenses ([details](skills/decision/roles.md)):

- **Fundamental** — quality, valuation, strategy, management, scenarios.
- **Quant** — trend, momentum, volume, levels, risk, and cost-basis distribution.
- **Sentiment / News** — dated catalysts, positioning, insider flows, narrative gaps.
- **Macro / Regime** — Fed, yields, volatility, breadth, and crisis conditions.

### ⚔️ Research Debate — *bull vs bear → Research Manager*
The [bull and bear](skills/decision/research-debate.md) challenge each other’s strongest point.
The Research Manager then commits to a stance.

### 🛡️ Risk Committee — *three lenses → Risk Judge*
Aggressive, Neutral, and Conservative lenses debate the
[trade plan](skills/decision/risk-committee.md). The Risk Judge approves, resizes, or vetoes it
using hard limits such as RR ≥ 2 and ≤2% account risk per idea.

### 🧠 Reflection & Memory — *the desk learns*
Calls are logged, scored by return and alpha versus SPY, and distilled into
[reusable lessons](skills/decision/reflection-memory.md).

---

## 🌍 The Knowledge Commons

No trader understands every industry. This repo collects specialist knowledge in one open library
that every fork can use.

Contributed knowledge lives at three levels:

- **Sector playbooks** — [`skills/analysis/sectors/`](skills/analysis/sectors/): drivers,
  catalysts, valuation, and risks.
- **Stock playbooks** — [`skills/analysis/stocks/`](skills/analysis/stocks/): recurring setups,
  catalysts, and dated history—not live calls.
- **Trading & analysis skills** — strategy patterns (`skills/decision/`), edge signals
  (`skills/edge/`), engine improvements.

The loop is simple:

1. Write it from the matching `_TEMPLATE.md`.
2. Review it against the [quality bar](CONTRIBUTING.md#the-playbook-quality-bar):
   **specific · falsifiable · primary-sourced · dated · illustrated · general**.
3. Once merged, every fork can use it.

Coverage maps and the wanted list (banks, REITs, oil & gas, industrials, healthcare, mining, …)
are in [`skills/analysis/sectors/README.md`](skills/analysis/sectors/README.md) and
[`skills/analysis/stocks/README.md`](skills/analysis/stocks/README.md).

Rules, debate protocols, risk gates, and sizing math are readable files. Contributions carry
knowledge, never private positions; the PII gate enforces that boundary.

---

## 📄 Sample report

See what a run produces:
**[`reports/report_2026-07-05_sample-ai-robotics-value-chain_claude-fable-5.html`](reports/report_2026-07-05_sample-ai-robotics-value-chain_claude-fable-5.html)**
— a sanitized, self-contained bilingual HTML analysis of physical AI and humanoid robotics.

Open it in a browser, or view without cloning via a raw-HTML previewer (prepend
`https://htmlpreview.github.io/?` to the file's GitHub URL).

It opens with the call — what to do, in one screen:

<p align="center">
  <img src="docs/sample-report/01-the-call.png" width="760" alt="Sample report — the call: verdict cards and the sized orders table">
</p>

<details>
<summary><b>📸 More pages from the sample report</b> (scorecards, layer map, chip footprint, signals, forecast fan …)</summary>
<br>

**Decision scorecards** — call, trade plan, and money flow.

<p align="center">
  <img src="docs/sample-report/02-scorecards.png" width="760" alt="Decision scorecards — ACCUMULATE / HOLD with trade plan and money-flow gauges">
</p>

**Layer map** — the theme split by certainty, purity, and elasticity.

<p align="center">
  <img src="docs/sample-report/03-layer-map.png" width="760" alt="Layer map — brain / body / components cards and the layer-ranked call">
</p>

**Institutional footprint** — cost basis and trapped supply.

<p align="center">
  <img src="docs/sample-report/04-chip-footprint.png" width="760" alt="Chip-distribution histogram with the Wyckoff phase read">
</p>

**Levels and signals** — price, support, resistance, and indicators.

<p align="center">
  <img src="docs/sample-report/05-levels-signals.png" width="760" alt="Price chart with S/R ladder and signal dashboard">
</p>

**Fundamentals and catalysts** — consensus, the desk view, and the plan.

<p align="center">
  <img src="docs/sample-report/06-fundamentals.png" width="760" alt="Fundamentals, catalyst, and the ACTION trade plan">
</p>

**Forecast** — Monte Carlo range and historical base rate.

<p align="center">
  <img src="docs/sample-report/07-forecast.png" width="760" alt="Monte-Carlo price forecast cone with the verdict">
</p>

</details>

The format is **Summary → Action → Evidence**, with plain-language callouts, charts, two time
horizons, and a sized trade plan.

> Illustrative only — a demo of the output format on a fictional $2,000 account, not investment
> advice.

---

## ✅ Why Trust the Process?

Do not trust it because it says “AI.” Trust what you can inspect and what its record earns:

- **Visible evidence.** Reports separate facts, calculations, assumptions, and judgment. Key
  claims should cite dated primary sources.
- **Challenged decisions.** Bull, bear, risk, and CIO roles expose disagreement.
- **Risk before execution.** No invalidation, sizing, sufficient data, and acceptable RR means no
  actionable ticket.
- **You keep control.** The shipped workflow previews an exact order and requires your explicit,
  order-specific confirmation before placement.
- **Scored outcomes.** Calls are evaluated against a benchmark, not memory or confidence.
- **Auditable implementation.** Skills, formulas, reports, records, and privacy gates are local
  files—not a hidden hosted strategy.

The project does **not** promise profit or perfect data. Start with analysis and let your own
out-of-sample record earn trust.

---

## ⚙️ Setup

Use the AI coding agent in your local IDE terminal as the installer. Clone the repo, start the
agent, and give it the prompt below. Never paste secrets into chat.

### 1. Clone and enter the repository

```bash
git clone https://github.com/Barneybean/ai_trader_toolbox.git
cd ai_trader_toolbox
```

### 2. Start a compatible coding agent in the same terminal

```bash
codex
# or
claude
```

Any terminal agent that reads repository instructions and runs local commands can work.
[`SKILL.md`](SKILL.md) is the charter; [`AGENTS.md`](AGENTS.md) routes compatible agents to it.

### 3. Feed this README to the agent

Paste this request into the terminal agent:

```text
Read README.md, AGENTS.md, and SKILL.md completely. Set up this AI trading toolbox from this
terminal. Detect what is already installed; create only the required git-ignored local
configuration; install and verify the privacy hooks; explain how to connect my supported broker
without printing secrets; run the available consistency and PII checks; then run a safe
analysis-only smoke test. Do not place any order. Tell me exactly what still needs my input.
```

The repository tells the agent how to detect capabilities, use fallbacks, protect privacy, and
stop before broker actions.

### 4. Connect market data and broker capabilities when prompted

Robinhood's agentic-trading connector is currently the working broker integration. Complete its
official connection flow from your terminal agent when it asks:

➡️ **[Robinhood — Agentic Trading Overview → Connect your AI agent](https://robinhood.com/us/en/support/articles/agentic-trading-overview/#ConnectyourAIagent)**

The agent should verify market data, portfolio data, and an order **preview**. It must not place
an order without your confirmation of that exact ticket.

### Manual terminal setup (fallback)

If the agent cannot complete a step, use these minimal commands:

```bash
cp config.example.toml config.local.toml
cp .env.example .env                       # only for an API-key feature you enable
bash scripts/install_hooks.sh
python3 scripts/scan_pii.py
```

For runtime-specific wiring and capability detection, see [`PORTABILITY.md`](PORTABILITY.md).

The desk pulls data, runs the pipeline, and returns a ranked, risk-checked report — or an honest
"nothing clears the bar." No broker connector? It falls back to web data + a historicals JSON you
supply (see *Portability & capability detection* in `SKILL.md`).

### Use the engines standalone (no agent)

```bash
# Indicators + S/R map + chip distribution:
python3 scripts/indicators.py path/to/historicals.json --price 128.40 --float 4100000000

# The learning journal:
python3 scripts/track_record.py recall --symbol NVDA
python3 scripts/track_record.py report            # win rate + avg alpha + recent lessons

# Toolkit activity log (debugging + reliability — see docs/adr/):
python3 scripts/desk_log.py run -- python3 scripts/indicators.py path/to/historicals.json
python3 scripts/desk_log.py stats                 # per-script runs, error rate, p50/p95 ms
```

Pure Python standard library — no dependencies, runs anywhere `python3` does.

---

## 📖 Use It

Keep using the same terminal agent. Describe the decision; the agent routes the right skills and
engines.

Start with an analysis-only run:

```text
Run the full desk on NVDA. Use current, dated evidence; recall prior lessons; show the bull case,
bear case, quant levels, valuation, catalysts, invalidation, and risk plan. Produce the bilingual
HTML report. Do not place or preview an order.
```

Other useful requests:

```text
Review my portfolio and watchlist. What deserves deeper work, what should I avoid, and why?

Map the semiconductor industry by value-chain layer and identify what may inflect next.

Run the weekly retrospective. Score matured calls versus SPY and show what the process learned.

Revisit the last analysis of NKE. What changed in the evidence, thesis, levels, and decision?
```

The normal loop:

1. **Ask** for a ticker, sector, theme, watchlist, portfolio review, or scheduled desk run.
2. **Inspect** the HTML report: decision, evidence, opposing case, invalidation, position risk, and
   source dates.
3. **Challenge** weak claims. Missing or stale evidence should downgrade the call.
4. **Approve only an exact ticket** if you choose to trade. The agent must restate and preview the
   symbol, side, quantity, order type, limit, duration, and estimated effect before asking for your
   order-specific confirmation.
5. **Keep score.** Log the call, score it when its horizon matures, and review repeated errors
   before changing a rule.

### Full-potential checklist

- [ ] A terminal coding agent can read `README.md`, `AGENTS.md`, and `SKILL.md` and run Python.
- [ ] `config.local.toml` and any `.env` values exist only locally and remain git-ignored.
- [ ] Privacy hooks are installed and `python3 scripts/scan_pii.py` passes.
- [ ] A supported broker is connected for live portfolio data and confirmed execution, or the
      documented web/manual-data fallback is understood.
- [ ] The first analysis-only report builds successfully and its sources and risk plan are reviewed.
- [ ] Personal watchlists, house views, and paid/private knowledge live only in private overlays.
- [ ] Calls are logged and later scored so confidence can be earned from outcomes.

After the manual flow is reliable, consider weekday pre-market and post-close runs plus a weekly
review. Scheduled reports still require confirmation before execution.

---

## 🧩 Make It Yours

The repo ships **generic starter templates** — replace them with your own edge:

| File | Put here |
|---|---|
| `skills/playbook/house-views.md` | Your macro/technical heuristics |
| `skills/playbook/watchlist-theses.md` | Names you track + thesis + invalidation |
| `skills/playbook/mentor-method.md` · `skills/playbook/mentor-casebook.md` | The method/investor you study |
| `skills/analysis/sectors/` | Add a sector playbook via `sectors/_TEMPLATE.md` |
| `skills/analysis/stocks/` | Add a stock playbook via `stocks/_TEMPLATE.md` |

Keep confidential watchlists, paid research, and private deals under git-ignored
`skills/private/`.

---

## 🔌 Broker Support

Connect a broker for live data, portfolio context, and confirmed execution.

| Broker | Status | Notes |
|---|---|---|
| **Robinhood** | ✅ working (via connector) | Quotes, historicals, fundamentals, positions, confirm-before-order execution. |
| **Interactive Brokers** | 🔌 planned | Adapter interface + config slot ship now; implementation welcome. |
| **Futu / moomoo** | 🔌 planned | Same. |

### Robinhood: connect your AI agent (agentic trading)

Robinhood's **agentic trading** connector lets an AI agent read your data and place orders (with
confirmation). Follow Robinhood's official setup:

➡️ **[Robinhood — Agentic Trading Overview → *Connect your AI agent*](https://robinhood.com/us/en/support/articles/agentic-trading-overview/#ConnectyourAIagent)**

> 💡 Connect from a terminal agent. Store the authorized account only in git-ignored
> `config.local.toml`. Every order requires confirmation.

**Confirmed execution in practice:** the agent recommended, previewed, and placed these limit
orders only after user approval. The 🤖 marks agent-placed orders.

<div align="center">
<img src="docs/agentic-orders-robinhood.png" width="820" alt="Robinhood Activity feed showing AI-agent-placed limit buy orders: NVIDIA and MP Materials placed, Cameco, Nike and SoFi queued — each row marked with the agent icon, all resting as limit orders while the account holds zero shares.">
</div>

The design goal is **one broker-adapter interface** — add a broker by implementing a single class.
See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## 🔒 Privacy & the PII Gate

The repo protects private data with three layers:

- **Secrets live only in git-ignored files** — `config.local.toml`, `.env`, `skills/private/`.
- **A scanner** — [`scripts/scan_pii.py`](scripts/scan_pii.py) — flags account numbers, keys,
  connector UUIDs, and personal identifiers in tracked files.
- **Three gates** — pre-commit, pre-push, and
  [CI](.github/workflows/pii-scan.yml).

```bash
bash scripts/install_hooks.sh          # turn on the local gate
python3 scripts/scan_pii.py            # scan on demand before publishing
```

Add your exact private strings to `scripts/pii_denylist.local.txt` (git-ignored) for hard
blocking.

---

## 🗺️ Product Roadmap

The roadmap shows what works, what is in progress, and where help matters.

| Status | Area | Outcome | Help wanted |
|---|---|---|---|
| ✅ Available | Auditable desk foundation | Multi-lens research, debate, risk gates, bilingual HTML reports, confirm-before-order execution, privacy checks, and outcome journaling | Tests, documentation, playbooks, and independent review |
| 🚧 WIP | Historical learning and continuity | Efficient recall of prior analyses, trades, methods, decisions, and outcomes during every relevant run | Retrieval evaluation, schemas, deduplication, and long-history benchmarks |
| 🚧 WIP | Reliability and portability | Observable engine runs, consistent setup across terminal agents, safer publishing, and clearer degraded-mode behavior | Cross-platform tests, fixtures, and installation diagnostics |
| 🎯 Next | Financial-report analysis | Deeper reusable skills for 10-K/10-Q/8-K, earnings releases, footnotes, guidance changes, segment economics, cash-flow quality, and transcript contradictions | Accounting expertise, filing fixtures, citation tests, and sector-specific rubrics |
| 🎯 Next | Diversified decision-grade data | Prefer accurate, free, primary, and timely sources; reconcile conflicts and expose source, freshness, and fallback quality in every call | Source adapters, licensing review, reliability scoring, caching, and fallback design |
| 🎯 Next | Efficient near-real-time decisions | Incremental analysis that reacts to meaningful price, news, filing, flow, and portfolio changes without rerunning everything | Event routing, latency benchmarks, streaming adapters, and cost controls |
| 🔬 Research | Loss-aware execution | Improve entries, exits, sizing, slippage control, and kill switches to improve risk-adjusted outcomes—not claim guaranteed maximum profit | Paper-trading harnesses, execution simulations, broker adapters, and measurable acceptance criteria |
| 🔬 Research | Black-swan and crisis response | Detect surprise-event regime shifts, preserve liquidity, reduce correlated losses, hedge when justified, and define recovery/re-entry playbooks | Historical crisis scenarios, stress tests, market-microstructure expertise, and chaos drills |
| 🔬 Research | Public activity and conflict signals | Legally monitor timely public disclosures from corporate insiders, elected officials, funds, and prominent market commentators—including figures such as Donald Trump, Nancy Pelosi, and Tom Lee—then test whether a signal adds value after reporting delay, bias, and false positives | Official disclosure sources, entity resolution, legal/ethics review, lag-aware backtests, and manipulation safeguards |
| 🎯 Next | Broker platform | Harden Robinhood, define one tested adapter interface, then add IBKR and Futu/moomoo with quotes, positions, previews, confirmations, fills, and reconciliation | Maintainers with sandbox accounts, broker API experience, and integration-test fixtures |

“Insider” work here means analysis of **lawfully available public disclosures**, never access to or
use of material non-public information. Named people are examples of public-signal categories,
not endorsements or allegations. No signal should enter the decision process until it is tested
out of sample and its source, publication delay, survivorship bias, and failure modes are visible.

Want to help? Open an issue with a source, test case, or design and read
[`CONTRIBUTING.md`](CONTRIBUTING.md). To follow the build and help others find it,
**[star the repository](https://github.com/Barneybean/ai_trader_toolbox)**.

---

## 🤝 Contributing

Issues and PRs are welcome. Pick a roadmap item or add a playbook through
[The Knowledge Commons](#-the-knowledge-commons). State the problem, evidence, acceptance criteria,
failure modes, and tests. Run `python3 scripts/scan_pii.py` before pushing and follow
[`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## 🙏 Acknowledgements & Citation

The structured **bull/bear research debate**, **multi-perspective risk committee**, and
**reflection/memory** design are inspired by **TradingAgents** (Tauric Research). If you build on
this work, please also credit theirs:

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

AI Trader is for **research and education only** and is **not financial or tax advice**. By
default it does not auto-trade — you approve and place every order. If you modify it to automate
execution, you do so at your own risk and own every outcome. Past performance and backtests do
not guarantee future results.

Licensed under the terms in [`LICENSE`](LICENSE).
