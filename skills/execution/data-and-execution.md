# Data & Execution Reference (Robinhood connector)

All market data, positions, and order handling go through the connected Robinhood connector. Its tools are prefixed `mcp__<id>__` (the id is the connection's UUID). If the tools aren't loaded in the session, load them via ToolSearch first (search for names like `place_equity_order`, `get_equity_quotes`, `get_equity_historicals`).

## Account

The only tradable account for this desk is the one you configure as tradable in
`config.local.toml` (git-ignored — **account numbers are never committed to this repo**). Confirm
it with `get_accounts` at the start of a run and verify it matches your configured
`broker.<name>.account_number`. Prefer an account explicitly marked agent-accessible.

Never place orders against any other account, even if the user holds more there. Read-only data
(quotes, historicals, fundamentals) can be pulled for any ticker regardless of account.

## Watchlists (universe, prioritized)

Watchlist IDs are **user-specific and live in your local config**, not in this repo. Configure
them under `[broker.<name>.watchlists]` in `config.local.toml` (label → connector watchlist id),
then pull members with `get_watchlist_items`. Discover your ids with `get_watchlists`.

A typical layout (yours will differ):
- **Broad list** — your large universe (screen for movers/setups; don't work up every name).
- **Theme lists** (e.g. "AI", "Robot") — focused, tractable sources of Core/Tactical ideas; prioritize these.
- **Crypto list** — only if the user asks; this desk is equities-focused.

Prioritize the focused theme lists and screen the broad list for standouts. Confirm ids with
`get_watchlists` in case they change.

## Data pull — tool map

Per candidate ticker:

- `get_equity_quotes` — last price, bid/ask, day change, volume.
- `get_equity_fundamentals` — market cap, P/E, P/B, margins, yield, 52-wk range, sector.
- `get_equity_historicals` — ~1 year daily bars → feed to `scripts/indicators.py`.
- `get_earnings_calendar` — next report date; `get_earnings_results` — recent surprises.
- `get_equity_tradability` — confirm tradable before recommending.
- `get_equity_positions` (the configured tradable account) — current holdings / existing exposure.
- `get_portfolio` (the configured tradable account) — authoritative buying power for sizing.

Once per run, for the **macro/regime read** (`skills/analysis/macro-regime.md`):

- `get_indexes` / `get_index_quotes` — VIX, SPX/NDX and any available Treasury-yield index (e.g. TNX/10-yr) for the top-down filter.
- `get_equity_historicals` on `SPY`/`QQQ` → `scripts/indicators.py` for market trend & breadth (above/below the 200-DMA).
- `WebSearch` (not a connector tool) for the Fed rate path / dot plot, the next FOMC/CPI/NFP date, live yields, and any credit-spread read — cite dated sources.

Resolve company names to tickers with `search`. For sentiment/news use `WebSearch` and cite dated sources.

### Running indicators

```bash
python3 scripts/indicators.py <path-to-historicals.json> --price <live quote>
```

Save the connector's historicals response to a file (or pipe via `-`). Pass the live quote via `--price` when the market is open so the support/resistance map centers on the real price. The script auto-locates the bars and prints, grouped by category: trend (SMA 20/50/200, EMA 12/26, **ADX/+DI/−DI**), momentum (RSI(14), MACD(12,26,9) with fresh-cross flag, **Stochastic**), volatility (**ATR(14)**, Bollinger(20,2)), volume (**relative volume, OBV** accumulation/distribution), the **support/resistance map** (nearest support below, nearest resistance/"pressure" above, full ladders, classic pivot points, Fibonacci retracements), the 52-wk range, an **ATR/structure trade scaffold** (reference stop, target, reward:risk), and a plain-English signal summary. Interpret it per `skills/analysis/quant-levels.md`. If the feed lacks high/low, the summary flags that ATR/ADX/Stoch/S-R are degraded to closes.

Pass `--float <shares>` (from `get_equity_fundamentals`) to enable the exact turnover-decay **chip/cost-basis distribution (筹码分布)** instead of the recency-decay proxy.

### Charts & the HTML report

The report is delivered as **styled, self-contained HTML** (markdown is the editable source). Two more scripts turn the numbers into a desk-quality page:

```bash
# 1) per-name charts (reuses the SAME historicals + float; no extra data pull)
python3 scripts/charts.py <historicals.json> --symbol <T> --price <live> --float <float> \
    --out reports/charts --date <YYYY-MM-DD>
```

`charts.py` writes three SVGs and prints a ready-to-paste markdown embed block: **price/volume** (candles, SMA 20/50/200, Bollinger, the S/R ladder as zones, volume sub-panel), **chips** (the 筹码分布 histogram — profit vs. trapped split, main cost-basis shelf, high-volume nodes), and **gauges** (RSI/Stochastic/ADX/rel-volume meters + trend/MACD/OBV/scaffold badges). Paste the embed block into that name's block in the markdown. It shares `indicators.py`, so the charts and the cited numbers never disagree. (`--only price,chips,gauges` to subset; `charts.sparkline()` gives an inline unicode price sparkline for one-line watchlist entries.)

```bash
# 2) render the markdown report → self-contained styled HTML (SVGs inlined)
python3 scripts/build_report.py reports/Trading-Desk-Report-<YYYY-MM-DD>.md
```

`build_report.py` converts the markdown to a dark, information-dense page: recommendation cards colour-coded by action (green=add, red=avoid/trim, amber=watch), inlined charts (one portable file — no broken links on GitHub or over email), styled tables, a masthead, plus `> [!ACTION]`/`[!TIP]`/`[!WATCH]`/`[!RISK]`/`[!NOTE]` callout boxes and auto hover-tooltips on jargon. **The `.html` is the deliverable and the committed artifact; the `.md` is a local build intermediate and is NOT committed.** Commit the `.html` and `reports/charts/` only.

Charts render on Robinhood daily bars only — a volume-at-price proxy that can't see dark-pool/off-exchange prints. Treat chip zones as ranges, not ticks. For true block/dark-pool footprints an unusual-options-flow or tick feed (see below) would be the upgrade.

## Execution — confirm before every order (hard rule)

The desk RECOMMENDS. It does not trade on its own. When the user wants to act on a specific recommendation:

1. **Restate the exact order:** symbol, buy/sell, quantity, order type (prefer limit), limit price, and the configured tradable account.
2. **Preview it:** call `review_equity_order` (or `review_option_order`) and show the broker's preview — estimated cost, buying-power impact, any warnings.
3. **Get explicit confirmation:** ask for a clear "yes" tied to that specific preview. A watchlist, a briefing, a prior "sounds good," or general enthusiasm is NOT confirmation.
4. **Place it:** only now call `place_equity_order` (or `place_option_order`). Report the confirmation/fill and the updated position and buying power.
5. **Log it** to the desk track record (see rubric).

If anything is ambiguous — quantity, price, which account, whether the user actually meant "do it" — do NOT place the order. Ask. An un-placed order costs nothing; a wrong one costs real money.

Options require the account to carry the appropriate option level; check before proposing option trades. To modify/cancel, use `cancel_equity_order` / `cancel_option_order` and confirm the same way.

## Safety notes

- Never move money, initiate transfers, or change account settings — this desk only analyzes and, on explicit confirmation, places equity/option orders in the configured tradable account.
- If the connector returns errors or stale data, surface that plainly; do not paper over gaps with guesses.
