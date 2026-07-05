# Reflection & Memory — the desk learns from its own calls

**What this upgrades.** The desk already keeps a track record (`skills/decision/review-rubric.md` → "Track
record"). This reference turns that passive log into TradingAgents' **reflection loop**: after a
call's outcome is known, score it (raw return **and alpha vs SPY**), write one concrete lesson,
store it, and **inject the relevant past lessons back into future runs** for the same ticker and
the same setup type. This is how the desk gets *calibrated over time* instead of repeating
mistakes. It adds a learning layer; it does not change the edge doctrine or the gates.

Borrowed-and-adapted from TradingAgents' `reflect_on_final_decision` + decision-memory injection.

The journal lives **in the repo** (`journal/`), not in a runtime-specific memory store — so
Claude Code, Claude Desktop, and Codex all read and write the *same* history (single source of
truth, per `PORTABILITY.md`). Managed by `scripts/track_record.py`.

---

## The loop

```
   RECALL ──► DECIDE ──► LOG ──► (time passes) ──► SCORE ──► REFLECT ──► (feeds next RECALL)
```

### 1. RECALL — at the start of a run (SKILL.md Step 1)
For every candidate ticker, pull its prior decisions and lessons and **inject them as context**
before analyzing:
```bash
python3 scripts/track_record.py recall --symbol NKE
```
Returns the last few same-ticker decisions (stance, entry/stop/target, score) and their
reflections. Also pull **setup-type** lessons (e.g. "buying pre-markup chip-washes", "fading a
crowded momentum name") so the desk applies what it learned on *analogous* trades, not just the
same ticker. Read these before forming a new view — a past lesson can flip or size a new call.

### 2. LOG — when a recommendation is surfaced (SKILL.md Step 9)
Append the decision to the journal:
```bash
python3 scripts/track_record.py log --symbol NKE --sleeve core --action accumulate \
  --entry 42.20 --stop 38.50 --target 90 --horizon "6mo" --conviction high \
  --score 78 --thesis "pre-markup chip-wash accumulation; turnaround" --setup chip-wash
```
Every surfaced idea is logged (and vetoed ideas too, with the failing gate — losers teach the
most). The log is the raw material the reflection reads later.

### 3. SCORE — when the outcome matures (a later run, or on request)
Given the entry and a later exit/mark, plus SPY over the same window, compute the result:
```bash
python3 scripts/track_record.py score --id <decision-id> --exit 61.00 \
  --spy-entry 611 --spy-exit 640
```
Produces **raw return** and **alpha vs SPY** (raw minus SPY's return over the same window), and
tags the call a hit/miss vs its target and stop. Alpha matters more than raw — beating SPY is
the bar; making 10% while SPY made 15% is a losing call.

### 4. REFLECT — write the lesson (the desk, not the script)
The desk writes a **terse 2–4 sentence reflection** (plain prose, no bullets) covering, in order:
1. **Directional accuracy**, citing the alpha figure ("Right direction, +18% raw / +13% alpha").
2. **Which parts of the thesis worked or failed** ("chip-wash read was right; underestimated how
   long the base took").
3. **One concrete, reusable lesson** for the next similar setup ("On immature bases, ladder
   smaller starters and widen the time stop — don't expect the markup in 4 weeks").

Every word must earn its place — the reflection is stored verbatim and re-read by future runs.
Store it:
```bash
python3 scripts/track_record.py reflect --id <decision-id> \
  --text "Right direction, +18% raw / +13% alpha. Chip-wash accumulation thesis was correct but the base took ~5 months, not the 6–8 weeks implied. Lesson: on immature bases, smaller starter + wider time stop; don't front-run the markup."
```

---

## What makes a good lesson (calibration, not storytelling)
- **Actionable and transferable** — it changes what the desk does next time ("size to the weakest
  assumption", "don't chase the wave layer that's already consensus"), not a play-by-play.
- **Names the error class**, tying to the desk's own frameworks: a variant thesis that was really
  consensus, a stop too tight for an asymmetric bet, a catalyst whose two-sided version hit,
  ignoring a regime headwind, chasing strength instead of buying weakness.
- **Honest about luck** — a call that worked for the wrong reason is a *miss* to learn from, not a
  win to repeat.

## How reflections change future runs
- **Repeated mistake guard:** if the recalled lessons show the desk has been wrong the same way on
  a ticker/setup, that lowers conviction and size on the new call until the pattern breaks.
- **Confirmed edge:** a setup type that has repeatedly produced alpha (e.g. the mentor's
  buy-the-chip-wash pattern) earns incremental conviction — but never a waived gate.
- **Calibration report:** on request ("how have your calls done?"), summarize hit rate, average
  alpha, and the recurring lessons — a real desk grades itself honestly.

## Guardrail
Reflection tunes conviction and sizing; it never overrides a hard gate, a stop-loss, or a genuine
thesis break. Learning that a setup "usually works" is not license to skip the stress-test on the
next one.
