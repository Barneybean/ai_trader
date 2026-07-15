"""Shared Sunday-start reporting-week calendar.

Reporting weeks run Sunday through Saturday. Folder labels keep the familiar
``YYYY-Www`` shape by using the ISO year/week of the Monday inside that
reporting week. This makes Sunday and the following Monday share one folder.
"""

from __future__ import annotations

import datetime as dt


def week_start(day: dt.date) -> dt.date:
    """Return the Sunday that starts ``day``'s reporting week."""
    return day - dt.timedelta(days=(day.weekday() + 1) % 7)


def week_name(day: dt.date) -> str:
    """Return the ``YYYY-Www`` label for ``day``'s Sunday-start week."""
    monday = week_start(day) + dt.timedelta(days=1)
    iso = monday.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"
