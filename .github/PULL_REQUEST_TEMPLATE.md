## Linked issue

Closes #<issue-number>

## Use case / reason

<!-- Who needs this change, what problem does it solve, and why now? -->

## Update

<!-- Concise implementation summary. Name deliberate exclusions or follow-up issues. -->

## Type

- [ ] Feature
- [ ] Bug fix
- [ ] Playbook / methodology
- [ ] Broker / integration
- [ ] Engine / operations
- [ ] Documentation

## Validation

<!-- Tests, smoke checks, reproduction evidence, screenshots, or manual verification. -->

## Risk and rollback

<!-- Failure modes, compatibility impact, rollout plan, and how to reverse safely. -->

## Boundary and privacy

<!-- State whether docs/open-source-boundary.md was reviewed and whether sanitization was needed. -->

## Checklist

- [ ] The linked issue contains the use case/reason and measurable acceptance criteria
- [ ] The change is focused on that issue; unrelated findings have separate issues
- [ ] Tests reproduce bug fixes and cover behavior changes
- [ ] Consistency, PII, and proportional smoke gates pass
- [ ] No generated runtime state, credentials, personal data, or private knowledge is included
- [ ] Documentation and ADRs are updated where behavior or architecture changed
- [ ] I reviewed the final diff and rollback path
- [ ] Agent-context wording (`SKILL.md`, `skills/`) is concise and does not conflict with an accepted ADR or duplicate an existing method
- [ ] Playbook changes follow the matching template, update the coverage map, and meet the specific/falsifiable/primary-sourced/dated/general quality bar
- [ ] Engine changes remain Python-stdlib-only, unless a dependency was justified in the linked issue and approved during review
