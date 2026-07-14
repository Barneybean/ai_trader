# Contributing to AI Trader

Thanks for your interest! This project is an open-source **starter** desk — general trading
knowledge and one example skill that people fork and customize. Contributions that make the *base*
better for everyone are very welcome.

## Required change lifecycle

Every feature, bug fix, and behavior change follows **issue → branch update → reviewed MR/PR →
merge**. The issue must explain the use case or reason and acceptance criteria; the MR/PR must use
`Closes #<issue>`. Direct permanent changes to the default branch are not accepted. Read the
canonical [`Developer guide`](DEVELOPMENT.md) before implementation.

Before proposing or syncing a feature into the public toolbox, read the canonical
[`Open-Source Boundary and Customization Standard`](docs/open-source-boundary.md). It defines what
belongs in the reusable core, what must be configurable, and what must remain private.

## Ways to contribute

- ⭐ **Playbooks** — sector/industry or single-stock (see below).
- **Strategy & edge skills** — patterns for `skills/decision/strategies.md`, signals for `skills/edge/`.
- **Broker adapters** — implement the adapter interface for a new broker (IBKR, Futu, Alpaca, …).
- **Engine improvements** — new indicators, better chip-distribution/S-R logic, tests.
- **Skill / reference quality** — clearer methodology, better prompts, fixes.
- **Docs & examples** — quickstarts, example (synthetic) reports, tutorials.

## ⭐ The flagship contribution: playbooks

The idea behind this project is a **knowledge commons**: no single person knows how every industry
or name prices — a semis veteran reads node yields and design wins, a biotech hand reads trial
design and cash runway, a bank analyst reads credit cycles and book-value quality. Playbooks are
how that knowledge gets into the base desk, where every fork reads it.

Playbooks come at two altitudes, same template discipline and same quality bar ("sector" and
"industry" mean the same thing here):

- **Sector / industry** — `skills/analysis/sectors/<name>.md`: how an industry prices.
- **Single stock** — `skills/analysis/stocks/<TICKER>.md`: how a specific name trades — repeating
  setups, catalyst calendar, valuation ranges, dated episodes. **Knowledge, never a live call**
  (live theses stay in `skills/playbook/watchlist-theses.md` or a private overlay).

**How:**

1. Check the coverage maps: [`skills/analysis/sectors/README.md`](skills/analysis/sectors/README.md)
   (includes the wanted list) or [`skills/analysis/stocks/README.md`](skills/analysis/stocks/README.md).
2. Open a **playbook proposal** issue to claim it (so nobody duplicates work).
3. Copy the matching `_TEMPLATE.md` and answer all seven fields.
4. Register it in the coverage map (sectors also get a row in `skills/analysis/sector-playbooks.md`).
5. Open a PR — the template's checklist walks the quality bar below.

### The playbook quality bar

A playbook merges when it is:

- **Specific** — names the 1–2 variables the sector re-rates on. "P/E and growth" is an automatic revision request.
- **Falsifiable** — a reader can check the drivers against real filings/trackers and watch them work.
- **Primary-sourced** — points at the filings, databases, and standards bodies where the data appears *first*.
- **Dated** — catalysts are tied to real, recurring events (PDUFA dates, capacity announcements, rate decisions…).
- **Illustrated** — at least one named, worked archetype showing the pattern paying off (or blowing up).
- **General** — trading craft, not your positions. No PII, no paid content, nothing you lack the
  right to share. For stock playbooks: episodes are dated history, never live calls.

The same bar applies to strategy patterns and edge skills: specific, sourced, general. Reviews
happen in the open, the way the desk reviews a trade — expect a bull/bear pass on your playbook.

## 🔒 The one hard rule: no PII

This is a public repo. **Never commit personal or account data** — account numbers, API keys,
connector/watchlist UUIDs, real positions, or a specific person's private book.

- Put desk settings in `config.local.toml` and bridge secrets in
  `chat-bot-bridge/.env` (both git-ignored).
- Put anything personal in `skills/private/` (git-ignored).
- **Run the gate before every push:**
  ```bash
  bash scripts/ops/install_hooks.sh     # once: installs pre-commit + pre-push PII hooks
  python3 scripts/ops/scan_pii.py       # on demand
  ```
  CI (`.github/workflows/pii-scan.yml`) will fail a PR that trips the scanner.

If you're forking to build *your own* customized desk, keep your edge in the git-ignored overlays —
you can pull upstream updates to the base without exposing your customizations.

## Branch model

- **`main`** — the clean public toolkit and normal PR target. The PII and consistency gates run
  here; release/public branch names remain supported by the local hooks.
- Personal/customized branches are *yours* and are not the target of PRs.

## Dev setup

No build step. The engines are **pure Python standard library** — keep them dependency-free so they
run anywhere `python3` does. If a feature genuinely needs a dependency, discuss it in an issue first
and make it optional.

```bash
git clone <your-fork> && cd ai-trader
bash scripts/ops/install_hooks.sh
python3 scripts/analysis/indicators.py <historicals.json> --price <px>   # sanity-check the engine
```

## Syncing from a private desk, fork, or user branch

Treat another source as untrusted for publication even when you own it. Follow
[`docs/open-source-boundary.md`](docs/open-source-boundary.md) and begin with:

```bash
python3 scripts/ops/sync_audit.py --source /path/to/source
```

Never merge a private branch into public or share the public push remote with a private repository.
Port one capability unit manually, preserve public-only assets, run all gates, and obtain human
review. A `reusable_candidate` classification means “reviewable,” not “safe to copy automatically.”

## Style & conventions

- Match the surrounding code: clear names, comments where intent isn't obvious, no dead code.
- Reference files are Markdown: lead with purpose, then the actionable framework, then guardrails.
- Keep the desk's discipline intact — additions should serve "edge or silence," not add noise.
- **Condensed wording, always.** `SKILL.md` and `skills/` are loaded into agent context on
  every desk run — every sentence you add costs tokens forever. Write dense: no
  throat-clearing, no restating what a linked file already says, frameworks over essays.
  `check_consistency.py` warns when a skill file passes ~2,600 words; treat the warning as
  "condense," never "split into two files to dodge the budget."

## Key decisions → ADRs

Changes to the desk **method**, toolkit **architecture**, **data contracts**, or the
**privacy posture** carry an Architecture Decision Record in the same PR — scaffold with
`python3 scripts/ops/new_adr.py "Title"` and see [`docs/adr/README.md`](docs/adr/README.md) for
the when/how. Routine fixes and new reference content don't need one. When debugging a
script, wrap it with `python3 scripts/lib/desk_log.py run -- <cmd>` so the failure lands in the
activity log (`desk_log.py tail --errors`).

## Self-review before opening a PR

Review your own change the way the desk reviews a trade — *before* anyone else sees it:

1. **Run the gates** (the pre-push hook and CI re-run both; passing locally first is the point):

   ```bash
   python3 scripts/ops/check_consistency.py   # conflicts: broken refs, unregistered playbooks, ADR integrity, word budgets
   python3 scripts/ops/scan_pii.py            # privacy: no personal/account data
   ```

2. **Condensed-wording pass** — reread your diff and cut: intros, hedges, restated context,
   anything a linked file already says. Target: every surviving sentence changes what an
   agent or reader would do.
3. **Conflict pass** — the gate catches mechanical conflicts; the semantic ones are on you.
   Check your addition against `docs/adr/` (don't contradict an accepted ADR — write a
   superseding one), the coverage maps (don't duplicate an existing or claimed playbook),
   and the skills it sits next to (don't add a second, competing way to do the same thing).

## Pull requests

1. Start from a documented issue, then branch from the target repository's default branch.
2. Keep PRs focused; include `Closes #<issue>` and complete the use-case/reason section.
3. Complete the self-review above — gates green, wording condensed, no conflicts.
4. For a new broker/sector, follow the existing interface/template so it composes.
5. State that `docs/open-source-boundary.md` was reviewed. Update it in the same PR when the change
   adds or changes a strategy default, risk/cash policy, mentor framework, data source, broker,
   agent runner/switching rule, execution mode, memory/report surface, phone integration, privacy
   rule, or public standard.
6. If the change touches README, docs, skills, scripts, `chat-bot-bridge/`, or hooks, run `python3 scripts/ops/smoke_test.py`
   and fix any wiring it flags before opening the PR.

## Adding a broker (interface sketch)

A broker adapter implements a small, uniform surface the desk already expects:
`quote`, `historicals`, `fundamentals`, `positions`, `buying_power`, `review_order`, `place_order`.
The full `base` protocol lands with the broker-adapter layer on the roadmap — until then, open an
issue to coordinate so your adapter drops into the same shape.

By contributing, you agree your contributions are licensed under the repo's [`LICENSE`](LICENSE).
Not financial advice — see the README disclaimer.
