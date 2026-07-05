# Quant Analysis — Levels, Indicators, and Edge Math

This is the Quant role's playbook: how to turn the raw output of `scripts/indicators.py`
into a **defensible read of where price is likely to find support (the floor) and
resistance (the upper "pressure")**, and how to convert that into a numeric edge the
CIO gate can trust. The whole point is to replace "the chart looks bullish" with
levels, volatility-scaled risk, and a reward:risk number.

Run the script first — never eyeball. Feed it ~1yr of daily bars:
`python3 scripts/indicators.py <historicals.json> --price <live quote>`. Pass the live
quote via `--price` when the market is open so the support/resistance map is centered
on the real current price, not yesterday's close.

---

## 1. Support & resistance — reading the "pressure" map

`support_resistance` in the output is the core deliverable the user asked for.

- **`nearest_support`** = the closest price *below* current where buyers have stepped in
  before (the lower floor). **`nearest_resistance`** = the closest price *above* where
  sellers have capped it before (the **upper pressure**). Each carries:
  - `level` — the clustered price zone (not a single tick; it's a *zone*).
  - `touches` — how many independent swing pivots formed it. **More touches = stronger
    level.** A 3-touch resistance is real overhead supply; a 1-touch level is soft.
  - `distance_pct` — how far the level sits from the current price. Small distance to
    overhead resistance = little room to run; small distance to support = tight risk.
- **`resistance_ladder` / `support_ladder`** — the next several levels up and down. Use
  these to place scale-out targets (sell into each resistance rung) and to know where
  the next floor is if the first support fails.
- **How levels are built:** fractal swing highs/lows (a pivot is a bar whose high/low is
  the extreme of the surrounding window), then clustered within ~0.6×ATR so nearby
  pivots merge into one zone. This is why levels are volatility-aware: a $400 stock and a
  $4 stock both get sensible zones.

**Confluence is what makes a level tradable.** A price level is high-conviction when
several independent methods point to the same area. Cross-check the swing-based S/R
against the other level sources in the output:
- **Moving averages** (`sma_20/50/200`) act as dynamic S/R — price often bounces off or
  stalls at a rising SMA50/200. The house view "reclaim and hold the 30-day MA after a
  washout" lives here (SMA20 ≈ the ~30-session line).
- **Bollinger bands** — the lower band is a mean-reversion support in a range; the upper
  band is stretch/resistance. `percent_b` <0 or >1 = price outside the band (extended).
- **Pivot points** (`P/R1-3/S1-3`) — classic floor-trader levels from the last bar; the
  Tactical sleeve uses these for near-term intraday/swing references.
- **Fibonacci** retracements — after a big move, 0.382 / 0.5 / 0.618 are the zones a
  pullback commonly finds support (in an uptrend) or a bounce fails (in a downtrend).
- **52-week high/low and round numbers** — psychological levels that concentrate orders.

Report a level as **strong** when swing-touches + at least one of {MA, pivot, fib,
round number} coincide within a tolerance. Report it as **soft** when only one method
sees it. Say which in the writeup — "resistance ~$129 is strong (3 swing touches + falling
SMA50 + prior gap)" is what a quant read looks like.

---

## 2. The indicator stack — what each one is *for*

Don't dump every number. Each indicator answers one question; use them as a layered filter.

| Layer | Indicator (in output) | Question it answers | Reading |
|---|---|---|---|
| **Trend** | SMA 20/50/200, EMA 12/26 | Which direction, and is it aligned? | Price>SMA50>SMA200 = clean uptrend. Crosses (golden/death) mark regime changes. |
| **Trend strength** | ADX / +DI / −DI | Is there a trend at all, or is it chop? | ADX>25 = trending (trade with it); ADX<20 = range (fade extremes, mean-revert). Direction from +DI vs −DI. |
| **Momentum** | RSI(14) | Over/under-stretched, and diverging? | >70 overbought, <30 oversold. **Divergence** (price new high, RSI lower high) warns of exhaustion. |
| **Momentum** | MACD(12,26,9) | Is momentum turning? | `fresh_cross` = a same-day signal-line cross (an actionable inflection), not just "bullish". |
| **Momentum** | Stochastic %K/%D | Where in the recent range? | <20 oversold / >80 overbought; %K crossing %D up from oversold = a swing trigger. |
| **Volatility** | ATR(14), `atr_pct` | How much does it move per day? | Sizes stops/targets (below). `atr_pct` tells you if it's a 1%/day or 6%/day name. |
| **Volatility** | Bollinger(20,2), `width_pct` | Squeeze or expansion? | Narrow width = coiled (breakout pending); wide = already moving. |
| **Volume** | Relative volume, OBV | Is the move confirmed by participation? | Move on `rel_volume`>1.5 = conviction; OBV `accumulation`/`distribution` = who's winning. House view: volume expansion → reversal/breakout tell. |

**Regime dictates the playbook.** Read ADX first:
- **Trending (ADX>25):** trade *with* the trend. Buy pullbacks to support/rising MA; sell
  rips to resistance only to trim. Breakouts through resistance are more likely to hold.
- **Range/chop (ADX<20):** mean-revert. Buy near support, sell near resistance, fade RSI
  extremes. Breakouts more likely to fail — demand volume confirmation.

---

## 3. From levels to a trade — the edge math

`trade_scaffold` in the output is a **starting frame**, not the final order. It computes a
long-side stop and target so the PM has a volatility-anchored default; the PM then adjusts.

- **Stop = volatility- and structure-aware.** Default reference = the tighter of
  `1.5×ATR` below entry or just under the nearest structural support. This keeps the stop
  outside normal daily noise (an ATR-tight stop gets shaken out) while respecting the real
  floor. A stop is a **dollar statement of risk**, not a chart doodle (see `skills/decision/strategies.md`).
- **Target = the upper pressure.** Primary target defaults to the nearest resistance zone —
  that's where the move is statistically likely to stall. Stack additional targets on the
  `resistance_ladder` for scale-outs.
- **Reward:Reward = `reward_risk`.** `(target − entry) / (entry − stop)`. **The hard gate
  is RR ≥ 2.0 net of costs** (`skills/decision/review-rubric.md`). If the scaffold shows RR<2 — usually
  because price is right under heavy resistance — that is the quant telling you *the entry
  is bad here*; wait for a pullback to support (better entry, more room to the ceiling) or
  pass. Don't force it by widening the target past a real level.

**Expected value, not just RR.** RR is the payoff ratio; pair it with a rough hit
probability to get EV: `EV ≈ p_win × reward − (1 − p_win) × risk`. Anchor `p_win` in the
setup quality and regime, and stay humble:
- Trend-continuation pullback in a strong uptrend (ADX>25, bouncing off rising SMA + support
  confluence, volume confirming): higher base rate (~50–60%).
- Counter-trend / knife-catch / breakout in chop: lower (~35–45%) — demand a bigger RR to
  compensate. A 3:1 RR at 40% wins is still strongly positive EV; a 1.5:1 at 45% is not.
- **Validate the threshold against this name's own history** (`skills/decision/strategies.md`): before
  leaning on "RSI<30 bounces here," glance at how it actually behaved at past oversold
  points via the historicals. If the pattern didn't hold, distrust it.

**Position size follows the stop, not the other way around.** Given the per-idea 2% risk
cap: `shares = (0.02 × account) / (entry − stop)`. Then check the result against the
concentration cap (`skills/decision/review-rubric.md`). Show the math.

---

## 4. The quant writeup (what the role hands the desk)

For each candidate the Quant should output a tight block the PM and CIO can act on:

1. **Regime & trend:** primary trend (MA alignment), ADX strength/direction, one line.
2. **Setup classification:** trend-continuation / breakout / pullback / mean-reversion / none.
3. **Lower support:** nearest support zone + strength (touches + confluence) + distance.
4. **Upper pressure:** nearest resistance zone + strength + distance. Name the ceiling.
5. **Momentum & volume confirmation:** RSI/MACD/Stoch state, any divergence; is volume
   confirming or diverging (OBV)?
6. **Levels-based trade frame:** entry zone, ATR/structure stop, target ladder, and the
   **RR number** — plus a one-line EV/probability sanity check.
7. **Timing verdict:** *now* / *wait for level X* / *no*. Be willing to say "good name,
   wrong price — wait for the pullback to $X."

Separate **fact** (the computed numbers) from **judgment** (your interpretation), and flag
degraded data: if the feed had no high/low, the summary carries a WARNING and ATR/ADX/Stoch/
S-R are approximated from closes — say so and lower confidence accordingly.
