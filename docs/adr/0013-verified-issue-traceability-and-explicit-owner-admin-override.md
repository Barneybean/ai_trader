# ADR-0013: Verified issue traceability and explicit owner-admin override

- **Status:** Accepted
- **Date:** 2026-07-13
- **Deciders:** Repository owner and toolkit maintainer

## Context

The contribution template required `Closes #…`, but CI only recognized issue-shaped text in the PR
description. It did not prove that the issue existed in this repository or contained a rationale and
acceptance criteria. The governance bootstrap also demonstrated that an administrator can perform a
privileged host-level action outside file-based checks.

The same audit found a stale `manual` public-default statement and an unclassified
`scripts/execution/` path. Both weaken the source-sync policy precisely where execution authority
requires the strongest review.

## Decision

We will validate closing references through GitHub's read-only issue API. Every referenced issue
must be open, belong to the current repository, be an issue rather than a PR, and contain a
completed use-case/reason section plus acceptance criteria. The PR keeps its separate rationale
requirement. The policy lives in a stdlib-only tested script invoked by CI and the smoke suite.

We will classify `scripts/execution/**` as sanitization-required and keep `semi` as the single public
default with `manual` as the kill switch. The repository owner/admin may override the approval
requirement only after every required check passes and the owner explicitly directs the merge. The
override reason must be recorded on the PR, and the merge still occurs through that PR. It cannot
authorize a direct push, a failing check, or an automated bypass.

## Consequences

Traceability now depends on the GitHub issue API being available to CI, and older issues may need
their rationale or acceptance criteria filled in before a PR can close them. Contributors get a
clear failure instead of a syntactic pass. High-authority execution code cannot silently enter the
generic reusable-candidate path. A solo repository owner can complete a reviewed, green PR without
manufacturing a second approver, but must leave an explicit audit record.

## Alternatives considered

- **Continue checking PR text only** — rejected because an unrelated or nonexistent reference can
  satisfy a regex without creating an auditable issue.
- **Copy full-auto files before classifying the directory** — rejected because execution authority,
  broker scope, and private configuration require sanitization before code review.
- **Forbid every owner override** — rejected because a solo repository would become unmergeable;
  explicit owner direction plus green checks and a PR record preserves the relevant audit trail.
- **Allow automation to use the override** — rejected because it would turn a narrow owner decision
  into an unreviewed routine bypass.
