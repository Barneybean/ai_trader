#!/usr/bin/env python3
"""Canonical time helpers (ADR-0031).

Store machine events as ISO-8601 UTC instants with ``Z``. Render human-facing
dates and clock times in Pacific with an explicit zone label.
"""
from __future__ import annotations

import datetime as _dt
from zoneinfo import ZoneInfo

UTC = _dt.timezone.utc
PACIFIC = ZoneInfo("America/Los_Angeles")


def utc_now() -> _dt.datetime:
    """Return the current timezone-aware UTC instant."""
    return _dt.datetime.now(UTC)


def utc_now_iso(timespec: str = "seconds") -> str:
    """Return the canonical UTC ``Z`` record format."""
    return utc_now().isoformat(timespec=timespec).replace("+00:00", "Z")


def to_utc_iso(when: _dt.datetime, timespec: str = "seconds") -> str:
    """Normalize an aware datetime to a UTC ``Z`` record string.

    A naive input is treated as UTC as a safe compatibility fallback.
    """
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    return when.astimezone(UTC).isoformat(timespec=timespec).replace("+00:00", "Z")


def pacific_now() -> _dt.datetime:
    """Return the current timezone-aware Pacific instant."""
    return _dt.datetime.now(PACIFIC)


def pacific_date() -> _dt.date:
    """Return the Pacific calendar day used for report and filing dates."""
    return pacific_now().date()


def pacific_label(when: _dt.datetime | None = None, fmt: str = "%Y-%m-%d %H:%M %Z") -> str:
    """Render a Pacific human-facing time and its DST-correct zone label."""
    when = when or pacific_now()
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    return when.astimezone(PACIFIC).strftime(fmt)
