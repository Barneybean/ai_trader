#!/usr/bin/env python3
"""Regression tests for Sunday-start report lifecycle behavior."""

import datetime as dt
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_report
import organize_reports as organizer
from report_week import week_name, week_start


class ReportWeekTests(unittest.TestCase):
    def test_sunday_through_saturday_share_the_following_monday_label(self):
        self.assertEqual(week_start(dt.date(2026, 7, 12)), dt.date(2026, 7, 12))
        for day in range(12, 19):
            self.assertEqual(week_name(dt.date(2026, 7, day)), "2026-W29")
        self.assertEqual(week_name(dt.date(2026, 7, 11)), "2026-W28")
        self.assertEqual(week_name(dt.date(2026, 7, 19)), "2026-W30")

    def test_sunday_restores_current_report_and_archives_prior_week(self):
        with tempfile.TemporaryDirectory() as tmp:
            reports = Path(tmp) / "reports"
            archive = reports / "archive"
            misplaced = archive / "2026-W29" / "report_2026-07-13_premarket_test.html"
            prior = reports / "report_2026-07-11_daily_test.html"
            misplaced.parent.mkdir(parents=True)
            misplaced.write_text("current", encoding="utf-8")
            prior.write_text("prior", encoding="utf-8")

            with mock.patch.multiple(organizer, REPORTS=str(reports), ARCHIVE=str(archive)):
                organizer.organize_reports(today=dt.date(2026, 7, 12))

            self.assertTrue((reports / misplaced.name).is_file())
            self.assertTrue((archive / "2026-W28" / prior.name).is_file())
            self.assertFalse(misplaced.exists())
            self.assertFalse(prior.exists())

    def test_recovers_finished_html_misplaced_under_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            reports = Path(tmp) / "reports"
            archive = reports / "archive"
            build = reports / ".build"
            current = build / "2026-W29" / "report_2026-07-14_midmarket_test.html"
            prior = build / "2026-W28" / "report_2026-07-11_daily_test.html"
            current.parent.mkdir(parents=True)
            prior.parent.mkdir(parents=True)
            current.write_text("current", encoding="utf-8")
            prior.write_text("prior", encoding="utf-8")

            with mock.patch.multiple(
                organizer,
                REPORTS=str(reports),
                ARCHIVE=str(archive),
                BUILD=str(build),
            ):
                organizer.organize_reports(today=dt.date(2026, 7, 15))

            self.assertTrue((reports / current.name).is_file())
            self.assertTrue((archive / "2026-W28" / prior.name).is_file())
            self.assertFalse(current.exists())
            self.assertFalse(prior.exists())

    def test_default_build_output_is_the_finished_reports_inbox(self):
        with tempfile.TemporaryDirectory() as tmp:
            reports = Path(tmp) / "reports"
            markdown = reports / ".build" / "2026-W29" / "report_2026-07-14_midmarket_test.md"
            with mock.patch.object(build_report, "REPORTS_DIR", str(reports)):
                output = build_report.default_output_path(str(markdown))
            self.assertEqual(output, str(reports / "report_2026-07-14_midmarket_test.html"))

    def test_support_artifacts_are_repartitioned(self):
        with tempfile.TemporaryDirectory() as tmp:
            reports = Path(tmp) / "reports"
            charts = reports / "assets" / "charts"
            market_data = reports / "cache" / "market-data"
            build = reports / ".build"
            sunday_chart = charts / "2026-W28" / "DEMO-2026-07-12-price.svg"
            sunday_chart.parent.mkdir(parents=True)
            sunday_chart.write_text("svg", encoding="utf-8")

            with mock.patch.multiple(
                organizer,
                REPORTS=str(reports),
                CHARTS=str(charts),
                MARKET_DATA=str(market_data),
                BUILD=str(build),
            ):
                organizer.organize_support_files()

            self.assertTrue((charts / "2026-W29" / sunday_chart.name).is_file())
            self.assertFalse(sunday_chart.exists())


if __name__ == "__main__":
    unittest.main()
