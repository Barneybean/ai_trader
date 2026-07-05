#!/usr/bin/env python3
"""The desk's decision journal + reflection loop (see skills/decision/reflection-memory.md).

A pure-stdlib ledger that lets the desk LEARN from its own calls: log every recommendation,
score it against SPY once the outcome matures (raw return AND alpha), attach a one-lesson
reflection, and RECALL prior lessons for a ticker/setup at the start of the next run.

Storage lives IN the repo so every runtime (Claude Code / Desktop / Codex) shares one history:
    journal/decisions.jsonl   append-only structured decisions + outcomes + reflections
    journal/reflections.md     human-readable rollup (regenerated from the jsonl)

Commands:
    log      append a new decision                (--symbol --action --entry --stop --target ...)
    recall   print prior decisions+lessons        (--symbol NKE [--setup chip-wash])
    score    compute raw return + alpha vs SPY     (--id <id> --exit <px> --spy-entry --spy-exit)
    reflect  attach a lesson to a scored decision  (--id <id> --text "...")
    list     show decisions (optionally --open)    ([--symbol] [--open])
    report   calibration summary (hit rate, alpha) ([--symbol])

The desk (LLM) writes the reflection PROSE; this script does the bookkeeping + alpha math so the
numbers and the ledger never drift. Prices are passed in (from the connector or web); the script
never fetches — keeping it runtime-agnostic.
"""
import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOURNAL_DIR = os.path.join(ROOT, "journal")
DECISIONS = os.path.join(JOURNAL_DIR, "decisions.jsonl")
REFLECTIONS_MD = os.path.join(JOURNAL_DIR, "reflections.md")


def _ensure():
    os.makedirs(JOURNAL_DIR, exist_ok=True)
    if not os.path.exists(DECISIONS):
        open(DECISIONS, "a").close()


def _load():
    _ensure()
    rows = []
    with open(DECISIONS) as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _save_all(rows):
    with open(DECISIONS, "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _next_id(rows, symbol, date):
    # deterministic id: SYMBOL-DATE-N (no clock/random needed)
    base = f"{symbol.upper()}-{date}"
    n = sum(1 for r in rows if r.get("id", "").startswith(base)) + 1
    return f"{base}-{n}"


def _pct(a, b):
    return None if not a else round((b - a) / a * 100, 2)


def cmd_log(args):
    rows = _load()
    if not args.date:
        raise SystemExit("--date YYYY-MM-DD is required (pass the run date; the script has no clock).")
    rec = {
        "id": _next_id(rows, args.symbol, args.date),
        "date": args.date,
        "symbol": args.symbol.upper(),
        "sleeve": args.sleeve,
        "action": args.action,
        "setup": args.setup,
        "entry": args.entry,
        "stop": args.stop,
        "target": args.target,
        "horizon": args.horizon,
        "conviction": args.conviction,
        "score": args.score,
        "thesis": args.thesis,
        "status": "open",
        "outcome": None,
        "reflection": None,
    }
    with open(DECISIONS, "a") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"Logged {rec['id']}: {rec['action']} {rec['symbol']} @ {rec['entry']} "
          f"stop {rec['stop']} target {rec['target']} ({rec['sleeve']}, conv {rec['conviction']})")


def cmd_recall(args):
    rows = _load()
    sym = args.symbol.upper() if args.symbol else None
    hits = [r for r in rows if (not sym or r["symbol"] == sym)
            and (not args.setup or r.get("setup") == args.setup)]
    hits = hits[-args.n:] if args.n else hits
    if not hits:
        print(f"No prior decisions for {sym or 'any'}"
              + (f" / setup={args.setup}" if args.setup else "") + ". Fresh slate.")
        return
    print(f"# Recall — {sym or 'all'}"
          + (f" · setup={args.setup}" if args.setup else "") + f" ({len(hits)} prior)\n")
    for r in hits:
        o = r.get("outcome") or {}
        line = f"[{r['date']}] {r['action'].upper()} {r['symbol']} @ {r['entry']} " \
               f"(→{r['target']}, stop {r['stop']}) · score {r.get('score')}, conv {r.get('conviction')}"
        if o:
            line += f" · OUTCOME raw {o.get('raw_return')}% / alpha {o.get('alpha')}% [{o.get('verdict')}]"
        else:
            line += " · OPEN"
        print(line)
        if r.get("thesis"):
            print(f"    thesis: {r['thesis']}")
        if r.get("reflection"):
            print(f"    LESSON: {r['reflection']}")
        print()


def cmd_score(args):
    rows = _load()
    rec = next((r for r in rows if r["id"] == args.id), None)
    if not rec:
        raise SystemExit(f"No decision with id {args.id}. Use `list` to find it.")
    raw = _pct(rec["entry"], args.exit)
    spy = _pct(args.spy_entry, args.spy_exit) if args.spy_entry and args.spy_exit else None
    alpha = round(raw - spy, 2) if (raw is not None and spy is not None) else None
    # verdict vs the plan: hit target / stopped / in-between
    verdict = "open"
    if rec.get("target") and args.exit >= rec["target"]:
        verdict = "target_hit"
    elif rec.get("stop") and args.exit <= rec["stop"]:
        verdict = "stopped_out"
    elif raw is not None:
        verdict = "win" if raw > 0 else "loss"
    if alpha is not None:
        verdict += "_beat_spy" if alpha > 0 else "_lag_spy"
    rec["outcome"] = {"exit": args.exit, "raw_return": raw, "spy_return": spy,
                      "alpha": alpha, "verdict": verdict}
    rec["status"] = "scored"
    _save_all(rows)
    print(f"{rec['id']} {rec['symbol']}: raw {raw}%"
          + (f", SPY {spy}%, alpha {alpha}%" if spy is not None else " (no SPY window given)")
          + f" → {verdict}")
    print("Now write the lesson:  track_record.py reflect --id "
          f"{rec['id']} --text \"...\"  (see skills/decision/reflection-memory.md)")


def cmd_reflect(args):
    rows = _load()
    rec = next((r for r in rows if r["id"] == args.id), None)
    if not rec:
        raise SystemExit(f"No decision with id {args.id}.")
    rec["reflection"] = args.text.strip()
    if rec["status"] == "open":
        rec["status"] = "reflected"
    _save_all(rows)
    _regen_reflections_md(rows)
    print(f"Reflection stored on {rec['id']} and rolled into journal/reflections.md")


def cmd_list(args):
    rows = _load()
    if args.symbol:
        rows = [r for r in rows if r["symbol"] == args.symbol.upper()]
    if args.open:
        rows = [r for r in rows if r.get("status") == "open"]
    if not rows:
        print("No matching decisions.")
        return
    for r in rows:
        o = r.get("outcome") or {}
        print(f"{r['id']:<22} {r['status']:<10} {r['action']:<11} {r['symbol']:<6} "
              f"@ {r['entry']}"
              + (f"  raw {o.get('raw_return')}% alpha {o.get('alpha')}%" if o else ""))


def cmd_report(args):
    rows = [r for r in _load() if r.get("outcome")]
    if args.symbol:
        rows = [r for r in rows if r["symbol"] == args.symbol.upper()]
    if not rows:
        print("No scored decisions yet — nothing to calibrate.")
        return
    n = len(rows)
    wins = sum(1 for r in rows if (r["outcome"].get("raw_return") or 0) > 0)
    beat = [r for r in rows if r["outcome"].get("alpha") is not None]
    beat_spy = sum(1 for r in beat if r["outcome"]["alpha"] > 0)
    avg_alpha = round(sum(r["outcome"]["alpha"] for r in beat) / len(beat), 2) if beat else None
    print(f"# Calibration{(' — ' + args.symbol.upper()) if args.symbol else ''} ({n} scored)")
    print(f"- Win rate (raw > 0): {wins}/{n} = {round(wins/n*100)}%")
    if beat:
        print(f"- Beat SPY: {beat_spy}/{len(beat)} = {round(beat_spy/len(beat)*100)}%; "
              f"avg alpha {avg_alpha}%")
    print("- Recent lessons:")
    for r in rows[-5:]:
        if r.get("reflection"):
            print(f"    [{r['symbol']} {r['date']}] {r['reflection']}")


def _regen_reflections_md(rows):
    lines = ["# Desk reflections (auto-generated from journal/decisions.jsonl)\n",
             "_One concrete lesson per scored call. Re-read at the start of each run "
             "(`track_record.py recall`)._\n"]
    for r in rows:
        if r.get("reflection"):
            o = r.get("outcome") or {}
            tag = f"raw {o.get('raw_return')}% / alpha {o.get('alpha')}%" if o else "unscored"
            lines.append(f"- **{r['symbol']}** ({r['date']}, setup={r.get('setup') or 'n/a'}, "
                         f"{tag}): {r['reflection']}")
    with open(REFLECTIONS_MD, "w") as f:
        f.write("\n".join(lines) + "\n")


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    lg = sub.add_parser("log", help="append a new decision")
    lg.add_argument("--symbol", required=True)
    lg.add_argument("--date", required=True, help="run date YYYY-MM-DD (no clock in-script)")
    lg.add_argument("--sleeve", choices=["tactical", "core"], default="core")
    lg.add_argument("--action", required=True,
                    help="buy|accumulate|trim|avoid|sell|watch|veto")
    lg.add_argument("--setup", help="setup type, e.g. chip-wash, wave-inflection, bottom-fish")
    lg.add_argument("--entry", type=float)
    lg.add_argument("--stop", type=float)
    lg.add_argument("--target", type=float)
    lg.add_argument("--horizon", help="e.g. '2-6wk' or '6mo'")
    lg.add_argument("--conviction", choices=["low", "medium", "high"], default="medium")
    lg.add_argument("--score", type=int)
    lg.add_argument("--thesis", help="one-line variant-perception thesis")
    lg.set_defaults(func=cmd_log)

    rc = sub.add_parser("recall", help="print prior decisions + lessons for a symbol/setup")
    rc.add_argument("--symbol")
    rc.add_argument("--setup")
    rc.add_argument("--n", type=int, default=5, help="most recent N (default 5)")
    rc.set_defaults(func=cmd_recall)

    sc = sub.add_parser("score", help="compute raw return + alpha vs SPY for a decision")
    sc.add_argument("--id", required=True)
    sc.add_argument("--exit", type=float, required=True)
    sc.add_argument("--spy-entry", type=float)
    sc.add_argument("--spy-exit", type=float)
    sc.set_defaults(func=cmd_score)

    rf = sub.add_parser("reflect", help="attach a one-lesson reflection to a decision")
    rf.add_argument("--id", required=True)
    rf.add_argument("--text", required=True)
    rf.set_defaults(func=cmd_reflect)

    ls = sub.add_parser("list", help="list decisions")
    ls.add_argument("--symbol")
    ls.add_argument("--open", action="store_true", help="only still-open decisions")
    ls.set_defaults(func=cmd_list)

    rp = sub.add_parser("report", help="calibration summary")
    rp.add_argument("--symbol")
    rp.set_defaults(func=cmd_report)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
