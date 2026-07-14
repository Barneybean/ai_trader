# Developer guide

Every feature, bug fix, and behavior change follows one traceable lifecycle:

> **Issue → update on a branch → merge request / pull request → review → merge**

“MR/PR” means the reviewed merge request used by the hosting platform. GitHub calls it a Pull
Request. Never commit a permanent feature or fix directly to the default branch.

## 1. Start with an issue

Create or select the issue **before editing code**. Work requested in chat, found by an agent, or
discovered during another change still needs an issue. The issue is the source of truth for why the
change exists.

Every issue must state:

- the user or operator use case;
- the problem, evidence, or reason for changing behavior;
- current and expected behavior;
- measurable acceptance criteria;
- affected users, components, and known failure modes;
- privacy, security, trading-authority, and public/private-boundary implications.

Bug reports also include reproducible steps, environment details, and sanitized logs or screenshots
when available. Feature issues explain why the existing behavior is insufficient and what outcome
matters; a proposed implementation is optional.

One issue may cover one coherent capability. Split unrelated outcomes before implementation so the
review and rollback boundary stays clear.

## 2. Implement on a branch

Branch from the target repository's current default branch. Include the issue number and purpose:

```text
feature/123-provider-health-check
fix/456-sunday-report-retention
docs/789-setup-clarity
```

Keep the update focused on the issue's acceptance criteria. If implementation reveals a separate
problem, create another issue instead of silently expanding scope. Add or update tests for behavior
changes; a bug fix should reproduce the failure before proving the fix.

For public ports or changes involving another checkout, follow
[`docs/open-source-boundary.md`](docs/open-source-boundary.md). Audit and sanitize the capability;
never merge or copy a private tree into a public repository.

## 3. Open the MR/PR

Use the repository template. The description must contain:

- `Closes #<issue>` so the host attaches and closes the issue on merge;
- the use case and reason for the change;
- a concise implementation summary;
- validation evidence and test commands;
- risk, compatibility, rollout, and rollback notes;
- boundary/privacy review when applicable.

Open a draft MR/PR early when design feedback would prevent wasted work. Keep one primary issue per
MR/PR; additional linked issues must share the same implementation and rollback boundary.

## 4. Review and gates

An MR/PR is mergeable only when:

1. its linked issue is still accurate and acceptance criteria are met;
2. automated consistency, privacy, traceability, and proportional test/smoke gates pass;
3. the diff contains no unrelated, generated, runtime, or sensitive files;
4. documentation and ADRs are updated when behavior or architecture changed;
5. a human reviewer has read the issue, diff, validation evidence, and smoke summary.

Agents may implement, test, and prepare the MR/PR. They must not invent the issue rationale, bypass
human-review gates, approve their own work, or merge directly into the protected branch.

## 5. Merge and close

Use the repository's configured merge strategy, confirm the issue closed automatically, delete the
feature branch, and verify the deployed/default-branch behavior. A regression or rollback is a new
issue and MR/PR so the audit trail remains complete.

## Emergency containment

Protective, reversible operational action—such as switching to manual mode, stopping a schedule,
or disabling a failing integration—may happen before an issue when delay creates immediate risk.
Record the incident as soon as the system is safe. Any permanent feature or code fix still follows
**issue → branch update → MR/PR → merge**; “emergency” never authorizes an unreviewed permanent
change to the default branch.

## Repository enforcement

The issue forms require use cases, reasons, evidence, and acceptance criteria. The MR/PR template
requires `Closes #…`, and `.github/workflows/change-traceability.yml` rejects MR/PRs without both a
closing issue reference and a completed **Use case / reason** section.

Repository administrators must also protect the default branch with **Require a pull request before
merging**, require the traceability/privacy/consistency checks, prevent force pushes, and limit
direct pushes. File-based CI cannot prevent an administrator from bypassing host settings.
