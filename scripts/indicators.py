#!/usr/bin/env python3
"""
Technical + quant indicators for the trading-desk skill.

Pure Python + standard library only (no pandas/numpy/TA-Lib required) so it runs
anywhere without an install step. Computes what a quant analyst needs to read
trend, momentum, volatility, volume — and, most importantly for this desk, the
concrete **support (lower) and resistance (upper "pressure") price levels** an
idea trades against.

Usage:
    python3 indicators.py <historicals.json>
    cat historicals.json | python3 indicators.py -
    python3 indicators.py <historicals.json> --price 391.20   # override "current" price

Input: either
  (a) the raw Robinhood connector historicals response (the script hunts for the
      list of bars under common keys like data/results/historicals), or
  (b) a plain JSON array of bars, each an object with at least "close"
      (optional: open, high, low, volume, date/begins_at).

Output: JSON with the latest indicator values, a support/resistance map (nearest
support below and nearest resistance above the current price, with strength and
distance), ATR-based stop/target scaffolding, and a plain-English signal summary.

Everything downstream (the Quant role, the trade plan) should read levels from
this output rather than eyeballing a chart. See skills/analysis/quant-levels.md for
how to interpret it.
"""

import argparse
import json
import sys


# --------------------------------------------------------------------------- #
# Input parsing (robust to the connector's nested response shapes)
# --------------------------------------------------------------------------- #

def _looks_like_bar(d):
    """A bar dict carries a close price; a wrapper dict (per-symbol result) does not."""
    return isinstance(d, dict) and any(k in d for k in ("close", "close_price", "c"))


def _drop_interpolated(bars):
    """Skip gap-fill bars (interpolated=true carry no new info)."""
    return [b for b in bars if not (isinstance(b, dict) and b.get("interpolated"))]


def _find_bars(obj):
    """Locate the list of price bars inside an arbitrary connector response.

    Handles the Robinhood shape data.results[].bars: 'bars'/'historicals' are the
    actual bar containers and are checked before 'results'/'data', which wrap
    per-symbol result objects that must be drilled into rather than returned as-is.
    """
    if isinstance(obj, list):
        if not obj:
            return None
        # A list of bar-like dicts (or raw numbers) is the series we want.
        if _looks_like_bar(obj[0]) or isinstance(obj[0], (int, float, str)):
            return _drop_interpolated(obj)
        # Otherwise it's a list of wrapper objects (e.g. per-symbol results) — drill in.
        for item in obj:
            found = _find_bars(item)
            if found:
                return found
        return None
    if isinstance(obj, dict):
        # The real bar container first, so we don't return a results/data list by mistake.
        for key in ("bars", "historicals", "results", "data", "items"):
            if key in obj:
                found = _find_bars(obj[key])
                if found:
                    return found
        # Fallback: search any nested value.
        for v in obj.values():
            found = _find_bars(v)
            if found:
                return found
    return None


def _to_float(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _field(b, *names):
    """Pull the first present, coercible field from a bar dict."""
    if not isinstance(b, dict):
        return None
    for n in names:
        if n in b:
            v = _to_float(b[n])
            if v is not None:
                return v
    return None


def _ohlcv(bars):
    """Extract aligned open/high/low/close/volume lists. High/low fall back to close
    when a feed only carries closes, so downstream math still runs (degraded)."""
    o, h, l, c, v = [], [], [], [], []
    for b in bars:
        if isinstance(b, dict):
            close = _field(b, "close", "close_price", "c")
            if close is None:
                continue
            c.append(close)
            o.append(_field(b, "open", "open_price", "o") or close)
            h.append(_field(b, "high", "high_price", "h") or close)
            l.append(_field(b, "low", "low_price", "l") or close)
            v.append(_field(b, "volume", "v") or 0.0)
        else:
            close = _to_float(b)
            if close is None:
                continue
            c.append(close); o.append(close); h.append(close); l.append(close); v.append(0.0)
    return o, h, l, c, v


# --------------------------------------------------------------------------- #
# Core indicators
# --------------------------------------------------------------------------- #

def sma(values, period):
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def ema_series(values, period):
    if len(values) < period:
        return None
    k = 2 / (period + 1)
    e = sum(values[:period]) / period  # seed with SMA of first `period` values
    series = [e]
    for x in values[period:]:
        e = x * k + e * (1 - k)
        series.append(e)
    return series


def ema(values, period):
    s = ema_series(values, period)
    return s[-1] if s else None


def rsi(values, period=14):
    if len(values) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(values)):
        change = values[i] - values[i - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    avg_gain = sum(gains[:period]) / period  # Wilder's smoothing
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def macd(values, fast=12, slow=26, signal=9):
    if len(values) < slow + signal:
        return None
    fast_s = ema_series(values, fast)
    slow_s = ema_series(values, slow)
    n = min(len(fast_s), len(slow_s))
    macd_line = [fast_s[-n + i] - slow_s[-n + i] for i in range(n)]
    sig_s = ema_series(macd_line, signal)
    if not sig_s:
        return None
    macd_val = macd_line[-1]
    signal_val = sig_s[-1]
    # histogram sign flip vs the prior bar = a fresh cross (momentum inflection)
    prev_hist = macd_line[-2] - sig_s[-2] if len(sig_s) >= 2 else None
    hist = macd_val - signal_val
    fresh = None
    if prev_hist is not None:
        if prev_hist <= 0 < hist:
            fresh = "bullish_cross"
        elif prev_hist >= 0 > hist:
            fresh = "bearish_cross"
    return {
        "macd": round(macd_val, 4),
        "signal": round(signal_val, 4),
        "histogram": round(hist, 4),
        "cross": "bullish" if macd_val > signal_val else "bearish",
        "fresh_cross": fresh,
    }


def bollinger(values, period=20, mult=2):
    if len(values) < period:
        return None
    window = values[-period:]
    mid = sum(window) / period
    var = sum((x - mid) ** 2 for x in window) / period
    sd = var ** 0.5
    upper = mid + mult * sd
    lower = mid - mult * sd
    last = values[-1]
    pct_b = (last - lower) / (upper - lower) if upper != lower else None
    return {
        "middle": round(mid, 4),
        "upper": round(upper, 4),
        "lower": round(lower, 4),
        "percent_b": round(pct_b, 3) if pct_b is not None else None,
        "width_pct": round((upper - lower) / mid * 100, 2) if mid else None,
    }


def stochastic(highs, lows, closes, k_period=14, d_period=3):
    """Stochastic oscillator %K/%D — where price sits in its recent range (0–100)."""
    if len(closes) < k_period + d_period:
        return None
    ks = []
    for i in range(k_period - 1, len(closes)):
        hh = max(highs[i - k_period + 1:i + 1])
        ll = min(lows[i - k_period + 1:i + 1])
        ks.append(100 * (closes[i] - ll) / (hh - ll) if hh != ll else 50.0)
    if len(ks) < d_period:
        return None
    k_now = ks[-1]
    d_now = sum(ks[-d_period:]) / d_period
    zone = "overbought" if k_now > 80 else "oversold" if k_now < 20 else "neutral"
    return {"k": round(k_now, 2), "d": round(d_now, 2), "zone": zone}


def _true_ranges(highs, lows, closes):
    tr = []
    for i in range(1, len(closes)):
        tr.append(max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        ))
    return tr


def atr(highs, lows, closes, period=14):
    """Average True Range (Wilder) — the stock's typical daily dollar range.
    The desk sizes stops and targets in ATR multiples so they respect real
    volatility instead of arbitrary round numbers."""
    tr = _true_ranges(highs, lows, closes)
    if len(tr) < period:
        return None
    a = sum(tr[:period]) / period
    for x in tr[period:]:
        a = (a * (period - 1) + x) / period
    return a


def adx(highs, lows, closes, period=14):
    """ADX + directional movement (Wilder). ADX measures trend STRENGTH (not
    direction): >25 trending, <20 chop/range. +DI vs -DI gives direction."""
    if len(closes) < 2 * period + 1:
        return None
    plus_dm, minus_dm, tr = [], [], []
    for i in range(1, len(closes)):
        up = highs[i] - highs[i - 1]
        down = lows[i - 1] - lows[i]
        plus_dm.append(up if (up > down and up > 0) else 0.0)
        minus_dm.append(down if (down > up and down > 0) else 0.0)
        tr.append(max(highs[i] - lows[i], abs(highs[i] - closes[i - 1]), abs(lows[i] - closes[i - 1])))
    if len(tr) < period:
        return None

    def _wilder(seq):
        s = sum(seq[:period])
        out = [s]
        for x in seq[period:]:
            s = s - s / period + x
            out.append(s)
        return out

    tr_s = _wilder(tr)
    pdm_s = _wilder(plus_dm)
    mdm_s = _wilder(minus_dm)
    dxs = []
    for i in range(len(tr_s)):
        if tr_s[i] == 0:
            continue
        pdi = 100 * pdm_s[i] / tr_s[i]
        mdi = 100 * mdm_s[i] / tr_s[i]
        denom = pdi + mdi
        dxs.append(100 * abs(pdi - mdi) / denom if denom else 0.0)
    if len(dxs) < period:
        return None
    adx_val = sum(dxs[-period:]) / period
    pdi_last = 100 * pdm_s[-1] / tr_s[-1] if tr_s[-1] else None
    mdi_last = 100 * mdm_s[-1] / tr_s[-1] if tr_s[-1] else None
    return {
        "adx": round(adx_val, 2),
        "plus_di": round(pdi_last, 2) if pdi_last is not None else None,
        "minus_di": round(mdi_last, 2) if mdi_last is not None else None,
        "regime": "trending" if adx_val >= 25 else "range/chop" if adx_val < 20 else "developing",
        "direction": ("up" if (pdi_last or 0) > (mdi_last or 0) else "down") if pdi_last is not None else None,
    }


def obv(closes, volumes):
    """On-Balance Volume + a short-vs-long trend read. Rising OBV under flat/up
    price = accumulation; falling OBV = distribution (volume confirmation)."""
    if not volumes or sum(volumes) == 0:
        return None
    o = [0.0]
    for i in range(1, len(closes)):
        if closes[i] > closes[i - 1]:
            o.append(o[-1] + volumes[i])
        elif closes[i] < closes[i - 1]:
            o.append(o[-1] - volumes[i])
        else:
            o.append(o[-1])
    trend = None
    if len(o) >= 20:
        recent = o[-5:]
        base = o[-20:-15] if len(o) >= 20 else o[:5]
        trend = "accumulation" if sum(recent) / len(recent) > sum(base) / len(base) else "distribution"
    return {"obv": round(o[-1], 0), "trend": trend}


def volume_read(volumes, period=20):
    """Is today's volume expanding vs its average? (house view: volume expansion
    signals reversal/confirmation.)"""
    if not volumes or len(volumes) < period + 1 or sum(volumes[-period:]) == 0:
        return None
    avg = sum(volumes[-period - 1:-1]) / period
    last = volumes[-1]
    ratio = last / avg if avg else None
    return {
        "last": round(last, 0),
        "avg_20": round(avg, 0),
        "rel_volume": round(ratio, 2) if ratio else None,
        "state": ("expanding" if ratio and ratio > 1.5 else "contracting" if ratio and ratio < 0.6 else "normal"),
    }


# --------------------------------------------------------------------------- #
# Support / Resistance — the "upper pressure & lower support" map
# --------------------------------------------------------------------------- #

def _swing_points(highs, lows, k=3):
    """Fractal swing highs/lows: bar i is a swing high if its high is the max of
    the [i-k, i+k] window (and symmetrically for lows). k=3 catches meaningful
    pivots without over-fitting noise."""
    sh, sl = [], []
    n = len(highs)
    for i in range(k, n - k):
        win_h = highs[i - k:i + k + 1]
        win_l = lows[i - k:i + k + 1]
        if highs[i] == max(win_h) and highs[i] >= highs[i - 1] and highs[i] >= highs[i + 1]:
            sh.append(highs[i])
        if lows[i] == min(win_l) and lows[i] <= lows[i - 1] and lows[i] <= lows[i + 1]:
            sl.append(lows[i])
    return sh, sl


def _cluster_levels(levels, tol):
    """Group price levels within `tol` (absolute $) into zones; strength = touches."""
    if not levels:
        return []
    levels = sorted(levels)
    clusters = [[levels[0]]]
    for x in levels[1:]:
        if x - clusters[-1][-1] <= tol:
            clusters[-1].append(x)
        else:
            clusters.append([x])
    out = []
    for c in clusters:
        out.append({"level": round(sum(c) / len(c), 2), "touches": len(c)})
    return out


def support_resistance(highs, lows, closes, price, atr_val):
    """Build the S/R map around `price`.

    Zones come from clustered fractal swing highs/lows (strength = # of touches).
    Cluster tolerance scales with volatility (~0.6*ATR, floored at 0.5% of price)
    so a $400 stock and a $4 stock both get sensible zones. Returns the nearest
    support below and nearest resistance above, plus the full ranked ladders."""
    if not price:
        return None
    tol = max((atr_val or 0) * 0.6, price * 0.005)
    sh, sl = _swing_points(highs, lows, k=3)
    # Every swing is potential S or R depending on which side of price it sits.
    res_raw = [x for x in (sh + sl) if x > price * 1.001]
    sup_raw = [x for x in (sh + sl) if x < price * 0.999]
    resistances = sorted(_cluster_levels(res_raw, tol), key=lambda z: z["level"])
    supports = sorted(_cluster_levels(sup_raw, tol), key=lambda z: z["level"], reverse=True)

    def _decorate(z):
        z = dict(z)
        z["distance_pct"] = round((z["level"] - price) / price * 100, 2)
        return z

    resistances = [_decorate(z) for z in resistances]
    supports = [_decorate(z) for z in supports]
    return {
        "cluster_tolerance": round(tol, 2),
        "nearest_resistance": resistances[0] if resistances else None,
        "nearest_support": supports[0] if supports else None,
        "resistance_ladder": resistances[:5],
        "support_ladder": supports[:5],
    }


def pivot_points(prev_high, prev_low, prev_close):
    """Classic floor-trader pivots from the last completed bar — intraday/short-term
    S/R references the Tactical sleeve leans on."""
    if None in (prev_high, prev_low, prev_close):
        return None
    p = (prev_high + prev_low + prev_close) / 3
    return {
        "P": round(p, 2),
        "R1": round(2 * p - prev_low, 2), "S1": round(2 * p - prev_high, 2),
        "R2": round(p + (prev_high - prev_low), 2), "S2": round(p - (prev_high - prev_low), 2),
        "R3": round(prev_high + 2 * (p - prev_low), 2), "S3": round(prev_low - 2 * (prev_high - p), 2),
    }


def fibonacci(highs, lows, lookback=120):
    """Fibonacci retracement over the recent swing range (default ~6 months).
    Direction inferred from whether the swing high or low came last."""
    hh = highs[-lookback:] if len(highs) >= lookback else highs
    ll = lows[-lookback:] if len(lows) >= lookback else lows
    if not hh or not ll:
        return None
    hi = max(hh); lo = min(ll)
    if hi == lo:
        return None
    hi_idx = len(hh) - 1 - hh[::-1].index(hi)
    lo_idx = len(ll) - 1 - ll[::-1].index(lo)
    up = lo_idx < hi_idx  # low happened first → most recent leg is up → retrace down from hi
    rng = hi - lo
    ratios = [0.236, 0.382, 0.5, 0.618, 0.786]
    levels = {}
    for r in ratios:
        levels[str(r)] = round(hi - rng * r, 2) if up else round(lo + rng * r, 2)
    return {
        "swing_high": round(hi, 2), "swing_low": round(lo, 2),
        "direction": "up" if up else "down",
        "retracements": levels,
    }


def chip_bins(highs, lows, closes, volumes, float_shares=None, bins=48, half_life=55):
    """Compute the raw chip / cost-basis histogram (筹码分布) — shared by the summary
    (`chip_distribution`) and the chart renderer so both read the *same* bins.

    Walk the bars oldest→newest; each day distribute that bar's volume uniformly
    across its [low,high] range into price bins, and **decay** the existing
    distribution to model turnover (old chips changing hands). Decay is
    turnover-based when `float_shares` is given (decay = 1 − volume/float, the real
    algorithm), else a recency half-life proxy. Returns
    (centers, chips, width, pmin) or None if there's nothing to bin."""
    if not volumes or sum(volumes) == 0:
        return None
    pmin, pmax = min(lows), max(highs)
    if pmax <= pmin:
        return None
    width = (pmax - pmin) / bins
    centers = [pmin + (b + 0.5) * width for b in range(bins)]
    chips = [0.0] * bins
    rec_decay = 0.5 ** (1.0 / half_life)  # per-step recency decay if no float
    for i in range(len(closes)):
        vol = volumes[i]
        # decay existing chips (turnover) before adding today's
        if float_shares and float_shares > 0:
            d = max(0.0, 1.0 - min(vol / float_shares, 1.0))
        else:
            d = rec_decay
        if d != 1.0:
            chips = [c * d for c in chips]
        lo, hi = lows[i], highs[i]
        span = hi - lo
        for b in range(bins):
            eb_lo = pmin + b * width
            eb_hi = eb_lo + width
            if span <= 0:
                if eb_lo <= lo < eb_hi:
                    chips[b] += vol
                    break
                continue
            overlap = min(hi, eb_hi) - max(lo, eb_lo)
            if overlap > 0:
                chips[b] += vol * (overlap / span)
    if sum(chips) <= 0:
        return None
    return centers, chips, width, pmin


def chip_distribution(highs, lows, closes, volumes, price, float_shares=None,
                      bins=48, half_life=55):
    """Chip / cost-basis distribution (筹码分布) — where current holders actually
    bought, approximated from volume-at-price.

    This is the institutional-positioning read the mentor method leans on: it maps
    how many shares are held at each price so you can see the **main cost-basis
    zone** (主力成本 — where big money accumulated), how much of the float is sitting
    in **profit vs. trapped** overhead (获利盘 vs 套牢盘), and how **concentrated**
    the chips are (集中度 — tight = washed-out/ready to move; dispersed = still churning).

    Binning is done by `chip_bins` (shared with the chart renderer). Volume-only
    proxy: it can't see off-exchange/dark prints, so treat zones as ranges, not ticks."""
    if not price:
        return None
    binned = chip_bins(highs, lows, closes, volumes, float_shares=float_shares,
                       bins=bins, half_life=half_life)
    if not binned:
        return None
    centers, chips, width, pmin = binned
    total = sum(chips)
    frac = [c / total for c in chips]

    # main cost-basis peak(s)
    peak_b = max(range(bins), key=lambda b: frac[b])
    def _zone(b):
        return {"price": round(centers[b], 2),
                "low": round(pmin + b * width, 2), "high": round(pmin + (b + 1) * width, 2),
                "pct_chips": round(frac[b] * 100, 1)}
    secondary = [b for b in range(1, bins - 1)
                 if frac[b] > frac[b - 1] and frac[b] >= frac[b + 1]
                 and frac[b] >= 0.5 * frac[peak_b] and b != peak_b]
    secondary.sort(key=lambda b: frac[b], reverse=True)

    # profit vs trapped split around current price
    below = sum(frac[b] for b in range(bins) if centers[b] < price)   # 获利盘 (in profit)
    above = 1.0 - below                                              # 套牢盘 (trapped overhead)

    # concentration: price width holding the central 70% of chips (15th–85th pct)
    cum, p15, p85 = 0.0, None, None
    for b in range(bins):
        cum += frac[b]
        if p15 is None and cum >= 0.15:
            p15 = centers[b]
        if p85 is None and cum >= 0.85:
            p85 = centers[b]
            break
    conc_width = (p85 - p15) if (p15 is not None and p85 is not None) else None
    conc_pct = round(conc_width / price * 100, 1) if conc_width else None
    conc_label = None
    if conc_pct is not None:
        conc_label = "concentrated" if conc_pct < 15 else "moderate" if conc_pct < 30 else "dispersed"

    # high-volume nodes (HVN) = heaviest chip shelves ≈ strong S/R
    order = sorted(range(bins), key=lambda b: frac[b], reverse=True)
    hvn = []
    for b in order:
        if frac[b] < 0.02:
            break
        if all(abs(centers[b] - centers[o]) > 2 * width for o in [x["_b"] for x in hvn]):
            z = _zone(b); z["_b"] = b; z["side"] = "support" if centers[b] < price else "resistance"
            hvn.append(z)
        if len(hvn) >= 4:
            break
    for z in hvn:
        z.pop("_b", None)

    read = []
    read.append(f"main cost-basis ~{round(centers[peak_b],2)} ({round(frac[peak_b]*100,1)}% of chips)")
    read.append(f"{round(below*100,0):.0f}% of chips in profit / {round(above*100,0):.0f}% trapped overhead")
    if conc_label:
        read.append(f"{conc_label} (central 70% spans {conc_pct}% of price)")

    return {
        "basis": "turnover-decay" if float_shares else "recency-decay",
        "main_cost_basis": _zone(peak_b),
        "secondary_peaks": [_zone(b) for b in secondary[:2]],
        "pct_in_profit": round(below * 100, 1),      # 获利盘
        "pct_trapped_overhead": round(above * 100, 1),  # 套牢盘
        "concentration_pct": conc_pct, "concentration": conc_label,
        "high_volume_nodes": hvn,
        "read": "; ".join(read),
    }


# --------------------------------------------------------------------------- #
# Assembly
# --------------------------------------------------------------------------- #

def round_or_none(x, n=4):
    return round(x, n) if isinstance(x, (int, float)) else None


def _stop_targets(price, atr_val, nearest_support, nearest_resistance):
    """Scaffold an ATR-aware long-side stop/target and the resulting reward:risk.

    Stop = the tighter-is-riskier of (1.5*ATR below price) or just under the
    nearest structural support; primary target = nearest resistance (the "upper
    pressure"). This is a *starting* frame for the PM, not a fixed order."""
    if not price or not atr_val:
        return None
    atr_stop = price - 1.5 * atr_val
    struct_stop = (nearest_support["level"] * 0.99) if nearest_support else None
    stop = min(atr_stop, struct_stop) if struct_stop else atr_stop
    target = nearest_resistance["level"] if nearest_resistance else price + 3 * atr_val
    risk = price - stop
    reward = target - price
    rr = (reward / risk) if risk > 0 else None
    return {
        "reference_stop": round(stop, 2),
        "stop_basis": "structure" if struct_stop and struct_stop <= atr_stop else "1.5*ATR",
        "risk_per_share": round(risk, 2),
        "primary_target": round(target, 2),
        "target_basis": "nearest_resistance" if nearest_resistance else "3*ATR (no overhead level)",
        "reward_per_share": round(reward, 2),
        "reward_risk": round(rr, 2) if rr else None,
        "note": "Long-side scaffold from volatility + structure. PM sets the actual order; gate is RR>=2.0 net of costs.",
    }


def build(bars, price_override=None, float_shares=None):
    o, h, l, c, v = _ohlcv(bars)
    if len(c) < 15:
        return {"error": f"need >=15 closes, got {len(c)}"}
    has_hl = any(h[i] != c[i] or l[i] != c[i] for i in range(len(c)))
    price = price_override if price_override is not None else c[-1]

    sma20, sma50, sma200 = sma(c, 20), sma(c, 50), sma(c, 200)
    rsi14 = rsi(c, 14)
    macd_v = macd(c)
    bb = bollinger(c)
    atr14 = atr(h, l, c, 14)
    adx_v = adx(h, l, c, 14)
    stoch = stochastic(h, l, c)
    obv_v = obv(c, v)
    vol = volume_read(v)
    sr = support_resistance(h, l, c, price, atr14)
    piv = pivot_points(h[-2], l[-2], c[-2]) if len(c) >= 2 else None
    fib = fibonacci(h, l)
    chips = chip_distribution(h, l, c, v, price, float_shares=float_shares)

    nr = sr["nearest_resistance"] if sr else None
    ns = sr["nearest_support"] if sr else None
    plan = _stop_targets(price, atr14, ns, nr)

    result = {
        "n_bars": len(c),
        "has_high_low": has_hl,
        "price": round(price, 4),
        "last_close": round(c[-1], 4),
        "trend": {
            "sma_20": round_or_none(sma20), "sma_50": round_or_none(sma50), "sma_200": round_or_none(sma200),
            "ema_12": round_or_none(ema(c, 12)), "ema_26": round_or_none(ema(c, 26)),
            "adx": adx_v,
        },
        "momentum": {"rsi_14": round_or_none(rsi14, 2), "macd": macd_v, "stochastic": stoch},
        "volatility": {"atr_14": round_or_none(atr14, 4),
                       "atr_pct": round(atr14 / price * 100, 2) if atr14 and price else None,
                       "bollinger": bb},
        "volume": {"obv": obv_v, "relative": vol},
        "support_resistance": sr,
        "pivot_points": piv,
        "fibonacci": fib,
        "chip_distribution": chips,
        "range_52w": {"high": round(max(c[-252:]), 4), "low": round(min(c[-252:]), 4)},
        "trade_scaffold": plan,
    }

    # --- Plain-English signal summary ----------------------------------------
    notes = []
    if sma50 and sma200:
        notes.append("primary uptrend (SMA50>SMA200)" if sma50 > sma200 else "primary downtrend (SMA50<SMA200)")
    if sma50:
        notes.append("above SMA50" if price > sma50 else "below SMA50")
    if adx_v:
        notes.append(f"{adx_v['regime']} (ADX {adx_v['adx']:.0f}, {adx_v.get('direction')})")
    if rsi14 is not None:
        notes.append(f"overbought RSI {rsi14:.0f}" if rsi14 > 70 else
                     f"oversold RSI {rsi14:.0f}" if rsi14 < 30 else f"neutral RSI {rsi14:.0f}")
    if macd_v:
        notes.append(f"MACD {macd_v['cross']}" + (f" ({macd_v['fresh_cross']})" if macd_v.get("fresh_cross") else ""))
    if stoch:
        notes.append(f"stoch {stoch['zone']} ({stoch['k']:.0f})")
    if bb and bb.get("percent_b") is not None:
        pb = bb["percent_b"]
        if pb > 1:
            notes.append("above upper Bollinger (stretched)")
        elif pb < 0:
            notes.append("below lower Bollinger (stretched)")
    if vol and vol.get("state") != "normal":
        notes.append(f"volume {vol['state']} ({vol['rel_volume']}x)")
    if obv_v and obv_v.get("trend"):
        notes.append(f"OBV {obv_v['trend']}")
    if ns:
        notes.append(f"support ~{ns['level']} ({ns['distance_pct']:+.1f}%, {ns['touches']} touches)")
    if nr:
        notes.append(f"resistance/pressure ~{nr['level']} ({nr['distance_pct']:+.1f}%, {nr['touches']} touches)")
    if plan and plan.get("reward_risk"):
        notes.append(f"scaffold RR≈{plan['reward_risk']}:1 (stop {plan['reference_stop']} → target {plan['primary_target']})")
    if chips:
        notes.append(f"chips: {chips['read']}")
    if not has_hl:
        notes.append("WARNING: feed had no high/low — ATR/ADX/Stoch/S-R degraded to closes")
    result["summary"] = "; ".join(notes)
    return result


def main():
    p = argparse.ArgumentParser(description="Technical + quant indicators with support/resistance map.")
    p.add_argument("source", help="historicals JSON file, or '-' for stdin")
    p.add_argument("--price", type=float, default=None,
                   help="override the 'current' price for the S/R map (e.g. a live quote)")
    p.add_argument("--float", type=float, default=None, dest="float_shares",
                   help="circulating float (shares) — enables the exact turnover-decay chip "
                        "distribution instead of the recency-decay proxy (e.g. --float 4.25e9)")
    args = p.parse_args()

    raw = sys.stdin.read() if args.source == "-" else open(args.source).read()
    obj = json.loads(raw)
    bars = _find_bars(obj)
    if not bars:
        print(json.dumps({"error": "could not locate price bars in input"}))
        sys.exit(1)
    out = build(bars, price_override=args.price, float_shares=args.float_shares)
    if "error" in out:
        print(json.dumps(out))
        sys.exit(1)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
