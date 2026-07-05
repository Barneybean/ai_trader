# Contributing to AI Trader

Thanks for your interest! This project is an open-source **starter** desk — general trading
knowledge and one example skill that people fork and customize. Contributions that make the *base*
better for everyone are very welcome.

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

- Put secrets in `config.local.toml` / `.env` (git-ignored).
- Put anything personal in `skills/private/` (git-ignored).
- **Run the gate before every push:**
  ```bash
  bash scripts/install_hooks.sh     # once: installs pre-commit + pre-push PII hooks
  python3 scripts/scan_pii.py       # on demand
  ```
  CI (`.github/workflows/pii-scan.yml`) will fail a PR that trips the scanner.

If you're forking to build *your own* customized desk, keep your edge in the git-ignored overlays —
you can pull upstream updates to the base without exposing your customizations.

## Branch model

- **`opensource`** (this branch) — the clean, public starter. PRs target this branch. The PII gate
  is enforced here.
- Personal/customized branches are *yours* and are not the target of PRs.

## Dev setup

No build step. The engines are **pure Python standard library** — keep them dependency-free so they
run anywhere `python3` does. If a feature genuinely needs a dependency, discuss it in an issue first
and make it optional.

```bash
git clone <your-fork> && cd ai-trader
bash scripts/install_hooks.sh
python3 scripts/indicators.py <historicals.json> --price <px>   # sanity-check the engine
```

## Style & conventions

- Match the surrounding code: clear names, comments where intent isn't obvious, no dead code.
- Reference files are Markdown: lead with purpose, then the actionable framework, then guardrails.
- Keep the desk's discipline intact — additions should serve "edge or silence," not add noise.

## Pull requests

1. Branch off `opensource`.
2. Keep PRs focused; describe the *why*.
3. Ensure `python3 scripts/scan_pii.py` passes and no personal data is included.
4. For a new broker/sector, follow the existing interface/template so it composes.

## Adding a broker (interface sketch)

A broker adapter implements a small, uniform surface the desk already expects:
`quote`, `historicals`, `fundamentals`, `positions`, `buying_power`, `review_order`, `place_order`.
The full `base` protocol lands with the broker-adapter layer on the roadmap — until then, open an
issue to coordinate so your adapter drops into the same shape.

By contributing, you agree your contributions are licensed under the repo's [`LICENSE`](LICENSE).
Not financial advice — see the README disclaimer.

