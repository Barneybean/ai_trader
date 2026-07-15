# Universal messenger desk bridge (official APIs)

Text the desk from your phone and the message runs on this computer through a supported headless
agent inside the AI Trader Toolbox repository. The reply returns through the same app. Codex and
Claude keep separate resumable sessions; bounded recent chat context carries across an availability
fallback without merging their session state.

Copy [`.env.example`](.env.example) to `.env` and fill in your own provider values before starting.
Before installing launchd services, replace `YOUR_NAME`, executable paths, tunnel domain, timezone,
and example schedule times in the `com.example.*.plist` templates. Install commands intentionally
refuse unresolved `YOUR_NAME` placeholders.

Four official providers share one transport contract. Select one with `PROVIDER`; credentials
can also auto-detect from the user-configured provider priority order:

- **telegram** — Telegram Bot API long-polling. Free forever, near-instant,
  no tunnel, no inbound port, no re-joins. Bot: t.me/YOUR_BOT; only
  `TELEGRAM_ALLOWED_USER_ID` is obeyed.
- **discord** — Discord Bot REST API polling. No tunnel or inbound port; supports text,
  typing indicators, and report attachments. Only `DISCORD_ALLOWED_USER_ID` in the configured
  `DISCORD_CHANNEL_ID` can drive the desk.
- **twilio** — Twilio WhatsApp API, polling or webhook mode. Trial accounts may require a
  ContentSid template on every send, and template creation is behind the $20 upgrade
  (error 21654).
- **meta** — WhatsApp Business Cloud API direct (webhook mode only). Use this when you have
  a verified business setup and want the direct WhatsApp path.

**Zero npm dependencies**: the server uses only Node built-ins (`http`, `crypto`, `fetch`).

Implementation is organized by responsibility under `src/` (`agents`, `broker`, `control`,
`delivery`, `reports`, and `runtime`) with mirrored tests under `test/`. Root `server.js` and
`scheduled-run.js` remain stable compatibility entrypoints. See [`DEVELOPMENT.md`](DEVELOPMENT.md).

Adding another app now requires one adapter with `send`, optional `sendFile` and `typing`,
`start`, and its text limit. Desk commands, serialization, sessions, allowlisting, status
messages, and file security remain provider-independent.

```text
Telegram · Discord · WhatsApp
              │ official provider API
              ▼
        server.js on this computer
              │ serialized run + isolated session
              ▼
        Codex or Claude CLI
              │
              └── reply / report attachment → the originating app
```

## Security model

- **Polling mode has zero inbound surface** — the laptop only makes outbound HTTPS calls to
  api.twilio.com; there is no listener, no tunnel, no public URL to attack.
- (Webhook mode, when used: Twilio `X-Twilio-Signature` HMAC-SHA1 / Meta `X-Hub-Signature-256`
  HMAC-SHA256, timing-safe compares, localhost-bound listener behind the tunnel.)
- **Sender allowlist.** Each provider requires its own allowed user/phone identifier. Other
  senders are logged and ignored—nobody else can drive the desk.
- **Dedup + serialization.** Message IDs are deduplicated and prompts run one at a time, so two
  agents never operate the same trading desk concurrently.
- **Order discipline is mode-gated** (see Trading modes below): manual = per-order confirm,
  semi = numbered-ticket approval, full = validate-only autonomous shadow. In **every** mode
  only the locally configured execution account is tradable; all other accounts remain read-only,
  and money movement (transfers/ACH) is forbidden.
- **Secrets stay in `.env`** (git-ignored), as do `state.json` and `logs/`.

## Setup — Telegram

1. Create a bot with @BotFather and put its token plus your numeric user ID in `.env`.
2. Replace `YOUR_NAME` paths in the `com.example.*.plist` templates, then install the bridge
   (`npm run service:install`). Telegram uses long polling and needs no public inbound port.
3. Message **t.me/YOUR_BOT**. Commands: `/new`, `/status`, `/mode`, `/decide`, `/help`.

To re-create from scratch: @BotFather → `/newbot` → put the token in
`TELEGRAM_BOT_TOKEN` → message the bot once → `curl .../getUpdates` to read your numeric
`from.id` → `TELEGRAM_ALLOWED_USER_ID` → `npm run service:restart`.

## Setup — Twilio WhatsApp

Put the Account SID, auth token, sender, and your allowed phone ID in `.env`, then set
`PROVIDER=twilio`. Polling mode needs no public inbound port. Twilio trial/sandbox restrictions,
template requirements, pricing, and join-expiration rules vary; confirm the current provider rules
before relying on this channel. If a template is required, set `TWILIO_CONTENT_SID`.

## Setup — Discord

1. Create an application and bot in the Discord Developer Portal and enable its Message Content
   intent. Invite it to a private server with View Channels, Read Message History, Send Messages,
   Attach Files, and Send Messages in Threads permissions.
2. Enable Discord Developer Mode, then copy your user ID and private channel ID into
   `DISCORD_ALLOWED_USER_ID` and `DISCORD_CHANNEL_ID`; put the bot token in
   `DISCORD_BOT_TOKEN`.
3. Set `PROVIDER=discord` and restart with `npm run service:restart`. The first poll records a
   safe watermark and intentionally does not replay existing channel history.

## Setup — Meta WhatsApp Cloud API

1. In the Meta developer dashboard, create or select your own app and business portfolio. Under
   **WhatsApp → API Setup**, copy the Phone Number ID and access token; get the app secret from
   **App settings → Basic**.
2. Fill the meta section of `.env` (`WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `APP_SECRET`;
   `VERIFY_TOKEN` is pre-generated), blank `TWILIO_ACCOUNT_SID` (or set `PROVIDER=meta`).
3. Meta is webhook-only: install your preferred tunnel, then edit
   `com.example.chat-bot-tunnel.plist` and run `npm run tunnel:install`.
   then App dashboard → WhatsApp → **Configuration** → callback `https://<domain>/webhook` +
   verify token from `.env` → subscribe to **messages** → `npm run service:restart`.
4. For permanence swap the 24h token for a system-user token (Business Settings → System
   Users → Generate Token, permissions `whatsapp_business_messaging` +
   `whatsapp_business_management`).

## Robinhood MCP (broker account data from the phone)

Broker access is optional. Register and authenticate a supported broker connector in the agent
runtime you intend to use; headless sessions can then reuse that runtime's local authentication.
Without a connector, the desk falls back to the documented web/manual-data workflow and never
pretends an order was placed.

## Trading modes (desk core — the bridge is just one door)

The mode system lives in the toolkit, not here: canonical protocol
`../skills/decision/trading-modes.md`, state `../desk-mode.json`, terminal CLI
`../scripts/ops/desk_mode.py`. Every session — terminal, scheduled, phone — reads the same
switch; this bridge's `/mode` command and its injected chat rules are consumers.

A `/mode` command on your phone switches between three levels of execution authority,
applied from the very next message and the next scheduled run:

- **/mode full** — the desk decides what it would do, runs each ticket through the deterministic
  execution gateway, and reports `VALIDATED PROPOSAL` or `BLOCKED`; it never places an order.
- **/mode semi** — the public default; numbered, fully-specified tickets; you
  reply `approve 1` or `approve all` and exactly those execute. Ad-hoc orders still get one
  confirm round-trip each.
- **/mode manual** — advise-only kill switch; every exact order requires
  its own preview and explicit confirmation in a later message.

`/mode` alone shows the current mode. In every mode, accounts outside the configured execution
scope are read-only, and no mode permits money movement. Full user manual:
[`../docs/user-manual.md`](../docs/user-manual.md).

## Use

Send normal requests such as `run the alerts sweep`, `analyze SYM`, or `run today's report`.
An order request still follows the active trading mode and exact-ticket confirmation rules.

Bridge commands: `/new` (fresh sessions for every agent), `/status` (active run or bridge health),
`/mode` (view/set trading mode), `/agent` (numbered agent/model picker), `/stop` (interrupt the active
turn but preserve its session), `/steer TEXT` (redirect the running turn), `/decide N` (answer a
pending agent decision), and `/help`. Long-running requests stream a compact live run card; the
bridge runs one prompt at a time.

`/agent` opens a bridge-native numbered picker of configured agent/model pairs — up to four models
each, with passive availability that never spends tokens to display. Reply `/agent N` or a bare
number within five minutes to set the exact default for future runs, or `/agent codex`|`claude` for
one agent's focused model menu. Manual selection changes future runs only: it does not interrupt the
active turn or disable automatic availability switching, and a recent observed availability failure
stays marked (with a reset time when known) across bridge restart and model handoff.
Those observations live only in the git-ignored, bounded `model-availability.json` runtime ledger;
the public repository ships no user's availability history. Automatic fallback skips a model while
its observed limit is current and considers at most three configured models per registered agent.
It tries eligible models from the preferred agent before crossing to another provider, preserving
the lower-cost session boundary whenever possible.

When the agent needs a material choice mid-run it does not guess — it posts a numbered decision and
pauses; your `/decide N` resumes that session. When a phone interaction changes repository files, the
bridge produces a private mobile code-change review (kept in the git-ignored runtime directory, never
in the investment `reports/` tree). After editing bridge runtime code, activation is deferred until
the current reply is delivered, so a restart never drops your in-flight message.

`/agent` shows or sets the default phone agent. AUTO uses the configured priority order first
and falls back to the next available agent. If the active agent hits a usage limit or cannot continue,
the bridge switches to the next available agent, keeps the recent phone context, and tells
you which agent/model took over. If the handoff cannot preserve context cleanly, the reply
says so and the replacement agent restarts from the original prompt.

### Reports, recovery, and scheduled runs

Every successful run automatically attaches each new, complete, self-contained
`reports/**/*.html` artifact. Explicit `FILE:` attachments and auto-discovered reports share one
delivery ledger, so the same document is not sent twice. Files must resolve inside this repository;
hidden files, bridge runtime/config files, symlink escapes, and oversized artifacts are rejected.

Successful, varied tool results count as progress, so production report runs have no default
tool-call or streamed-output ceiling. The configured wall-clock timeout still applies, and circuit
guards stop repeated semantic calls, repeated identical failures, or sustained failures without a
successful result. Optional finite ceilings remain available for diagnostics and tests.

If a report stops at one of those guards before a complete HTML artifact exists, the bridge may make
one fresh-session, report-only completion pass. The pass reuses existing work, keeps the same
progress guards enabled, and cannot write broker orders. A complete report recovered from a failed
run is still attached; incomplete scaffolds are not. Scheduled reports build one read-only broker
snapshot rather than polling the same endpoints; recovery reuses an already completed snapshot
instead of fetching it again. An ordinary non-report run stopped by the same loop/stall guards may
retry once with the same agent; broker-execution runs never take that retry. There is no recursive
recovery or autonomous repair. Execution transcripts remain local unless `PHONE_EXECUTION_LOG`
explicitly enables delivery.

Repeated-call detection fingerprints observable semantic tool input. Opaque web-search events that
omit their query still count against the total run budget, but they are not falsely classified as
identical calls; genuinely repeated queries and stable MCP/command inputs remain protected.

Scheduled pre-market, optional mid-market, and post-market requests allow intentional and recovery
re-runs, which receive collision-safe report names. Only a near-simultaneous double-fire of the same
kind is debounced; `force: true` and plumbing tests bypass the debounce. Invoke the optional update with
`node scheduled-run.js midmarket`; it checks the morning plan rather than re-underwriting the day.
Each accepted report run preserves prior artifacts rather than overwriting them.
When semi-auto output contains actionable tickets, the phone receives a compact numbered follow-up
with the exact approval wording. Users may discuss a pending ticket naturally, revise it into a new
numbered proposal, or use `close N`/`close all` to remove it from the local queue without touching a
broker order. A reconciled report that does not re-propose an older ticket retires it automatically.

## Troubleshooting

- **No reply at all** → check `logs/bridge.log`, provider credentials, the sender allowlist, and
  any provider-specific sandbox, template, or conversation-window requirement.
- **"claude exited without JSON"** → run the failing prompt manually:
  `claude -p "<prompt>" --output-format json --settings chat-bot-bridge/claude-settings.json` in the desk dir.
- **Stuck/looping session** → send `/new`.
- **Agent switched mid-run** → normal on limit or unavailability. The phone should show
  both agent/model tags, for example `codex -> claude` or `claude -> codex`.
- Service: `launchctl list | grep chat-bot-bridge`; `npm run service:restart` / `service:uninstall`;
  logs in `logs/bridge.log` + `logs/bridge.err.log`.

## Security note — residual risk

Headless agents can run shell commands, so prompt injection remains a meaningful risk even with
`.env` read denials. Keep the sender allowlist narrow, avoid group-chat relays, restrict broker
authority, and rotate provider tokens after any suspected compromise. The public `com.example.*`
plists are templates only: replace their placeholder paths locally and never commit the customized
copies, `.env`, state, sessions, or logs.
