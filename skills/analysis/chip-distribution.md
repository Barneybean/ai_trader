# Accumulation, Distribution & Chip Distribution (institutional footprints)

Price is moved by **institutions accumulating and distributing** — and retail loses by getting
**shaken out during accumulation** and **holding the bag during distribution.** The desk's job
is to read the footprints: which phase a stock is in, where the "chips" (shares by holder
cost-basis) are concentrated, whether smart money is quietly buying or unloading, and — the
mentor's specialty — **anticipating the shakeouts ("chip washes" / 洗盘) that come before a
markup, and accumulating into them instead of being flushed out.** This is a *probabilistic
pattern read*, always confirmed with volume/OBV and fused with the fundamental thesis — a wash
in a broken business is just a decline.

Pairs with `skills/analysis/quant-levels.md` (the levels/volume engine), `skills/edge/smart-money.md` (insider
buying *is* an accumulation footprint), and `skills/edge/variant-perception.md`.

---

## First identify the PHASE (the same setup is a buy or a trap depending on it)

The Wyckoff cycle: **Accumulation → Markup → Distribution → Markdown.**
- **Accumulation** — basing *after* a decline; institutions absorb supply. Range-bound, dull,
  frustrating. *Buy the shakeouts.*
- **Markup** — trend up; chips have transferred to higher cost. *Ride; add on pullbacks to
  support.*
- **Distribution** — topping *after* a run; institutions unload into strength. Churn at highs.
  *Trim/avoid.*
- **Markdown** — trend down; supply overwhelms. *Avoid; don't average a falling knife.*

Call the phase FIRST. Buying a "cheap" name in markdown is catching a knife; buying a dull base
in late accumulation is the setup.

## Chip / cost-basis distribution (筹码分布)

The distribution of shares by the price at which holders bought. What to read:
- **Concentration vs. dispersion.** A **single dense peak** (筹码集中) after a long base = supply
  absorbed at one cost zone = accumulation likely complete = bullish. **Multiple peaks / heavy
  overhead** = trapped holders (套牢盘) above = resistance on the way up.
- **Chip migration.** When low-cost chips at the base **move up** (via turnover/换手) into higher
  cost zones, the markup is underway — early holders sold to new higher-cost buyers, absorbing
  float. Concentration *at the bottom* that won't break = accumulation still in progress.
- **Overhead supply.** Dense chips above current price = sellers waiting to "get out even" =
  each rally meets supply until it's absorbed. Light overhead = clean runway.

**The desk computes it — `scripts/indicators.py` → `chip_distribution`.** Rather than only
proxying, the script builds an actual 筹码分布 from volume-at-price: it walks the daily bars,
distributes each day's volume across that day's range, and **decays older chips by turnover**
(exact when you pass `--float <shares>`; a recency half-life otherwise) so the profile reflects
who holds *now*. Read these fields:
- **`main_cost_basis`** — the price zone holding the most chips (主力成本 / where big money's
  average sits). Below price = a support shelf and a profit cushion; **above price = overhead
  supply** (the recent crowd trapped, capping rallies).
- **`secondary_peaks`** + **`high_volume_nodes`** — the other dense shelves; these are the
  strongest S/R and the natural scale-in / scale-out rungs.
- **`pct_in_profit` (获利盘) vs `pct_trapped_overhead` (套牢盘)** — how much float is sitting in
  gain vs. underwater above price. Heavy trapped-overhead = every bounce meets "get me out even"
  selling until absorbed.
- **`concentration`** — **`concentrated`** (a tight single peak) after a long base = supply
  absorbed = accumulation likely complete = bullish; **`dispersed`** = chips spread across a wide
  range = still churning / late-cycle = *not* a coiled base. This one field often separates a
  ready-to-launch accumulation from an extended name that just looks cheap.

Cross-check the computed profile with **OBV** (net volume accumulating vs distributing) and the
**support/resistance swing-touch clustering** — when the chip peak, a multi-touch S/R shelf, and
an OBV turn all coincide, the read is high-confidence. High turnover at a level = chips
transferring there (accumulation if price holds, distribution if it stalls at highs).

## Accumulation tells (buy the base)

- Prior downtrend **exhausting**; selling climaxes then price refuses to make new lows.
- **Volume dries up** in the base (sellers exhausted), then **expands on up-days** (demand).
- **Higher lows**, narrowing range, long dull sideways action.
- **OBV rising while price is flat** — the classic "smart money accumulating under cover" tell.
- **Springs/shakeouts that quickly reclaim** support (see below).
- **Insider open-market cluster buying** at the base (`skills/edge/smart-money.md`) — a direct
  footprint.

## Distribution tells (trim / avoid)

- **Churning at highs on heavy volume with no price progress.**
- **Upthrusts / failed breakouts** (UTAD): pokes above resistance that fail back into the range.
- **OBV divergence** — price makes highs, OBV doesn't (volume not confirming).
- **Heavy discretionary insider selling into strength** — the Robinhood-at-$150 pattern.

## The shakeout / "chip wash" (洗盘) — the mentor's edge

**Why institutions do it:** before marking a stock up they **shake out weak/low-cost holders**
to (a) reduce overhead supply that would cap the rally and (b) accumulate more cheaply. So a
base is rarely clean — expect **deliberate dips that look like breakdowns.**

**Signature of a wash (vs. a real breakdown):**
- A sharp dip **breaks an obvious support / round number / recent low** — *bear trap* — then
  **quickly reclaims** it (a Wyckoff **spring**).
- The dip comes on **declining or non-confirming volume**, or volume spikes but price snaps
  back same/next day (absorption).
- **OBV holds / doesn't break down**; higher-timeframe base intact; the fundamental thesis
  unbroken.
- Often **repeated** — "a couple more washes" — a long, boring, frustrating base with multiple
  fakeouts that flush impatient holders.

**How to trade it:** *expect* the washes and **scale in on them** rather than being shaken out.
Confirm with the reclaim (spring) + OBV holding + thesis intact. Pre-commit invalidation so a
wash-read doesn't become a bag-hold: a **real markdown** — lower lows on *rising* volume, OBV
collapsing, thesis broken — is NOT a wash; stand aside.

## Timing the markup (when the "boost" comes)

Markup is near when accumulation looks **complete**: chips concentrated at the base (single
peak), volume dried then **expanding on up-moves (sign of strength)**, price **reclaims and holds
above the base and the 50-DMA**, OBV breaks to new highs, overhead supply absorbed. "Expect a
couple more washes before it's boosted" = the base is **immature** — institutions are still
accumulating; be patient and buy the flushes.

## The judgment to produce (per name)

1. **Phase call** — accumulation / markup / distribution / markdown, with the evidence
   (price structure + volume + OBV + chip/S-R concentration).
2. **Chip read** — where the concentration and overhead supply sit; is the base holding.
3. **Wash vs. markdown** — are more shakeouts likely (base immature) or is markup near (base
   complete)? Or is this a genuine markdown to avoid?
4. **Accumulation plan** — the scale-in levels to buy the washes, the spring-reclaim
   confirmation, and the invalidation (base failure).

## Worked example — NKE (the mentor's read)

After a long markdown from ~$80 to the low-$40s, NKE is **basing** (accumulation) — and the
**insider cluster buying at $42–43** (CEO Hill, dir. Cook, ex-Intel-CEO Swan) is a textbook
accumulation footprint. The mentor's institutional-practice read: **expect a couple more chip
washes in the low-$40s / high-$30s** — deliberate flushes below the obvious $42/$40 supports to
shake out weak hands and absorb overhead — **before** the markup. Accumulate *into* those washes.
The markup thesis (multi-quarter earnings turnaround + **2026 World Cup** brand tailwind + the
**DTC→wholesale pivot** under a CEO with deep wholesale roots + a **CFO change** Wall Street
should welcome) targets **~$90–100 over ~6 months** once accumulation completes and NKE reclaims
and holds. **Invalidation** (markdown, not wash): a weekly close well below $40 on *heavy*
volume with OBV breaking down.

**Guardrails:** this lens is probabilistic — always confirm with volume + OBV, distinguish a
wash from a markdown, and only apply it where the fundamental thesis supports accumulation.
