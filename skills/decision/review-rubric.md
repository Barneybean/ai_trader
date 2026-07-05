# Review Rubric, Sleeves, and Sizing

This is the desk's constitution. It defines what "moves the needle" means concretely, so the CIO gate is consistent instead of vibes. The user chose a **high bar**: only strong-edge ideas reach them. When in doubt, cut.

---

## Sleeves (capital partition)

Capital is split into two sleeves with different jobs and different judging standards. Track each sleeve's allocated vs available dollars every run.

- **Tactical sleeve — short-term (swing/day trades).** Judged mainly on the Quant's setup and a defined near-term catalyst. Tight stops, defined invalidation, faster exits. Default target allocation: **40%** of account value.
- **Core sleeve — long-term (position/buy-and-hold).** Judged mainly on the Fundamental Analyst's business quality + valuation, with technicals only for entry timing. Wider stops or thesis-based invalidation; longer holds. Default target allocation: **60%** of account value.

Default split is a starting point, not a rule — the user can change it, and it's fine to hold cash in either sleeve when nothing qualifies. Never let one sleeve borrow from the other without flagging it.

> Small-account note: on a small account, keep it simple. Favor a few meaningful positions over many tiny ones (fractional shares are fine). Day trading is constrained on a small cash account (settlement timing; pattern-day-trader rules bite margin accounts under $25k) — prefer swing over intraday unless the user insists.

---

## Scoring (0–100)

Score each candidate on six dimensions. Weights differ by sleeve because the sleeves value different things.

| Dimension | What it measures | Tactical weight | Core weight |
|---|---|---|---|
| Thesis / Edge | Is there a real, specific, *non-consensus* reason this makes money? (`skills/edge/variant-perception.md`) | 20 | 30 |
| Catalyst | Defined event/driver within the horizon | 25 | 10 |
| Technical setup / timing | Trend, momentum, entry quality (Quant) | 25 | 15 |
| Valuation / quality | Business quality & price (Fundamental) | 5 | 30 |
| Risk / reward | Entry→target vs entry→stop | 20 | 10 |
| Conviction | Strength & agreement of evidence across roles | 5 | 5 |

Score each dimension 0–100, multiply by its weight, sum, divide by 100. That's the idea's score.

**Scoring Thesis/Edge:** a differentiated, evidenced variant view (a structural read estimates miss, a quantified backlog, a priced-at-zero optionality, a second-order beneficiary) scores high. A correct but *consensus* view — already in the price — scores low here no matter how true ("great company," "cyclical," "expensive"). No variant-perception statement → this dimension caps low, which usually keeps a consensus idea below the surface bar. See `skills/edge/variant-perception.md`.

**Scoring Conviction:** boost it when independent evidence *converges* — and weight **insider & smart-money flows** heavily here (`skills/edge/smart-money.md`): a CEO/cluster open-market buy at a bottom that aligns with the thesis raises conviction; heavy discretionary top-management selling into strength lowers it (and caps size) even on a strong story.

---

## Net-edge rule (gain vs risk vs tax/cost)

Judge every idea on **net expected value**, not headline upside:

`net edge ≈ gross edge − estimated spread/slippage − expected tax drag`

- **Tactical (short-term)** gains are taxed as ordinary income and the sleeve churns, so tactical ideas must clear a **higher gross bar** to survive — a thin swing trade that barely nets after tax and spread is a skip.
- **Core (long-term)** ideas held >1 year get the lower long-term rate, so their after-tax edge is structurally better — reflect that when ranking across sleeves.
- If two ideas rank similarly, prefer the one with lower turnover / better tax character.

See `skills/decision/strategies.md` and `skills/decision/tax-aware.md` for the mechanics.

## Turnover budget (from Qlib's rotation constraint)

Overtrading is the quiet killer of after-tax returns. Cap rotations at roughly **1–2 position changes per sleeve per week**, excluding forced exits (stop-outs, thesis breaks). Only rotate out of a holding when a challenger *clearly* outranks it — a marginal score edge does not justify a taxable, cost-incurring swap.

## Hard gates (must pass ALL to surface)

Scoring ranks ideas; gates decide eligibility. An idea can score well and still be cut by a gate.

1. **Risk/reward ≥ 2.0 net of costs** (entry→target at least twice entry→stop, after spread). Non-negotiable — it's how a desk survives a sub-50% win rate.
2. **Defined invalidation.** A concrete price or thesis condition that says "we were wrong." No stop, no trade. Prefer a *non-price* thesis-break (a lost contract, cut guidance, a pulled catalyst) alongside the price level — per the stress-test.
2b. **Survives the thesis stress-test** (`skills/decision/stress-test.md`). Every catalyst has its two-sided (bad) version written; the load-bearing assumptions are inventoried and the weakest one is named; disconfirming evidence was hunted, not ignored; a pre-mortem was run. Conviction/size track the *weakest load-bearing assumption*, not the upside. A thesis that can only be stated bullishly hasn't been tested.
3. **Sleeve-appropriate edge:**
   - Tactical: a *defined* catalyst OR a high-quality technical setup (clean trend/breakout/pullback with volume). A drifting chart with no catalyst does not qualify.
   - Core: attractive valuation OR clearly improving fundamentals on a quality business. "It's a good company" at a rich price does not qualify. For a *high-conviction* Core bottom-fish, the desk must be able to write an explicit, credible path to ~2x over months–1 year (re-rating + growth + catalyst) per `skills/playbook/mentor-method.md` — "it'll go up eventually" is not a path.
4. **No unwanted binary event inside the hold** unless the trade is explicitly an earnings play the user asked for. Flag earnings inside the window.
5. **Tradable & liquid enough** that the spread doesn't eat the edge.
6. **Conviction ≥ Medium.** Low-conviction ideas are logged, not surfaced.
7. **Worth the attention.** On the account's size, the expected payoff must be meaningful — don't surface a trade whose best case is trivial dollars.

If an idea fails any gate, it goes in the internal log with the failing reason and appears (one line) in the "watchlist scan" section only if it's a watchlist name the user is tracking.

---

## Position sizing

- **Per-idea risk cap:** risk no more than **2%** of account value on a single idea (distance from entry to stop × shares ≤ 2% of account). This governs how much you can *lose*.
- **Per-name concentration cap (mentor rule):** no single position may exceed **25% of portfolio value** — a hard ceiling, never a target. In practice size by **conviction tier**: ~7–8% high-conviction large-cap, ~4–5% growth/semis, ~3–4% dividend/defensive, ~1–2% speculative. The risk cap and the concentration cap both apply; the binding one wins. See `skills/playbook/mentor-method.md`.
- **Cash is a deliberate hedge (~30–40% default) and a weapon.** Don't feel obligated to be fully invested — dry powder deployed into pullbacks/crashes is where the mentor makes the most money (`skills/playbook/mentor-casebook.md`). Spend it down to ~15–20% in a real crash (Aug-2024, April-2025 archetypes), then rebuild by trimming winners into strength.
- **Scale in on weakness, in tranches, with pre-planned lower adds.** Never open at full size; ladder small adds (~0.25–1% of book per tranche; 2–4% only in a crash or top-conviction) with the next add levels defined in advance. Buying weakness in quality > chasing strength (the chase is the trap).
- **Cap, then trim into strength.** When a name runs past its conviction tier (a core toward ~10–15%, a top-conviction toward ~20% but never past the 25% hard cap), *trim the excess into the spike/target* to control risk and refill cash. The trims fund the next pullback's buys. Scale-outs happen at resistance rungs (`skills/analysis/quant-levels.md`) and target prices.
- **Hedging is short-term insurance only.** At market highs, a small (1–2%) short-term hedge/put/short is acceptable — but flag it, keep it small, and flatten it fast; cash is the safer hedge. Never a standing short book.
- **Sleeve budget:** a new position can't push a sleeve over its target allocation without an explicit flag and user OK.
- **Concentration:** avoid stacking correlated names (same sector/theme) such that a single shock blows through the per-idea cap across positions.
- Show the math in the trade plan: entry, stop, shares, $ at risk, and % of account.
- Include the **exit plan** (trailing-stop rule, scale-out at +1R if used, time stop) — a trade without defined exits is incomplete (see `skills/decision/strategies.md`).

### Asymmetric / secular-wave bets (the multi-bagger sleeve of behavior)
Early-in-the-wave category-definers (`skills/edge/thematic-waves.md`) won't fit the standard swing math — they draw down 40–60% on the way to a multiple, so a tight 2% stop just churns you out. Size them as **convex options, not swings**:
- **Small starter, scale on confirmation.** Take a small initial position (toward the ~1–2% speculative tier), then *add as catalysts hit* (each inflection tell earns more size). Never open at full size.
- **RR gate is met by convexity, not a chart stop.** The ≥2.0 RR is satisfied by a **bounded downside (the small position itself) against a credible multi-x upside** — state the probability-weighted payoff. For these, the Core edge gate reads as a **credible multi-bagger path** (extending the mentor "2x path"), evidenced, not hoped.
- **Invalidate on thesis, not just price.** Pre-commit to the *thesis-break* conditions (a node slip, a failed readout, the bottleneck easing) so a normal drawdown doesn't shake you out of a winner — and a broken thesis doesn't become a bag.
- **Basket, capped.** Run several small asymmetric bets rather than one large one; the aggregate still respects the 25% concentration and correlation caps (don't stack five names on the same wave layer).

---

## Prioritization rules

1. **Watchlist first.** Analyze the user's watchlist names before field candidates and give them the benefit of a full workup.
2. **But be honest.** If a field candidate outscores the best watchlist idea and clears the gates, surface it and explicitly say it beats the watchlist and why.
3. **Rank by score within eligibility**, highest edge first, tagged by sleeve.

---

## Track record (so the desk learns)

Each run, append a one-line record of any surfaced recommendation to an internal log the user can request: date, ticker, sleeve, thesis, entry/stop/target, score. Over time this lets the desk review hit rate and calibration honestly — a real desk grades itself. If the user asks "how have your calls done," reconcile past logged ideas against subsequent prices via the connector.
