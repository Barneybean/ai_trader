# Structured Research Debate (Bull vs Bear, multi-round)

**What this upgrades.** The desk already runs a Bull-vs-Bear Red Team (SKILL.md Step 5). This
reference makes that step a **structured, multi-round debate with an adjudicating Research
Manager** — the mechanism TradingAgents uses to stop a thesis from winning by assertion. It
does **not** replace the desk's edge doctrine: the *content* of the debate is still the
`skills/edge/variant-perception.md` thesis and the `skills/decision/stress-test.md` attack. This just makes the
adversarial process iterative and forces a committed verdict instead of a mushy "looks good."

Borrowed-and-adapted from TradingAgents' researcher team + `research_manager`; kept subordinate
to this desk's rubric, sleeves, and mentor method.

---

## Roles

- **Bull Researcher** — argues the long case, built on the *variant-perception statement* (not
  generic optimism): what the market misses, why it isn't priced, the catalyst that closes the
  gap. Cites the specialists' evidence (fundamentals, quant levels, insider flows, wave
  position).
- **Bear Researcher** — argues the short/avoid case. Its job is the `skills/decision/stress-test.md`
  attack made adversarial: the two-sided version of every catalyst, the weakest load-bearing
  assumption, disconfirming evidence, the pre-mortem, and the consensus view the bull is
  fading (steelmanned — you can only fade a view you fully understand).
- **Research Manager** — adjudicates and produces the **investment plan** the PM will size.

---

## The debate protocol

1. **Rounds.** Default **2 rounds**; go to **3** for high-conviction or large-size ideas, **1**
   for quick screens. (This is the desk's analogue of `max_debate_rounds` — scale it to stakes,
   not habit.)
2. **Rebuttal rule — engage, don't restate.** Each side, after round 1, must **directly rebut
   the other side's single strongest point** before adding anything new. An argument that
   ignores the opponent's best point is disqualified. No talking past each other.
3. **Evidence discipline.** Every claim ties to a dated source, an `indicators.py` number, or a
   filing — no vibes. "The chart looks strong" is not an argument; "reclaimed SMA50 on 1.8×
   volume, OBV making highs" is.
4. **Convergence check.** If both sides converge on the same read (e.g. "fairly priced, no
   edge"), stop early and label it **beta / no variant edge** — that itself is the verdict.

---

## Adjudication — the Research Manager commits

The Research Manager reads the full debate history and issues a **committed stance on a
5-point scale**, mapped to this desk's actions:

| Stance | Desk action | Meaning |
|---|---|---|
| **Strong Buy** | Buy / Accumulate aggressively (within caps) | Bull case decisively won; variant edge intact |
| **Buy / Overweight** | Buy / Accumulate | Bull won on balance |
| **Hold** | Watch / no trade | *Only* when evidence is genuinely balanced — not a cop-out |
| **Underweight** | Trim / avoid new | Bear won on balance |
| **Sell / Avoid** | Trim/exit or do-not-buy | Bear case decisively won |

**Do not default to Hold.** Per TradingAgents' research manager: commit to a clear stance
whenever the debate's strongest arguments warrant one; "Hold" is reserved for a genuine
stalemate, not for indecision. A desk that always says "hold" is useless.

**Output — the Investment Plan** (feeds SKILL.md Step 6, PM/Trader):
- The committed stance + the **one argument that decided it** (which side's strongest point won, and why the other side's best rebuttal failed).
- The surviving **variant-perception statement** (or the note that it collapsed to consensus → cut/beta).
- The **1–2 questions the thesis is still most vulnerable on** (hand these to Risk).
- Provisional horizon read: short-run and long-run calls (per the desk's two-horizon rule).

---

## Guardrails (so this doesn't overwrite the desk's edge)

- The debate **serves** the CIO gate and rubric — it does not replace them. A Strong-Buy stance
  still has to clear every hard gate in `skills/decision/review-rubric.md` (RR ≥ 2, defined invalidation,
  sleeve-appropriate edge, conviction ≥ Medium).
- The bear's attack **is** the `skills/decision/stress-test.md`; don't run them as two separate things —
  the stress-test is the bear's ammunition.
- Keep the desk's voice: variant perception, secular-wave position, chip/phase read, and the
  mentor's "buy weakness in quality" lens are the *substance* being debated. This mechanism is
  the ring; the edge doctrine is the fighter.
