# Data & Execution Reference (Robinhood connector)

All market data, positions, and order handling go through the connected Robinhood connector. Its
tools are prefixed `mcp__<id>__` (the id is the connection's UUID). If not loaded in the session,
load them via ToolSearch first (search names like `place_equity_order`, `get_equity_quotes`,
`get_equity_historicals`).

## Account

The only tradable account is the execution account you explicitly authorize in `config.local.toml` (git-ignored
— **account numbers are never committed to this repo**). Confirm it with `get_accounts` at the start
of a run and verify it matches your configured `broker.<name>.account_number`. Prefer an account
explicitly marked agent-accessible.

Never place orders against any other account, even if the user holds more there. Read-only data
(quotes, historicals, fundamentals) can be pulled for any ticker regardless of account.

## Watchlists (universe, prioritized)

Watchlist IDs are **user-specific and live in your local config**, not this repo. Configure them
under `[broker.<name>.watchlists]` in `config.local.toml` (label → connector watchlist id), then
pull members with `get_watchlist_items`. Discover ids with `get_watchlists`.

A typical layout (yours will differ):
- **Broad list** — your large universe (screen for movers/setups; don't work up every name).
- **Theme lists** (e.g. "AI", "Robot") — focused, tractable sources of Core/Tactical ideas;
  prioritize these.
- **Crypto list** — only if the user asks; this desk is equities-focused.

Prioritize the focused theme lists and screen the broad list for standouts. Confirm ids with
`get_watchlists` in case they change.

## Data pull — tool map

Per candidate ticker:

- `get_equity_quotes` — last price, bid/ask, day change, volume.
- `get_equity_fundamentals` — market cap, P/E, P/B, margins, yield, 52-wk range, sector.
- `get_equity_historicals` — ~1 year daily bars → feed to `scripts/analysis/indicators.py`.
- `get_earnings_calendar` — next report date; `get_earnings_results` — recent surprises.
- `get_equity_tradability` — confirm tradable before recommending.
- `get_equity_positions` (the configured tradable account) — current holdings / existing exposure.
- `get_portfolio` (the configured tradable account) — authoritative buying power for sizing.
- `get_equity_orders` / `get_option_orders` (the configured tradable account) — **open resting orders. Pull every run (SKILL Step 3b, hard gate).** Decompose `net buying power = settled cash − cash reserved by open buy orders`; report cash / reserved / net, list each resting order (side/symbol/qty/limit/session/TIF), and surface any order that fights the run's plan as a cancel/replace ticket. Buying power already nets out reserved orders — never quote it alone as free "dry powder".

Once per run, for the **macro/regime read** (`skills/analysis/macro-regime.md`):

- `get_indexes` / `get_index_quotes` — VIX, SPX/NDX and any available Treasury-yield index (e.g.
  TNX/10-yr) for the top-down filter.
- `get_equity_historicals` on `SPY`/`QQQ` → `scripts/analysis/indicators.py` for market trend & breadth
  (above/below the 200-DMA).
- `WebSearch` (not a connector tool) for the Fed rate path / dot plot, next FOMC/CPI/NFP date, live
  yields, any credit-spread read — cite dated sources.

Resolve company names to tickers with `search`. For sentiment/news use `WebSearch` and cite dated
sources.

### Running indicators

```bash
python3 scripts/analysis/indicators.py <path-to-historicals.json> --price <live quote>
```

Save the connector's historicals response to a file (or pipe via `-`). Pass the live quote via
`--price` when the market is open so the support/resistance map centers on the real price. The
script auto-locates the bars and prints, grouped by category: trend (SMA 20/50/200, EMA 12/26,
**ADX/+DI/−DI**), momentum (RSI(14), MACD(12,26,9) with fresh-cross flag, **Stochastic**),
volatility (**ATR(14)**, Bollinger(20,2)), volume (**relative volume, OBV**
accumulation/distribution), the **support/resistance map** (nearest support below, nearest
resistance/"pressure" above, full ladders, classic pivot points, Fibonacci retracements), the 52-wk
range, an **ATR/structure trade scaffold** (reference stop, target, reward:risk), and a
plain-English signal summary. Interpret it per `skills/analysis/quant-levels.md`. If the feed lacks
high/low, the summary flags that ATR/ADX/Stoch/S-R are degraded to closes.

Pass `--float <shares>` (from `get_equity_fundamentals`) to enable the exact turnover-decay
**chip/cost-basis distribution (筹码分布)** instead of the recency-decay proxy.

### Longer history — Yahoo Finance (`scripts/lib/yahoo.py`)

The Robinhood connector serves only ~1 year of daily bars. Base rates and the Monte-Carlo
bootstrap in `scripts/analysis/forecast.py` get materially better with a longer sample, so pull multi-year
history from Yahoo (pure stdlib, no key, split/dividend-adjusted by default):

```bash
python3 scripts/lib/yahoo.py MP --range 5y --out reports/data/MP.json   # 5y daily → analytics-ready JSON
python3 scripts/analysis/indicators.py reports/data/MP.json --price <live>   # same file feeds every script
```

It emits the exact bar shape `indicators.py` / `charts.py` / `forecast.py` already parse, so it is a
drop-in for the connector historicals. `forecast.py` also accepts a **bare ticker** directly (auto-
fetches from Yahoo) for both the subject and `--peers`:

```bash
python3 scripts/analysis/forecast.py MP --price 53.31 --peers ALB,SQM --breakout 60.19 --breakdown 51.63
```

Notes: use `--raw` for literal traded prices (chips/levels) vs. the default back-adjusted series
(returns math); the **squeeze percentile is lookback-dependent** (a band tight vs. 1y can be mid-pack
vs. 5y — state the window). Yahoo is a courtesy public endpoint: cache to a file, don't hammer. Keep
using the connector for **live quotes, fundamentals, tradability, positions, and all order handling**
— Yahoo is history only.

### Charts & the HTML report

The report is delivered as **styled, self-contained HTML** (markdown is the editable source). Two
more scripts turn the numbers into a desk-quality page:

```bash
# 1) per-name charts (reuses the SAME historicals + float; no extra data pull)
python3 scripts/report/charts.py <historicals.json> --symbol <T> --price <live> --float <float> \
    --out reports/assets/charts --date <YYYY-MM-DD>
```

`charts.py` writes three SVGs and prints a ready-to-paste markdown embed block: **price/volume**
(candles, SMA 20/50/200, Bollinger, the S/R ladder as zones, volume sub-panel), **chips** (the
筹码分布 histogram — profit vs. trapped split, main cost-basis shelf, high-volume nodes), and
**gauges** (RSI/Stochastic/ADX/rel-volume meters + trend/MACD/OBV/scaffold badges). Paste the embed
block into that name's block in the markdown. It shares `indicators.py`, so the charts and cited
numbers never disagree. (`--only price,chips,gauges` to subset; `charts.sparkline()` gives an inline
unicode price sparkline for one-line watchlist entries.)

```bash
# 2) render the markdown report → self-contained styled HTML (SVGs inlined)
python3 scripts/report/build_report.py reports/.build/<YYYY-Www>/report_<YYYY-MM-DD>_<title>_<model>.md
```

`build_report.py` converts the markdown to a dark, information-dense page: recommendation cards
colour-coded by action (green=add, red=avoid/trim, amber=watch), inlined charts (one portable file
— no broken links on GitHub or over email), styled tables, a masthead, plus
`> [!ACTION]`/`[!TIP]`/`[!WATCH]`/`[!RISK]`/`[!NOTE]` callout boxes and auto hover-tooltips on
jargon. **The `.html` is the deliverable; the `.md` is local build state.** Reports, chart sources,
caches, and journals remain local unless the user explicitly publishes them to a private destination.

Charts render on Robinhood daily bars only — a volume-at-price proxy that can't see
dark-pool/off-exchange prints. Treat chip zones as ranges, not ticks. For true block/dark-pool
footprints an unusual-options-flow or tick feed (see below) would be the upgrade.

## Execution — preview every order; authorization follows the active mode

Read `skills/decision/trading-modes.md` before acting. `semi` is the public default (numbered tickets
the user approves). `manual` is the per-order-confirm kill switch; experimental `full` has no authority until the user explicitly opts in.
For every proposed or executable ticket:

1. **Restate the exact order:** symbol, buy/sell, quantity, order type (prefer limit), limit price,
   **session + time-in-force** (default **24-hour / `all_day_hours` + `gtc`** — see below), and the
   configured tradable account.
2. **Preview it:** call `review_equity_order` (or `review_option_order`) and show the broker's
   preview — estimated cost, buying-power impact, any warnings.
3. **Apply the active authorization rule:** `manual` requires a clear later "yes" tied to the
   preview; `semi` requires approval of the numbered ticket; `full` requires a previously explicit
   mode opt-in plus every sufficiency, risk, account-scope, and execution gate. A briefing or general
   enthusiasm never changes the mode.
4. **Place or leave unplaced:** call `place_equity_order` (or `place_option_order`) only when the
   active mode authorizes this exact preview. Report the
   confirmation/fill and the updated position and buying power.
5. **Log it** to the desk track record (see rubric).

If quantity, price, account, mode, connector state, or a gate is ambiguous, do not place the order.
Ask or return an unplaced ticket. An unplaced order costs nothing; a wrong one costs real money.

**Session — default to the 24-hour market.** Place resting limits with `market_hours="all_day_hours"`
(24-hour) and `time_in_force="gtc"` by **default**, so the order is live around the clock and catches
an **overnight / pre-market flush** the instant it happens instead of lying dormant until the regular
9:30–4 session. A `regular_hours`-only order misses any move outside RTH — for buy-the-wash resting
limits that is a real, avoidable miss. Caveats:
- **Whole shares only.** Fractional / dollar-based orders place *only* in `regular_hours`; a 24-hour
  order must be a **whole-share limit** — round the dollar target to whole shares (e.g. "$120 of MP
  at $46" → **3 sh**, note the rounding in the restate).
- **Always a limit, never a market, off-hours.** Overnight/extended liquidity is thin and spreads
  gape — a market order can fill far from the last print. Rest a limit at your level.
- **Not every name is 24-h-eligible.** If the broker rejects `all_day_hours`, fall back to
  `regular_hours` and say so in the confirmation.
- **Re-point dormant orders.** To move an existing `regular_hours` resting order onto the 24-hour
  session, **cancel-and-replace** at the same price/qty (there is no in-place session edit); offer
  this whenever the book still holds RTH-only dip orders.
- Still below market = still resting: 24-hour changes *when* a marketable order *can* fill, not
  *whether* a below-market limit fills — be explicit with the user that a flush order won't fill at
  the current price in any session.

Options require the account to carry the appropriate option level; check before proposing option
trades. To modify/cancel, use `cancel_equity_order` / `cancel_option_order` and confirm the same
way.

### Approved ticket, market moved — one bounded reconciliation

An approval authorizes the ticket's side, symbol, size, and intent, not an unlimited price chase.
Before placement, reconcile the live bid/ask and open orders:

- A limit adjustment toward marketability is allowed once, by at most **0.3%** from the approved
  limit, and old→new must be logged.
- If the needed change is larger, worsens the risk case, changes size/side, or fails another gate,
  send one concrete corrected numbered ticket for fresh approval. Do not ask an open-ended question
  on every tick.
- Never cancel or weaken a live protective stop until the replacement exit is confirmed live. If a
  discretionary exit does not fill, keep or reinstate protection in the same session.
- `close N`/`disregard` drops a local proposed ticket only; it never cancels a broker order.

## Action-price alerts — the levels registry (every recommendation registers its price)

The connector has **no push price-alert API** (scans are pull-based screeners), so the desk
guarantees alerting with three mechanisms, strongest first:

1. **Order-as-alert (configured execution account only, mode-authorized only).** A resting **GTC +
   `all_day_hours` whole-share limit** is the alert and self-executes when price arrives. It needs
   exact-ticket approval in `manual`/`semi`; validate-only `full` may evaluate the ticket but cannot
   place it. Never infer authorization from a briefing alone.
2. **The levels registry + sweep (always).** Every recommendation that names an action price —
   buy zone, add-on-wash level, trim/stop, re-entry trigger, breakout/breakdown gate — **must be
   written to `journal/action-levels.jsonl`** (ticker, level, direction `below`/`above`, action
   text, source report, set/expiry dates, optional `not_before` for wash-sale-gated re-entries).
   **Every desk run starts by running `python3 scripts/journal/check_alerts.py`** and leads the report
   with any TRIGGERED levels ("alerts hit since last run") before new analysis. The check uses
   daily **lows/highs since the set date**, not just the last close — intraday touches count,
   because washes and breakouts rarely wait for the close. The user can also run it standalone
   anytime (Yahoo data, no broker login).
   Computed forecast/exit levels can be promoted with
   `python3 scripts/journal/capture_levels.py --help`; automatic rows keep report provenance and do
   not overwrite an open human-curated level.
3. **App alerts for real-time push.** For levels the user wants push-notified between desk runs,
   end the report with the explicit list to set manually in the Robinhood app ("set alerts:
   SYM 40, MP 52, …") — the desk cannot set these via the connector.

Registry hygiene: remove a level when acted on or the thesis changes (a stale level is a false
alert); date-gate wash-sale re-entries with `not_before`; expire zone-entries tied to a catalyst
(e.g. "add only before earnings") on the catalyst date. TRIGGERED means *re-validate then act* —
levels are recommendations frozen in time, and the desk re-checks the thesis (news, phase, volume)
with live quotes before executing anything.

## Safety notes

- Never move money, initiate transfers, or change account settings — this desk only analyzes and, on
  explicit confirmation, places equity/option orders in the configured tradable account.
- If the connector returns errors or stale data, surface that plainly; do not paper over gaps with
  guesses.

## Account-data confinement (hard rules)

Account data — **account numbers, holder names, balances/buying power, position quantities and
values, order history** — is for **in-session analysis only**. It must never leave the desk
unmasked:

1. **Identifiers are masked EVERYWHERE, always.** Any account number, holder name, or connector
   UUID in *any* committed artifact (reports, journal, skills, README, commit messages) uses the
   masked form only — last-4 (`••••1234`). Full identifiers live solely in `config.local.toml`
   and `scripts/ops/pii_denylist.local.txt` (both git-ignored). Enforced by
   `scan_pii.py --accounts-only`, which the hooks now run on **every branch, private included**.
2. **Values & positions never reach the public repo.** Dollar balances, share counts, cost bases,
   and P&L may appear in private-branch reports (that's their purpose) but are blocked from the
   public branch by the existing gate (`reports/`, `journal/` are git-ignored; framework files
   must use illustrative placeholder numbers, never real ones).
3. **Nothing account-related goes online.** Never include account identifiers, balances, or real
   position details in web searches, fetched URLs, artifacts, PR/issue text, cloud-agent prompts,
   or any external service call. When an external query needs context, use the ticker and
   generic sizing ("a mid-5-figure position"), never the actual numbers.
4. **Screenshots are PII too.** The text gate cannot read pixels — before committing any image,
   crop/blur account numbers, names, balances, and anything identifying (see
   `docs/agentic-orders.png` precedent: bottom strip cropped before commit).
5. **New account identifiers get denylisted immediately.** First time the desk sees a new
   account number/holder name from the connector, add it to `scripts/ops/pii_denylist.local.txt`
   in the same session.
