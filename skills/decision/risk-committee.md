# Three-Lens Risk Debate (Aggressive · Neutral · Conservative → Risk Judge)

**What this upgrades.** The desk already has a Risk Manager with veto power (SKILL.md Step 7).
This reference makes that step a **structured three-perspective debate** before the veto — the
mechanism TradingAgents uses so risk isn't one person's gut call but a contested decision. The
Risk Judge is the *same* Risk Manager, now adjudicating three explicit stances and still bound
by every hard gate and sizing cap in `skills/decision/review-rubric.md` and `skills/playbook/mentor-method.md`. Nothing here
overwrites the desk's risk rules — it structures how they're applied.

Borrowed-and-adapted from TradingAgents' `risk_mgmt` debators + risk judge.

---

## The three lenses debate the *trade plan* (not the thesis)

The thesis was already adjudicated by the Research Manager (`skills/decision/research-debate.md`). This debate
is about **the PM's proposed plan** — size, entry zone, stop, targets — for a name that already
passed research. Each lens argues from a fixed stance and must rebut the others:

- **Aggressive / Risky lens** — champions the higher-reward posture: press the position, size
  toward the top of the conviction tier, buy the dip aggressively, use the full sleeve budget.
  Argues that the asymmetric upside (the multi-bagger, the wave inflection) justifies the risk
  and that under-sizing a real edge is its own mistake. Must engage the conservative's downside.
- **Conservative / Safe lens** — prioritizes capital protection: smaller starter, wider stop or
  more tranches, more cash held back, flag the binary event. Argues the desk survives by not
  blowing up — the weakest load-bearing assumption (from the debate) is the real position size.
  Must engage the aggressive's opportunity-cost point.
- **Neutral lens** — the balanced read: challenges both, proposes the moderate sizing/entry that
  captures most of the edge while respecting the caps. Names where the aggressive case overreaches
  and where the conservative case is leaving free money.

**Rounds:** default **1 round** (each lens states its case + one rebuttal); go to **2** for
large size, a crisis regime, or when the two extremes are far apart.

---

## The Risk Judge adjudicates → final sized plan or veto

The Risk Judge weighs the three lenses and issues **the binding decision**. It is *not* a
vote-count — the judge decides which lens the specific situation calls for (aggressive in a
washout with a clean setup; conservative into a binary event or a hostile regime). The judge
**must**:

1. **Enforce the hard gates** (`skills/decision/review-rubric.md`): RR ≥ 2.0 net of costs, defined invalidation
   (prefer a non-price thesis-break too), no unwanted binary inside the hold, tradable/liquid,
   conviction ≥ Medium, worth-the-attention.
2. **Enforce sizing caps** (`skills/decision/review-rubric.md` + `skills/playbook/mentor-method.md`): ≤ **2% account risk** per
   idea, ≤ **25%** per-name concentration (hard ceiling, size by conviction tier), sleeve budget
   not breached without a flag, no stacked correlated names.
3. **Apply the regime tilt** (`skills/analysis/macro-regime.md` / `skills/analysis/crisis-playbook.md`): shrink Tactical and raise
   cash in risk-off; in a crisis, defense first, then phased asymmetric offense.
4. **Honor the weakest-assumption rule:** size to the *weakest load-bearing assumption* the
   debate surfaced, not the upside.

**Output — one of:**
- **Approve as proposed** — plan clears all gates and the judge backs the PM's sizing.
- **Resize / restructure** — approve a modified plan (smaller starter, more tranches, tighter or
  wider stop, staged entry) with the reason stated.
- **Veto** — the idea does not reach the user; log it with the failing gate. A vetoed idea is
  still recorded in the internal log (and the journal, per `skills/decision/reflection-memory.md`).

The Risk Judge keeps the veto power the desk already grants it. The three-lens debate just makes
the veto *reasoned and contested* instead of a single reflex.

---

## Guardrail

This is risk **process**, not new risk **rules** — the numbers still come from the rubric and the
mentor method. If a lens argues for something the caps forbid (e.g. 30% in one name because "it's
a generational bet"), the judge cites the cap and overrules it. Convex asymmetric bets are sized
per the rubric's asymmetric-bet section (small starter, scale on confirmation, bounded downside),
not by waiving the cap.
