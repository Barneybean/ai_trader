#!/usr/bin/env python3
"""
Create the dated report file for a AI Trader run.

This is the *reusable* part of producing the daily report: the filename/title
convention and the fixed section scaffold (which matches the "Output format"
block in SKILL.md). The desk run fills the sections with live analysis; this
script just guarantees a consistently-titled, well-structured file exists in
the reports/ folder so there is a dated archive.

Pure standard library — no install step.

Filename convention: report_<date>_<title>_<model>.md
    e.g. reports/report_2026-07-05_daily-desk-run_claude-fable-5.md
Title and model are slugified (lowercase, hyphens). Pass the run's focus as
--title ("daily-desk-run", "nvda-deep-dive") and the AI model that ran the
desk as --model, so the archive shows what was analyzed and by which model.

Usage:
    python3 scripts/report/new_report.py --title daily-desk-run --model claude-fable-5
    python3 scripts/report/new_report.py --market open    # stamp "market open" in the header
    python3 scripts/report/new_report.py --date 2026-07-03
    python3 scripts/report/new_report.py --force          # overwrite if it already exists
    python3 scripts/report/new_report.py --print-path     # just print the path, write nothing

On success it prints the absolute path of the report file (last line), so a
caller can capture it.
"""

import argparse
import datetime as _dt
import os
import sys

_SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(_SCRIPTS, d) for d in ("lib", "analysis", "ops")]

import clock  # canonical time; reports file under the Pacific calendar day

# reports/ lives at the project root, one level up from this scripts/ dir. The
# editable markdown is a *build intermediate* — it lives in a git-ignored build
# dir so `reports/` itself only ever holds the finished, committed **HTML**.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REPORTS_DIR = os.path.join(PROJECT_ROOT, "reports")
BUILD_ROOT = os.path.join(REPORTS_DIR, ".build")  # git-ignored; grouped by ISO week

FILENAME_FMT = "report_{date}_{title}_{model}.md"

SCAFFOLD = """\
# Desk Run — {date_human}{market}

_<one-line dateline: session date, what this run covered, account status & buying power>_

## The call — what to do
<Decision-first: lead with the recommendation and the orders, so a busy reader gets the answer in
5 seconds. Then "Why" (high level), then the detail. Value-first tiles, tone = pos|neg|warn.>

> [!VERDICT] **<The one-line bottom line — the move and the why.>**
::: kpi
BUY · <TICKER> | <one-line reason> | pos
HOLD · <TICKER> | <reason> |
AVOID · <TICKER> | <reason> | neg
<$ buying power> | To deploy | warn
:::

**Orders — mode {mode} · configured execution account · value $<X> · buying power $<Y>.** (never include account identifiers; other accounts remain read-only and appear only as percentages) <Sizing rule: ≤2% risk/idea, ≤25%/name, cash from configured policy + current regime. In SEMI: number the tickets for "approve N". In FULL: split into "Executed" (with fill status + rationale) and "Proposed (borderline)".>

| Ticker | Side | Size now | Order | Stop (GTC) | Target | $ risk |
|---|---|---|---|---|---|---|
| **<T>** | BUY starter | $<n> · ~<sh> sh | limit $<px> | wk close < $<s> | ~$<t> | ~$<r> · <p>% |
| **<T>** | add-on-dip | $<n> | resting limit $<px> GTC · 24h | < $<s> | ~$<t> | on a dip only |

> [!ACTION] **BUY <T> — starter $<n> at limit $<px>, now.** <the one live order + add plan.>
> [!WATCH] **<T>** — resting limit / price alert at $<level>; <what a fill/break means>.
> [!NOTE] Resting limits go to the **24-hour market** (GTC · whole shares) so a wash fills the moment it hits, not just at the 9:30 open. Trading mode **{mode}** governs the trigger — manual: per-order confirm · semi: reply "approve N" · full: desk executes within playbook gates and reports every fill. Accounts outside the configured execution scope remain read-only.

<Embed the scorecards for the actionable picks here — the call in one visual each:>
![<T> decision scorecard](charts/<T>-<date>-scorecard.svg)

_If nothing clears the bar, say so plainly and recommend holding cash._

## Why — the high-level thesis
<A few tight sentences / a `::: compare` that frames the calls above. Regime, the edge, what's
worth buying vs avoiding — the reasoning, before the detail.>

## The detail — expand each idea
<One collapsible per idea, ranked highest-edge first. The call + scorecard already led above; here
is the evidence, levels, and charts a reader can drill into.>

### <TICKER> — <Buy/Accumulate/Trim/Avoid> · <Tactical|Core|Layer ①/②/③> · score X/100 · conviction Low/Med/High

> [!VERDICT] **<ACCUMULATE — the one-sentence thesis a non-financial reader gets instantly>.**

<Scorecard first: the call + trade plan + money-flow read in one visual. Generate it with
scripts/report/charts.py (pass --action/--conviction/--score/--sleeve/--entry/--stop/--target).>
![<TICKER> decision scorecard](charts/<TICKER>-<date>-scorecard.svg)

<Intro block — MANDATORY; assume the reader has never heard of the ticker:>
- **What it is:** business model, sector, size (mcap), how it makes money — 1–2 plain sentences — and why it's in the book/report at all.
- **Evidence trail (dated):** the specific collected facts fueling this verdict — filings/8-Ks read, analyst actions with the argument, dividend declarations (declared rate × frequency ÷ price, never the displayed trailing yield), mentor input + his sizing, ownership structure — each dated & sourced so the call is auditable.
- **Why it's mispriced:** which value-chain layer it sits in and how pure/elastic the exposure is.
- **The edge (variant perception):** consensus vs. our differentiated view, why it isn't priced, the catalyst/timeline.
- **Two horizons (always, with a clock):** short-run direction/level/target (~days–weeks) + wash likelihood; long-run target + time window (~6–18mo).

<Optional editorial blocks — use when they carry the point, not for decoration:>
<· one giant number that IS the message:>
::: hero
+58 | flow pressure — net accumulation, coiled for an up-move | teal
:::
<· hold a tension in two cards (bull vs bear, certainty vs purity):>
::: compare
Base case | <phrase> | <why> | pos
Bear case | <phrase> | <what breaks it> | rust
:::
<· a real dated sequence (catalyst path / production ramp):>
::: timeline
Now | <state>
4–8wk | <next catalyst / expected wash>
~6mo | <target if base completes>
:::

::: details Full analysis — footprint, levels, money-flow & trade plan

#### Institutional footprint — phase & chips
<The depth a daily deep-dive carries — do NOT skip this on a theme run. Chip chart is mandatory.>
![<TICKER> chip distribution](charts/<TICKER>-<date>-chips.svg)
- **Wyckoff phase:** accumulation / markup / distribution / markdown — plus the wash-vs-markup call (is a shakeout loading before a leg up, or is this real distribution?).
- **Chip distribution:** main cost basis (price + % of chips), **in-profit % vs trapped-overhead %**, concentration/dispersion — cite the `charts.py` chip summary. Where supply concentrates, the overhead that must clear, whether the base holds.
- **Insider / smart-money:** dated Form-4 open-market buys/sells (names, share counts, prices) or 13F positioning, if any.

#### The setup — levels & signals
![<TICKER> price/volume](charts/<TICKER>-<date>-price.svg) ![<TICKER> signals](charts/<TICKER>-<date>-gauges.svg)
- **Support/resistance ladder (with strength):** each level + how many times tested — cite `indicators.py`.
- **Trend & momentum:** SMA20/50/200 + trend read; **RSI, MACD, Stochastic %K, ADX**; volume (**rel-vol, OBV**) — cite the numbers.
- **Money-flow read:** flow_pressure, coil_energy, divergence, verdict + the trigger that confirms — cite `flow_anomaly.py`. Options overlay (P/C, IV rank, skew, unusual OI) if pulled.
> [!TIP] **How to read the charts:** <one-liner decoding chips/gauges/scorecard for a non-expert.>

#### Forecast — the odds
<Quantify the next move — probabilities + magnitude, not "looks bullish." Run
scripts/analysis/forecast.py (squeeze percentile · historical-analog base rate · Monte-Carlo
P(up)/P(down) + first-passage + price cone; --drift to price a headwind). Include for any
coiling / level-testing name; if it isn't coiled, SAY SO (the tool discriminates).>
<Draw it: charts.py emits `<TICKER>-<date>-forecast.svg` — history + the median projected
path + the 10–90% cone + the break/target lines. Embed it here:>
![<TICKER> price forecast](charts/<TICKER>-<date>-forecast.svg)
> [!TIP] **Reading the fan:** dashed line = median projected path; shaded cone = 10–90% outcome band; ▲/▼ = the break levels, T1/T2 = targets. Point at the fat tail — that's the move to plan for.
- **Structure:** Bollinger width <N>th percentile (<coiled | not a coil>); support $<lvl> tested <k>×.
- **Monte Carlo (~20d):** P(up) <p>% / P(down) <q>%, expected <±m>%; cone p10 $<a> · median $<b> · p90 $<c>.
- **First-passage / base rate:** <X>% it tags <up | down> level first; analogs resolved <U>% up. **Separate the clocks** — the near-term first move can oppose the pattern's eventual resolution; saying which *is* the edge.

#### Fundamentals & catalyst map
- <valuation vs a mature comparable, strategy/roadmap, the narrative gap>
<Catalyst map — MANDATORY per skills/analysis/catalyst-scan.md: scheduled events from the
calendar/filings, what just happened, and the company-response class. Label desk guesses
`SPECULATED (P≈x%)` so they never masquerade as filings:>

| Date | Event | Direction if… | Company action (class) | Source |
|---|---|---|---|---|
| <date> | <earnings / ex-div / debt maturity / regulatory> | <up if… / down if…> | <IMPROVING / WORSENING / COSMETIC> | <dated cite> |

**Next binary:** <date> <event> — positioning into it: <hold through / de-risk / gate adds / size-to-survive-the-tail>.

> [!ACTION] **Trade plan:** entry zone, stop (ATR/structure + hard invalidation), **3-step target ladder**, share count, $ at risk (% of account), exit plan.
> [!RISK] **What kills the thesis:** 2–3 concrete invalidation conditions.
<Tax note on any sell. Sources: dated links for news/sentiment/macro claims.>
:::

## Watchlist — analyzed, not actionable yet
<One line each for names that did NOT clear the bar: price, the single reason, and the level to wait for.>

## Sleeve status
::: kpi
<x>% | Tactical (target ~40%) |
<y>% | Core (target ~60%) |
<z>% | Cash | warn
:::

## Calendar (week ahead)
- Key dated events (FOMC/CPI/NFP, earnings) and, in plain terms, what each means for the entries.

## Sources
<Prove it — every material number (price, valuation, insider $, catalyst date) gets a dated link.
Tag anything not from the live connector.>
- <claim> — <dated source link>

_Informational only — not financial advice. Execution follows your trading mode ({mode}); `/mode manual` halts all autonomous execution._

<!-- lang:zh -->
<Everything ABOVE this marker is the English report; everything BELOW is the 中文 version. The
builder renders both with an EN / 中文 toggle at the top. MIRROR THE ENGLISH EXACTLY — same
sections, same numbers, same orders, same charts (reference the identical charts/…svg files).
When you change one language, change the other in the SAME edit.>

# <标题 — 与英文标题对应>

_<日期线：日期、覆盖范围、账户与买入力>_

## 结论 — 怎么做
> [!VERDICT] **<一句话结论：动作 + 理由。>**
::: kpi
买入 · <标的> | <一句理由> | pos
持有 · <标的> | <理由> |
回避 · <标的> | <理由> | neg
<$买入力> | 可用买入力 | warn
:::
**订单 — 模式 {mode} · 智能体账户 · 市值 $<X> · 买入力 $<Y>。**（仅智能体账户可写美元金额；其他账户只用百分比） <按 ≤2% 风险、单名 ≤25%、留 ~35% 现金。半自动模式：给订单编号，回复"approve N"执行；全自动模式：分"已执行"（含成交状态与理由）和"待批准（边际信号）"两栏。>

| 标的 | 方向 | 现在规模 | 订单 | 止损(GTC) | 目标 | 风险额 |
|---|---|---|---|---|---|---|
| **<T>** | 买入(起步) | $<n> · ~<股> | 限价 $<px> GTC · 24小时 | 周收 < $<s> | ~$<t> | ~$<r> · <p>% |

> [!ACTION] **买 <T> — 起步 $<n> 限价 $<px>，现在。** <唯一即时单 + 加仓计划。>
> [!NOTE] 挂单默认走**24小时市场**（GTC · 整股），一触及即成交，不必等 9:30 开盘。执行权限由交易模式 **{mode}** 决定——manual：逐单确认 · semi：回复"approve N"批准 · full：桌面在策略护栏内自主执行并即时汇报每笔成交。
![<T> decision scorecard](charts/<T>-<date>-scorecard.svg)

## 为什么 — 高层逻辑
<与英文"Why"对应的几句/`::: compare`。>

## 细节 — 逐个展开
### <标的> — <买入/持有/回避> · <战术|核心|层级 ①/②/③> · 评分 X/100 · 信心 低/中/高
> [!VERDICT] **<一句话结论，非专业读者也能秒懂>。**
![<标的> decision scorecard](charts/<标的>-<date>-scorecard.svg)
<公司简介块——必填；假设读者从未听说过这只股票：>
- **是什么：** 商业模式、行业、规模（市值）、靠什么赚钱——1–2 句大白话——以及它为什么会出现在本账户/本报告里。
- **证据链（带日期）：** 支撑本判定的具体事实——读过的财报/8-K、分析师行动及其论据、股息宣告（用"已宣告股息×频率÷价格"，绝不用页面显示的过期收益率）、导师观点及其仓位、股权结构——每条注明日期与来源，让判定可审计。
- **为何错价：** 处于价值链哪一层、敞口是否纯粹/有弹性。
- **认知差（variant perception）：** 共识 vs 我们的差异化判断、为何未被定价、催化剂与日期。
- **两个周期（都要带时钟）：** 短线方向/点位/目标（~日–周）+ 洗盘概率；长线目标 + 时间窗（~6–18个月）。

::: details 完整分析 — 筹码、指标、资金流与交易计划

#### 机构足迹 — 阶段与筹码
<主题研报也不能省掉这一段深度；筹码图为必备。>
![<标的> chip distribution](charts/<标的>-<date>-chips.svg)
- **Wyckoff 阶段：** 吸筹 / 拉升 / 派发 / 下跌 —— 以及洗盘 vs 真派发的判断。
- **筹码分布：** 主力成本（价格 + 筹码占比）、**获利盘% vs 套牢盘%**、集中/分散度 —— 引用 `charts.py` 筹码摘要。供给集中在哪、要突破的上方套牢、底部是否守住。
- **内部人 / 聪明钱：** 带日期的 Form-4 公开市场买卖（姓名、股数、价格）或 13F 持仓，如有。

#### 技术面 — 点位与信号
![<标的> price/volume](charts/<标的>-<date>-price.svg) ![<标的> signals](charts/<标的>-<date>-gauges.svg)
- **支撑/压力阶梯（带强度）：** 每个点位 + 被测试次数 —— 引用 `indicators.py`。
- **趋势与动量：** SMA20/50/200 + 趋势判断；**RSI、MACD、随机指标、ADX**；量能（**相对量、OBV**）—— 引用数值。
- **资金流：** flow_pressure、coil_energy、背离、结论 + 确认触发 —— 引用 `flow_anomaly.py`；如有则叠加期权流（P/C、IV rank、偏斜）。
> [!TIP] **图怎么看：** <一句话，给非专业读者解读 筹码/信号/评分卡>。

#### 预测 — 赔率
<量化下一步——概率+幅度，而非"看起来看涨"。运行 scripts/analysis/forecast.py（收敛百分位 · 历史类比基准率 ·
蒙特卡洛 上涨/下跌 + 首达 + 价格锥；--drift 计入逆风）。任何盘整/测试关键位的名字都要包含；若未收敛，
就明说（工具能区分）。>
<画出来：charts.py 会生成 `<TICKER>-<date>-forecast.svg` —— 历史 + 中位预测路径 + 10–90% 锥 + 突破/目标线。在此嵌入：>
![<TICKER> price forecast](charts/<TICKER>-<date>-forecast.svg)
> [!TIP] **怎么看扇形：** 虚线=中位预测路径；阴影锥=10–90% 结果带；▲/▼=突破位，T1/T2=目标。看厚尾——那是要提前计划的那一动。
- **结构：** 布林带宽第 <N> 百分位（<收敛 | 非盘整>）；支撑 $<lvl> 被测 <k> 次。
- **蒙特卡洛(~20日)：** 上涨 <p>% / 下跌 <q>%，期望 <±m>%；锥 p10 $<a> · 中位 $<b> · p90 $<c>。
- **首达 / 基准率：** <X>% 先触及 <上 | 下> 位；类比样本 <U>% 上行。**分清时间尺度**——近端首动可能与形态最终解决相反；说清是哪个*就是*优势。

#### 基本面与催化剂地图
- <相对成熟对标的估值、路线图、叙事差>
<催化剂地图——必填，按 skills/analysis/catalyst-scan.md：日历/文件中的既定事件、刚发生的事件、
公司响应类别。台面推测必须标注 `推测（P≈x%）`，绝不与公司文件混排：>

| 日期 | 事件 | 若发生则… | 公司动作（类别） | 来源 |
|---|---|---|---|---|
| <日期> | <财报 / 除息 / 债务到期 / 监管> | <向上若… / 向下若…> | <改善型 / 恶化型 / 表面功夫> | <带日期引用> |

**下一个二元事件：** <日期> <事件> —— 应对姿态：<持有过关 / 提前减险 / 触发前禁加仓 / 按左尾生存来定仓位>。

> [!ACTION] **交易计划：** 入场区、止损（ATR/结构 + 硬性失效）、**三级目标阶梯**、股数、风险额（占账户%）、离场计划。
> [!RISK] **什么会证伪：** 2–3 个具体失效条件。
<卖出的税务备注。来源：每个关键数字配带日期链接。>
:::

## 来源
- <与英文相同的带日期链接>

_仅供信息与研究参考，不构成投资建议。订单执行遵循当前交易模式（{mode}）；`/mode manual` 可随时切回逐单确认。_
"""


def _today():
    return clock.pacific_date().isoformat()


def slugify(text):
    """Lowercase, hyphen-separated, filename-safe ("NVDA Deep Dive" -> "nvda-deep-dive")."""
    out = []
    for ch in text.lower():
        if ch.isalnum() or ch == ".":
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    # Leading dots create hidden files and repeated dots are path-like noise.
    # Preserve an internal model-version dot (for example gpt-5.2), but never
    # permit a slug to begin/end with punctuation or contain "..".
    slug = "".join(out).strip("-.")
    while ".." in slug:
        slug = slug.replace("..", ".")
    return slug or "untitled"


def build_path(date_iso, title, model):
    # the .md source lives in the git-ignored build dir; build_report.py emits the
    # committed .html into reports/ (pass --out reports/<same-stem>.html).
    day = _dt.date.fromisoformat(date_iso)
    iso = day.isocalendar()
    build_dir = os.path.join(BUILD_ROOT, f"{iso.year}-W{iso.week:02d}")
    return os.path.join(build_dir, FILENAME_FMT.format(
        date=date_iso, title=slugify(title), model=slugify(model)))


def render_scaffold(date_iso, market):
    d = _dt.date.fromisoformat(date_iso)
    date_human = d.strftime("%A, %B %-d, %Y") + " (PT)"
    market_suffix = f" ({market})" if market else ""
    import desk_mode
    return SCAFFOLD.format(date_human=date_human, market=market_suffix,
                           mode=desk_mode.current().upper())


def main(argv=None):
    p = argparse.ArgumentParser(description="Create the dated AI Trader report file.")
    p.add_argument("--date", default=_today(), help="Report date YYYY-MM-DD (default: today).")
    p.add_argument("--title", default="desk-run",
                   help="Short run title, slugified into the filename (default: desk-run).")
    p.add_argument("--model", default="unknown-model",
                   help="AI model that ran the desk (e.g. claude-fable-5), slugified into the filename.")
    p.add_argument("--market", choices=["open", "closed"], default=None,
                   help="Optional market state to stamp in the header.")
    p.add_argument("--force", action="store_true", help="Overwrite if the file already exists.")
    p.add_argument("--print-path", action="store_true", help="Only print the path; do not write.")
    args = p.parse_args(argv)

    # Keep the report root as the current-week inbox even when this command is
    # only being used to print/scaffold a path.
    from organize_reports import organize_reports, organize_support_files
    organize_reports()
    organize_support_files()

    try:
        _dt.date.fromisoformat(args.date)
    except ValueError:
        p.error(f"--date must be YYYY-MM-DD, got {args.date!r}")

    market = None
    if args.market:
        market = "market open" if args.market == "open" else "market closed"

    path = build_path(args.date, args.title, args.model)

    if args.print_path:
        print(path)
        return 0

    os.makedirs(os.path.dirname(path), exist_ok=True)

    if os.path.exists(path) and not args.force:
        sys.stderr.write(
            f"Report already exists (use --force to overwrite): {path}\n"
        )
        print(path)
        return 0

    with open(path, "w", encoding="utf-8") as f:
        f.write(render_scaffold(args.date, market))

    sys.stderr.write(f"Wrote scaffold: {path}\n")
    print(path)
    return 0


if __name__ == "__main__":
    import desk_log
    raise SystemExit(desk_log.run(main))
