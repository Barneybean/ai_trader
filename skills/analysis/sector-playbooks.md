# Sector Playbooks — index

Generic fundamentals (P/E, growth) miss the real drivers — every industry prices on different
things: a semi on **process-node yield & customer wins**, a clinical biotech on **trial
readouts & months of cash**, a fintech on the **product-led flywheel**. Route each candidate to
its industry's playbook (read `sector`/`industry` from `get_equity_fundamentals`) and answer
that playbook's questions from primary sources before forming a view. This is the engine behind
`skills/edge/variant-perception.md`: most under-priced edges live in a sector-specific fact the
generic screen never sees.

## Coverage (one file per sector — scalable)

| Sector | File | Prices on… |
|---|---|---|
| Semiconductors & hardware | `sectors/semiconductors.md` | node yield, memory cycle & contracts, design wins |
| Biotech & pharma | `sectors/biotech-pharma.md` | pipeline rNPV, cash runway, trial/PDUFA catalysts |
| Software / AI / internet | `sectors/software-ai.md` | growth durability, NRR, AI monetization, Rule of 40 |
| Consumer fintech / product-led | `sectors/consumer-fintech.md` | product-led flywheel, stickiness, ecosystem |
| Nuclear / power / energy | `sectors/power-energy-nuclear.md` | licensing/timeline, PPAs, AI power demand |
| Robotics / autonomy | `sectors/robotics-autonomy.md` | deployment scale, unit economics (optionality) |

**Add a sector:** copy `sectors/_TEMPLATE.md` → `sectors/<name>.md`, fill it in, add a row here.
Don't grow a monolith. If a name spans sectors, use both.

## The two archetypes to hit (the standard)

- **Intel — a semis process/catalyst story** (`sectors/semiconductors.md`): is 18A working, how
  big if it works, how likely (handicapped), TSMC N2 gap, CHIPS/gov backing, foundry customers →
  **bull/base/bear scenario valuation**. Plus the CEO's $23M open-market buy at ~$23
  (`skills/edge/smart-money.md`).
- **Moderna at ~$20 — a biotech pipeline + cash-floor story** (`sectors/biotech-pharma.md`):
  rNPV of pipeline + cash ≈/> market cap (pipeline priced at zero) + catalysts → deep
  undervaluation. Ran to $70+.

## How every playbook is structured (interchangeable)

Each answers: (1) **the one or two variables that set the price**, (2) **the dated catalysts**
and the primary source that reveals each first, (3) **how the sector is valued** (which multiple/
model, on what earnings base) and the mispricing signal, (4) the **sector-specific red flags**,
(5) the **primary sources**, and (6) the **variant angle** — what industry insiders track that
generalists miss.

