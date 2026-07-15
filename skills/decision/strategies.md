# Strategy Playbook (distilled from top open-source trading projects)

Patterns borrowed from battle-tested open-source trading systems, adapted here. Balance three things that pull against each other: **gain** (upside), **risk** (surviving to trade again), and **tax/cost** (keeping what you make). Maxing one while ignoring the others is a gamble.

Sources: **Freqtrade** (exit/risk mechanics), **Microsoft Qlib** (rank-based construction with turnover control), **backtrader / Zipline** (backtest-before-you-trust discipline).

---

## 1. Exit discipline (from Freqtrade)

Most retail money is lost on exits, not entries — holding losers, selling winners too early. Every trade specifies its exits *up front*.

**Stop = risk on the trade, in dollars.** A statement of how much you'll lose, not a chart line. Size so (entry − stop) × shares ≤ the per-idea risk cap. This anchors everything.

**Trailing stop to protect profit.** Once up meaningfully, ratchet the stop up so a winner can't turn into a loser. Default: at ~+1R [up 1×(entry−stop)], move to breakeven; beyond, trail below the rising trend (recent swing low or a moving average). Don't trail so tight that normal noise stops you out.

**Time-tiered profit taking (ROI-table thinking).** Freqtrade exits at a profit target that *decays over time* — demand more early, accept less the longer it drags. For swings: define a primary target (the RR≥2 level), consider scaling out part at +1R and letting the rest run. If a Tactical trade hasn't worked after its window (a **time stop**, e.g. 5–15 trading days with no progress), exit and recycle — dead money has opportunity cost.

**One position, one plan.** Entry zone, stop, target(s), scale-out, and time stop are all defined before entry, and appear in the report's trade plan.

---

## 2. Rank-and-rotate with a turnover budget (from Qlib)

Qlib's TopkDropout scores the universe by factor value, holds the top-K, and each period **sells only the lowest-ranked holdings, replacing them with clearly higher-ranked challengers — capping swaps per period.** That cap concentrates capital in the best names while limiting churn, cutting costs and taxes.

Apply it here:
- **Score, don't just pick.** Rank watchlist + field candidates with the rubric so selection is comparative.
- **Hold the best, rotate reluctantly.** Rotate out only when a challenger *clearly* outranks the holding — a small edge doesn't justify a taxable swap.
- **Turnover budget.** Default ≤ ~1–2 position changes per sleeve per week, absent a stop-out or thesis break. High turnover is the enemy of after-tax returns.
- **Ensemble over single signal.** Qlib blends 158 factors; you won't, but combine at least fundamental + technical + catalyst evidence. Single-indicator signals are noisy.

---

## 3. Validate before you trust (from backtrader / Zipline)

Backtesting exists because a rule that looks great in hindsight usually falls apart live. Carry the mindset even without an engine:
- **Sanity-check thresholds against history.** Before leaning on "RSI < 30 bounces on this name," check past oversold points via `get_equity_historicals`. If it didn't hold, distrust it.
- **Always net out costs and slippage.** An edge that survives on paper can vanish after spread and (Tactical) taxes. Compute RR and EV *after* estimated costs — see the rubric's net-edge rule.
- **Beware overfitting.** A story needing five things to all go right is fragile. Prefer one or two clear drivers.
- **Small-sample humility.** A couple of good calls isn't skill; keep the track-record log (rubric) and judge the process over many trades.

---

## How this balances gain / risk / tax

- **Gain** — rank-and-rotate concentration plus letting winners run via trailing stops and partial scale-outs.
- **Risk** — the fixed-dollar stop, the 2% per-idea rule, time stops on dead trades, and the turnover limit against overtrading.
- **Tax/cost** — the turnover budget (fewer taxable events), the bias toward Core winners into long-term treatment, and netting costs into every RR — see `skills/decision/tax-aware.md`.

Reference which lever a recommendation pulls, so the user sees the trade-off.

---

## 4. Mandatory participation for top-decile setups

A call is a **must-buy** only when all four conditions hold:

1. Conviction is **High** and the rubric score is **≥80/100**.
2. It clears **every invariant**: RR ≥2 at entry, defined invalidation plus a live protective
   stop, and size within the canonical caps in `review-rubric.md`.
3. It survived the bear case (Research Manager = Buy/Strong Buy) on a real variant rather than
   broad-market beta.
4. A valid entry exists at or near the current price—not a breakout several levels away.

When all four hold, a starter proposal is mandatory under the active confirmation mode; the desk
does not silently choose zero participation. Start with roughly one-third to one-half of planned
size, re-justify lower-conviction resting bids if capital is constrained, and add only on the
pre-underwritten proof.

If conditions 1–3 hold but condition 4 fails because price is mid-range or RR is poor, arm a
concrete entry trigger in `journal/action-levels.jsonl` rather than leaving a passive watch. “Wait
for confirmation” justifies a zero-fill only when a named invariant or condition 4 blocks it.

Journal every top-decile call as must-buy **yes** with the approved fill, or **no** with the
blocking invariant/entry condition named, so the weekly retrospective can score whether the rule
participates when it should.
