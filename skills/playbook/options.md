# Options Playbook — Preferred Structures

The user trades options and prefers defined, income-oriented structures. Capture these as sanctioned strategies the desk can propose *when appropriate*, always with the same confirm-before-place discipline as equities.

## ⚠️ Account constraint (check first)

Options require an approved **option level** on the account being traded. The desk reads which
account it may trade — and any option-level limits — from your local config (`config.local.toml`,
git-ignored) and by calling the broker's `get_accounts` each run; account numbers are **never**
hardcoded here. Typical situations to handle:
- If the tradable account has **no option level enabled**, the desk **cannot place options there** —
  it may still analyze/recommend them and tell the user to enable options or place manually.
- If a *different* account carries options approval but isn't the agent-accessible one, the desk
  can't route orders to it.
- **Cash accounts** can't do strategies that require margin (e.g., naked puts need the
  cash-secured form).

Re-check `get_accounts` each run and respect whatever the live account actually allows.

## Core concepts the user uses

- **Delta** ≈ the option's sensitivity to the underlying and a rough proxy for the probability of finishing in-the-money. Higher delta = more stock-like, higher cost, higher assignment odds.
- **Buy in-the-money (ITM) options** when you want stock-like exposure with less time-premium decay and a higher delta — the user's preference for directional bets.

## Sanctioned structures

### Covered call
Own 100 shares, sell a call against them to collect premium. **Use when the user is willing to sell the shares at the strike and wants income, accepting capped upside.** Best on names held in the Core sleeve that have run up and where the user would happily be called away near resistance. The premium lowers effective cost basis; the trade-off is you cap gains above the strike.

### Cash-secured put (sell put)
Sell a put and set aside cash to buy the shares if assigned. **Use to get paid to potentially buy a stock you want lower.** The premium reduces your effective entry price. Risk is substantial if the stock falls hard (you're obligated to buy at the strike), but it's defined by the strike minus premium, and it's the *cash-secured* form for a cash account — not a naked put. Size so assignment wouldn't blow the per-idea risk cap.

### Vertical spreads (call or put)
Buy one option and sell another of the same type at a different strike/same expiry to **cap both cost and risk**. A vertical is the user's tool for a directional view with defined, limited loss (reference the user's noted resource: youtu.be/1SVswX2V_vE). Prefer these over naked long options when paying up for premium, and over naked short options when risk must be bounded.

## How the desk proposes options

1. **Only when the structure fits the thesis and horizon** — covered calls/CSPs for income and entries on names you'd hold; verticals for defined-risk directional bets. Don't bolt options onto every idea.
2. **Always show:** structure, strikes, expiry, net debit/credit, max gain, max loss, breakeven, and assignment implications — options hide risk that must be made explicit.
3. **Respect the account constraint above** and flag when the trade can't be placed in the tradable account as-is.
4. **Tax note:** most options are short-term / ordinary-income taxed; covered-call premium and assignments have their own treatment — keep the Tactical-sleeve tax drag in mind (`skills/decision/tax-aware.md`).
5. **Confirm before placing** via `review_option_order` → explicit yes → `place_option_order`, same as equities.

**Mentor's options discipline** (`skills/playbook/mentor-casebook.md`): only **small, LONG-dated calls on high-conviction names** — a tiny position (≲0.15–1%) betting on a multi-quarter/year thesis (his RC Jan-2027, SOFI, Google/Intel calls — all taken to profit). **Short-dated options = gambling** ("玩多了长期都亏钱") — avoid. Use puts only as brief tactical hedges at highs, taken to profit in days, not as a standing book.
