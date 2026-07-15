#!/usr/bin/env python3
"""Regression tests for non-destructive report run naming."""

import datetime as dt
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import new_report


class NewReportTests(unittest.TestCase):
    def test_second_same_day_run_gets_a_distinct_suffix_without_changing_model_slot(self):
        with tempfile.TemporaryDirectory() as tmp:
            reports = Path(tmp) / "reports"
            build = reports / ".build"
            first = build / "2026-W29" / "report_2026-07-13_premarket-daily-desk-run_gpt-5.md"
            first.parent.mkdir(parents=True)
            first.write_text("first", encoding="utf-8")
            with mock.patch.multiple(new_report, REPORTS_DIR=str(reports), BUILD_ROOT=str(build)):
                result = new_report.new_run_path(
                    "2026-07-13", "premarket-daily-desk-run", "gpt-5",
                    now=dt.datetime(2026, 7, 13, 6, 15, 30),
                )
            self.assertEqual(
                Path(result).name,
                "report_2026-07-13_premarket-daily-desk-run-rerun-061530_gpt-5.md",
            )

    def test_existing_html_also_reserves_the_new_run_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            reports = Path(tmp) / "reports"
            reports.mkdir()
            (reports / "report_2026-07-13_premarket-daily-desk-run_gpt-5.html").write_text(
                "finished", encoding="utf-8"
            )
            build = reports / ".build"
            with mock.patch.multiple(new_report, REPORTS_DIR=str(reports), BUILD_ROOT=str(build)):
                result = new_report.new_run_path(
                    "2026-07-13", "premarket-daily-desk-run", "gpt-5",
                    now=dt.datetime(2026, 7, 13, 7, 0, 0),
                )
            self.assertIn("-rerun-070000_gpt-5.md", result)

    def test_explicit_update_resolves_the_original_build_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            reports = Path(tmp) / "reports"
            html = reports / "report_2026-07-13_premarket-daily-desk-run_gpt-5.html"
            source = reports / ".build" / "2026-W29" / "report_2026-07-13_premarket-daily-desk-run_gpt-5.md"
            html.parent.mkdir(parents=True)
            source.parent.mkdir(parents=True)
            html.write_text("finished", encoding="utf-8")
            source.write_text("editable", encoding="utf-8")
            with mock.patch.multiple(
                new_report,
                REPORTS_DIR=str(reports),
                BUILD_ROOT=str(reports / ".build"),
            ):
                self.assertEqual(new_report.update_source_path(str(html)), str(source))


if __name__ == "__main__":
    unittest.main()
