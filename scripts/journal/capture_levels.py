#!/usr/bin/env python3
"""Capture computed trigger levels in the durable action-level registry.

``forecast.py`` and ``exit_radar.py`` compute breakout, breakdown, and trailing-stop
levels that would otherwise disappear after a run. This command promotes those levels
into ``journal/action-levels.jsonl``, the registry watched by ``check_alerts.py``.

Rules:
- Automatic rows use ``forecast:<id>`` or ``exit_radar:<id>`` provenance.
- A human-curated open row for the same ticker/direction wins.
- Identical open automatic rows are not duplicated.

Example:
  python3 scripts/journal/capture_levels.py --ticker EXAMPLE --set 2026-07-13 \
      --horizon-days 7 --report sample-report \
      --breakout 19.74 --breakdown 14.70 --stop 15.96 --account execution
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lib"))


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def levels_path(path: str | Path | None = None) -> Path:
    return Path(path) if path else _repo_root() / "journal" / "action-levels.jsonl"


def _load(path: Path) -> list:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def _expires(set_date: str, horizon_days: int) -> str:
    year, month, day = (int(value) for value in set_date.split("-"))
    return (date(year, month, day) + timedelta(days=max(1, int(horizon_days)))).isoformat()


def build_level_rows(
    ticker,
    *,
    breakout=None,
    breakdown=None,
    stop=None,
    source,
    set_date,
    horizon_days,
    account="execution",
):
    """Turn computed levels into action-level rows without performing I/O."""
    expires = _expires(set_date, horizon_days)
    base = {
        "ticker": str(ticker).upper(),
        "set": set_date,
        "expires": expires,
        "account": account,
    }
    rows = []
    if breakout is not None:
        rows.append(
            {
                **base,
                "level": float(breakout),
                "direction": "above",
                "action": "breakout trigger — review long / add",
                "source": f"forecast:{source}",
            }
        )
    if breakdown is not None:
        rows.append(
            {
                **base,
                "level": float(breakdown),
                "direction": "below",
                "action": "breakdown — exit / invalidation review",
                "source": f"forecast:{source}",
            }
        )
    if stop is not None:
        rows.append(
            {
                **base,
                "level": float(stop),
                "direction": "below",
                "action": "chandelier trailing stop — trim / exit review",
                "source": f"exit_radar:{source}",
            }
        )
    return rows


def _is_curated(row) -> bool:
    source = str(row.get("source", ""))
    return not (source.startswith("forecast:") or source.startswith("exit_radar:"))


def _is_open(row, today: date | None = None) -> bool:
    expires = str(row.get("expires", "")).strip()
    if not expires:
        return True
    try:
        return date.fromisoformat(expires) >= (today or date.today())
    except ValueError:
        return True


def capture(rows, path: str | Path | None = None):
    """Append automatic rows while preserving curated and identical open rows."""
    destination = levels_path(path)
    existing = _load(destination)
    open_rows = [row for row in existing if _is_open(row)]
    curated = {
        (row.get("ticker"), row.get("direction"))
        for row in open_rows
        if _is_curated(row)
    }
    seen_auto = {
        (row.get("ticker"), row.get("direction"), row.get("source"), row.get("level"))
        for row in open_rows
        if not _is_curated(row)
    }
    added, skipped = [], []
    for row in rows:
        if (row["ticker"], row["direction"]) in curated:
            skipped.append({**row, "_skip": "human-curated open level wins"})
            continue
        key = (row["ticker"], row["direction"], row["source"], row["level"])
        if key in seen_auto:
            skipped.append({**row, "_skip": "duplicate open automatic row"})
            continue
        added.append(row)
        seen_auto.add(key)
    if added:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with open(destination, "a", encoding="utf-8") as handle:
            for row in added:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
    return {"added": added, "skipped": skipped}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Capture computed trigger levels in action-levels.jsonl."
    )
    parser.add_argument("--ticket", "--ticker", dest="ticker", required=True)
    parser.add_argument("--set", dest="set_date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--horizon-days", type=int, default=14)
    parser.add_argument("--report", required=True, help="Source report ID for provenance")
    parser.add_argument("--breakout", type=float, default=None)
    parser.add_argument("--breakdown", type=float, default=None)
    parser.add_argument("--stop", type=float, default=None)
    parser.add_argument("--account", default="execution")
    parser.add_argument("--path", default=None)
    args = parser.parse_args(argv)

    rows = build_level_rows(
        args.ticker,
        breakout=args.breakout,
        breakdown=args.breakdown,
        stop=args.stop,
        source=args.report,
        set_date=args.set_date,
        horizon_days=args.horizon_days,
        account=args.account,
    )
    if not rows:
        print("no levels given (pass --breakout/--breakdown/--stop)")
        return 0
    result = capture(rows, args.path)
    print(
        f"captured {len(result['added'])} level(s), skipped {len(result['skipped'])} "
        f"for {args.ticker} (source report {args.report})"
    )
    return 0


if __name__ == "__main__":
    try:
        import desk_log

        raise SystemExit(desk_log.run(main, component="capture-levels"))
    except ImportError:
        raise SystemExit(main())
