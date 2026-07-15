# User Manual

How to drive the desk from your phone or a terminal. The methodology itself lives in
`SKILL.md` and `skills/`.

---

## Daily-report promise

You do not need to say “complete” to get complete work. “Run a daily report,” “run a full daily
report,” and “run a complete daily report” all invoke the maximum decision-grade pipeline: recall
history first, gather enough fresh dated evidence, run the relevant roles and engines, debate the
thesis, apply the risk and sufficiency gates, and return the full human-reviewable report.

Use “quick update,” “changes only,” or “status only” only when you want monitoring rather than a
report. If a quick check surfaces a possible action, the desk should escalate to the full analysis
before recommending anything.

---

## Talking to the desk

**Terminal:** run your coding agent in the repo and ask for a report, analysis, or review in plain
language.

**Phone:** use the optional bridge in `docs/phone-connection.md` if you want the same interaction
from a messaging app.

Examples:

- `Run a daily report on NVDA.`
- `Run a complete report on AI robotics opportunities.`
- `Analyze META.`
- `What changed since the last run?`

---

## Modes and commands

The public docs expose the same command surface as the phone bridge.

| Command | What it does |
|---|---|
| `/status` | Show bridge health, active agent, mode, and session state. |
| `/agent` | Open a numbered picker of configured agent/model pairs — up to four models each with passive availability; every pair has its own number. |
| `/agent N` (or a bare `N` within five minutes) | Select that exact default agent and model for future runs. |
| `/agent codex` · `/agent claude` | Open that agent's focused model picker. Manual selection changes future runs only — it does not interrupt the active turn or disable automatic availability switching. |
| `/new` | Start fresh sessions and clear old conversation state. |
| `/mode` | Show the current trading mode. |
| `/mode manual` | Require explicit confirmation for each order. |
| `/mode semi` | Propose numbered tickets and wait for approval. |
| `/mode full` | Run autonomous decisions in validate-only shadow mode; no order is placed. |
| `/stop` | Interrupt the active turn but keep its session and any completed file. |
| `/steer TEXT` | Redirect the currently running turn without starting over. |
| `/decide N` | Answer a pending agent decision by number and resume that session. |
| `/help` | List the supported commands. |

---

## Reports and recovery

The phone bridge automatically sends each new, complete HTML report once; the agent does not need
to remember a `FILE:` marker. A rerun preserves the earlier report and creates a distinct
`-rerun-HHMMSS` artifact. Use `new_report.py --update <finished-report>` only when intentionally
revising an existing report.
Only an explicit request to revise a named report updates an existing one; the desk asks when the
target is ambiguous.

Successful, varied tool results count as progress, so production report runs have no default
tool-call or output ceiling. The wall-clock timeout and loop/stall guards remain: repeated semantic
calls, repeated identical failures, and sustained failures without a successful result stop the run.
If report generation stops at one of those guards, the bridge can make one fresh-session completion
attempt. That attempt cannot place, cancel, or replace orders, cannot recurse, and incomplete report
scaffolds are never delivered. Execution transcripts stay in local ignored logs unless you opt in to
phone delivery. In semi mode, saved report tickets are followed by a compact numbered action list and
the exact `approve N` / `approve all` instruction. You can also discuss a pending ticket naturally,
revise it into a new numbered proposal, or use `close N` / `close all` to remove it from the local
queue without touching a broker order. A new reconciled report automatically retires an older ticket
that it does not re-propose.

Intentional or recovery scheduled re-runs are allowed and receive distinct artifact names. The
included scheduler is bridge-backed and requires the bridge process; without it, invoke or schedule
the terminal workflow directly. Only a near-simultaneous double-fire of the same schedule kind is
debounced. An ordinary non-report run stopped by a loop/stall guard may receive one same-agent
recovery pass; broker-execution runs never use that retry.

---

## Safety rules

- Never publish secrets, account identifiers, or live session IDs.
- Keep the bridge and agent order configurable.
- Use the public boundary standard in `docs/open-source-boundary.md` when deciding what belongs in
  the reusable core.
- A significant docs or behavior change should run `python3 scripts/ops/smoke_test.py` and the normal
  consistency / PII checks before you ship it.
