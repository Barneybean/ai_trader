# Portability — one skill, every runtime, one folder

This skill lives in **exactly one place** — this repo folder. Claude Code, Claude Desktop, and
Codex all read the *same* `SKILL.md`; nothing is duplicated or maintained separately. You edit
here, and every runtime sees the change (Claude Desktop after a one-command re-package).

```
        ┌─────────────────────── ~/Desktop/trading-desk (SOURCE OF TRUTH) ───────────────────────┐
        │   SKILL.md  +  AGENTS.md  +  skills/  +  scripts/                                    │
        └───────────────┬──────────────────────┬───────────────────────────┬─────────────────────┘
   symlink ~/.claude/skills/       reads AGENTS.md in the        re-packaged zip (regenerated,
   trading-desk  ->  source        repo dir (or ~/.codex link)    never hand-edited)
                │                          │                              │
          Claude Code                    Codex                      Claude Desktop
```

## One-time setup

```bash
bash scripts/install_mirrors.sh        # symlinks Claude Code + global Codex to this folder
python3 scripts/package_skill.py       # builds dist/trading-desk.zip for Claude Desktop upload
```

## How each runtime points back here

| Runtime | Mechanism | Maintenance |
|---|---|---|
| **Claude Code** | Symlink `~/.claude/skills/trading-desk` → this folder. Auto-discovered as a personal skill; the CWD copy also works when you're in the repo. | None — the symlink always reflects the latest files. |
| **Codex** | `AGENTS.md` at the repo root (read automatically when you run `codex` inside the folder). `install_mirrors.sh` also links `~/.codex/AGENTS.md` for global access. | None — it's the same file, in place. |
| **Claude Desktop** | Skills must be *uploaded* as a bundle — Desktop can't read a local folder live. `package_skill.py` regenerates `dist/trading-desk.zip` from this folder on demand. | Re-run the packager and re-upload after edits. The zip is a build artifact (git-ignored), not a second copy to maintain. |

## What makes the *same* SKILL.md work in all three

The differences between runtimes (broker connector, subagents, git remote, order placement)
are handled **inside** `SKILL.md` → **"Portability & capability detection"**. At the start of a
run the desk detects what's actually available and takes the matching branch:

- **Data:** Robinhood MCP if present, else web + user-supplied OHLCV JSON/CSV → `scripts/indicators.py` (pure stdlib, runs anywhere).
- **Roles:** parallel subagents if available, else sequential-but-separated passes.
- **Delivery:** git-committed HTML if there's a remote, else local/inline markdown+HTML.
- **Execution:** confirm-then-place only with a broker connector; otherwise emit an order ticket for the user to place. **Never auto-executes, on any runtime.**

The rule that keeps it trustworthy: **degraded is fine, fabricated is not.** A missing
capability means use the fallback and say so — never invent a quote or a catalyst to paper
over a gap.

## After you change the skill

1. Edit files in this folder (only here).
2. Claude Code & in-repo Codex: nothing to do — they read live.
3. Claude Desktop: `python3 scripts/package_skill.py` → re-upload `dist/trading-desk.zip`.
