# Strategy Playbook (distilled from top open-source trading projects)

These patterns are borrowed from the most battle-tested open-source trading systems and adapted to this desk. The goal is to balance three things that pull against each other: **gain** (capturing upside), **risk** (surviving to trade again), and **tax/cost** (keeping more of what you make). A strategy that maxes one while ignoring the others is not a strategy, it's a gamble.

Sources the patterns are drawn from: **Freqtrade** (exit/risk mechanics), **Microsoft Qlib** (rank-based portfolio construction with turnover control), and **backtrader / Zipline** (backtest-before-you-trust discipline).

---

## 1. Exit discipline (from Freqtrade)

Most retail money is lost not on entries but on exits — holding losers hoping they come back, and selling winners too early. Every trade this desk proposes must specify its exits *up front*, not improvise them later.

**Stop = risk on the trade, in dollars.** A stop isn't a chart line, it's a statement of how much you're willing to lose. Size the position so that (entry − stop) × shares ≤ the per-idea risk cap. This is the anchor for everything else.

**Trailing stop to protect profit.** Once a position is up by a meaningful amount, ratchet the stop up so a winner can't turn into a loser. A workable default: once the trade is up ~1×(entry−stop) [i.e. +1R], move the stop to breakeven; beyond that, trail it below the rising trend (e.g. below the recent swing low or a moving average). Don't trail so tight that normal noise stops you out.

**Time-tiered profit taking (ROI-table thinking).** Freqtrade exits when a trade hits a profit target that *decays over time* — demand more profit early, accept less the longer it drags. Translate to swing trading: define a primary target (the RR≥2 level) and consider scaling out part of the position at +1R to lock gains and let the rest run to target. If a Tactical trade hasn't worked after its expected window (a **time stop**, e.g. 5–15 trading days with no progress), exit and recycle the capital — dead money has an opportunity cost.

**One position, one plan.** Entry zone, stop, target(s), scale-out plan, and time stop are all defined before entry. The trade plan in the report must contain them.

---

## 2. Rank-and-rotate with a turnover budget (from Qlib)

Qlib's TopkDropout strategy scores the whole universe by factor value, holds the top-K names, and each period **sells only the lowest-ranked holdings and replaces them with clearly higher-ranked challengers — capping how many swaps happen per period.** That turnover cap is the key idea: it concentrates capital in the best names while deliberately limiting churn, which cuts both transaction costs and taxes.

Apply it here:

- **Score, don't just pick.** Rank watchlist + field candidates with the review rubric so selection is comparative, not one-off.
- **Hold the best, rotate reluctantly.** Only rotate out of an existing position when a challenger *clearly* outranks it — not on a marginal difference. A small score edge does not justify a taxable, cost-incurring swap.
- **Turnover budget.** Limit portfolio rotations per period (default: at most ~1–2 position changes per sleeve per week, absent a stop-out or thesis break). High turnover is the enemy of after-tax returns.
- **Ensemble over single signal.** Qlib blends 158 factors; you won't, but combine at least fundamental + technical + catalyst evidence rather than trading on one indicator. Single-indicator signals are noisy.

---

## 3. Validate before you trust (from backtrader / Zipline)

Backtesting frameworks exist because a rule that looks great in hindsight usually falls apart live. Carry the mindset even without a full backtest engine:

- **Sanity-check thresholds against history.** Before leaning on "RSI < 30 bounces on this name," glance at how the stock actually behaved at past oversold points via `get_equity_historicals`. If the pattern didn't hold historically, distrust it.
- **Always net out costs and slippage.** An edge that survives on paper can vanish after the spread and (for the Tactical sleeve) taxes. Compute risk/reward and expected value *after* estimated costs — see the rubric's net-edge rule.
- **Beware overfitting.** A story that requires five things to all go right is fragile. Prefer simple, robust theses with one or two clear drivers.
- **Small sample humility.** A couple of good calls isn't skill; keep the track-record log (rubric) and judge the process over many trades, not one.

---

## How this balances gain / risk / tax

- **Gain** comes from the rank-and-rotate concentration (own the best names) plus letting winners run via trailing stops and partial scale-outs.
- **Risk** is capped by the fixed-dollar stop, the 2% per-idea rule, time stops on dead trades, and the turnover limit preventing overtrading.
- **Tax/cost** is protected by the turnover budget (fewer taxable events), the bias toward holding Core winners into long-term treatment, and netting costs into every RR — all detailed in `skills/decision/tax-aware.md`.

The desk should explicitly reference which of these levers a given recommendation is pulling, so the user sees the trade-off being made.
