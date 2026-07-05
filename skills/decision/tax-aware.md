# Tax-Aware Trading

The desk's tradable account (configured in `config.local.toml`) is assumed to be a **taxable individual brokerage account**, so realized gains and losses have real tax consequences. Taxes are a cost like any other — the desk optimizes **after-tax** returns, not headline returns. This is a general framework, not tax advice; the user should confirm specifics with a tax professional, and exact rates depend on their income and filing status.

## The core facts the desk reasons from

- **Holding period matters a lot.** Sell a position held **one year or less → short-term gain, taxed as ordinary income** (the higher rate). Held **more than one year → long-term gain, taxed at the lower long-term capital-gains rate.** For many investors that difference is 10–20+ percentage points of the gain. This is the single biggest tax lever.
- **Match gains and losses by type.** Short-term losses first offset short-term gains; long-term losses offset long-term gains; net the two afterward. Realized net losses can offset up to **$3,000** of ordinary income per year, with the remainder carried forward.
- **Wash-sale rule.** If you sell at a loss and buy the *same or a substantially identical* security within **30 days before or after** the sale, the loss is **disallowed** for now — it's added to the cost basis of the replacement and the holding period carries over. So don't harvest a loss and jump right back in; wait 31+ days or use a genuinely different instrument.
- **Retirement accounts are different.** IRAs (Roth/Traditional), if you have them, are tax-sheltered — churn there has no immediate tax cost. But this desk trades the *taxable* account, so tax-awareness is fully in force here. If you ever route trades to a tax-sheltered IRA, relax the tax constraints accordingly.

## How the sleeves handle tax

**Core sleeve (long-term).** This is where tax optimization pays off most.
- Bias toward holding winners **past the one-year mark** when the thesis is intact. If a Core position is a winner and is, say, within a couple of months of qualifying for long-term treatment, that's a strong reason *not* to sell early — quantify the tax difference and surface it. Only override for a genuine thesis break or risk event.
- When trimming, prefer lots that are already long-term, or losers that can be harvested.

**Tactical sleeve (short-term).** These trades are *inherently* short-term / ordinary-income taxed and churn more, so they carry a built-in tax drag.
- Because of that drag, Tactical ideas must clear a **higher gross edge** to be worth it (see the net-edge rule in the rubric). A swing trade that nets only a hair after ordinary-income tax and spread isn't worth the risk.
- Keep the Tactical sleeve the smaller allocation, consistent with its higher friction.

## Tax-loss harvesting (opportunistic)

When the desk reviews holdings and finds a losing position whose thesis has weakened:
- Realizing the loss can offset realized gains (short vs long matched by type) and up to $3,000 of ordinary income — a real, bankable benefit.
- **Respect the wash-sale rule:** after harvesting, don't rebuy that ticker (or a substantially identical one) for 31+ days. If the user wants to stay exposed to the theme, rotate into a *different* name/ETF in the same area.
- Track any ticker sold at a loss so the desk doesn't recommend rebuying it inside the 30-day window (which would void the harvest).

## Rules the desk enforces

1. **Before recommending any SELL**, state the tax character: is this lot short-term or long-term? What's the approximate tax difference between selling now vs waiting for long-term? Would selling at a loss trigger a wash sale given recent buys?
2. **Never recommend rebuying a loss-harvested ticker within 30 days.** Maintain a short "recently harvested" list per run.
3. **Fold tax into the decision, don't let it override risk.** A tax reason to hold never outranks a stop-loss or a real thesis break — avoiding a big loss beats saving on tax. Tax is a tiebreaker and an optimizer, not a reason to ride a loser ("don't let the tax tail wag the investment dog").
4. **Report the after-tax framing** on Core exits and on any recommendation where tax materially changes the picture, so the user sees the trade-off.

## Quick reference

| Situation | Tax-aware move |
|---|---|
| Core winner near 1-yr mark, thesis intact | Prefer to hold for long-term rate; quantify the saving |
| Position stopped out / thesis broken | Exit regardless of tax — risk first |
| Losing position, weak thesis, have gains to offset | Consider harvesting; avoid rebuy 31+ days |
| Want to rotate but both names similar rank | Don't — turnover costs tax; hold (see skills/decision/strategies.md) |
| Tactical (short-term) idea with thin edge | Skip — ordinary-income tax + spread eats it |
