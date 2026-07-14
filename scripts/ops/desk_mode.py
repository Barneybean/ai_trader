#!/usr/bin/env python3
"""Trading mode — the desk's execution-authority switch (core state, all channels).

The mode lives in <repo>/desk-mode.json and binds EVERY session: interactive
terminals, the phone bridge, and scheduled runs alike. The bridge's /mode
command and this CLI write the same file; the protocol (what each mode means,
gates, approval grammar) is skills/decision/trading-modes.md.

    python3 scripts/ops/desk_mode.py               # show current mode
    python3 scripts/ops/desk_mode.py set full      # switch (full | semi | manual)
    python3 scripts/ops/desk_mode.py --json        # machine-readable

Modes:
  manual  advise-only; every order needs its own confirm round-trip (kill switch)
  semi    numbered proposed tickets; the user's "approve N / all" executes them
  full    validate-only autonomous shadow; tickets are gated and reported, never placed

Default (missing/unreadable file): semi.
"""
import json
import os
import sys

_SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(_SCRIPTS, d) for d in ("lib", "analysis", "ops")]

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODE_FILE = os.path.join(ROOT, "desk-mode.json")

MODES = {
    "manual": "MANUAL — advise only; every order needs an explicit per-order confirm (kill switch)",
    "semi": "SEMI-AUTO — reports propose numbered tickets; your approval reply executes them",
    "full": "FULL SHADOW — autonomous decisions are validated and reported, but never placed",
}
DEFAULT = "semi"


def current():
    try:
        with open(MODE_FILE) as f:
            m = json.load(f).get("mode")
        return m if m in MODES else DEFAULT
    except Exception:
        return DEFAULT


def set_mode(mode, source="cli"):
    if mode not in MODES:
        raise ValueError(f"unknown mode: {mode!r} (use: {' | '.join(MODES)})")
    import clock
    payload = {"mode": mode, "updated": clock.utc_now_iso(),
               "source": source}
    # atomic write — the bridge and scheduled runs read this file concurrently;
    # a reader must never catch a truncated file (parse failure falls back to
    # the public default, "semi", which still requires ticket approval)
    tmp = MODE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    os.replace(tmp, MODE_FILE)
    return mode


def main():
    args = [a for a in sys.argv[1:]]
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]

    if args and args[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    if args and args[0] != "set":
        print(f"unknown command {args[0]!r} — usage: desk_mode.py [set full|semi|manual] [--json]",
              file=sys.stderr)
        return 2
    if args and args[0] == "set":
        if len(args) < 2 or args[1] not in MODES:
            print("usage: desk_mode.py set full|semi|manual", file=sys.stderr)
            return 2
        set_mode(args[1])
        if not as_json:
            print(f"Mode set: {args[1].upper()}\n{MODES[args[1]]}\n"
                  "Applies from the next desk action and the next scheduled run.")
            if args[1] == "full":
                print("\nFULL SHADOW is validate-only: it cannot place broker orders. "
                      "Use semi for numbered approval or manual for per-order confirmation.")

    mode = current()
    if as_json:
        print(json.dumps({"mode": mode, "description": MODES[mode], "file": MODE_FILE}))
    elif not args:
        print(f"Trading mode: {mode.upper()}\n{MODES[mode]}\n"
              f"(state: desk-mode.json · protocol: skills/decision/trading-modes.md · "
              f"switch: desk_mode.py set <mode> or /mode on the phone)")
    return 0


if __name__ == "__main__":
    import desk_log
    sys.exit(desk_log.run(main))
