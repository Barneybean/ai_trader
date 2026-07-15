#!/usr/bin/env python3
"""Smoke gate — fast, targeted checks for significant repo updates.

The desk already has a consistency gate. This script adds the next layer:
when a change touches core code, bridge behavior, or the desk's operating
docs, run a small local smoke suite and ask a human to review the result
before the push leaves the machine.

Usage:
  python3 scripts/ops/smoke_test.py --staged
  python3 scripts/ops/smoke_test.py --range <git-rev-spec>
  python3 scripts/ops/smoke_test.py --range <spec1> --range <spec2>

Review gate:
  If the smoke suite runs, a human review is required. Re-run with
  SMOKE_REVIEW_OK=1 after reading the summary to proceed.
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "lib"))
import desk_log  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent

REVIEW_GUARD = "SMOKE_REVIEW_OK"
SMOKE_FIXTURE = {
    "ticker": "SMOKE",
    "roe_10y_avg": 0.12,
    "fcf_5y_cum": 1_000_000.0,
    "interest_coverage": 4.0,
    "gross_margin": 0.24,
    "ocf_to_ni_5y": 1.1,
    "net_margin": 0.07,
    "dilution_5y": 0.03,
}


def git_lines(*args: str) -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(ROOT), *args],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [line for line in out.splitlines() if line]


def changed_files_for_spec(spec: str) -> list[str]:
    if ".." in spec or "..." in spec:
        return git_lines("diff", "--name-only", "--diff-filter=ACMRTUXB", spec)
    return git_lines("diff-tree", "--no-commit-id", "--name-only", "-r", spec)


def significant_path(rel: str) -> bool:
    prefixes = (
        "README.md",
        "DEVELOPMENT.md",
        "CONTRIBUTING.md",
        "SKILL.md",
        "AGENTS.md",
        "PORTABILITY.md",
        "CLAUDE.md",
        "skills/",
        "scripts/",
        "chat-bot-bridge/",
        "docs/",
        ".githooks/",
        ".github/workflows/",
    )
    return rel == "README.md" or rel.startswith(prefixes)


def cmd_str(cmd: list[str]) -> str:
    return " ".join(shlex.quote(part) for part in cmd)


def run_cmd(label: str, cmd: list[str], *, cwd: Path = ROOT) -> tuple[bool, str]:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    out = (proc.stdout or "") + (proc.stderr or "")
    ok = proc.returncode == 0
    print(f"  {'✓' if ok else '✗'} {label}: {cmd_str(cmd)}")
    if out.strip():
        # keep the output compact; the hook output should remain reviewable
        print(out.rstrip())
    return ok, out


def unique(seq: list[str]) -> list[str]:
    seen = set()
    out = []
    for item in seq:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def smoke_commands(files: list[str]) -> tuple[list[tuple[str, list[str], Path]], list[str]]:
    commands: list[tuple[str, list[str], Path]] = []
    review_notes: list[str] = []
    has_md = any(f.endswith(".md") for f in files)
    has_py = any(f.endswith(".py") for f in files)
    has_js = any(f.endswith(".js") for f in files)
    has_json = any(f.endswith(".json") for f in files)
    touches_analysis = any(f.startswith("scripts/analysis/") for f in files)
    touches_journal = any(f.startswith("scripts/journal/") for f in files)
    touches_report = any(f.startswith("scripts/report/") for f in files)
    touches_ops = any(f.startswith("scripts/ops/") for f in files)
    touches_execution = any(f.startswith("scripts/execution/") for f in files)
    touches_lib = any(f.startswith("scripts/lib/") for f in files)
    touches_issue_log = any(f in {
        "scripts/lib/issue_log.py", "scripts/lib/test_issue_log.py"
    } for f in files)
    touches_bridge = any(f.startswith("chat-bot-bridge/") for f in files)
    touches_skills = any(f.startswith("skills/") or f in {"SKILL.md"} for f in files)
    touches_docs = any(f.startswith("docs/") for f in files) or has_md

    # Always run the repo integrity gate once a smoke suite is justified.
    commands.append((
        "consistency gate",
        [sys.executable, "scripts/ops/check_consistency.py"],
        ROOT,
    ))
    review_notes.append("Re-read the consistency gate output before pushing.")

    if has_py:
        py_files = [f for f in files if f.endswith(".py")]
        commands.append((
            "python syntax",
            [sys.executable, "-m", "py_compile", *py_files],
            ROOT,
        ))
        review_notes.append("Review syntax-sensitive Python files and the smoke output.")

    if touches_analysis:
        commands.append((
            "analysis quality gate",
            [
                sys.executable,
                "scripts/analysis/quality_gate.py",
                "--metrics",
                json.dumps(SMOKE_FIXTURE),
            ],
            ROOT,
        ))
        commands.append((
            "analysis CLI help",
            [sys.executable, "scripts/analysis/reverse_dcf.py", "--help"],
            ROOT,
        ))
        review_notes.append("Spot-check the analysis outputs against the report expectations.")

    if touches_journal:
        commands.append((
            "journal recall",
            [sys.executable, "scripts/journal/desk_memory.py", "context", "--symbol", "SMOKE"],
            ROOT,
        ))
        commands.append((
            "track record help",
            [sys.executable, "scripts/journal/track_record.py", "--help"],
            ROOT,
        ))
        commands.append((
            "capture-levels tests",
            [sys.executable, "scripts/journal/test_capture_levels.py"],
            ROOT,
        ))
        review_notes.append("Check the recall and journal flows for regressions.")

    if touches_report:
        commands.append((
            "report lifecycle tests",
            [sys.executable, "scripts/report/test_new_report.py"],
            ROOT,
        ))
        commands.append((
            "report week tests",
            [sys.executable, "scripts/report/test_report_week.py"],
            ROOT,
        ))
        commands.append((
            "report scaffold help",
            [sys.executable, "scripts/report/new_report.py", "--help"],
            ROOT,
        ))
        commands.append((
            "report renderer help",
            [sys.executable, "scripts/report/build_report.py", "--help"],
            ROOT,
        ))
        review_notes.append("Confirm the report workflow still matches the README and sample report.")

    if touches_ops:
        commands.append((
            "change traceability tests",
            [sys.executable, "scripts/ops/test_change_traceability.py"],
            ROOT,
        ))
        commands.append((
            "desk mode help",
            [sys.executable, "scripts/ops/desk_mode.py", "--json"],
            ROOT,
        ))
        commands.append((
            "PII scan help",
            [sys.executable, "scripts/ops/scan_pii.py", "--help"],
            ROOT,
        ))
        commands.append((
            "source sync auditor self-test",
            [sys.executable, "scripts/ops/sync_audit.py", "--self-test"],
            ROOT,
        ))
        review_notes.append("Check the operator gates: smoke, PII, and mode behavior.")

    if touches_execution:
        commands.append((
            "execution gateway tests",
            [sys.executable, "scripts/execution/test_gateway.py"],
            ROOT,
        ))
        review_notes.append(
            "Confirm the execution gateway remains validate-only and fails closed."
        )

    if touches_lib:
        commands.append((
            "clock tests",
            [sys.executable, "scripts/lib/test_clock.py"],
            ROOT,
        ))

    if touches_issue_log:
        commands.append((
            "operational issue-log tests",
            [sys.executable, "scripts/lib/test_issue_log.py"],
            ROOT,
        ))

    if touches_bridge:
        js_files = [f for f in files if f.startswith("chat-bot-bridge/") and f.endswith(".js")]
        json_files = [f for f in files if f.startswith("chat-bot-bridge/") and f.endswith(".json")]
        if has_js and js_files:
            commands.append((
                "bridge syntax",
                ["node", "--check", *js_files],
                ROOT,
            ))
        if json_files or "chat-bot-bridge/package.json" in files:
            commands.append((
                "bridge JSON",
                [
                    "node",
                    "--input-type=module",
                    "-e",
                    "import fs from 'fs';"
                    "for (const p of process.argv.slice(1)) JSON.parse(fs.readFileSync(p, 'utf8'));",
                    *json_files,
                ],
                ROOT,
            ))
        commands.append((
            "bridge rules import",
            [
                "node",
                "--input-type=module",
                "-e",
                (
                    "import { chatRules, MODES, currentMode } from './chat-bot-bridge/src/control/chat-rules.js';"
                    "import { claudeRateLimitBlocked, codexAvailabilityError, createRunCircuitBreaker, shouldFallbackForBroker } from './chat-bot-bridge/src/agents/agent-routing.js';"
                    "const text = chatRules('semi');"
                    "const normal = {type:'item.completed',item:{type:'command_execution',status:'completed',exit_code:0,command:'rg not found'}};"
                    "const limited = {type:'error',message:'rate limit reached; try again later'};"
                    "const failed = {type:'item.completed',item:{type:'command_execution',status:'failed',exit_code:127,command:'tool',stderr:'command not found'}};"
                    "const guard = createRunCircuitBreaker({maxToolCalls:2,maxIdenticalToolCalls:1,maxOutputTokens:5});"
                    "if (!text.includes('SEMI-AUTO') || !MODES.manual || !['manual','semi','full'].includes(currentMode())"
                    " || codexAvailabilityError(normal) !== null || !codexAvailabilityError(limited) || codexAvailabilityError(failed) !== null"
                    " || !shouldFallbackForBroker('show open orders','live broker status unavailable')"
                    " || shouldFallbackForBroker('explain the methodology','broker tools unavailable')"
                    " || claudeRateLimitBlocked({status:'allowed'}) || claudeRateLimitBlocked({status:'allowed_warning'})"
                    " || !claudeRateLimitBlocked({status:'rejected'})"
                    " || guard.observeTool('same') !== null || !guard.observeTool('same')"
                    " || !guard.observeOutputTokens(6)) process.exit(1);"
                ),
            ],
            ROOT,
        ))
        commands.append((
            "bridge behavior tests",
            ["npm", "--prefix", "chat-bot-bridge", "test"],
            ROOT,
        ))
        review_notes.append("Manually verify a phone flow if the bridge message path changed.")

    if touches_docs or touches_skills:
        review_notes.append("Review the README / skills routing changes for stale links or missing setup steps.")
    if any(
        f in {"SKILL.md", "AGENTS.md", "CONTRIBUTING.md"}
        or f.startswith(("skills/", "scripts/", "chat-bot-bridge/", ".github/"))
        for f in files
    ):
        review_notes.append(
            "Review docs/open-source-boundary.md; update it if this change alters the public/private "
            "boundary, customization model, or public standard."
        )

    if not commands:
        commands.append((
            "consistency gate",
            [sys.executable, "scripts/ops/check_consistency.py"],
            ROOT,
        ))
        review_notes.append("No dedicated smoke suite was needed; still review the docs and diff.")

    return commands, unique(review_notes)


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--staged", action="store_true",
                    help="inspect staged changes (pre-commit style)")
    ap.add_argument("--range", dest="ranges", action="append", default=[],
                    metavar="REV",
                    help="git revspec to inspect, repeatable (pre-push style)")
    ap.add_argument("--json", action="store_true",
                    help="machine-readable summary")
    return ap.parse_args()


def main() -> int:
    args = parse_args()

    changed: list[str] = []
    if args.staged:
        changed.extend(git_lines("diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB"))
    for spec in args.ranges:
        changed.extend(changed_files_for_spec(spec))

    changed = sorted(set(f for f in changed if significant_path(f) and (ROOT / f).exists()))

    summary = {
        "changed_files": changed,
        "ran_smoke": bool(changed),
        "review_required": bool(changed),
        "review_ok": bool(os.environ.get(REVIEW_GUARD)),
    }

    if args.json:
        print(json.dumps(summary, indent=2))

    if not changed:
        print("ℹ smoke_test: no significant changes detected; no smoke suite needed.")
        desk_log.log_event("smoke_test", "gate_result", level="info", files=0, suites=0, review=False)
        return 0

    print(f"🧪 smoke_test: significant updates detected in {len(changed)} file(s).")
    for f in changed:
        print(f"  • {f}")

    commands, review_notes = smoke_commands(changed)
    print("Smoke suites:")
    passed = 0
    for label, cmd, cwd in commands:
        ok, _ = run_cmd(label, cmd, cwd=cwd)
        if not ok:
            desk_log.log_event("smoke_test", "gate_result", level="error",
                               files=len(changed), suites=len(commands), review=True,
                               failed=label)
            print("\n✋ smoke_test: fix the failing smoke suite before pushing.")
            return 1
        passed += 1

    desk_log.log_event("smoke_test", "gate_result", level="info",
                       files=len(changed), suites=len(commands), review=True)

    print("\nReview requested.")
    for note in review_notes:
        print(f"  - {note}")
    print("Proposed update path:")
    print("  - Review the diff, the smoke output, and the affected docs together.")
    print("  - If the change spans code and docs, update the README or skills map in the same pass.")
    print(f"  - Re-run with {REVIEW_GUARD}=1 when the human review is complete.")

    if os.environ.get(REVIEW_GUARD):
        print(f"\n✓ {REVIEW_GUARD} present — review acknowledged.")
        return 0

    print(f"\n✋ Human review required: set {REVIEW_GUARD}=1 and re-run once you have reviewed the smoke output.")
    return 3


if __name__ == "__main__":
    raise SystemExit(desk_log.run(main))
