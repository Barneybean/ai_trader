# ADR-0036: Bridge runtime boundary and domain layout

Date: 2026-07-15 · Status: Accepted

## Context

The toolkit intentionally uses Python for portable deterministic desk work and Node for the
long-lived messenger/runtime adapter. Flat peer modules beside a large `server.js` obscured
ownership and made test discovery fragile.

## Decision

- Python remains canonical for analysis, report rendering, journal/learning, operations, and the
  validate-only execution gateway. Skills/docs remain canonical policy.
- Bridge modules move below `chat-bot-bridge/src/` by domain: `agents`, `broker`, `control`,
  `delivery`, `reports`, and `runtime`; unit tests mirror those domains under `test/`.
- Root `server.js` and `scheduled-run.js` remain compatibility entrypoints. Runtime composition
  lives in `src/app/bridge-server.js`, the only broad cross-domain wiring layer.
- Domain modules never import the app/root entrypoint and do not duplicate desk policy.
- `npm test` is the single test-discovery authority; an architecture test locks the layout.

Autonomous self-healing, repair prompts/adapters, fault-triggered code changes, and `/heal` controls
remain outside the public product and are explicitly absent from this layout.

## Consequences

Ownership is navigable, launchd/operator paths remain stable, and a future provider extraction has
a clear composition boundary. The large app module remains explicit technical debt.

## Alternatives considered

- Move all desk logic to Node—rejected because it duplicates the portable toolkit.
- Keep the flat directory—rejected because it hides ownership and weakens test discovery.
