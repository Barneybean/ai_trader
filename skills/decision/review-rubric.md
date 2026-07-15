# Review Rubric, Sleeves, and Sizing

The desk's constitution — it defines what "moves the needle" concretely, so the CIO gate is consistent instead of vibes. The user chose a **high bar**: only strong-edge ideas reach them. When in doubt, cut.

---

## Sleeves (capital partition)

Two sleeves, different jobs and judging standards. Track each sleeve's allocated vs available dollars every run.

- **Tactical — short-term (swing/day trades).** Judged on the Quant's setup + a defined near-term catalyst. Tight stops, defined invalidation, faster exits. Default: **40%** of account.
- **Core — long-term (position/buy-and-hold).** Judged on business quality + valuation, technicals only for entry timing. Wider or thesis-based invalidation; longer holds. Default: **60%** of account.

The default split is a starting point — the user can change it, and holding cash in either sleeve is fine. Never let one sleeve borrow from the other without flagging it.

> Small-account note: keep it simple. Favor a few meaningful positions over many tiny ones (fractional shares fine). Day trading is constrained on a small cash account (settlement timing; pattern-day-trader rules bite margin accounts under $25k) — prefer swing over intraday unless the user insists.

---

## Scoring (0–100)

Score six dimensions; weights differ by sleeve.

| Dimension | What it measures | Tactical | Core |
|---|---|---|---|
| Thesis / Edge | Real, specific, *non-consensus* reason this makes money (`skills/edge/variant-perception.md`) | 20 | 30 |
| Catalyst | Defined event/driver within the horizon | 25 | 10 |
| Technical setup / timing | Trend, momentum, entry quality (Quant) | 25 | 15 |
| Valuation / quality | Business quality & price (Fundamental) | 5 | 30 |
| Risk / reward | Entry→target vs entry→stop | 20 | 10 |
| Conviction | Strength & agreement of evidence across roles | 5 | 5 |

Score each 0–100, multiply by weight, sum, divide by 100 = the idea's score.

**Thesis/Edge:** a differentiated, evidenced variant view (a structural read estimates miss, a quantified backlog, priced-at-zero optionality, a second-order beneficiary) scores high. A correct but *consensus* view — already priced — scores low no matter how true ("great company," "cyclical," "expensive"). No variant-perception statement → caps low, which usually keeps a consensus idea below the surface bar. See `skills/edge/variant-perception.md`.

**Conviction:** boost when independent evidence *converges* — and weight **insider & smart-money flows** heavily (`skills/edge/smart-money.md`): a CEO/cluster bottom buy aligned with the thesis raises it; heavy discretionary selling into strength lowers it (and caps size) even on a strong story.

---

## Net-edge rule (gain vs risk vs tax/cost)

Judge on **net expected value**, not headline upside:

`net edge ≈ gross edge − estimated spread/slippage − expected tax drag`

- **Tactical** gains are ordinary-income taxed and the sleeve churns, so tactical must clear a **higher gross bar** — a thin swing that barely nets after tax and spread is a skip.
- **Core** held >1 year gets the lower long-term rate, so after-tax edge is structurally better — reflect that when ranking across sleeves.
- If two ideas rank similarly, prefer lower turnover / better tax character.

See `skills/decision/strategies.md` and `skills/decision/tax-aware.md`.

## Turnover budget (from Qlib)

Overtrading is the quiet killer of after-tax returns. Cap rotations at roughly **1–2 position changes per sleeve per week**, excluding forced exits (stop-outs, thesis breaks). Only rotate out when a challenger *clearly* outranks the holding — a marginal edge doesn't justify a taxable swap.

## Hard gates (must pass ALL to surface)

Scoring ranks; gates decide eligibility. An idea can score well and still be cut by a gate.

1. **Risk/reward ≥ 2.0 net of costs** (entry→target ≥ 2× entry→stop, after spread). Non-negotiable — it's how a desk survives a sub-50% win rate.
2. **Defined invalidation.** A concrete price or thesis condition that says "we were wrong." No stop, no trade. Prefer a *non-price* thesis-break (lost contract, cut guidance, pulled catalyst) alongside the price level.
2b. **Survives the thesis stress-test** (`skills/decision/stress-test.md`). Every catalyst has its two-sided (bad) version written; load-bearing assumptions inventoried, the weakest named; disconfirming evidence hunted; a pre-mortem run. Conviction/size track the *weakest load-bearing assumption*, not the upside. A thesis that can only be stated bullishly hasn't been tested.
2c. **Passes the sufficiency gate** (`skills/decision/sufficiency-gate.md`). A reviewer who did not author the thesis asks: *"Have you collected enough information and done enough quant analysis to come up with this recommendation?"* — every load-bearing fact dated + priced-in-checked, the freshest tape (72h) checked, the strongest opposing fact named, the full engine suite run with disagreeing signals reported, and an adversarial verify pass on stake-heavy or reversal calls. Applies to ad-hoc advisories the same as full runs — insufficient work fails an idea exactly like insufficient edge.
3. **Sleeve-appropriate edge:**
   - Tactical: a *defined* catalyst OR a high-quality technical setup (clean trend/breakout/pullback with volume). A drifting chart with no catalyst doesn't qualify.
   - Core: attractive valuation OR clearly improving fundamentals on a quality business. "Good company" at a rich price doesn't qualify. For a *high-conviction* Core bottom-fish, write an explicit, credible path to ~2x over months–1 year (re-rating + growth + catalyst) per `skills/playbook/mentor-method.md` — "it'll go up eventually" is not a path.
4. **No unwanted binary event inside the hold** unless it's explicitly an earnings play the user asked for. Flag earnings inside the window.
5. **Tradable & liquid enough** that the spread doesn't eat the edge.
6. **Conviction ≥ Medium.** Low-conviction ideas are logged, not surfaced.
7. **Worth the attention.** On the account's size, the expected payoff must be meaningful — don't surface a trade whose best case is trivial dollars.

A gate failure goes in the internal log with the reason, and appears (one line) in the "watchlist scan" section only if it's a watchlist name the user tracks.

---

## Position sizing — canonical risk limits (single source)

> These figures—per-idea risk, concentration, cash policy, and sleeve budget—are the canonical
> source. Other skills reference this section rather than restating the figures, so the caps cannot
> drift across files. Change a limit here once.

- **Per-idea risk cap:** ≤ **2%** of account on one idea (entry→stop × shares ≤ 2%). Governs how much you can *lose*.
- **Per-name concentration cap (mentor rule):** no position exceeds **25% of portfolio** — a hard ceiling, never a target. Size by **conviction tier**: ~7–8% high-conviction large-cap, ~4–5% growth/semis, ~3–4% dividend/defensive, ~1–2% speculative. Both caps apply; the binding one wins. See `skills/playbook/mentor-method.md`.
- **Cash is a deliberate hedge and a weapon, not a permanent percentage.** Derive it from the
  user's policy, market regime, opportunity quality, and upcoming binaries. Deploy in tranches
  during qualified dislocations and rebuild through trims; document the current rationale.
- **Scale in on weakness, in tranches, with pre-planned lower adds.** Never open at full size; ladder small adds (~0.25–1% of book per tranche; 2–4% only in a crash or top-conviction) with next levels defined in advance. Buying weakness in quality > chasing strength (the chase is the trap).
- **Cap, then trim into strength.** When a name runs past its tier (a core toward ~10–15%, a top-conviction toward ~20% but never past the 25% cap), *trim the excess into the spike/target* to control risk and refill cash. Trims fund the next pullback's buys. Scale-outs at resistance rungs (`skills/analysis/quant-levels.md`) and targets.
- **Hedging is short-term insurance only.** At highs, a small (1–2%) short-term hedge/put/short is acceptable — flag it, keep it small, flatten it fast; cash is the safer hedge. Never a standing short book.
- **Sleeve budget:** a new position can't push a sleeve over its target allocation without an explicit flag and user OK.
- **Concentration:** avoid stacking correlated names (same sector/theme) such that one shock blows through the per-idea cap across positions.
- Show the math in the trade plan: entry, stop, shares, $ at risk, % of account.
- Include the **exit plan** (trailing-stop rule, scale-out at +1R if used, time stop) — a trade without defined exits is incomplete (see `skills/decision/strategies.md`).

### Asymmetric / secular-wave bets (the multi-bagger sleeve of behavior)
Early-in-the-wave category-definers (`skills/edge/thematic-waves.md`) don't fit standard swing math — they draw down 40–60% en route to a multiple, so a tight 2% stop just churns you out. Size them as **convex options, not swings**:
- **Small starter, scale on confirmation.** Small initial position (toward the ~1–2% speculative tier), then *add as catalysts hit* (each inflection tell earns more size). Never open at full size.
- **RR gate met by convexity, not a chart stop.** The ≥2.0 RR is satisfied by a **bounded downside (the small position itself) against a credible multi-x upside** — state the probability-weighted payoff. Here the Core edge gate reads as a **credible multi-bagger path** (extending the mentor "2x path"), evidenced not hoped.
- **Invalidate on thesis, not just price.** Pre-commit the *thesis-break* conditions (a node slip, failed readout, the bottleneck easing) so a normal drawdown doesn't shake you out of a winner — and a broken thesis doesn't become a bag.
- **Basket, capped.** Run several small asymmetric bets rather than one large; the aggregate still respects the 25% concentration and correlation caps (don't stack five names on one wave layer).

---

## Prioritization

1. **Watchlist first.** Analyze the user's watchlist names before field candidates; give them a full workup.
2. **But be honest.** If a field candidate outscores the best watchlist idea and clears the gates, surface it and say it beats the watchlist and why.
3. **Rank by score within eligibility**, highest edge first, tagged by sleeve.

---

## Track record (so the desk learns)

Each run, append a one-line record of any surfaced recommendation to an internal log the user can request: date, ticker, sleeve, thesis, entry/stop/target, score. Over time this lets the desk review hit rate and calibration honestly. If the user asks "how have your calls done," reconcile past logged ideas against subsequent prices via the connector.
