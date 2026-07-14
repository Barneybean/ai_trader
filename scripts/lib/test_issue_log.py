#!/usr/bin/env python3
import tempfile
import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import issue_log


class IssueLogTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.path = Path(self._tmp.name) / "issues.jsonl"

    def tearDown(self):
        self._tmp.cleanup()

    def test_append_and_read(self):
        row = issue_log.record(
            severity="warn",
            category="gateway-reject",
            source="execution-gateway",
            summary="blocked fictional ticket",
            symbol="XYZ",
            context={"reasons": ["oversize"]},
            linked="ticket-1",
            path=self.path,
        )
        self.assertEqual(row["status"], "open")
        self.assertEqual(issue_log.load(self.path)[0]["symbol"], "XYZ")

    def test_ids_increment(self):
        first = issue_log.record(
            severity="info", category="test", source="suite", summary="first", path=self.path
        )
        second = issue_log.record(
            severity="info", category="test", source="suite", summary="second", path=self.path
        )
        self.assertTrue(first["id"].endswith("-1"))
        self.assertTrue(second["id"].endswith("-2"))

    def test_bad_severity_normalizes(self):
        row = issue_log.record(
            severity="invalid", category="test", source="suite", summary="first", path=self.path
        )
        self.assertEqual(row["severity"], "warn")

    def test_open_filter(self):
        issue_log.record(
            severity="info", category="test", source="suite", summary="open", path=self.path
        )
        issue_log.record(
            severity="info",
            category="test",
            source="suite",
            summary="done",
            status="resolved",
            path=self.path,
        )
        self.assertEqual(len(issue_log.open_issues(self.path)), 1)

    def test_malformed_existing_line_does_not_drop_new_issue(self):
        self.path.write_text("not-json\n", encoding="utf-8")
        issue_log.record(
            severity="warn", category="test", source="suite", summary="kept", path=self.path
        )
        self.assertEqual(len(issue_log.load(self.path)), 1)


if __name__ == "__main__":
    unittest.main()
