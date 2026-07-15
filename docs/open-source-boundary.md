# Open-Source Boundary, Customization, and Source-Sync Policy

**Status:** Canonical development reference
**Last reviewed:** 2026-07-13
**Applies to:** Any feature, skill, script, documentation, example, or configuration proposed for
`ai-trader-toolbox` or another public distribution.

This document defines what moves from the private source repo into the generic open-source
toolkit. It exists to achieve two goals at once:

1. Give new users a useful, trustworthy desk that works before they customize it.
2. Keep personal trading state, paid/private knowledge, credentials, and machine configuration out
   of public history.

This is a living standard. Review and update it whenever a feature changes the toolkit's strategy
defaults, risk model, data sources, execution authority, broker support, learning/memory, phone
access, reporting, privacy boundary, or public contribution model.

## Policy architecture

This file is the single human-readable policy. [`source-sync-policy.json`](source-sync-policy.json)
is its machine-enforced path/invariant profile, and `scripts/ops/sync_audit.py` is the read-only
auditor. The source may be a private desk, separate worktree, fork, or unrelated checkout. The
auditor never copies, edits, stages, commits, or pushes:

```bash
python3 scripts/ops/sync_audit.py --source /path/to/source
python3 scripts/ops/sync_audit.py --source /path/to/source --json
# From a source checkout that also carries this SOP:
python3 scripts/ops/sync_audit.py --source . --target /path/to/public-toolkit
```

Policy rules are source-agnostic and ordered. A new recurring path or sensitive-state category
belongs in the machine policy; a new authority, architecture, or privacy decision also updates this
document and receives an ADR.

## Threat model and classifications

Past sync failures included parallel feature directories, copied machine paths/schedules/models,
private account and tax assumptions becoming public defaults, stale docs after code moves, deleted
public security assets, private repos retaining public remotes, and syntax-clean features that did
not work. The process therefore classifies every difference before editing:

| Class | Meaning | Required action |
|---|---|---|
| `never_import` | Credentials, machine/runtime state, personal data/knowledge, or generated output | Do not copy. Extract a generic mechanism or blank template only. |
| `preserve_public` | Security/contribution assets, examples, ADR history, or compatibility surfaces | Keep the public version; never replace wholesale. |
| `sanitize_required` | Reusable behavior mixed with identity, paths, preferences, accounts, schedules, or policy | Port manually with neutral templates and safe defaults. |
| `reusable_candidate` | Generic mechanism likely suitable for public use | Review rights/content, port manually, and test. |
| `manual_review` | New surface not yet covered by policy | Stop, classify, and update policy if recurring. |

Classification is routing, not permission to publish. Automatic mirroring is never allowed.

## The product boundary

The public project ships **machinery, strong defaults, customization templates, safety gates, and
sanitized examples**. A user's private overlay supplies **personal philosophy, risk and cash
policy, mentor history, watchlists, positions, credentials, reports, and outcomes**.

```text
Public toolkit                     Private user overlay
├── research and risk workflow     ├── trading philosophy
├── analysis engines               ├── risk and cash policies
├── learning/scoring framework     ├── watchlists and positions
├── HTML reporting                 ├── mentor history
├── broker adapter interface       ├── credentials and account state
├── privacy/reliability gates      ├── execution preferences
├── customization templates        ├── reports and outcomes
└── fictional examples             └── machine configuration
```

## Canonical directory structure

Reusable features keep the same canonical path in private and public repositories. Do not create
a second public alias when sanitizing a feature.

| Capability | Canonical public path | Rule |
|---|---|---|
| Messenger/phone access | `chat-bot-bridge/` | One provider-neutral bridge; never add parallel `phone-bridge/`, `telegram-bridge/`, or app-specific runtime trees. |
| Analysis engines | `scripts/analysis/` | Former flat scripts are compatibility launchers only. |
| Journal machinery | `scripts/journal/` | Code is public; user journal data is private. |
| Shared libraries | `scripts/lib/` | Source code, never confused with root packaging artifact directories. |
| Execution gateway | `scripts/execution/` | High-authority code requires sanitization, deterministic validation, and sandbox tests before public release. |
| Operations and gates | `scripts/ops/` | Hooks, privacy, consistency, smoke, mode, packaging, and setup. |
| Report machinery | `scripts/report/` | Builders are public; generated reports and assets are private runtime output. |
| Methods and policies | `skills/` | Generic/configurable methods only; personal overlays remain ignored. |

Public-only contribution surfaces such as `SECURITY.md`, CI workflows, issue/PR templates,
sanitized examples, and compatibility launchers must survive a private-to-public sync. Private or
runtime-only paths—`.claude/`, `config.local.toml`, `.env`, `desk-mode.json`, `dist/`, `logs/`,
bridge state/sessions, journal data, report builds/caches/archives/assets, and customized launch
agents—must not be mirrored. Empty obsolete aliases should be removed rather than documented.

## Include in open source

### Generic research and decision infrastructure

- Fundamental, quant, sentiment/news, macro, bull, bear, risk, and CIO roles.
- Variant perception, business inflection, valuation/quality, reverse-DCF, catalyst, industry-map,
  thematic-wave, crisis, and black-swan protocols.
- Evidence sufficiency, dated sourcing, invalidation, position sizing, and reward:risk gates.
- Confirm-before-order execution as the safe default.

### Reusable engines and operations

- Generic analysis engines under `scripts/analysis/`.
- Generic journal/learning tools under `scripts/journal/`.
- Shared libraries, report generation, archive organization, and broker interfaces.
- PII scanning, consistency checks, smoke tests, hooks, CI, atomic writes, and ADR tooling.
- Setup guidance for reducing agent permission prompts: recommend scoped workspace/tool allowlists
  first; label unrestricted bypass as dangerous and incompatible with live broker execution.
- Compatibility wrappers when a public path migration would otherwise break existing users.

### Learning and customization framework

- Decision logging, benchmark scoring, reflections, insight registry, weekly review, action levels,
  unified recall, and machine-readable report memory.
- Empty or fictional templates for personal philosophy, risk, cash, execution, data-source,
  watchlist, and mentor policies.
- A setup flow that asks users about their horizon, drawdown tolerance, concentration, preferred
  methods, cash policy, confirmation rules, and learning cadence, then writes private local files.

### Generic mentor capability

- Append-only snapshot schema, allocation/target deltas, conviction history, disagreement analysis,
  outcome validation, and anti-copy-trading safeguards.
- Only fictional or clearly sanitized example snapshots.
- Canonical rule: mentor behavior is evidence to test, not an instruction to copy.

### Configurable strategy defaults

Universal process rules can be firm: source the evidence, state the bear case, define invalidation,
size risk, require confirmation, and keep score. Strategy preferences must be configurable.

Examples:

- **Strength entries:** the public toolkit may prefer quality on weakness while offering an
  exceptional-strength continuation gate. Remaining upside, fundamental proof, wave position,
  accumulation, structure, and RR determine PASS / WAIT / LATE. MU or SanDisk may appear only as
  dated educational examples, never hardcoded recommendations.
- **Cash:** publish a dynamic framework, not a permanent allocation. Example policy bands may be
  35–50% in hostile conditions, 20–35% in ordinary conditions, and 15–20% after a confirmed shock
  recovery. Users must be able to replace these bands and the recovery criteria privately.
- Fixed valuation hurdles, indicator preferences, position caps, sleeve splits, holding periods,
  and execution modes are defaults or optional modules—not universal truths.

### Complete-by-default report standard

The public toolkit should not make users discover a magic word for adequate analysis. “Daily
report,” “daily desk run,” “full daily report,” and “complete daily report” must invoke the same
maximum decision-grade pipeline with sufficient current data, supporting evidence, historical
recall, book-state reconciliation (open orders + cash-vs-buying-power before the orders section),
relevant engines and roles, adversarial review, risk/sufficiency gates, sources, charts,
and the full human-reviewable HTML report. Reduced monitoring is allowed only through explicit
phrases such as “quick update,” “changes only,” or “status only,” and any actionable finding must
escalate automatically to the complete pipeline.

### Public proof and contribution surfaces

- Sanitized bilingual HTML reports and fictional data fixtures.
- Reproducible calculations, dated sources, honest failures, paper/sandbox tests, and benchmarked
  track records where appropriate.
- README, user manual, roadmap, contribution guide, security policy, issue/PR templates, and public
  ADRs.
- A generic, sanitized phone bridge may include provider abstraction, allowlisting, model fallback,
  file delivery, schedules, privacy rules, and placeholder launchd templates.

Every public feature, bug fix, or behavior change must use the traceable lifecycle in
[`DEVELOPMENT.md`](../DEVELOPMENT.md): issue with a use case/reason and acceptance criteria → scoped
branch update → reviewed MR/PR that closes the issue → merge. Preserve the public issue forms,
MR/PR template, and traceability workflow during source syncs. Emergency containment may precede an
issue only when it is reversible and time-sensitive; permanent code still follows the full flow.

### Agent routing and resilient switching

The public update should include the reusable multi-agent routing capability:

- `auto` routing with configurable priority rather than hardcoded vendor preference;
- a short-lived numbered `/agent` picker where each visible agent/model pair can become the default;
  an agent-focused picker lists a bounded passive catalog without launching paid probe turns or
  interrupting the active run;
- availability observations and provider reset times may drive bounded no-session-persistence
  recovery probes, which a manual default change cancels;
- a user-selected continuation model remains the temporary ordinary-request route while the default
  is quarantined; broker capability routing remains exempt;
- fallback only for rate limits, quota/authentication failures, missing binaries, or other defined
  availability failures—not because one agent disagrees with another's investment answer;
- separate session IDs per agent, serialized execution, and a bounded recent-history handoff when
  switching so continuity is preserved without merging/corrupting contexts;
- `/new` clearing all agent sessions, and `/status` showing preference, last agent, priority, and
  session health without exposing sensitive identifiers;
- deterministic receipt, agent-start, fallback/trouble, elapsed-time, and completion messages so
  phone latency is observable;
- a sanitized live run card plus queue-safe `/status`, `/steer`, and `/stop` controls; interruption
  preserves resumable session state and completed files without exposing raw output;
- provider-neutral inbound images with owner checks, HTTPS download, MIME/signature/size validation,
  ignored private storage, retention cleanup, and handoff continuity;
- per-interaction source snapshots and privacy-redacted mobile change reviews that exclude existing
  dirty worktree changes and runtime/private/generated files;
- scheduled decision-grade reports that prove broker capability through an observed live read-only
  preflight before delivery;
- configurable binaries, timeouts, and agent priority through sanitized environment examples;
- tests for availability detection, model-choice eligibility, default behavior, session separation,
  command handling, and prevention of concurrent trading sessions.

The public default may prefer whichever supported agent is most available, but the order must be
user-configurable. Agent switching changes the runtime, never the desk's research, risk, privacy,
or execution rules.

### Trading Desk-only self-healing

Autonomous self-healing is private Trading Desk infrastructure and is `never_import`, not a
sanitizable public capability. Do not port or recreate `runtime/self-healing/**`, its plans/ADRs,
agent repair prompts, worktree/merge adapters, review-resume state, enablement commands, tests, or
examples in AI Trader Toolbox. The public bridge may retain ordinary reliability observability,
fault logging, bounded retries, model fallback, and human-directed debugging; it must not diagnose,
edit, commit, push, merge, or restart its own code.

This boundary applies even when the private implementation looks generic or contains no personal
data. Publishing self-healing requires a separate explicit boundary-policy decision; an ordinary
source-sync request is insufficient. During a public sync,
`chat-bot-bridge/src/app/bridge-server.js` and `src/control/remote-control.js` require fragment-level
review: remove every self-healing/fault-adjudication import, state hook, queue/runner hook, and every
`/heal` command/help surface. Copying either private file wholesale is prohibited.

## Do not include in open source

### Personal trading state

- Current or historical positions, balances, buying power, cost bases, P&L, action levels, trade
  plans, personal watchlists, private theses, journals, report memory, live reports, or charts.
- Private-deal information or personal account-placement/tax details.

### Mentor and paid/private knowledge

- Live mentor positions, weights, targets, screenshots, dated snapshot data, members-only comments,
  paid-content summaries, or private interpretations of current calls.
- `journal/mentor-book.json` and real `journal/mentor-snapshots/*.json`.
- Named methodologies unless their content is lawfully public, appropriately cited, generalized,
  and cleared of private/live information.

### Credentials and machine state

- `config.local.toml`, `.env`, tokens, account/connector IDs, Telegram IDs, bot identities, tunnel
  configuration, runtime state, local model state, or logs.
- Absolute user paths, personal launch agents, personal schedules, `.claude/settings.json`,
  status-line configuration, or `desk-mode.json` runtime state.
- Personal agent priority, subscription/rate-limit details, CLI authentication, executable paths,
  real Codex/Claude session IDs, recent private conversation handoff, or last-agent state.
- Build intermediates, bridge state, activity/timing logs, and generated test-memory entries.

## Features that require explicit policy review

### Trading autonomy

The public default is `semi` (numbered tickets the user approves before anything executes);
`manual` is the per-order-confirm kill switch. Experimental `full` is published only as a
validate-only shadow: deterministic checks and private reject logging are allowed, but broker
placement is not. Enabling live autonomy requires explicit opt-in, broker/account scope,
reconciliation, durable idempotency, sufficiency and risk gates, a verified kill switch, immediate
order/fill reporting, no transfers, and paper/sandbox tests. Public documentation must never
promise automatic profit.

### Named investment methods and case studies

Review copyright, licensing, sourcing, privacy, reporting delay, and survivorship bias. Prefer
generic principles and fictional examples. Public cases must be dated, cited, and clearly labeled
as historical—not live signals or endorsements.

### Phone and broker integrations

Publish interfaces and sanitized templates, never live configuration. Broker adapters require
capability detection, preview, confirmation, reconciliation, audit logging, kill switch behavior,
and sandbox integration tests. Bridge modules are grouped under
`chat-bot-bridge/src/{agents,broker,control,delivery,reports,runtime}/` with mirrored Node tests
under `chat-bot-bridge/test/`; root `server.js` is the compatibility transport entrypoint and
`src/app/bridge-server.js` is the composition root. Phone run controls (`/run`, `/stop`, `/steer`, `/decide`) and mobile code-change reviews are
public capabilities, but every launchd label/path stays a `YOUR_NAME`/`com.example` template and all
account/execution defaults stay public-safe (`semi` with explicit ticket approval, `manual` as the
kill switch, execution-scope-only, and no money movement). Availability observations are local,
bounded runtime state: publish the empty/configurable mechanism, never a user's model history,
reset times, sessions, report artifacts, or delivery ledger.

### Agent integrations and switching

Publish a provider-neutral runner contract and sanitized adapters, not a permanent Codex/Claude
special case. Document which failures permit fallback, keep sessions isolated, serialize runs, and
make priority configurable. Never copy CLI login state, subscription information, session IDs,
private conversation history, absolute binary paths, or personal defaults into the public repo.

## Standard source-to-public workflow

1. **Establish the firewall.** Private and public repositories must not share a push remote. For a
   branch, audit a separate worktree; shared-repository use requires the explicit
   `--allow-shared-repository` acknowledgement and still provides weaker isolation. Never merge a
   private branch into public.
2. **Audit before editing.** Run `sync_audit.py`, resolve every error, and review source-only paths
   and directory names—not only content diffs.
3. **Port one capability unit manually:** implementation + blank configuration template +
   README/manual + skill/policy routing + tests/smoke wiring + ADR when architectural + a
   compatibility path when users already depend on one. Do not copy an entire tree for one feature.
4. **Sanitize seven layers independently:** identity; credentials/session state; machine paths,
   binaries, tunnels and schedules; user positions/reports/journals; runtime/provider/model
   preferences; trading/account/tax/cash policy; and private/paid knowledge rights. Blank secrets,
   configure preferences, default to least authority, and exclude private knowledge.
5. **Reconcile the public contract.** Preserve `SECURITY.md`, CI, issue/PR templates, public ADRs,
   compatibility launchers, and sanitized examples. Search for stale paths/product names, planned
   features described as working, contradictory defaults, and hidden setup prerequisites.
6. **Run proportional evidence:** consistency, PII, sync audit, syntax and representative behavior
   tests, public-link checks, `git diff --check`, and the significant-change smoke gate. Never set
   `SMOKE_REVIEW_OK=1` before a person reads the output.
7. **Review through three lenses:** a new user (setup works without maintainer context), an existing
   user (compatibility and overlays survive), and an adversary/operator (no disclosure, authority
   expansion, wrong account/provider/model, or wrong-repo publication). Commit and push only from
   the public checkout.

## Accuracy and effectiveness standard

A safe port that does not work is incomplete; a working port with stale instructions is inaccurate;
a correct feature that forces one person's workflow on everyone is ineffective. Each capability
therefore needs one canonical implementation, capability detection and honest fallback, blank local
templates, a safe default with explicit higher-authority opt-ins, deterministic status/errors,
failure-mode tests, documented prerequisites/degraded behavior, and no material recurring token or
runtime cost without measured benefit.

## Maintenance triggers

The author/reviewer of any significant change must ask: **Does
`docs/open-source-boundary.md` still describe the product boundary accurately?** Review it when a
change touches:

- a new skill, strategy default, risk/cash policy, or mentor method;
- a new data source, broker, agent runner, switching/fallback rule, execution mode, or autonomous behavior;
- journal memory, reports, examples, phone delivery, schedules, or user configuration;
- PII/privacy rules, packaging, installers, public CI, or contribution workflow.

If the answer changes, update this document in the same commit. If it does not, record that the
boundary was reviewed in the PR or smoke-gate review. Update `source-sync-policy.json` when an audit
finds a recurring unclassified path or a mechanically detectable new risk. User-specific sensitive
terms remain only in git-ignored local denylists or an extra `sync_audit.py --denylist` file.
