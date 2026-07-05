# Three-Lens Risk Debate (Aggressive · Neutral · Conservative → Risk Judge)

**What this upgrades.** The desk has a Risk Manager with veto power (SKILL.md Step 7); this makes it a **structured three-perspective debate** before the veto — the TradingAgents mechanism so risk is a contested decision, not one gut call. The Risk Judge is the *same* Risk Manager, now adjudicating three explicit stances, still bound by every gate and cap in `skills/decision/review-rubric.md` and `skills/playbook/mentor-method.md`. It structures how the rules apply; it doesn't overwrite them.

Borrowed-and-adapted from TradingAgents' `risk_mgmt` debators + risk judge.

---

## The three lenses debate the *trade plan* (not the thesis)

The thesis was already adjudicated by the Research Manager (`skills/decision/research-debate.md`). This debate is about **the PM's proposed plan** — size, entry zone, stop, targets — for a name that passed research. Each argues a fixed stance and rebuts the others:

- **Aggressive / Risky** — press the position, size toward the top of the conviction tier, buy the dip aggressively, use the full sleeve budget. Argues the asymmetric upside (multi-bagger, wave inflection) justifies the risk and under-sizing a real edge is its own mistake. Must engage the conservative's downside.
- **Conservative / Safe** — smaller starter, wider stop or more tranches, more cash held back, flag the binary. Argues the desk survives by not blowing up — the weakest load-bearing assumption is the real position size. Must engage the aggressive's opportunity-cost point.
- **Neutral** — challenges both, proposes moderate sizing/entry that captures most of the edge within caps. Names where aggressive overreaches and where conservative leaves free money.

**Rounds:** default **1** (each states its case + one rebuttal); **2** for large size, a crisis regime, or when the extremes are far apart.

---

## The Risk Judge adjudicates → final sized plan or veto

The judge weighs the three lenses and issues **the binding decision** — *not* a vote-count, but which lens the situation calls for (aggressive in a clean washout; conservative into a binary or hostile regime). The judge **must**:

1. **Enforce the hard gates** (`skills/decision/review-rubric.md`): RR ≥ 2.0 net of costs, defined invalidation (prefer a non-price thesis-break too), no unwanted binary inside the hold, tradable/liquid, conviction ≥ Medium, worth-the-attention.
2. **Enforce sizing caps** (`skills/decision/review-rubric.md` + `skills/playbook/mentor-method.md`): ≤ **2% account risk** per idea, ≤ **25%** per-name concentration (hard ceiling, size by conviction tier), sleeve budget not breached without a flag, no stacked correlated names.
3. **Apply the regime tilt** (`skills/analysis/macro-regime.md` / `skills/analysis/crisis-playbook.md`): shrink Tactical and raise cash in risk-off; in a crisis, defense first, then phased asymmetric offense.
4. **Honor the weakest-assumption rule:** size to the *weakest load-bearing assumption*, not the upside.

**Output — one of:**
- **Approve as proposed** — clears all gates, judge backs the sizing.
- **Resize / restructure** — approve a modified plan (smaller starter, more tranches, tighter/wider stop, staged entry) with the reason.
- **Veto** — idea doesn't reach the user; log it with the failing gate. Still recorded in the internal log and journal (`skills/decision/reflection-memory.md`).

The judge keeps its veto power; the debate just makes the veto *reasoned and contested* instead of a single reflex.

---

## Guardrail

Risk **process**, not new risk **rules** — the numbers come from the rubric and mentor method. If a lens argues for what the caps forbid (e.g. 30% in one name because "it's a generational bet"), the judge cites the cap and overrules it. Convex asymmetric bets are sized per the rubric's asymmetric-bet section (small starter, scale on confirmation, bounded downside), not by waiving the cap.

