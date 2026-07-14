#!/usr/bin/env python3
"""Unit tests for the canonical clock (ADR-0031)."""

import datetime as dt
import re
import sys
import unittest
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

import clock

_Z_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


class ClockTests(unittest.TestCase):
    def test_utc_now_is_aware_utc(self):
        now = clock.utc_now()
        self.assertEqual(now.utcoffset(), dt.timedelta(0))

    def test_utc_now_iso_is_z_suffixed(self):
        self.assertRegex(clock.utc_now_iso(), _Z_RE)

    def test_to_utc_iso_normalizes_pacific_and_naive(self):
        pacific = dt.datetime(2026, 7, 14, 9, 30, tzinfo=ZoneInfo("America/Los_Angeles"))
        self.assertEqual(clock.to_utc_iso(pacific), "2026-07-14T16:30:00Z")
        self.assertEqual(clock.to_utc_iso(dt.datetime(2026, 7, 14, 16, 30)), "2026-07-14T16:30:00Z")

    def test_pacific_date_is_a_date(self):
        self.assertIsInstance(clock.pacific_date(), dt.date)

    def test_pacific_label_is_dst_correct(self):
        summer = dt.datetime(2026, 7, 14, 16, 30, tzinfo=dt.timezone.utc)
        winter = dt.datetime(2026, 1, 14, 17, 30, tzinfo=dt.timezone.utc)
        self.assertIn("09:30", clock.pacific_label(summer))
        self.assertIn("PDT", clock.pacific_label(summer))
        self.assertIn("PST", clock.pacific_label(winter))


if __name__ == "__main__":
    unittest.main()
