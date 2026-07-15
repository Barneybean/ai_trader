#!/usr/bin/env python3
"""
Render a desk report from markdown into a **self-contained, styled HTML file**.

Why: markdown is the natural way to *write* the analysis, but a browser page is
far easier to *read* — cards per recommendation, styled tables, colour-coded
badges, and the charts sitting inline next to the thesis. This tool keeps the
markdown as the editable source and produces a polished HTML twin.

Key property: it **inlines** any `![alt](charts/NAME.svg)` image whose SVG file
exists, so the output is one portable file (no broken image links on GitHub, in
email, or when saved to disk). Images it can't find are left as normal `<img>`.

Pure standard library — a compact markdown-subset converter (headings, lists,
pipe tables, blockquotes, rules, bold/italic/code, links, images). It is tuned
for the desk report scaffold in SKILL.md, not arbitrary markdown.

Usage:
    python3 scripts/report/build_report.py reports/.build/2026-W28/report_2026-07-03_daily-desk-run_claude-fable-5.md
    python3 scripts/report/build_report.py <in.md> --out <out.html>
    python3 scripts/report/build_report.py <in.md> --charts-dir reports/assets/charts/YYYY-Www
"""

import argparse
import html
import os
import re
import sys
from urllib.parse import urlsplit

from report_week import week_name

_SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(_SCRIPTS, d) for d in ("lib", "analysis", "ops")]
PROJECT_ROOT = os.path.dirname(_SCRIPTS)
REPORTS_DIR = os.path.join(PROJECT_ROOT, "reports")



# --------------------------------------------------------------------------- #
# Inline formatting
# --------------------------------------------------------------------------- #

_CODE_RE = re.compile(r"`([^`]+)`")
_IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
# italic only at word boundaries so snake_case / file_names survive
_ITAL_A = re.compile(r"(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])")
_ITAL_U = re.compile(r"(?<![\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])")


def _inline(text, base_dir, charts_dir):
    """Convert inline markdown to HTML. Code spans are protected first so their
    contents aren't re-formatted; images are handled by the block layer, but any
    stray inline image is rendered as a plain <img>."""
    codes = []

    def _stash(m):
        codes.append(m.group(1))
        return f"\x00{len(codes) - 1}\x00"

    text = _CODE_RE.sub(_stash, text)
    text = html.escape(text, quote=False)
    text = _BOLD_RE.sub(r"<strong>\1</strong>", text)
    text = _ITAL_A.sub(r"<em>\1</em>", text)
    text = _ITAL_U.sub(r"<em>\1</em>", text)
    def _link(m):
        label, href = m.groups()
        # Reports are durable artifacts and may contain model-authored markdown.
        # Keep active schemes (javascript:, data:, file:) out of the result.
        scheme = urlsplit(html.unescape(href)).scheme.lower()
        safe = href if scheme in ("", "http", "https", "mailto") else "#"
        return (f"<a href='{html.escape(safe, quote=True)}' target='_blank' "
                f"rel='noopener noreferrer'>{label}</a>")
    def _img(m):
        alt, src = m.groups()
        scheme = urlsplit(html.unescape(src)).scheme.lower()
        safe = src if scheme in ("", "http", "https") else "#"
        return (f"<img src='{html.escape(safe, quote=True)}' "
                f"alt='{html.escape(alt, quote=True)}' style='max-width:100%'>")
    text = _IMG_RE.sub(_img, text)   # stray inline image on a mixed text line
    text = _LINK_RE.sub(_link, text)

    def _unstash(m):
        return f"<code>{html.escape(codes[int(m.group(1))], quote=False)}</code>"

    return re.sub(r"\x00(\d+)\x00", _unstash, text)


def _svg_inline(src, base_dir, charts_dir):
    """Return the raw SVG markup for `src` if the file exists, else None."""
    roots = [os.path.realpath(base_dir)]
    if charts_dir:
        roots.append(os.path.realpath(charts_dir))
    for cand in (os.path.join(base_dir, src),
                 os.path.join(charts_dir, os.path.basename(src)) if charts_dir else None):
        real = os.path.realpath(cand) if cand else None
        allowed = real and any(real == root or real.startswith(root + os.sep) for root in roots)
        if allowed and os.path.isfile(real):
            with open(real, encoding="utf-8") as f:
                svg = f.read()
            # strip any xml/doctype prolog; keep from the first <svg
            i = svg.find("<svg")
            svg = svg[i:] if i >= 0 else svg
            # SVG can execute script or load remote resources when embedded raw.
            if re.search(r"<\s*script\b|\bon\w+\s*=|(?:href|src)\s*=\s*['\"]\s*(?:javascript:|data:|https?:)",
                         svg, re.I):
                return None
            return svg
    return None


def _svg_is_tall(svg, ratio=0.85):
    """True when an inlined SVG's aspect (h/w) is >= ratio — a portrait/near-square
    chart that shouldn't be upscaled to full container width."""
    m = re.search(r"viewBox='0 0 ([\d.]+) ([\d.]+)'", svg) or \
        re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    if not m:
        return False
    w, h = float(m.group(1)), float(m.group(2))
    return bool(w) and (h / w) >= ratio


def _render_images(line, base_dir, charts_dir):
    """A line that is only image(s) → a figure row (charts side by side). Inlines
    SVGs when possible. Returns HTML, or None if the line isn't image-only."""
    imgs = _IMG_RE.findall(line)
    if not imgs or _IMG_RE.sub("", line).strip():
        return None
    figs = []
    for alt, src in imgs:
        svg = _svg_inline(src, base_dir, charts_dir) if src.endswith(".svg") else None
        if svg:
            # A portrait-ish chart (e.g. the chip histogram) blows up if it fills a
            # full-width lone row — tag it so CSS can cap its width to match the
            # half-width charts instead of upscaling it to a giant tower.
            tall = " tall" if _svg_is_tall(svg) else ""
            figs.append(f"<figure class='chart{tall}'>{svg}</figure>")
        else:
            scheme = urlsplit(src).scheme.lower()
            safe_src = src if scheme in ("", "http", "https") else ""
            figs.append(f"<figure class='chart'>"
                        f"<img src='{html.escape(safe_src, quote=True)}' "
                        f"alt='{html.escape(alt, quote=True)}'></figure>")
    cls = "charts-row" if len(figs) > 1 else "charts-one"
    return f"<div class='{cls}'>{''.join(figs)}</div>"


# --------------------------------------------------------------------------- #
# Block parsing
# --------------------------------------------------------------------------- #

def _card_accent(heading):
    """Colour-code a recommendation card by the action in its heading — the way a
    desk blotter tags a line: green=add, red=avoid/trim, amber=watch/hold."""
    h = heading.lower()
    if any(k in h for k in ("avoid", "trim", "sell", "pass", "did not clear", "reduce")):
        return "card-neg"
    if any(k in h for k in ("buy", "accumulate", "add", "starter", "long", "overweight")):
        return "card-pos"
    if any(k in h for k in ("watch", "hold", "neutral", "monitor")):
        return "card-warn"
    return "card-neu"


_CALLOUTS = {
    "ACTION":  ("callout-action",  "▶ Action"),
    "TIP":     ("callout-tip",     "💡 In plain English"),
    "PLAIN":   ("callout-tip",     "💡 In plain English"),
    "WATCH":   ("callout-note",    "◔ Watch / wait"),
    "WARNING": ("callout-warning", "⚠ Risk"),
    "RISK":    ("callout-warning", "⚠ What kills it"),
    "NOTE":    ("callout-note",    "ℹ Note"),
}


def _callout(kind, body, base_dir, charts_dir):
    k = kind.upper()
    if k == "VERDICT":   # the headline call — a full-width banner, not a small box
        return (f"<div class='verdict'><span class='verdict-tag'>The call</span>"
                f"<div class='verdict-body'>{_inline(body, base_dir, charts_dir)}</div></div>")
    if k == "QUOTE":     # the thesis in one line — a big pull-quote
        return f"<p class='quote'>{_inline(body, base_dir, charts_dir)}</p>"
    if k == "KICKER":    # a section eyebrow / where-am-I label
        return f"<div class='kicker'>{_inline(body, base_dir, charts_dir)}</div>"
    cls, label = _CALLOUTS.get(k, ("callout-note", kind.title()))
    return (f"<div class='callout {cls}'><span class='callout-label'>{label}</span>"
            f"{_inline(body, base_dir, charts_dir)}</div>")


def _render_kpis(inner_lines, base_dir, charts_dir):
    """Render a `::: kpi` block into a responsive tile grid. Each non-empty line is
    `Value | Label | tone?` where tone ∈ pos|neg|warn (colours the tile)."""
    tiles = []
    for ln in inner_lines:
        ln = ln.strip().lstrip("-").strip()
        if not ln:
            continue
        cells = [c.strip() for c in ln.split("|")]
        value = cells[0] if cells else ""
        label = cells[1] if len(cells) > 1 else ""
        tone = cells[2].lower() if len(cells) > 2 else ""
        cls = {"pos": "kpi-pos", "neg": "kpi-neg", "warn": "kpi-warn"}.get(tone, "")
        tiles.append(f"<div class='kpi {cls}'>"
                     f"<div class='kpi-v'>{_inline(value, base_dir, charts_dir)}</div>"
                     f"<div class='kpi-l'>{_inline(label, base_dir, charts_dir)}</div></div>")
    return f"<div class='kpi-grid'>{''.join(tiles)}</div>"


_TONE = {"pos": "teal", "teal": "teal", "buy": "teal",
         "neg": "rust", "rust": "rust", "avoid": "rust", "risk": "rust",
         "ink": "ink", "navy": "ink"}


def _render_compare(inner_lines, base_dir, charts_dir):
    """`::: compare` → side-by-side cards. Each line: `Label | Phrase | Body | tone?`
    (tone ∈ pos/teal · neg/rust · ink). Holds the tension between two reads."""
    cards = []
    for ln in inner_lines:
        ln = ln.strip().lstrip("-").strip()
        if not ln:
            continue
        c = [x.strip() for x in ln.split("|")]
        lab = c[0] if c else ""
        phrase = c[1] if len(c) > 1 else ""
        body = c[2] if len(c) > 2 else ""
        tone = _TONE.get(c[3].lower(), "") if len(c) > 3 else ""
        cards.append(f"<div class='ccard {tone}'><div class='lab'>{_inline(lab, base_dir, charts_dir)}</div>"
                     f"<div class='phrase'>{_inline(phrase, base_dir, charts_dir)}</div>"
                     + (f"<div class='body'>{_inline(body, base_dir, charts_dir)}</div>" if body else "")
                     + "</div>")
    return f"<div class='compare'>{''.join(cards)}</div>"


def _render_timeline(inner_lines, base_dir, charts_dir):
    """`::: timeline` → chevron-linked cards. Each line: `When | What`. Use only for
    a real dated sequence (order carries information)."""
    cards = []
    for ln in inner_lines:
        ln = ln.strip().lstrip("-").strip()
        if not ln:
            continue
        c = [x.strip() for x in ln.split("|")]
        when = c[0] if c else ""
        what = c[1] if len(c) > 1 else ""
        cards.append(f"<div class='tcard'><div class='when'>{_inline(when, base_dir, charts_dir)}</div>"
                     f"<div class='what'>{_inline(what, base_dir, charts_dir)}</div></div>")
    return f"<div class='timeline'>{''.join(cards)}</div>"


def _render_hero(inner_lines, base_dir, charts_dir):
    """`::: hero` → one giant number that IS the message. First non-empty line:
    `Number | caption | tone?`."""
    for ln in inner_lines:
        ln = ln.strip().lstrip("-").strip()
        if not ln:
            continue
        c = [x.strip() for x in ln.split("|")]
        num = c[0] if c else ""
        cap = c[1] if len(c) > 1 else ""
        tone = _TONE.get(c[2].lower(), "") if len(c) > 2 else ""
        return (f"<div class='hero {tone}'><div class='hero-num'>{_inline(num, base_dir, charts_dir)}</div>"
                + (f"<div class='hero-cap'>{_inline(cap, base_dir, charts_dir)}</div>" if cap else "")
                + "</div>")
    return ""


# Plain-English definitions for jargon — the builder auto-links the FIRST occurrence of
# each term to a hover tooltip so non-financial readers can decode the desk's shorthand.
GLOSSARY = {
    "variant perception": "The desk's non-consensus view — what we think the market has wrong and why it isn't priced in yet.",
    "chip distribution": "A map of the prices where today's holders actually bought — shows where big money accumulated and where sellers are stuck underwater.",
    "cost basis": "The price a holder originally paid. Clusters of it act as support (buyers defend it) or resistance (trapped sellers exit there).",
    "chip wash": "A deliberate shakeout — pushing price down to scare weak holders into selling before a move up. (Chinese: 洗盘.)",
    "accumulation": "Big money quietly buying over time, usually while price looks flat or weak.",
    "distribution": "Big money quietly selling into strength — the opposite of accumulation; a warning sign.",
    "resistance": "A price ceiling where sellers have repeatedly capped the stock.",
    "support": "A price floor where buyers have repeatedly stepped in.",
    "reward:risk": "Dollars you aim to make for each dollar risked. The desk only takes trades with about 2:1 or better.",
    "risk:reward": "Dollars you aim to make for each dollar risked. The desk wants about 2:1 or better.",
    "stop": "A pre-set exit price that caps your loss if the trade goes against you.",
    "200-dma": "The average closing price over the last 200 days — a common dividing line between a long-term up- and down-trend.",
    "sma200": "200-day average price — the long-term trend line.",
    "sma50": "50-day average price — the medium-term trend line.",
    "sma20": "20-day average price — the short-term trend line.",
    "rsi": "Momentum gauge from 0–100. Above 70 = overbought (may pull back); below 30 = oversold (may bounce).",
    "macd": "A trend-momentum indicator; a 'bullish cross' means upward momentum is starting to build.",
    "atr": "Average daily dollar swing of the stock — used to set stops that respect its real volatility instead of a round number.",
    "adx": "Trend-strength gauge. Above 25 = a real trend is in force; below 20 = choppy/sideways.",
    "obv": "On-Balance Volume — running total of volume that adds on up-days and subtracts on down-days. Rising = buyers in control.",
    "bollinger": "Volatility bands drawn around price; tagging the outer band means the move is stretched.",
    "stochastic": "A 0–100 gauge of where price sits in its recent range. >80 overbought, <20 oversold.",
    "float": "The number of shares actually available to trade in the open market.",
    "starter": "A deliberately small first position, sized so you can add later if the thesis confirms.",
    "conviction": "How strongly the desk believes the idea — sizing scales with it.",
}
# longest terms first so multi-word phrases win over their sub-words
_GLOSSARY_ORDER = sorted(GLOSSARY.items(), key=lambda kv: -len(kv[0]))
_GLOSSARY_SKIP = {"code", "a", "abbr", "svg", "h1", "h2", "h3", "h4", "title", "style"}


def _inject_glossary(body):
    """Wrap the first occurrence of each glossary term in an <abbr> tooltip, skipping
    text inside code/links/headings and — importantly — inside inlined <svg> charts
    (whose axis labels contain words like 'support'/'resistance')."""
    used = set()
    suppress = 0
    out = []
    for tok in re.split(r"(<[^>]+>)", body):
        if tok.startswith("<") and tok.endswith(">"):
            mm = re.match(r"</?\s*([a-zA-Z0-9]+)", tok)
            nm = mm.group(1).lower() if mm else ""
            if nm in _GLOSSARY_SKIP and not tok.endswith("/>"):
                suppress = max(0, suppress - 1) if tok.startswith("</") else suppress + 1
            out.append(tok)
            continue
        if suppress or not tok.strip():
            out.append(tok)
            continue
        for term, definition in _GLOSSARY_ORDER:
            if term in used:
                continue
            m = re.search(r"(?<![\w-])(" + re.escape(term) + r")(?![\w-])", tok, re.I)
            if m:
                used.add(term)
                tip = html.escape(definition, quote=True)
                tok = (tok[:m.start()] + f"<abbr class='gl' title='{tip}'>"
                       + m.group(1) + "</abbr>" + tok[m.end():])
        out.append(tok)
    return "".join(out)


def _is_table_sep(s):
    return bool(re.match(r"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$", s))


def _split_row(s):
    s = s.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def markdown_to_html(md, base_dir, charts_dir):
    lines = md.replace("\r\n", "\n").split("\n")
    out = []
    i = 0
    open_card = False
    para = []
    list_stack = []   # list of ('ul'|'ol', indent)
    seen_h1 = [False]
    meta_used = [False]

    def close_para():
        if para:
            # the first paragraph after the H1 title is the run's dateline/meta
            cls = ""
            if seen_h1[0] and not meta_used[0]:
                cls = " class='meta'"
                meta_used[0] = True
            out.append(f"<p{cls}>{_inline(' '.join(para), base_dir, charts_dir)}</p>")
            para.clear()

    def close_lists(to_indent=-1):
        while list_stack and list_stack[-1][1] > to_indent:
            tag, _ = list_stack.pop()
            out.append(f"</{tag}>")

    def close_card():
        nonlocal open_card
        close_para()
        close_lists()
        if open_card:
            out.append("</section>")
            open_card = False

    while i < len(lines):
        raw = lines[i]
        line = raw.strip()

        if not line:
            close_para()
            close_lists()
            i += 1
            continue

        # fenced container: ::: details <summary> / ::: kpi … closed by a bare :::
        if line.startswith(":::"):
            close_para(); close_lists()
            fm = re.match(r"^:::+\s*(\w+)?\s*(.*)$", line)
            ctype = (fm.group(1) or "").lower()
            ctitle = (fm.group(2) or "").strip()
            i += 1
            inner, depth = [], 1
            # depth-aware: '::: kpi' inside '::: details' must not steal the closer
            while i < len(lines):
                s = lines[i].strip()
                if s == ":::":
                    depth -= 1
                    if depth == 0:
                        break
                elif s.startswith(":::"):
                    depth += 1
                inner.append(lines[i]); i += 1
            if depth:
                print(f"warn: unclosed '::: {ctype or 'box'}' fence — everything to EOF "
                      "rendered inside it", file=sys.stderr)
            else:
                i += 1  # consume the closing :::
            if ctype == "kpi":
                out.append(_render_kpis(inner, base_dir, charts_dir))
            elif ctype == "compare":
                out.append(_render_compare(inner, base_dir, charts_dir))
            elif ctype == "timeline":
                out.append(_render_timeline(inner, base_dir, charts_dir))
            elif ctype == "hero":
                out.append(_render_hero(inner, base_dir, charts_dir))
            elif ctype == "details":
                inner_html = markdown_to_html("\n".join(inner), base_dir, charts_dir)
                summ = _inline(ctitle or "Full analysis — expand", base_dir, charts_dir)
                out.append(f"<details class='deep'><summary>{summ}</summary>"
                           f"<div class='deep-body'>{inner_html}</div></details>")
            else:
                inner_html = markdown_to_html("\n".join(inner), base_dir, charts_dir)
                out.append(f"<div class='box'>{inner_html}</div>")
            continue

        # headings
        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            text = m.group(2)
            if level <= 2:
                close_card()
                tag = "h1" if level == 1 else "h2"
                if level == 1:
                    seen_h1[0] = True
                out.append(f"<{tag}>{_inline(text, base_dir, charts_dir)}</{tag}>")
            else:  # h3 / h4 open a recommendation card
                close_card()
                out.append(f"<section class='card {_card_accent(text)}'>")
                open_card = True
                out.append(f"<h3>{_inline(text, base_dir, charts_dir)}</h3>")
            i += 1
            continue

        # horizontal rule
        if re.match(r"^(\*\s*){3,}$", line) or re.match(r"^(-\s*){3,}$", line) or line == "---":
            close_para(); close_lists()
            out.append("<hr>")
            i += 1
            continue

        # image-only line (charts)
        img_html = _render_images(line, base_dir, charts_dir)
        if img_html:
            close_para(); close_lists()
            out.append(img_html)
            i += 1
            continue

        # tables
        if "|" in line and i + 1 < len(lines) and _is_table_sep(lines[i + 1]):
            close_para(); close_lists()
            header = _split_row(line)
            i += 2
            body = []
            # a following callout/heading/fence that happens to contain '|' is
            # NOT a table row — only plain pipe-lines belong to the body
            while (i < len(lines) and "|" in lines[i] and lines[i].strip()
                   and not lines[i].lstrip().startswith((">", "#", ":::"))):
                body.append(_split_row(lines[i]))
                i += 1
            th = "".join(f"<th>{_inline(c, base_dir, charts_dir)}</th>" for c in header)
            rows = ""
            for r in body:
                tds = "".join(f"<td>{_inline(c, base_dir, charts_dir)}</td>" for c in r)
                rows += f"<tr>{tds}</tr>"
            out.append(f"<div class='table-wrap'><table><thead><tr>{th}</tr></thead>"
                       f"<tbody>{rows}</tbody></table></div>")
            continue

        # blockquote / callout ( > [!ACTION] ... )
        if line.startswith(">"):
            close_para(); close_lists()
            buf = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip().lstrip(">").strip())
                i += 1
            text = " ".join(x for x in buf if x)
            cm = re.match(r"\[!(\w+)\]\s*(.*)$", text, re.S)
            if cm:
                out.append(_callout(cm.group(1), cm.group(2), base_dir, charts_dir))
            else:
                out.append(f"<blockquote>{_inline(text, base_dir, charts_dir)}</blockquote>")
            continue

        # list items (ul: -,* ; ol: 1.)
        lm = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", raw)
        if lm:
            close_para()
            indent = len(lm.group(1))
            kind = "ol" if lm.group(2)[0].isdigit() else "ul"
            if not list_stack or indent > list_stack[-1][1]:
                out.append(f"<{kind}>")
                list_stack.append((kind, indent))
            else:
                close_lists(indent)
                if not list_stack or list_stack[-1][1] < indent:
                    out.append(f"<{kind}>")
                    list_stack.append((kind, indent))
            out.append(f"<li>{_inline(lm.group(3), base_dir, charts_dir)}</li>")
            i += 1
            continue

        # paragraph text
        close_lists()
        para.append(line)
        i += 1

    close_card()
    return "\n".join(out)


# --------------------------------------------------------------------------- #
# Page shell
# --------------------------------------------------------------------------- #

CSS = """
/* Editorial "printed desk memo" theme — warm parchment ground, ink navy, a
   three-accent system (brass gold / pine teal / terracotta rust). Deliberately
   one committed light world (like a printed report); holds its ground in any
   viewer theme rather than inverting. */
:root{
  --paper:#f4efe3; --card:#ffffff; --ink:#1c2a37; --ink2:#42505d; --muted:#6c7682;
  --line:#e4ddcd; --gold:#a2792c; --gold-soft:#f4ecd8; --gold-line:#e7d6ab;
  --teal:#3c7365; --teal-soft:#e7efe9; --teal-line:#cfe0d6;
  --rust:#b04e2d; --rust-soft:#f7e7df; --rust-line:#eccdbd;
}
*{box-sizing:border-box;}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",
    ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  line-height:1.62;font-size:15.5px;-webkit-font-smoothing:antialiased;}
.wrap{max-width:1080px;margin:0 auto;padding:0 26px 90px;counter-reset:slide;}
body::before{content:"";display:block;height:4px;
  background:linear-gradient(90deg,var(--gold),var(--teal) 55%,var(--rust));}
.wrap>h1:first-child{margin-top:40px;}
h1{font-size:clamp(30px,5vw,46px);line-height:1.1;margin:.1em 0 .35em;color:var(--ink);
  letter-spacing:-.02em;font-weight:850;text-wrap:balance;}
h2{font-size:clamp(22px,3vw,30px);margin:2.4em 0 .7em;color:var(--ink);font-weight:850;
  letter-spacing:-.015em;counter-increment:slide;text-wrap:balance;}
h2::before{content:counter(slide);display:inline-block;min-width:1.4em;margin-right:.45em;
  color:var(--gold);font-variant-numeric:tabular-nums;font-weight:850;}
h3{font-size:19px;margin:0 0 .5em;color:var(--ink);font-weight:850;letter-spacing:-.01em;}
h4{font-size:14px;margin:1.3em 0 .5em;color:var(--gold);font-weight:800;
  text-transform:uppercase;letter-spacing:.06em;}
p{margin:.6em 0;}
p.meta{color:var(--muted);font-size:14px;margin:0 0 1.6em;padding-bottom:1.3em;
  border-bottom:1px solid var(--line);line-height:1.55;}
p.meta em{font-style:normal;}
a{color:var(--gold);text-decoration:none;}a:hover{text-decoration:underline;}
strong{color:var(--ink);font-weight:800;}
code{background:var(--gold-soft);border:1px solid var(--gold-line);border-radius:5px;
  padding:.08em .38em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:.85em;color:#7a5c1f;}
hr{border:none;border-top:1px solid var(--line);margin:2.2em 0;}
ul,ol{margin:.5em 0 .9em;padding-left:1.3em;}
li{margin:.3em 0;}
li::marker{color:var(--gold);}
blockquote{margin:1em 0;padding:.5em 1.1em;border-left:3px solid var(--gold-line);
  color:var(--ink2);background:var(--gold-soft);border-radius:0 8px 8px 0;font-size:.97em;}
/* recommendation cards — white with a semantic left rail */
.card{background:var(--card);border:1px solid var(--line);border-left:6px solid var(--muted);
  border-radius:14px;padding:22px 26px;margin:18px 0;box-shadow:0 1px 2px rgba(28,42,55,.04);}
.card h3{color:var(--ink);}
.card ul{padding-left:1.15em;}
.card li{margin:.42em 0;}
.card-pos{border-left-color:var(--teal);}
.card-neg{border-left-color:var(--rust);}
.card-warn{border-left-color:var(--gold);}
.card-neu{border-left-color:#40566b;}
.table-wrap{overflow-x:auto;margin:1.2em 0;}
table{border-collapse:collapse;width:100%;font-size:.93em;font-variant-numeric:tabular-nums;}
th,td{border:1px solid var(--line);padding:9px 12px;text-align:left;vertical-align:top;}
th{background:var(--gold-soft);color:var(--ink);font-weight:800;}
tr:nth-child(even) td{background:#faf6ec;}
.charts-row{display:flex;flex-wrap:wrap;gap:16px;margin:18px 0;align-items:flex-start;}
.charts-row .chart{flex:1 1 300px;min-width:0;}
.charts-one{margin:18px 0;}
/* a lone portrait chart (chip histogram) caps its width so it doesn't upscale into a tower */
.charts-one figure.chart.tall{max-width:460px;}
.charts-row .chart.tall{flex:0 1 300px;}
figure.chart{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;
  padding:10px;overflow:hidden;box-shadow:0 1px 2px rgba(28,42,55,.04);}
figure.chart svg,figure.chart img{width:100%;height:auto;display:block;border-radius:6px;}
.footer{margin-top:52px;padding-top:18px;border-top:1px solid var(--line);
  color:var(--muted);font-size:12.5px;}
/* jargon tooltips */
abbr.gl{text-decoration:underline dotted var(--gold);text-underline-offset:3px;cursor:help;border:0;}
/* callouts — semantic tinted boxes */
.callout{border:1px solid;border-left-width:6px;border-radius:11px;padding:14px 18px;
  margin:16px 0;font-size:.97em;background:var(--card);}
.callout-label{display:block;font-weight:850;font-size:.72em;letter-spacing:.06em;
  text-transform:uppercase;margin-bottom:5px;}
.callout p{margin:.3em 0;}
.callout-action{background:var(--teal-soft);border-color:var(--teal-line);border-left-color:var(--teal);}
.callout-action .callout-label{color:var(--teal);}
.callout-tip{background:var(--gold-soft);border-color:var(--gold-line);border-left-color:var(--gold);}
.callout-tip .callout-label{color:var(--gold);}
.callout-warning{background:var(--rust-soft);border-color:var(--rust-line);border-left-color:var(--rust);}
.callout-warning .callout-label{color:var(--rust);}
.callout-note{background:#f0ece0;border-color:var(--line);border-left-color:var(--muted);}
.callout-note .callout-label{color:var(--muted);}

/* ── editorial deck components ───────────────────────────────────────────── */
/* cover / title block */
.cover{margin:34px 0 30px;padding:38px 40px 34px;border-radius:18px;
  background:radial-gradient(130% 150% at 0% 0%,#fbf7ec 0%,#f4efe3 55%,#f0e9d9 100%);
  border:1px solid var(--line);box-shadow:0 1px 2px rgba(28,42,55,.05);}
.cover-kicker{font-size:12px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--gold);font-weight:850;margin-bottom:14px;}
.cover h1{font-size:clamp(32px,5.5vw,54px);margin:0 0 .3em;}
.cover p.meta{border:0;padding:0;margin:0;color:var(--ink2);font-size:15px;}
/* section eyebrow (> [!KICKER] ...) */
.kicker{display:flex;align-items:center;gap:12px;font-size:12.5px;font-weight:850;
  letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:2.6em 0 .2em;}
.kicker::before{content:"";width:5px;height:19px;background:var(--gold);border-radius:2px;}
/* KPI tiles */
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
  gap:14px;margin:18px 0;}
.kpi{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--muted);
  border-radius:12px;padding:16px 18px;}
.kpi-v{font-size:24px;font-weight:850;color:var(--ink);line-height:1.12;letter-spacing:-.02em;
  font-variant-numeric:tabular-nums;}
.kpi-l{font-size:12.5px;color:var(--muted);margin-top:4px;}
.kpi-pos{border-left-color:var(--teal);} .kpi-pos .kpi-v{color:var(--teal);}
.kpi-neg{border-left-color:var(--rust);} .kpi-neg .kpi-v{color:var(--rust);}
.kpi-warn{border-left-color:var(--gold);} .kpi-warn .kpi-v{color:var(--gold);}
/* hero — one giant number carries the point (::: hero  NUMBER | caption | tone) */
.hero{margin:22px 0;}
.hero-num{font-size:clamp(56px,12vw,116px);font-weight:850;letter-spacing:-.03em;
  line-height:.98;color:var(--gold);font-variant-numeric:tabular-nums;}
.hero.teal .hero-num{color:var(--teal);} .hero.rust .hero-num{color:var(--rust);}
.hero.ink .hero-num{color:var(--ink);}
.hero-cap{margin-top:18px;font-size:clamp(15px,1.9vw,18px);color:var(--ink2);max-width:60ch;}
/* comparison cards (::: compare  label | phrase | body | tone) */
.compare{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
  gap:18px;margin:22px 0;}
.ccard{background:var(--card);border:1px solid var(--line);border-left:6px solid var(--gold);
  border-radius:14px;padding:22px 24px;box-shadow:0 1px 2px rgba(28,42,55,.04);}
.ccard.teal{border-left-color:var(--teal);} .ccard.rust{border-left-color:var(--rust);}
.ccard.ink{border-left-color:#40566b;}
.ccard .lab{font-size:13px;color:var(--muted);font-weight:700;margin-bottom:12px;}
.ccard .phrase{font-size:clamp(22px,2.8vw,30px);font-weight:850;letter-spacing:-.01em;
  line-height:1.12;color:var(--gold);}
.ccard.teal .phrase{color:var(--teal);} .ccard.rust .phrase{color:var(--rust);}
.ccard.ink .phrase{color:var(--ink);}
.ccard .body{margin-top:12px;color:var(--ink2);font-size:15.5px;line-height:1.55;}
/* timeline (::: timeline  when | what) */
.timeline{display:flex;gap:0;flex-wrap:wrap;margin:22px 0;align-items:stretch;}
.tcard{flex:1 1 160px;min-width:150px;background:var(--card);border:1px solid var(--line);
  border-top:5px solid var(--gold);border-radius:12px;padding:18px 16px;position:relative;}
.tcard + .tcard{margin-left:24px;}
.tcard + .tcard::before{content:"›";position:absolute;left:-20px;top:50%;
  transform:translateY(-50%);color:var(--gold);font-size:24px;font-weight:850;}
.tcard .when{font-weight:850;color:var(--ink);font-size:16px;margin-bottom:9px;}
.tcard .what{color:var(--ink2);font-size:14px;line-height:1.45;}
/* pull-quote (> [!QUOTE] ...) — the thesis in one line */
.quote{font-size:clamp(24px,4vw,40px);font-weight:850;letter-spacing:-.02em;line-height:1.2;
  color:var(--ink);margin:34px 0 18px;text-wrap:balance;}
.quote::before{content:"\\201C";color:var(--gold);}
.quote::after{content:"\\201D";color:var(--gold);}
/* the headline call banner (> [!VERDICT] ...) */
.verdict{display:flex;align-items:center;gap:16px;margin:18px 0 8px;padding:18px 22px;
  border-radius:14px;background:var(--teal-soft);border:1px solid var(--teal-line);
  border-left:6px solid var(--teal);}
.verdict-tag{flex:0 0 auto;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  font-weight:850;color:var(--teal);border:1px solid var(--teal-line);border-radius:20px;
  padding:5px 12px;background:var(--card);}
.verdict-body{font-size:16.5px;color:var(--ink);line-height:1.5;}
/* collapsible deep-dive */
details.deep{margin:16px 0;border:1px solid var(--line);border-radius:12px;background:var(--card);
  overflow:hidden;box-shadow:0 1px 2px rgba(28,42,55,.04);}
details.deep>summary{cursor:pointer;list-style:none;padding:14px 20px;font-weight:800;
  color:var(--ink);font-size:14.5px;display:flex;align-items:center;gap:10px;user-select:none;}
details.deep>summary::-webkit-details-marker{display:none;}
details.deep>summary::before{content:"\\25B8";color:var(--gold);font-size:12px;transition:transform .15s;}
details.deep[open]>summary::before{transform:rotate(90deg);}
details.deep>summary:hover{background:var(--gold-soft);}
details.deep[open]>summary{border-bottom:1px solid var(--line);}
.deep-body{padding:6px 22px 16px;}
.deep-body>h4:first-child,.deep-body>p:first-child{margin-top:.7em;}
.box{margin:16px 0;}
/* bilingual toggle — EN / 中文 */
.lang-toggle{position:sticky;top:0;z-index:20;display:flex;justify-content:flex-end;gap:0;
  margin:0 -26px 8px;padding:10px 26px;background:rgba(244,239,227,.92);
  -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border-bottom:1px solid var(--line);}
.lang-toggle label{font:inherit;font-weight:800;font-size:13px;cursor:pointer;user-select:none;
  border:1px solid var(--gold-line);background:var(--card);color:var(--muted);padding:6px 15px;}
.lang-toggle label:first-child{border-radius:8px 0 0 8px;}
.lang-toggle label:last-child{border-radius:0 8px 8px 0;border-left:0;}
/* CSS-only toggle: hidden radios + :checked, so it works in JS-less viewers
   (Telegram/WeChat previews, iOS Quick Look, print). JS is optional sugar. */
.lang-radio{position:absolute;left:-9999px;}
.lang{display:none;}
#lang-en:checked ~ .wrap .lang-en{display:block;}
#lang-zh:checked ~ .wrap .lang-zh{display:block;}
#lang-en:checked ~ .wrap .lang-toggle .b-en,
#lang-zh:checked ~ .wrap .lang-toggle .b-zh{background:var(--gold);color:#fff;border-color:var(--gold);}
#lang-en:focus-visible ~ .wrap .lang-toggle .b-en,
#lang-zh:focus-visible ~ .wrap .lang-toggle .b-zh{outline:2px solid var(--gold);outline-offset:2px;}
/* print → a clean slide deck / PDF (keep colours, one section per page) */
@media print{
  html,body{background:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .lang-toggle{display:none;}
  .wrap{max-width:none;padding:0 12px;}
  .cover{break-after:page;}
  h2{break-before:page;padding-top:8px;}
  .card,.kpi-grid,.compare,.timeline,.hero,.verdict,figure.chart,.callout{break-inside:avoid;}
  details.deep{border:0;box-shadow:none;}
  details.deep>summary::before{content:"";}
  details.deep>summary{color:var(--gold);font-size:12px;padding:6px 0;}
  .deep-body{display:block !important;padding:0;}  /* expand every deep-dive for the PDF */
}
"""


_RADIOS = """<input type="radio" name="deck-lang" id="lang-en" class="lang-radio" checked>
<input type="radio" name="deck-lang" id="lang-zh" class="lang-radio">"""

_TOGGLE = """<div class="lang-toggle" role="group" aria-label="Language / 语言">
<label class="b-en" for="lang-en" aria-label="English">EN</label>
<label class="b-zh" for="lang-zh" aria-label="中文">中文</label></div>
<script>
/* optional enhancement only — the toggle itself is pure CSS */
(function(){var l;try{l=localStorage.getItem('deckLang')}catch(e){}
if(!l&&(navigator.language||'').toLowerCase().indexOf('zh')===0)l='zh';
if(l==='zh')document.getElementById('lang-zh').checked=true;
['lang-en','lang-zh'].forEach(function(id){
  document.getElementById(id).addEventListener('change',function(){
    try{localStorage.setItem('deckLang',id==='lang-zh'?'zh':'en')}catch(e){}});});
})();
</script>
"""


def wrap_page(title, body, bilingual=False):
    toggle = _TOGGLE if bilingual else ""
    radios = _RADIOS if bilingual else ""
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<style>{CSS}</style>
</head><body>{radios}<div class="wrap">
{toggle}{body}
<div class="footer">Generated by AI Trader · charts from
<code>scripts/analysis/indicators.py</code> + <code>scripts/report/charts.py</code> · informational only, not financial advice.</div>
</div></body></html>
"""


def _title_from(md, fallback):
    m = re.search(r"^#\s+(.*)$", md, re.M)
    return m.group(1).strip() if m else fallback


_LANG_SPLIT = re.compile(r"^<!--\s*lang:zh\s*-->\s*$", re.M | re.I)


def _split_langs(md):
    """A single source file carries both languages: English first, then a
    `<!-- lang:zh -->` marker line, then the 中文 version. Returns (en, zh|None)."""
    m = _LANG_SPLIT.search(md)
    if not m:
        return md, None
    return md[:m.start()].rstrip(), md[m.end():].lstrip()


def _bilingual_wrap(en_body, zh_body):
    return (f"<div class='lang lang-en' lang='en'>{en_body}</div>"
            f"<div class='lang lang-zh' lang='zh'>{zh_body}</div>")


def _wrap_cover(body):
    """Promote the leading H1 (+ its dateline meta paragraph) into a title 'slide'."""
    m = re.match(r"\s*<h1>(.*?)</h1>\s*(<p class='meta'>.*?</p>)?", body, re.S)
    if not m:
        return body
    h1, meta = m.group(1), (m.group(2) or "")
    cover = (f"<header class='cover'><div class='cover-kicker'>AI Trader · desk run</div>"
             f"<h1>{h1}</h1>{meta}</header>")
    return cover + body[m.end():]


def _render_body(md, base_dir, charts_dir, glossary=True):
    body = _wrap_cover(markdown_to_html(md, base_dir, charts_dir))
    return _inject_glossary(body) if glossary else body


def default_output_path(md_path):
    """Return the canonical finished-HTML path for a report Markdown source."""
    name = os.path.splitext(os.path.basename(md_path))[0] + ".html"
    return os.path.join(REPORTS_DIR, name)


def build(md_path, out_path=None, charts_dir=None):
    with open(md_path, encoding="utf-8") as f:
        md = f.read()
    base_dir = os.path.dirname(os.path.abspath(md_path))
    if charts_dir is None:
        # Chart sources are grouped by the report's Sunday-start week. The HTML embeds
        # them, so their physical location is an implementation detail.
        m = re.search(r"report_(\d{4}-\d{2}-\d{2})_", os.path.basename(md_path))
        if m:
            day = __import__("datetime").date.fromisoformat(m.group(1))
            charts_dir = os.path.join(REPORTS_DIR, "assets", "charts", week_name(day))
        else:
            charts_dir = os.path.join(base_dir, "charts")
    en_md, zh_md = _split_langs(md)
    title = _title_from(en_md, os.path.basename(md_path))
    if zh_md is not None:
        # bilingual: English (with jargon tooltips) + 中文 (Chinese explains its own terms)
        body = _bilingual_wrap(_render_body(en_md, base_dir, charts_dir, glossary=True),
                               _render_body(zh_md, base_dir, charts_dir, glossary=False))
        page = wrap_page(title, body, bilingual=True)
    else:
        page = wrap_page(title, _render_body(en_md, base_dir, charts_dir), bilingual=False)
    if out_path is None:
        # Markdown is build state under reports/.build/. Finished HTML always
        # belongs in the reports inbox unless explicitly overridden.
        out_path = default_output_path(md_path)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(page)
    # A rebuilt historical report belongs in its reporting-week archive immediately;
    # current-week reports remain directly in reports/.
    from organize_reports import organize_reports, organize_support_files
    moved = organize_reports()
    organize_support_files()
    final_path = moved.get(os.path.abspath(out_path), out_path)
    # Machine-readable memory sidecar; HTML remains the human artifact.
    journal_dir = os.path.join(PROJECT_ROOT, "scripts", "journal")
    if journal_dir not in sys.path: sys.path.insert(0, journal_dir)
    from desk_memory import index_report
    index_report(md_path, final_path, en_md)
    return final_path


def main():
    p = argparse.ArgumentParser(description="Render a markdown desk report to styled, self-contained HTML.")
    p.add_argument("markdown", help="the report .md file")
    p.add_argument("--out", default=None,
                   help="output .html path (default: reports/<same-name>.html)")
    p.add_argument("--charts-dir", default=None,
                   help="chart source directory (default: reports/assets/charts/<report-week>)")
    args = p.parse_args()
    if not os.path.isfile(args.markdown):
        sys.stderr.write(f"no such file: {args.markdown}\n")
        sys.exit(1)
    out = build(args.markdown, args.out, args.charts_dir)
    print(out)


if __name__ == "__main__":
    import desk_log
    raise SystemExit(desk_log.run(main))
