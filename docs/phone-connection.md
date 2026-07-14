# Phone Connection

Use a messaging bridge if you want the desk reachable from your phone.

This repo publishes the interface and the guardrails, not a personal live configuration. Keep
provider tokens, chat IDs, and session state in local git-ignored files.

The bridge runtime lives under [`chat-bot-bridge/`](../chat-bot-bridge/).

## What the bridge should do

- accept plain-language desk requests from your phone;
- forward reports, approvals, follow-ups, and questions to the active agent;
- show the current mode, agent preference, and session health;
- preserve confirm-before-order behavior in every mode;
- fall back cleanly when the active agent is unavailable, without exposing private session data;
- attach each newly completed report once, while keeping execution transcripts local by default;
- make one bounded, broker-write-disabled recovery attempt when a report alone reaches its tool cap.

## Setup shape

1. Choose a supported messaging provider.
2. Configure the bridge locally with provider credentials and allowlists.
3. Connect it to the desk workspace and verify it can read the repo instructions.
4. Confirm that `/status`, `/agent`, `/mode`, `/new`, and `/help` respond before trusting it.

The bridge stores observed model limits in a bounded, git-ignored local ledger and skips currently
unavailable choices during automatic fallback. Scheduled report submissions are deduplicated per
kind and local calendar day unless the scheduler explicitly requests a forced rerun. A rejected
queue-full submission remains eligible to run later.

Recorded runtime events use UTC; the phone shows report dates and model reset clocks in labeled
Pacific time (`PT`, `PST`, or `PDT`).

## Common commands

| Command | Meaning |
|---|---|
| `/status` | Show bridge health, active agent, mode, and session state. |
| `/agent` | Open a numbered picker of configured agent/model pairs — up to four models each with passive availability; every pair has its own number. |
| `/agent N` (or a bare `N` within five minutes) | Select that exact default agent and model for future runs. |
| `/agent codex` · `/agent claude` | Open that agent's focused model picker with availability. Manual selection does not disable automatic availability switching. |
| `/new` | Start fresh sessions and clear old conversation state. |
| `/mode` | Show the current trading mode. |
| `/mode manual` | Require explicit confirmation for each order. |
| `/mode semi` | Propose numbered tickets and wait for approval. |
| `/mode full` | Validate autonomous proposals in shadow mode; never place an order. |
| `/stop` | Interrupt the active turn but keep its session and any completed file. |
| `/steer TEXT` | Redirect the currently running turn without starting over. |
| `/decide N` | Answer a pending agent decision by number and resume that session. |
| `/help` | List the supported commands. |

Everything else should behave like normal desk conversation.

## Safety notes

- Do not publish secrets, account identifiers, or live session IDs.
- Do not publish runtime availability, delivery, report, transcript, or scheduling state.
- Keep agent priority configurable; do not hardcode a private personal order into the public docs.
- If the bridge changes the public/private boundary, update [docs/open-source-boundary.md](open-source-boundary.md) in the same change.
