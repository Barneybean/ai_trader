# Thesis Stress-Test — the desk's adversarial questioning mechanism

Before any idea reaches the user, it runs a **structured interrogation** designed to break it. The
desk's edge is not being right often — it's *killing wrong ideas cheaply* and *sizing surviving ideas
to the confidence they actually earn*. This is the checklist the Red Team applies to every thesis and
the CIO verifies before the gate. It also governs how the desk answers the **user's own premises**:
when the user says "if X then Y, right?", the desk does not just agree — it audits the "if→then" and
surfaces the condition that would flip it.

Run it out loud in the report for any high-conviction idea. A thesis that can't survive these questions
gets **killed, downgraded, or resized** — never waved through because the story is attractive.

---

## 1. Premise audit (challenge the "if → then")
State the thesis as an explicit conditional and interrogate each link.
- Is Y a **necessary** consequence of X, or just a *common* one? What's the hidden condition?
- Restate the user's premise back as a testable claim. (E.g. "OpenAI IPO → ORCL up" is only true for a
  *healthy* IPO that validates the backlog; a *delayed or down-round* IPO confirms the bear case and
  sends it lower. Same event, opposite outcomes.)
- Separate the catalyst from the company's **own** problems (an OpenAI IPO doesn't fix Oracle's capex
  funding). Don't let a real catalyst launder an unrelated risk.

## 2. Catalyst two-sidedness (write the bad version)
For **every** catalyst, write the bull resolution AND the bear resolution explicitly.
- Is it binary/two-sided? What is "the same event, gone wrong" (delay vs cancel; beat-but-guide-down;
  approval-but-label-restriction; win-but-priced-in)?
- Is the catalyst **already consensus / priced**? If everyone expects it, the surprise is asymmetric to
  the downside. (Ties to `skills/edge/variant-perception.md`.)
- Distinguish a benign from a malign version of the *same* headline before trading it.

## 3. Assumption inventory (find the load-bearing wall)
List every assumption the thesis rests on and tag each:
- **Load-bearing** (thesis dies without it) vs **incidental**. Rate confidence in each load-bearing one.
- A thesis that needs **many** things to all go right is fragile — prefer one or two clear drivers
  (no overfitting, `skills/decision/strategies.md`). Count the load-bearing assumptions; more than ~2–3 is a yellow flag.
- The **weakest load-bearing assumption sets the position size**, not the most exciting one.

## 4. Base-rate / reference class
- How often does *this kind* of setup actually work? Anchor on the reference class, not the vivid story.
- Validate the specific trigger against this name's own history (does "RSI<30 bounces here" actually
  hold?) via the historicals — `skills/decision/strategies.md`.
- Beware the narrative that feels inevitable in hindsight but has a poor base rate live.

## 5. Disconfirming-evidence hunt (argue the other side hardest)
- Actively search for the **strongest** evidence *against* the thesis, not confirmation. What would the
  smartest bear say? Steelman it.
- What single piece of data would **falsify** the thesis? Go look for it. If you can't name one, the
  thesis isn't yet testable — that's a problem, not a comfort.
- Check the institutional footprint for contradiction: does the chip/OBV read (`skills/analysis/chip-distribution.md`)
  agree, or is smart money doing the opposite of the story?

## 6. Invalidation design (specific, observable, and NOT just a stop-loss)
- Define a **concrete, observable condition** that says "we were wrong" — ideally *non-price* (thesis
  break: a contract lost, guidance cut, a customer default, a catalyst pulled), plus a price level.
- Distinguish a **thesis break** (exit / stop adding) from **noise / a shakeout** (stay, even add) — the
  wash-vs-markdown test in `skills/analysis/chip-distribution.md`.
- Pre-commit it *before* entry, in writing, so it can't be rationalized away later.

## 7. Path & timing risk (right destination, wrong road)
- Even if the endpoint is right, what's the **path**? Is the catalyst date unknown? Is there event risk
  (earnings/macro/FOMC) *inside* the intended hold?
- **How do you get paid if you're right but early?** This is where structure comes in: scale-in ladders,
  defined-risk options for convex catalyst exposure, a breakout-add on confirmation — so a correct thesis
  with bad timing doesn't stop you out or make you miss the gap. (See the ORCL/OpenAI-IPO worked example.)
- Note the lead time a catalyst actually gives (an IPO telegraphs via S-1 → roadshow → pricing over weeks
  — you are rarely as blind to timing as the fear implies).

## 8. Pre-mortem (it's 6 months later and this lost money — why?)
- Write the **top 3 reasons** the trade failed, as if it already did. Then check the plan defends against
  each. If it doesn't, fix the plan or pass.
- Ask specifically: what did we *assume* that turned out false? What did the crowd see that we dismissed?

## 9. Verdict → sizing link
The stress-test outputs one of:
- **Kill** — a load-bearing assumption fails, the catalyst is two-sided-to-the-downside and priced, or
  there's no falsification/invalidation. Log it, don't surface it.
- **Downgrade** — survives but with a fragile assumption → smaller size / lower conviction tier.
- **Pass, sized to the weakest load-bearing assumption's confidence** — not to the upside. High conviction
  requires the *bear case to be weak*, not the bull case to be exciting.

Surface, in the report, the **one or two questions the idea is most vulnerable on** and how the plan
answers them. An idea presented without its strongest counter-argument has not been stress-tested.

---

## How the desk uses it
- The **Red Team** runs §1–§8 and hands the CIO a verdict + the residual vulnerabilities.
- The **CIO gate** (`skills/decision/review-rubric.md`) will not pass a high-conviction idea that hasn't survived the
  stress-test, and sizes per §9.
- Applies to **user premises too**: when the user asserts a cause→effect, the desk audits it (§1–§2) and
  answers with the conditional and the flip-risk, not a reflexive "yes." Agreeing without testing is the
  failure mode this file exists to prevent.
