# Contributing to Trading Desk

Thanks for your interest! This project is an open-source **starter** desk — general trading
knowledge and one example skill that people fork and customize. Contributions that make the *base*
better for everyone are very welcome.

## Ways to contribute

- **Broker adapters** — implement the adapter interface for a new broker (IBKR, Futu, Alpaca, …).
- **Sector playbooks** — add `skills/analysis/sectors/<name>.md` from `skills/analysis/sectors/_TEMPLATE.md`.
- **Engine improvements** — new indicators, better chip-distribution/S-R logic, tests.
- **Skill / reference quality** — clearer methodology, better prompts, fixes.
- **Docs & examples** — quickstarts, example (synthetic) reports, tutorials.

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
git clone <your-fork> && cd trading-desk
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
