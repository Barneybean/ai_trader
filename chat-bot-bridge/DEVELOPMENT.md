# Bridge developer guide

The bridge is the toolkit's messenger/runtime adapter, not a second trading engine. It receives an
authenticated message, runs an agent in the toolkit checkout, and safely delivers the result.
Permanent changes follow [`../DEVELOPMENT.md`](../DEVELOPMENT.md) and the public/private boundary in
[`../docs/open-source-boundary.md`](../docs/open-source-boundary.md).

## Choose the right home

| Change | Canonical home |
|---|---|
| Indicators, order validation, report rendering, journal/learning, portable operations | `../scripts/<analysis|execution|journal|report|ops|lib>/` |
| Investment method, risk rule, source standard, execution protocol | `../skills/` or `../docs/` |
| Provider I/O, phone sessions, agent processes, bridge state, safe delivery | `src/` by domain |
| Completed-report discovery/recovery/delivery | `src/reports/` |
| Saved-ticket parsing and authenticated approval resolution | `src/broker/` |

Node code belongs here only when removing the messenger/runtime would make the capability
meaningless. The bridge may consume desk policy but must not reimplement investment, sizing,
privacy, or execution decisions.

## Required no-bridge design check

Before adding a bridge feature, ask whether it is still useful when phone messaging is absent. If
yes, put the behavior in the repository core with a local entrypoint, local result/artifact, and
documented configuration precedence; make the bridge a thin caller. If no, record why the behavior
is genuinely transport- or session-specific and test that boundary.

The scheduler shipped in this directory is bridge-backed and requires the bridge process. Do not
describe it as a bridge-independent core scheduler unless a separate local runtime is implemented.

## Layout

```text
chat-bot-bridge/
├── server.js                 stable compatibility entrypoint
├── scheduled-run.js          stable scheduled-run submitter
├── service-control.sh
├── package.json
├── src/
│   ├── app/                  composition root and provider/agent wiring
│   ├── agents/               catalogs, routing, availability, handoff
│   ├── broker/               preflight and exact saved-ticket resolution
│   ├── control/              phone commands and mode-aware channel rules
│   ├── delivery/             media, output, telemetry, change reviews
│   ├── reports/              artifact detection, recovery, delivery
│   └── runtime/              clock and schedule semantics
└── test/
    └── <same-domain>/        mirrored Node unit tests
```

`server.js` and `scheduled-run.js` remain at the root for launchd, npm, and existing operators.
Runtime state also stays at the root and remains ignored: `.env`, `state.json`, local availability
history, sessions, and `logs/`.

Autonomous self-healing is outside the public product boundary. Do not add repair prompts,
fault-adjudication triggers, worktree/commit/merge/restart automation, or `/heal` controls here or
elsewhere in the public toolkit. Ordinary fault logging, bounded retries, provider fallback, and
human-directed debugging remain allowed.

## Dependency rules

```text
server.js → src/app/bridge-server.js → src/<domain>/ → desk CLI / skills / files
```

- `src/app/` is the only broad composition layer.
- Domain modules never import `src/app/` or the root entrypoint.
- `src/agents/` selects an available runtime; it does not decide trades.
- `src/broker/` resolves authenticated phone intent; Python validation and live broker
  reconciliation remain authoritative.
- `src/control/` consumes the canonical trading-mode protocol.
- `src/reports/` finds and delivers artifacts; `scripts/report/` builds them.
- `src/runtime/scheduled-task.js` may depend on the broker preflight prompt so scheduled reports
  prove live capability before delivery.

Before adding another provider or transport, open a focused issue for a provider-adapter contract;
do not add a parallel root server.

## Test and review checklist

Run from `chat-bot-bridge/`:

```bash
npm test
node --check server.js
node --check scheduled-run.js
node --check src/app/bridge-server.js
```

Architecture and cross-boundary changes also run, from the repository root:

```bash
python3 scripts/ops/check_consistency.py
python3 scripts/ops/smoke_test.py --staged
python3 scripts/ops/scan_pii.py --staged --allow-knowledge
```

Every new module needs a mirrored test. Do not stage runtime state, generated reports, logs,
credentials, or private self-healing material. Service activation stays deferred until any active
phone/scheduled run finishes; the stable root entrypoint means this layout needs no plist changes.
