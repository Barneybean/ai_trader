# ADR-0038: Agent-run budgets are progress-aware

Date: 2026-07-15 · Status: Accepted

## Context

Decision-grade reports may require many independent tools. A fixed call count can stop useful work
even while each result adds evidence, while a high fixed ceiling still does not identify a repeated
failure loop. Output-token ceilings have the same problem for long but productive streamed runs.

## Decision

Production runs have no default tool-call or streamed-output ceiling while successful, varied work
continues. Every attempt still has a wall-clock timeout. Circuit guards stop:

- the same semantic tool call repeated more than six times;
- the same normalized tool failure repeated more than three times; or
- more than eight consecutive tool failures without a successful result.

Operators may set finite call or output ceilings for diagnostics and tests. An unfinished report or
ordinary non-report run stopped by a loop/stall guard may receive exactly one fresh recovery pass.
Report recovery reuses completed artifacts and any captured read-only broker snapshot; recovery
cannot write broker orders. Broker-execution runs never retry, and recovery cannot recurse.

## Consequences

Long productive reports can finish without an arbitrary call-count failure, while semantic loops and
failure stalls stop earlier and more specifically. A successful tool result resets failure-stall
state but does not erase repeated-call history. The policy is runtime reliability only: it does not
diagnose, edit, or repair the bridge.

## Alternatives considered

- Increase fixed report ceilings—rejected because the limit remains arbitrary and failure loops can
  still waste the whole allowance.
- Retry until completion—rejected because repeated recovery can loop and broker retries can duplicate
  side effects.
