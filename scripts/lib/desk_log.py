#!/usr/bin/env python3
"""Shared activity logging for the desk toolkit.

Every toolkit script funnels its run telemetry here so debugging and
reliability questions ("did the weekly review run?", "why did the report
build die?") are answered from one place:

  logs/desk.log         human-readable, size-rotated (5 MB x 5)
  logs/activity.jsonl   structured events, one JSON object per line

Usage inside a script (two lines at the entry point):

    import desk_log
    if __name__ == "__main__":
        raise SystemExit(desk_log.run(main))

`run()` logs script_start (argv), script_end (duration + exit code) and
script_error (exception + traceback), then propagates the outcome
unchanged — instrumented scripts behave exactly as before.

Ad-hoc events from anywhere (including shell / Claude sessions):

    python3 scripts/lib/desk_log.py event <component> <event> [k=v ...]
    python3 scripts/lib/desk_log.py tail [-n 20] [-c component]
    python3 scripts/lib/desk_log.py stats [--since YYYY-MM-DD]   # runs, error rate, p50/p95

Never log secrets, tokens, or account identifiers — logs are plain files.
"""

from __future__ import annotations

import json
import logging
import logging.handlers
import os
import sys
import time
import traceback
from pathlib import Path

DESK_DIR = Path(__file__).resolve().parent.parent.parent
LOG_DIR = DESK_DIR / "logs"
TEXT_LOG = LOG_DIR / "desk.log"
JSONL_LOG = LOG_DIR / "activity.jsonl"
JSONL_MAX_BYTES = 10 * 1024 * 1024  # rotate activity.jsonl at 10 MB

_loggers: dict[str, logging.Logger] = {}


def _ensure_dir() -> None:
    LOG_DIR.mkdir(exist_ok=True)


def get_logger(component: str) -> logging.Logger:
    """A logger writing to logs/desk.log (and stderr passes through untouched)."""
    if component in _loggers:
        return _loggers[component]
    _ensure_dir()
    logger = logging.getLogger(f"desk.{component}")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    if not logger.handlers:
        h = logging.handlers.RotatingFileHandler(
            TEXT_LOG, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
        )
        h.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)s [%(name)s] %(message)s", "%Y-%m-%d %H:%M:%S"
        ))
        logger.addHandler(h)
    _loggers[component] = logger
    return logger


def _rotate_jsonl() -> None:
    try:
        if JSONL_LOG.exists() and JSONL_LOG.stat().st_size > JSONL_MAX_BYTES:
            JSONL_LOG.replace(JSONL_LOG.with_suffix(".jsonl.1"))
    except OSError:
        pass


def log_event(component: str, event: str, level: str = "info", **data) -> None:
    """One structured event to activity.jsonl + a mirrored line in desk.log."""
    _ensure_dir()
    _rotate_jsonl()
    import clock
    record = {
        "ts": clock.utc_now_iso(),
        "component": component,
        "level": level,
        "event": event,
        **data,
    }
    try:
        with JSONL_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")
    except OSError:
        pass  # logging must never take down the tool being logged
    logger = get_logger(component)
    extra = " ".join(f"{k}={v}" for k, v in data.items())
    getattr(logger, level, logger.info)(f"{event}{' ' + extra if extra else ''}")


def run(main_fn, component: str | None = None):
    """Wrap a script's main(): log start / end / error, propagate the outcome."""
    comp = component or Path(sys.argv[0]).stem
    argv = sys.argv[1:]
    start = time.monotonic()
    log_event(comp, "script_start", argv=argv)
    try:
        rc = main_fn()
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
        log_event(comp, "script_end", level="info" if code == 0 else "warning",
                  duration_s=round(time.monotonic() - start, 2), exit_code=code)
        raise
    except Exception as e:
        log_event(comp, "script_error", level="error",
                  duration_s=round(time.monotonic() - start, 2),
                  error=f"{type(e).__name__}: {e}",
                  traceback=traceback.format_exc(limit=20))
        raise
    code = rc if isinstance(rc, int) else 0
    log_event(comp, "script_end", level="info" if code == 0 else "warning",
              duration_s=round(time.monotonic() - start, 2), exit_code=code)
    return rc


# ------------------------------------------------------------------ CLI ----
def _cli_event(args: list[str]) -> int:
    if len(args) < 2:
        print("usage: desk_log.py event <component> <event> [k=v ...]", file=sys.stderr)
        return 2
    component, event, *pairs = args
    data = {}
    for p in pairs:
        k, _, v = p.partition("=")
        data[k] = v
    log_event(component, event, **data)
    return 0


def _cli_tail(args: list[str]) -> int:
    n, component = 20, None
    it = iter(args)
    for a in it:
        if a == "-n":
            n = int(next(it, "20"))
        elif a in ("-c", "--component"):
            component = next(it, None)
    if not JSONL_LOG.exists():
        print("(no activity yet)")
        return 0
    lines = JSONL_LOG.read_text(encoding="utf-8").splitlines()
    shown = 0
    rows = []
    for line in reversed(lines):
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if component and r.get("component") != component:
            continue
        rows.append(r)
        shown += 1
        if shown >= n:
            break
    for r in reversed(rows):
        extra = {k: v for k, v in r.items()
                 if k not in ("ts", "component", "level", "event", "traceback")}
        extras = " ".join(f"{k}={v}" for k, v in extra.items())
        print(f"{r.get('ts','')} {r.get('level','info'):7} {r.get('component','?'):16} "
              f"{r.get('event','?')}{' ' + extras if extras else ''}")
    return 0


def _percentile(sorted_vals: list[float], p: int) -> float | None:
    if not sorted_vals:
        return None
    return sorted_vals[round((p / 100) * (len(sorted_vals) - 1))]


def _cli_stats(args: list[str]) -> int:
    since = None
    it = iter(args)
    for a in it:
        if a == "--since":
            since = next(it, None)
    if not JSONL_LOG.exists():
        print("(no activity yet)")
        return 0
    per: dict[str, dict] = {}
    for line in JSONL_LOG.read_text(encoding="utf-8").splitlines():
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if since and r.get("ts", "") < since:
            continue
        s = per.setdefault(r.get("component", "?"),
                           {"starts": 0, "ends": 0, "errors": 0, "durs": [], "last_err": None})
        ev = r.get("event")
        if ev == "script_start":
            s["starts"] += 1
        elif ev == "script_end":
            s["ends"] += 1
            if "duration_s" in r:
                s["durs"].append(r["duration_s"])
        if r.get("level") in ("error", "warning") or ev == "script_error":
            s["errors"] += 1
            detail = r.get("error") or f"exit {r.get('exit_code')}"
            s["last_err"] = f"{r.get('ts', '?')} {' '.join(str(detail).split())}"
    print(f"{'component':18} {'runs':>5} {'errs':>5} {'err%':>5} {'p50s':>7} {'p95s':>7}  last error")
    for name in sorted(per):
        s = per[name]
        durs = sorted(s["durs"])
        denom = s["ends"] or s["starts"]
        err_pct = f"{100 * s['errors'] / denom:.0f}%" if denom else "-"
        p50, p95 = _percentile(durs, 50), _percentile(durs, 95)
        print(f"{name:18} {s['ends']:>5} {s['errors']:>5} {err_pct:>5} "
              f"{p50 if p50 is not None else '-':>7} {p95 if p95 is not None else '-':>7}  "
              f"{(s['last_err'] or '')[:70]}")
    incomplete = {n: s["starts"] - s["ends"] for n, s in per.items() if s["starts"] > s["ends"]}
    if incomplete:
        print("\nstarted but never ended (crashed or still running): "
              + ", ".join(f"{n}×{c}" for n, c in sorted(incomplete.items())))
    return 0


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd == "event":
        return _cli_event(rest)
    if cmd == "tail":
        return _cli_tail(rest)
    if cmd == "stats":
        return _cli_stats(rest)
    print(f"unknown command: {cmd} (use event | tail | stats)", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
