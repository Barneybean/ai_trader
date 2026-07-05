#!/usr/bin/env python3
"""
Create the dated report file for a AI Trader run.

This is the *reusable* part of producing the daily report: the filename/title
convention and the fixed section scaffold (which matches the "Output format"
block in SKILL.md). The desk run fills the sections with live analysis; this
script just guarantees a consistently-titled, well-structured file exists in
the reports/ folder so there is a dated archive.

Pure standard library — no install step.

Filename convention: report_<date>_<title>_<model>.md
    e.g. reports/report_2026-07-05_daily-desk-run_claude-fable-5.md
Title and model are slugified (lowercase, hyphens). Pass the run's focus as
--title ("daily-desk-run", "nvda-deep-dive") and the AI model that ran the
desk as --model, so the archive shows what was analyzed and by which model.

Usage:
    python3 scripts/new_report.py --title daily-desk-run --model claude-fable-5
    python3 scripts/new_report.py --market open    # stamp "market open" in the header
    python3 scripts/new_report.py --date 2026-07-03
    python3 scripts/new_report.py --force          # overwrite if it already exists
    python3 scripts/new_report.py --print-path     # just print the path, write nothing

On success it prints the absolute path of the report file (last line), so a
caller can capture it.
"""

import argparse
import datetime as _dt
import os
import sys

# reports/ lives at the project root, one level up from this scripts/ dir.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORTS_DIR = os.path.join(PROJECT_ROOT, "reports")

FILENAME_FMT = "report_{date}_{title}_{model}.md"

SCAFFOLD = """\
# Desk Run — {date_human}{market}

_<one-line dateline: session date, what this run covered, account status & buying power>_

## Summary
<3–4 plain-English bullets a non-financial reader can scan in 10 seconds:>
- **<Market/regime in plain words>** — what's happening and what it means for risk today.
- **<What's worth buying (if anything)>** — the names and the one-line reason, in everyday language.
- **<What to avoid / pass on>** — and why the "obvious" ideas don't work today.
- **<The discipline point>** — the single takeaway.

> [!TIP] <Optional: define in plain English any core term a non-financial reader needs to follow the Action section.>

## Action — what to do
<Highlight the concrete moves. Use a callout per action so they stand out:>
> [!ACTION] **BUY/SELL/TRIM <TICKER>** — size ($/shares), entry zone, stop, first target — in plain terms. Say whether to act now or wait for a dip.
> [!WATCH] **Wait for a price** on <names> — the trigger level for each; don't act above it.
> [!NOTE] **Cash management** — how much to deploy vs. hold, and any event to keep powder for.

_If nothing clears the bar, say so plainly and recommend holding cash._

## Breakdown
<One card per recommendation, ranked highest-edge first. Keep bullets tight; put the trade
plan and risks in callouts so they pop. For each:>

### <TICKER> — <Buy/Accumulate/Trim/Avoid> · <Tactical|Core> · score X/100 · conviction Low/Med/High
> [!TIP] **The idea in one sentence:** <plain-English thesis a non-financial reader gets instantly.>
- **What it is:** the business + why it's mispriced (2–3 short points).
- **The edge (variant perception):** consensus view vs. our differentiated view, why it isn't priced yet, and the catalyst/timeline that closes the gap.
- **Insider / smart-money signal:** dated Form-4 buys/sells or positioning, if any.
- **Quant read (the levels):** support (floor) & resistance (ceiling) zones with strength, trend (MA alignment, ADX), momentum (RSI/MACD/Stoch), volume (rel-vol/OBV) — cite the `indicators.py` numbers.
- <embed the three charts.py SVGs: price/volume, chips, gauges>
> [!TIP] **How to read the charts:** <one-liner decoding the chips/gauges for a non-expert — include only when it helps.>
> [!ACTION] **Trade plan:** entry zone, stop (ATR/structure), target ladder, share count, $ at risk (and % of account), exit plan.
> [!RISK] **What kills the thesis:** 2–3 concrete invalidation conditions (a price below support, a macro trigger, a thesis break).
<Tax note on any sell or when material. Sources: dated links for news/sentiment/macro claims.>

## Watchlist — analyzed, not actionable yet
<One line each for names that did NOT clear the bar: price, the single reason, and the level to wait for.>

## Sleeve status
- **Tactical** (target ~40%): <allocated vs available>. **Core** (target ~60%): <allocated vs available>. **Cash:** <%>.

## Calendar (week ahead)
- Key dated events (FOMC/CPI/NFP, earnings) and, in plain terms, what each means for the entries.

_Informational only — not financial advice. Every order is yours to approve._
"""


def _today():
    return _dt.date.today().isoformat()


def slugify(text):
    """Lowercase, hyphen-separated, filename-safe ("NVDA Deep Dive" -> "nvda-deep-dive")."""
    out = []
    for ch in text.lower():
        if ch.isalnum() or ch == ".":
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-") or "untitled"


def build_path(date_iso, title, model):
    return os.path.join(REPORTS_DIR, FILENAME_FMT.format(
        date=date_iso, title=slugify(title), model=slugify(model)))


def render_scaffold(date_iso, market):
    d = _dt.date.fromisoformat(date_iso)
    date_human = d.strftime("%A, %B %-d, %Y")
    market_suffix = f" ({market})" if market else ""
    return SCAFFOLD.format(date_human=date_human, market=market_suffix)


def main(argv=None):
    p = argparse.ArgumentParser(description="Create the dated AI Trader report file.")
    p.add_argument("--date", default=_today(), help="Report date YYYY-MM-DD (default: today).")
    p.add_argument("--title", default="desk-run",
                   help="Short run title, slugified into the filename (default: desk-run).")
    p.add_argument("--model", default="unknown-model",
                   help="AI model that ran the desk (e.g. claude-fable-5), slugified into the filename.")
    p.add_argument("--market", choices=["open", "closed"], default=None,
                   help="Optional market state to stamp in the header.")
    p.add_argument("--force", action="store_true", help="Overwrite if the file already exists.")
    p.add_argument("--print-path", action="store_true", help="Only print the path; do not write.")
    args = p.parse_args(argv)

    try:
        _dt.date.fromisoformat(args.date)
    except ValueError:
        p.error(f"--date must be YYYY-MM-DD, got {args.date!r}")

    market = None
    if args.market:
        market = "market open" if args.market == "open" else "market closed"

    path = build_path(args.date, args.title, args.model)

    if args.print_path:
        print(path)
        return 0

    os.makedirs(REPORTS_DIR, exist_ok=True)

    if os.path.exists(path) and not args.force:
        sys.stderr.write(
            f"Report already exists (use --force to overwrite): {path}\n"
        )
        print(path)
        return 0

    with open(path, "w", encoding="utf-8") as f:
        f.write(render_scaffold(args.date, market))

    sys.stderr.write(f"Wrote scaffold: {path}\n")
    print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

