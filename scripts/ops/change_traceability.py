#!/usr/bin/env python3
"""Validate that a pull request closes documented issues in this repository.

The GitHub workflow supplies PR_BODY, GITHUB_REPOSITORY, and GITHUB_TOKEN. Keeping
the policy in this stdlib-only module makes the behavior testable without a live API.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any


CLOSING_REF = re.compile(
    r"(?i)\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+"
    r"(?:(?P<repository>[\w.-]+/[\w.-]+))?#(?P<number>\d+)\b"
)
HEADING = re.compile(r"(?m)^(?:#{1,6}\s+(.+?)|\*\*(.+?)\*\*)\s*$")
COMMENT = re.compile(r"<!--.*?-->", re.S)
RATIONALE_HEADINGS = {
    "use case",
    "use case / reason",
    "affected use case and impact",
    "reason for change",
    "use case / reason for adding this playbook",
}
ACCEPTANCE_HEADINGS = {
    "acceptance criteria",
    "expected behavior and acceptance criteria",
    "expected outcome and acceptance criteria",
}


def normalize_heading(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().rstrip(":")).casefold()


def markdown_sections(markdown: str) -> dict[str, str]:
    """Return normalized Markdown headings and their non-comment content."""
    clean = COMMENT.sub("", markdown or "")
    matches = list(HEADING.finditer(clean))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        heading = normalize_heading(match.group(1) or match.group(2) or "")
        end = matches[index + 1].start() if index + 1 < len(matches) else len(clean)
        value = clean[match.end():end].strip()
        if heading and value:
            sections[heading] = value
    return sections


def closing_issue_numbers(pr_body: str, repository: str) -> tuple[list[int], list[str]]:
    """Extract closing issues, rejecting references to another repository."""
    numbers: list[int] = []
    errors: list[str] = []
    current = repository.casefold()
    for match in CLOSING_REF.finditer(pr_body or ""):
        referenced_repository = (match.group("repository") or repository).casefold()
        number = int(match.group("number"))
        if referenced_repository != current:
            errors.append(
                f"Closing reference {match.group(0)!r} targets another repository; "
                "use a same-repository issue."
            )
            continue
        if number not in numbers:
            numbers.append(number)
    if not numbers:
        errors.append("Add `Closes #<issue>` for an issue in this repository.")
    return numbers, errors


def validate_pr_body(pr_body: str, repository: str) -> tuple[list[int], list[str]]:
    numbers, errors = closing_issue_numbers(pr_body, repository)
    reason = markdown_sections(pr_body).get("use case / reason", "")
    if not reason:
        errors.append("Complete the `## Use case / reason` section in the PR description.")
    return numbers, errors


def validate_issue(number: int, issue: dict[str, Any] | None) -> list[str]:
    """Validate a GitHub issue payload; None represents a 404 response."""
    prefix = f"Issue #{number}"
    if issue is None:
        return [f"{prefix} does not exist in this repository."]
    if issue.get("pull_request"):
        return [f"{prefix} is a pull request, not an issue."]

    errors: list[str] = []
    if issue.get("state") != "open":
        errors.append(f"{prefix} must be open when the PR is proposed.")
    sections = markdown_sections(str(issue.get("body") or ""))
    if not any(sections.get(name) for name in RATIONALE_HEADINGS):
        errors.append(f"{prefix} needs a completed use-case or reason section.")
    if not any(sections.get(name) for name in ACCEPTANCE_HEADINGS):
        errors.append(f"{prefix} needs completed acceptance criteria.")
    return errors


def fetch_issue(repository: str, number: int, token: str) -> dict[str, Any] | None:
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/issues/{number}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "ai-trader-toolbox-traceability-gate",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise RuntimeError(f"GitHub issue lookup failed with HTTP {exc.code}.") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"GitHub issue lookup failed: {exc.reason}.") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr-body", default=os.environ.get("PR_BODY", ""))
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", ""))
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN", ""))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    missing = [name for name, value in (("repository", args.repository), ("token", args.token)) if not value]
    if missing:
        print("Change traceability failed: missing " + ", ".join(missing) + ".", file=sys.stderr)
        return 2

    numbers, errors = validate_pr_body(args.pr_body, args.repository)
    for number in numbers:
        try:
            issue = fetch_issue(args.repository, number, args.token)
        except RuntimeError as exc:
            errors.append(str(exc))
            continue
        errors.extend(validate_issue(number, issue))

    if errors:
        print("Change traceability failed:\n- " + "\n- ".join(errors), file=sys.stderr)
        return 1
    joined = ", ".join(f"#{number}" for number in numbers)
    print(f"Change traceability passed for {joined}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
