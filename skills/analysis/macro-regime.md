# Macro & Regime Lens — the Top-Down Filter

A stock doesn't trade in a vacuum. The single most common way a technically clean,
fundamentally sound idea still loses money is that the **macro regime** was against it —
the Fed was hiking into it, yields were spiking, or the tape was in risk-off. This lens
sits *above* the single-name analysis: it sets the weather the trade has to sail in, and
it tilts the desk's short-term and long-term posture differently.

Every desk run establishes the regime **once**, up front (Desk Head / Sentiment step),
and every recommendation then states which way the macro wind is blowing for it. This
operationalizes the user's own rate/yield house views (`skills/playbook/house-views.md`) into a checklist.

---

## 1. What to read, and where to get it

Use `WebSearch` for anything dated (cite sources), and the Robinhood connector for live
index/quote data. Pull these each run:

| Factor | Why it matters | How to get it |
|---|---|---|
| **Fed policy rate + stance** | The risk-free rate anchors every valuation; the direction (hiking/cutting/hold) sets the tape's bias. | WebSearch: "current fed funds target rate", latest FOMC statement. |
| **Fed dot plot / rate projections (SEP)** | The market trades the *path*, not just today's rate. The dot plot shows where the FOMC expects rates to go. | WebSearch the most recent Summary of Economic Projections; note the median dot for year-end. |
| **Next FOMC meeting + announcement date** | A rate decision is a market-wide binary event — a macro earnings date. Don't open fresh short-term risk right into it. | WebSearch "next FOMC meeting date"; the calendar is fixed (8/yr). |
| **Fed speakers / minutes / Jackson Hole** | Between meetings, speeches and minutes move the rate path. | WebSearch recent Fed commentary; flag if a major speech is inside the hold. |
| **CPI / PCE / jobs (NFP) prints** | These *drive* the rate path — a hot CPI can reprice the whole curve in a day. | WebSearch the economic calendar for the next CPI/PCE/NFP date; treat like an FOMC event. |
| **2yr & 10yr Treasury yields** | 2yr ≈ the market's Fed-path bet; 10yr ≈ the discount rate for long-duration/growth equities. Rising yields = headwind, esp. for high-multiple names. | Connector `get_index_quotes` / `get_indexes` (look for TNX/10-yr, or WebSearch the yield). |
| **Yield-curve shape (10y−2y)** | Inversion (2y>10y) = recession signal; a re-steepening off deep inversion often precedes trouble. | Compute from the two yields. |
| **MOVE index (bond vol)** | Rising bond-market volatility precedes equity stress. | WebSearch "MOVE index level". |
| **VIX (equity vol / fear)** | Regime thermostat. House view: high VIX = better *entries* but size smaller. | Connector index quote or WebSearch. |
| **Market trend & breadth** | Is SPX/QQQ above/below its 50/200-day? Are advancers beating decliners? A great stock in a tape below its 200-DMA fights gravity. | Pull SPY/QQQ historicals → `indicators.py`; WebSearch breadth if needed. |
| **Credit spreads (HY OAS)** | Widening high-yield spreads = risk-off brewing before equities notice. | WebSearch "high yield credit spread" if a risk-off read is forming. |

If a factor can't be fetched, say so — don't invent a number. A regime read with three
solid inputs beats one with six guessed ones.

---

## 2. Classify the regime

Synthesize the inputs into one of a few regimes, and write it in one line at the top of
the run. The regime tilts *which ideas even belong on the page*:

- **Risk-on / easing:** Fed on hold or cutting, yields stable/falling, VIX low-to-mid,
  indices above rising 200-DMA, breadth healthy. → Favor growth, high-beta, breakouts;
  the Tactical sleeve can be more aggressive; long-duration/high-multiple names OK.
- **Risk-off / tightening:** Fed hiking or hawkish, yields spiking, VIX elevated/rising,
  indices below 200-DMA, breadth weak, credit widening. → Defense first. Lean financials
  and healthcare (house view), quality balance sheets, dividends; shrink Tactical size;
  raise the cash allocation; be very selective on high-multiple growth.
- **Transition / event-risk window:** an FOMC/CPI/NFP print inside a few days, or a
  post-inversion re-steepening. → Reduce fresh short-term exposure into the event; stage
  limit orders to fill *after* the print; keep dry powder.
- **Washout / capitulation:** VIX spiking hard, broad indiscriminate selling. → The
  house-view + mentor-method buy zone — deploy cash into *quality* names reclaiming their
  30-day MA, size up gradually, don't catch the knife on the first red day.
- **Crisis / regime-shock:** a *structural* break, not a dip — VIX >30–40+ and sticky,
  credit spreads blowing out, cross-asset correlation → 1 (forced de-leveraging), circuit
  breakers, and a regime catalyst (bursting bubble, credit seizure, exogenous shock like a
  pandemic/war, or a policy rupture like a tariff regime or market-moving social-media
  policy). → **Switch to `skills/analysis/crisis-playbook.md`.** Defense first (no leverage,
  raise cash, liquidity + smaller size), then disciplined offense (barbell of cash/quality
  + convex asymmetric bets, buy survivors in tranches, own the shock's direct
  beneficiaries). Name the **crisis type** and the **phase** (de-risk → capitulation →
  policy response → new leadership) — the phase dictates whether a buy is suicide or the
  trade of the decade.

---

## 3. How the regime tilts short-term vs long-term

The same macro fact points different directions on different horizons — say both.

**Short-term (Tactical sleeve):**
- Treat FOMC / CPI / NFP dates as **binary events**: don't open a fresh swing right into
  one unless it's an explicit event play the user asked for. Flag any macro print inside
  the intended hold, exactly as the rubric flags earnings.
- Rising yields / rising VIX → tighten stops, cut size, prefer mean-reversion at support
  over chasing breakouts. Falling VIX off a spike → the house-view entry window.
- The tape's own trend matters more short-term than long: don't fight a sharply falling
  SPX/QQQ with a new long, however good the single-name chart.

**Long-term (Core sleeve):**
- The rate *path* matters more than any single meeting. A credible **cutting cycle** ahead
  (dot plot trending down) is a tailwind for long-duration quality and rate-sensitive
  sectors — a reason to accumulate on weakness. A **higher-for-longer** path compresses
  multiples — demand a bigger valuation margin of safety before buying growth.
- Macro-driven washouts are *opportunities* for the Core sleeve, not reasons to avoid —
  the mentor method buys quality when forced/emotional flows (not fundamentals) set the
  price. A great business cheap because the *market* (not the *company*) is scared is the
  Core setup. Say "the macro is the reason it's cheap, and the reason it re-rates."
- Long-term theses should be robust to the regime, not dependent on one Fed outcome. If a
  Core idea only works if the Fed cuts three times, that's a fragile, overfit thesis
  (`skills/decision/strategies.md`).

---

## 4. Company strategy & roadmap sit *inside* the macro frame

Macro sets the discount rate; the **company's own strategy and product roadmap** determine
whether it can grow *through* that rate. The Fundamental Analyst supplies these (see
`skills/decision/roles.md`); the macro lens contextualizes them: a company executing a strong roadmap into
an easing cycle is a double tailwind; the same roadmap into a tightening cycle needs
self-funding and pricing power to survive. Note when a name's growth is **rate-sensitive**
(unprofitable, long-duration cash flows — hurt by high rates) vs **rate-resilient**
(profitable, cash-generative, pricing power).

---

## 5. Name it in every recommendation

Every surfaced idea must carry a one-line **macro tilt**: which regime we're in, whether it
is a tailwind or headwind for *this* name on *each* horizon, and any macro event inside the
hold. Examples of the shape:

> *Macro tilt:* Higher-for-longer regime (10yr ~4.6% and firm, VIX ~14, FOMC in 9 days).
> Headwind for the multiple short-term — stage the entry to fill after the meeting.
> Long-term neutral-to-positive: profitable and self-funding, so less rate-sensitive than
> peers; a 2026 cutting cycle would be upside, not a dependency.

Legibility is the goal: the user thinks in rates, yields, and rotation (`skills/playbook/house-views.md`),
so the desk's macro reasoning should be stated in exactly those terms — and always
**validate the heuristic against the live data** for the specific name and day before
trusting it.
