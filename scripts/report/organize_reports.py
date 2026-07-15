#!/usr/bin/env python3
"""Keep only the current Sunday-start week's finished reports in ``reports/``.

Reports from every other week live in ``reports/archive/YYYY-Www/``.  The date
comes from the canonical ``report_YYYY-MM-DD_...html`` filename, not mtime, so
copying or rebuilding a report cannot put it in the wrong week. Stray finished
HTML under ``reports/.build/`` is recovered into the same canonical location.
"""
import argparse
import datetime as dt
import os
import re

from report_week import week_name

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPORTS = os.path.join(ROOT, "reports")
ARCHIVE = os.path.join(REPORTS, "archive")
CHARTS = os.path.join(REPORTS, "assets", "charts")
MARKET_DATA = os.path.join(REPORTS, "cache", "market-data")
BUILD = os.path.join(REPORTS, ".build")
REPORT_RE = re.compile(r"^report_(\d{4}-\d{2}-\d{2})_.+\.html$")

def organize_reports(today=None):
    """Normalize report locations against the current reporting week.

    Returns a mapping of absolute old paths to absolute new paths.
    """
    today = today or dt.date.today()
    current_week = week_name(today)
    moved = {}
    os.makedirs(ARCHIVE, exist_ok=True)
    candidates = []
    for name in sorted(os.listdir(REPORTS)):
        path = os.path.join(REPORTS, name)
        if os.path.isfile(path):
            candidates.append(path)
    for folder, _, names in os.walk(ARCHIVE):
        candidates.extend(os.path.join(folder, name) for name in sorted(names))
    # `.build/` is Markdown-only. Recover any historical default-output mistake
    # instead of hiding a deliverable from the archive and delivery flow.
    for folder, _, names in os.walk(BUILD):
        candidates.extend(os.path.join(folder, name) for name in sorted(names))

    for src in candidates:
        name = os.path.basename(src)
        match = REPORT_RE.match(name)
        if not match:
            continue
        report_day = dt.date.fromisoformat(match.group(1))
        report_week = week_name(report_day)
        if report_week == current_week:
            dst = os.path.join(REPORTS, name)
        else:
            dst = os.path.join(ARCHIVE, report_week, name)
        if os.path.abspath(src) == os.path.abspath(dst):
            continue
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        # Rebuilding or reclassifying intentionally refreshes the canonical copy.
        os.replace(src, dst)
        moved[os.path.abspath(src)] = os.path.abspath(dst)

    for folder, _, _ in os.walk(ARCHIVE, topdown=False):
        if folder != ARCHIVE and not os.listdir(folder):
            os.rmdir(folder)
    return moved


def organize_support_files():
    """Normalize chart, data, and build artifacts by reporting week."""
    rules = (
        (os.path.join(REPORTS, "charts"), CHARTS, re.compile(r"^[A-Z0-9.^=-]+-(\d{4}-\d{2}-\d{2})-.+\.svg$")),
        (CHARTS, CHARTS, re.compile(r"^[A-Z0-9.^=-]+-(\d{4}-\d{2}-\d{2})-.+\.svg$")),
        (os.path.join(REPORTS, "data"), MARKET_DATA, re.compile(r"^.+-(\d{4}-\d{2}-\d{2})\.json$")),
        (MARKET_DATA, MARKET_DATA, re.compile(r"^.+-(\d{4}-\d{2}-\d{2})\.json$")),
        (BUILD, BUILD, re.compile(r"^report_(\d{4}-\d{2}-\d{2})_.+\.md$")),
    )
    moved = {}
    for source, target_root, pattern in rules:
        if not os.path.isdir(source):
            continue
        candidates = []
        for folder, _, names in os.walk(source):
            candidates.extend(os.path.join(folder, name) for name in sorted(names))
        for src in candidates:
            name = os.path.basename(src)
            match = pattern.match(name)
            if not match:
                continue
            folder = os.path.join(target_root, week_name(dt.date.fromisoformat(match.group(1))))
            os.makedirs(folder, exist_ok=True)
            dst = os.path.join(folder, name)
            if os.path.abspath(src) == os.path.abspath(dst):
                continue
            os.replace(src, dst)
            moved[os.path.abspath(src)] = os.path.abspath(dst)
    return moved


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--today", help="override current date for testing (YYYY-MM-DD)")
    args = parser.parse_args(argv)
    today = dt.date.fromisoformat(args.today) if args.today else None
    moved = organize_reports(today)
    moved.update(organize_support_files())
    for old, new in moved.items():
        print(f"{os.path.relpath(old, ROOT)} -> {os.path.relpath(new, ROOT)}")
    print(f"Current week: {week_name(today or dt.date.today())}; organized {len(moved)} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
