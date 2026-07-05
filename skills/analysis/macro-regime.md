# Macro & Regime Lens — the Top-Down Filter

A stock doesn't trade in a vacuum. The most common way a clean, sound idea still loses is that
the **macro regime** was against it — Fed hiking into it, yields spiking, tape in risk-off. This
lens sits *above* single-name analysis: it sets the weather the trade must sail in, and tilts
short- and long-term posture differently.

Establish the regime **once** per run, up front (Desk Head / Sentiment step); every rec then
states which way the wind blows for it. Operationalizes the user's rate/yield house views
(`skills/playbook/house-views.md`) into a checklist.

---

## 1. What to read, and where to get it

`WebSearch` for anything dated (cite sources); Robinhood connector for live index/quotes. Each run:

| Factor | Why it matters | How to get it |
|---|---|---|
| **Fed policy rate + stance** | Risk-free rate anchors valuation; direction (hike/cut/hold) sets the tape's bias. | WebSearch "current fed funds target rate", latest FOMC statement. |
| **Fed dot plot / projections (SEP)** | Market trades the *path*, not today's rate. | WebSearch latest SEP; note median year-end dot. |
| **Next FOMC meeting + date** | Market-wide binary event. Don't open fresh short-term risk into it. | WebSearch "next FOMC meeting date"; fixed (8/yr). |
| **Fed speakers / minutes / Jackson Hole** | Between meetings, these move the rate path. | WebSearch recent Fed commentary; flag a major speech inside the hold. |
| **CPI / PCE / jobs (NFP)** | *Drive* the rate path — a hot CPI reprices the curve in a day. | WebSearch next CPI/PCE/NFP date; treat like FOMC. |
| **2yr & 10yr Treasury yields** | 2yr ≈ Fed-path bet; 10yr ≈ discount rate for long-duration/growth. Rising = headwind, esp. high-multiple. | Connector `get_index_quotes`/`get_indexes` (TNX/10-yr), or WebSearch. |
| **Yield-curve shape (10y−2y)** | Inversion (2y>10y) = recession signal; re-steepening off deep inversion often precedes trouble. | Compute from the two yields. |
| **MOVE index (bond vol)** | Rising bond vol precedes equity stress. | WebSearch "MOVE index level". |
| **VIX (equity vol / fear)** | Regime thermostat. House view: high VIX = better *entries* but size smaller. | Connector index quote or WebSearch. |
| **Market trend & breadth** | SPX/QQQ vs 50/200-day? Advancers vs decliners? A great stock below its 200-DMA fights gravity. | SPY/QQQ historicals → `indicators.py`; WebSearch breadth if needed. |
| **Credit spreads (HY OAS)** | Widening = risk-off before equities notice. | WebSearch "high yield credit spread" if a risk-off read is forming. |

If a factor can't be fetched, say so — don't invent a number. Three solid inputs beat six guessed.

---

## 2. Classify the regime

Synthesize into one regime, one line at the top of the run. It tilts *which ideas even belong on
the page*:

- **Risk-on / easing:** Fed on hold/cutting, yields stable-falling, VIX low-mid, indices above
  rising 200-DMA, breadth healthy. → Favor growth, high-beta, breakouts; Tactical more
  aggressive; long-duration/high-multiple OK.
- **Risk-off / tightening:** Fed hiking/hawkish, yields spiking, VIX elevated/rising, indices
  below 200-DMA, breadth weak, credit widening. → Defense first. Lean financials & healthcare
  (house view), quality balance sheets, dividends; shrink Tactical; raise cash; selective on
  high-multiple growth.
- **Transition / event-risk:** FOMC/CPI/NFP within days, or a post-inversion re-steepening. →
  Reduce fresh short-term exposure into the event; stage limits to fill *after* the print; keep
  dry powder.
- **Washout / capitulation:** VIX spiking hard, broad indiscriminate selling. → House-view +
  mentor-method buy zone — deploy cash into *quality* names reclaiming their 30-day MA, size up
  gradually, don't catch the knife on the first red day.
- **Crisis / regime-shock:** a *structural* break, not a dip — VIX >30–40+ and sticky, credit
  spreads blowing out, cross-asset correlation → 1 (forced de-leveraging), circuit breakers, and
  a regime catalyst (bursting bubble, credit seizure, exogenous shock like pandemic/war, or a
  policy rupture like a tariff regime or market-moving social-media policy). → **Switch to
  `skills/analysis/crisis-playbook.md`.** Defense first (no leverage, raise cash, liquidity +
  smaller size), then disciplined offense (barbell of cash/quality + convex asymmetric bets, buy
  survivors in tranches, own the shock's direct beneficiaries). Name the **crisis type** and
  **phase** (de-risk → capitulation → policy response → new leadership) — the phase dictates
  whether a buy is suicide or the trade of the decade.

---

## 3. How the regime tilts short-term vs long-term

Same fact, different directions by horizon — say both.

**Short-term (Tactical sleeve):**
- Treat FOMC / CPI / NFP as **binary events**: don't open a fresh swing into one unless it's an
  explicit event play. Flag any macro print inside the intended hold, as the rubric flags earnings.
- Rising yields / VIX → tighten stops, cut size, prefer mean-reversion at support over chasing
  breakouts. Falling VIX off a spike → the house-view entry window.
- The tape's trend matters more short-term than long: don't fight a sharply falling SPX/QQQ with
  a new long, however good the chart.

**Long-term (Core sleeve):**
- The rate *path* beats any single meeting. A credible **cutting cycle** (dot plot down) = tailwind
  for long-duration quality and rate-sensitive sectors — accumulate on weakness. **Higher-for-longer**
  compresses multiples — demand a bigger valuation margin of safety before buying growth.
- Macro-driven washouts are *opportunities* for Core — the mentor method buys quality when
  forced/emotional flows (not fundamentals) set the price. A great business cheap because the
  *market* (not the *company*) is scared is the Core setup. "The macro is why it's cheap, and why
  it re-rates."
- Long-term theses must be robust to the regime, not dependent on one Fed outcome. A Core idea
  that only works if the Fed cuts three times is fragile and overfit (`skills/decision/strategies.md`).

---

## 4. Company strategy & roadmap sit *inside* the macro frame

Macro sets the discount rate; the **company's own strategy and roadmap** determine whether it can
grow *through* that rate. The Fundamental Analyst supplies these (`skills/decision/roles.md`); the
macro lens contextualizes: a strong roadmap into an easing cycle is a double tailwind; the same
into a tightening cycle needs self-funding and pricing power to survive. Note whether growth is
**rate-sensitive** (unprofitable, long-duration cash flows — hurt by high rates) or
**rate-resilient** (profitable, cash-generative, pricing power).

---

## 5. Name it in every recommendation

Every idea carries a one-line **macro tilt**: the regime, whether it's a tailwind or headwind for
*this* name on *each* horizon, and any macro event inside the hold. Shape:

> *Macro tilt:* Higher-for-longer regime (10yr ~4.6% and firm, VIX ~14, FOMC in 9 days). Headwind
> for the multiple short-term — stage the entry to fill after the meeting. Long-term
> neutral-to-positive: profitable and self-funding, less rate-sensitive than peers; a 2026 cutting
> cycle would be upside, not a dependency.

Legibility is the goal: the user thinks in rates, yields, and rotation
(`skills/playbook/house-views.md`), so state macro reasoning in those terms — and always
**validate the heuristic against live data** for the specific name and day before trusting it.

