#!/usr/bin/env python3
"""Append-only private operational issue log.

This is distinct from the trade-outcome journal: it records gateway rejects,
faults, near misses, and other operational events that need human review. The
default ``journal/issues.jsonl`` path is git-ignored.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

VALID_SEVERITY = {"info", "warn", "critical"}


def issues_path(path: str | Path | None = None) -> Path:
    return Path(path) if path else Path(__file__).resolve().parents[2] / "journal" / "issues.jsonl"


def load(path: str | Path | None = None) -> list:
    target = issues_path(path)
    if not target.exists():
        return []
    rows = []
    for line in target.read_text(encoding="utf-8").splitlines():
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def record(
    *,
    severity: str,
    category: str,
    source: str,
    summary: str,
    symbol: str | None = None,
    context: dict | None = None,
    status: str = "open",
    linked: str | None = None,
    path: str | Path | None = None,
) -> dict:
    import clock
    now = clock.utc_now()
    target = issues_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    prefix = f"ISS-{now:%Y-%m-%d}-"
    row = {
        "id": prefix + str(1 + sum(
            str(item.get("id", "")).startswith(prefix) for item in load(target)
        )),
        "ts": clock.to_utc_iso(now),
        "severity": severity if severity in VALID_SEVERITY else "warn",
        "category": category,
        "source": source,
        "symbol": symbol,
        "summary": summary,
        "context": context or {},
        "status": status,
        "resolution": None,
        "linked": linked,
    }
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    return row


def open_issues(path: str | Path | None = None) -> list:
    return [item for item in load(path) if item.get("status") == "open"]
