#!/usr/bin/env python3
"""Unit tests for capture_levels."""

import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import capture_levels as cl


class BuildRows(unittest.TestCase):
    def test_directions_actions_and_sources(self):
        rows = cl.build_level_rows(
            "example",
            breakout=19.74,
            breakdown=14.70,
            stop=15.96,
            source="sample",
            set_date="2026-07-13",
            horizon_days=7,
        )
        by_direction = {(row["direction"], row["source"].split(":")[0]): row for row in rows}
        self.assertEqual(by_direction[("above", "forecast")]["level"], 19.74)
        self.assertEqual(by_direction[("below", "forecast")]["level"], 14.70)
        self.assertEqual(by_direction[("below", "exit_radar")]["level"], 15.96)
        self.assertEqual(rows[0]["ticker"], "EXAMPLE")

    def test_expires_is_set_plus_horizon(self):
        rows = cl.build_level_rows(
            "X", breakout=10, source="sample", set_date="2026-07-13", horizon_days=7
        )
        self.assertEqual(rows[0]["expires"], "2026-07-20")


class Capture(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.path = Path(self.temporary_directory.name) / "action-levels.jsonl"
        self.set_date = date.today().isoformat()

    def tearDown(self):
        self.temporary_directory.cleanup()

    def rows(self, **overrides):
        values = dict(
            breakout=19.74,
            breakdown=14.7,
            stop=15.96,
            source="sample",
            set_date=self.set_date,
            horizon_days=7,
        )
        values.update(overrides)
        return cl.build_level_rows("EXAMPLE", **values)

    def test_appends_and_is_idempotent(self):
        first = cl.capture(self.rows(), self.path)
        self.assertEqual(len(first["added"]), 3)
        second = cl.capture(self.rows(), self.path)
        self.assertEqual(len(second["added"]), 0)
        self.assertEqual(len(second["skipped"]), 3)
        self.assertEqual(len(self.path.read_text().strip().splitlines()), 3)

    def test_human_curated_open_level_wins(self):
        expires = (date.today() + timedelta(days=30)).isoformat()
        self.path.write_text(
            json.dumps(
                {
                    "ticker": "EXAMPLE",
                    "level": 14.7,
                    "direction": "below",
                    "action": "thesis invalidation",
                    "source": "human",
                    "set": self.set_date,
                    "expires": expires,
                    "account": "execution",
                }
            )
            + "\n",
            encoding="utf-8",
        )
        result = cl.capture(self.rows(), self.path)
        self.assertNotIn("below", {row["direction"] for row in result["added"]})
        self.assertIn("above", {row["direction"] for row in result["added"]})
        self.assertTrue(any("human-curated" in row.get("_skip", "") for row in result["skipped"]))

    def test_expired_rows_do_not_block_re_capture(self):
        expired = (date.today() - timedelta(days=1)).isoformat()
        row = self.rows()[0]
        self.path.write_text(json.dumps({**row, "expires": expired}) + "\n", encoding="utf-8")
        result = cl.capture([row], self.path)
        self.assertEqual(len(result["added"]), 1)


if __name__ == "__main__":
    unittest.main()
