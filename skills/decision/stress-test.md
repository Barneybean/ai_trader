# Thesis Stress-Test — the desk's adversarial questioning mechanism

Before any idea reaches the user, run a **structured interrogation** designed to break it. The desk's edge is *killing wrong ideas cheaply* and *sizing survivors to the confidence they earn*, not being right often. This is the checklist the Red Team applies to every thesis and the CIO verifies before the gate. It also governs the **user's own premises**: on "if X then Y, right?", audit the "if→then" and surface the condition that would flip it.

Run it out loud in the report for any high-conviction idea. A thesis that can't survive gets **killed, downgraded, or resized** — never waved through because the story is attractive.

---

## 1. Premise audit (challenge the "if → then")
State the thesis as an explicit conditional; interrogate each link.
- Is Y a **necessary** consequence of X, or just a *common* one? What's the hidden condition?
- Restate the user's premise as a testable claim. (E.g. "OpenAI IPO → ORCL up" holds only for a *healthy* IPO that validates the backlog; a *delayed/down-round* IPO confirms the bear case and sends it lower. Same event, opposite outcomes.)
- Separate the catalyst from the company's **own** problems (an OpenAI IPO doesn't fix Oracle's capex funding). Don't let a real catalyst launder an unrelated risk.

## 2. Catalyst two-sidedness (write the bad version)
For **every** catalyst, write the bull AND bear resolution.
- Binary/two-sided? What is "the same event, gone wrong" (delay vs cancel; beat-but-guide-down; approval-but-label-restriction; win-but-priced-in)?
- Is it **already consensus / priced**? If everyone expects it, the surprise is asymmetric to the downside (`skills/edge/variant-perception.md`).
- Distinguish a benign from a malign version of the *same* headline before trading it.

## 3. Assumption inventory (find the load-bearing wall)
List every assumption; tag each:
- **Load-bearing** (thesis dies without it) vs **incidental**. Rate confidence in each load-bearing one.
- A thesis needing **many** things to go right is fragile — prefer one or two clear drivers (no overfitting, `skills/decision/strategies.md`). More than ~2–3 load-bearing assumptions is a yellow flag.
- The **weakest load-bearing assumption sets the size**, not the most exciting one.

## 4. Base-rate / reference class
- How often does *this kind* of setup work? Anchor on the reference class, not the vivid story.
- Validate the trigger against this name's own history ("RSI<30 bounces here"?) via historicals — `skills/decision/strategies.md`.
- Beware the narrative that feels inevitable in hindsight but has a poor base rate live.

## 5. Disconfirming-evidence hunt (argue the other side hardest)
- Search for the **strongest** evidence *against* the thesis. What would the smartest bear say? Steelman it.
- What single datum would **falsify** the thesis? Go look. If you can't name one, it isn't testable — a problem, not a comfort.
- Check the institutional footprint (`skills/analysis/chip-distribution.md`) for contradiction: does the chip/OBV read agree, or is smart money doing the opposite?

## 6. Invalidation design (specific, observable, NOT just a stop-loss)
- Define a **concrete, observable condition** that says "we were wrong" — ideally *non-price* (contract lost, guidance cut, customer default, catalyst pulled), plus a price level.
- Distinguish a **thesis break** (exit / stop adding) from **noise / a shakeout** (stay, even add) — the wash-vs-markdown test in `skills/analysis/chip-distribution.md`.
- Pre-commit it *before* entry, in writing, so it can't be rationalized away.

## 7. Path & timing risk (right destination, wrong road)
- Even if the endpoint is right, what's the **path**? Catalyst date unknown? Event risk (earnings/macro/FOMC) *inside* the hold?
- **How do you get paid if right but early?** Structure answers this: scale-in ladders, defined-risk options for convex catalyst exposure, a breakout-add on confirmation — so bad timing doesn't stop you out or make you miss the gap. (See the ORCL/OpenAI-IPO example.)
- Note the lead time a catalyst gives (an IPO telegraphs via S-1 → roadshow → pricing over weeks — you're rarely as blind to timing as the fear implies).

## 8. Pre-mortem (it's 6 months later and this lost money — why?)
- Write the **top 3 reasons** it failed, as if it already did. Check the plan defends against each; if not, fix the plan or pass.
- Ask: what did we *assume* that turned out false? What did the crowd see that we dismissed?

## 9. Verdict → sizing link
Outputs one of:
- **Kill** — a load-bearing assumption fails, the catalyst is two-sided-to-the-downside and priced, or there's no falsification/invalidation. Log it, don't surface it.
- **Downgrade** — survives but with a fragile assumption → smaller size / lower tier.
- **Pass, sized to the weakest load-bearing assumption's confidence** — not the upside. High conviction requires the *bear case to be weak*, not the bull case to be exciting.

Surface the **one or two questions the idea is most vulnerable on** and how the plan answers them. An idea presented without its strongest counter-argument hasn't been stress-tested.

---

## How the desk uses it
- The **Red Team** runs §1–§8, hands the CIO a verdict + residual vulnerabilities.
- The **CIO gate** (`skills/decision/review-rubric.md`) won't pass a high-conviction idea that hasn't survived, and sizes per §9.
- Applies to **user premises too**: audit the asserted cause→effect (§1–§2) and answer with the conditional and flip-risk, not a reflexive "yes." Agreeing without testing is the failure mode this file prevents.

