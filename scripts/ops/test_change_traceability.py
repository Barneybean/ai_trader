#!/usr/bin/env python3

import unittest

from change_traceability import (
    closing_issue_numbers,
    markdown_sections,
    validate_issue,
    validate_pr_body,
)


REPOSITORY = "example/toolbox"
VALID_ISSUE = {
    "state": "open",
    "body": "## Use case / reason\nA maintainer needs traceability.\n\n"
            "## Acceptance criteria\nThe gate rejects incomplete issues.",
}


class TraceabilityTests(unittest.TestCase):
    def test_valid_same_repository_issue_and_pr_reason(self):
        body = "Closes #12\n\n## Use case / reason\nMake review evidence auditable."
        numbers, errors = validate_pr_body(body, REPOSITORY)
        self.assertEqual(numbers, [12])
        self.assertEqual(errors, [])
        self.assertEqual(validate_issue(12, VALID_ISSUE), [])

    def test_exact_qualified_repository_is_allowed(self):
        numbers, errors = closing_issue_numbers("Fixes example/toolbox#7", REPOSITORY)
        self.assertEqual(numbers, [7])
        self.assertEqual(errors, [])

    def test_cross_repository_reference_is_rejected(self):
        numbers, errors = closing_issue_numbers("Closes someone/else#7", REPOSITORY)
        self.assertEqual(numbers, [])
        self.assertTrue(any("another repository" in error for error in errors))

    def test_missing_issue_reference_and_comment_only_reason_are_rejected(self):
        numbers, errors = validate_pr_body(
            "## Use case / reason\n<!-- replace me -->", REPOSITORY
        )
        self.assertEqual(numbers, [])
        self.assertEqual(len(errors), 2)

    def test_missing_issue_is_rejected(self):
        self.assertIn("does not exist", validate_issue(404, None)[0])

    def test_pull_request_reference_is_rejected(self):
        issue = dict(VALID_ISSUE, pull_request={"url": "https://example.invalid"})
        self.assertIn("not an issue", validate_issue(8, issue)[0])

    def test_closed_issue_is_rejected(self):
        issue = dict(VALID_ISSUE, state="closed")
        self.assertTrue(any("must be open" in error for error in validate_issue(9, issue)))

    def test_issue_requires_rationale_and_acceptance_criteria(self):
        issue = {"state": "open", "body": "## Notes\nSomething changed."}
        errors = validate_issue(10, issue)
        self.assertEqual(len(errors), 2)

    def test_github_feature_and_bug_form_headings_are_supported(self):
        feature = {
            "state": "open",
            "body": "### Use case\nNeed a feature.\n\n"
                    "### Expected outcome and acceptance criteria\nIt is observable.",
        }
        bug = {
            "state": "open",
            "body": "### Affected use case and impact\nA task fails.\n\n"
                    "### Expected behavior and acceptance criteria\nThe task passes.",
        }
        self.assertEqual(validate_issue(11, feature), [])
        self.assertEqual(validate_issue(12, bug), [])

    def test_playbook_template_bold_headings_are_supported(self):
        issue = {
            "state": "open",
            "body": "**Use case / reason for adding this playbook:**\nCover a missing sector.\n\n"
                    "**Acceptance criteria:**\nA reviewed playbook is registered.",
        }
        self.assertEqual(validate_issue(13, issue), [])

    def test_markdown_parser_strips_placeholders(self):
        sections = markdown_sections("## Use case / reason\n<!-- placeholder -->")
        self.assertNotIn("use case / reason", sections)


if __name__ == "__main__":
    unittest.main()
