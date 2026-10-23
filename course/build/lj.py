"""LJR7 course drawing kit. Every graphic and slide is drawn with these parts, so the look never changes
between versions (rule 13). All names, colours and sizes come from ../glossary.json (rule 14).

Parts: page frame (header, rule, key, footer), card (white, 1 px border, soft shadow, thin accent band),
neutral chip, status chip (icon + word), attention panel, line icons (Tabler outline set in ../design/icons).
Output is plain SVG (editable in Figma, Illustrator, Inkscape or Canva). shoot.mjs turns SVG into PNG and PDF.
"""
import json
import os
import re
from html import escape

from PIL import ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
G = json.load(open(os.path.join(ROOT, "glossary.json"), encoding="utf-8"))
C = G["colours"]
FONT_DIR = os.path.join(ROOT, "assets", "fonts")
ICON_DIR = os.path.join(ROOT, "design", "icons")
_fonts = {}


def font(size, weight=400):
    key = (size, weight)
    if key not in _fonts:
        w = {300: 300, 400: 400, 600: 600, 700: 700}.get(weight, 400)
        _fonts[key] = ImageFont.truetype(os.path.join(FONT_DIR, f"Lexend-{w}.ttf"), size)
    return _fonts[key]


def tw(text, size, weight=400):
    """Width in px of text set in Lexend."""
    return font(size, weight).getlength(text)


def wrap(text, size, width, weight=400):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if tw(trial, size, weight) <= width or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit(text, size, width, weight=400, floor=22):
    """Largest size (down to floor) at which text fits on one line."""
    while size > floor and tw(text, size, weight) > width:
        size -= 1
    return size


def esc(t):
    return escape(str(t), quote=True)


def layer(name):
    return C["layers"][name]


def ring(n):
    return C["rings"][str(n)]


def luminance(hexc):
    h = hexc.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def on(hexc):
    """Ink or page colour, whichever reads on hexc (LC-VISUAL-STANDARD §5.17)."""
    return C["ink"] if luminance(hexc) > 0.25 else C["page"]


# ---------- icons ----------
_icon_cache = {}


def icon_paths(name):
    if name not in _icon_cache:
        src = open(os.path.join(ICON_DIR, name + ".svg"), encoding="utf-8").read()
        body = re.search(r"<svg[^>]*>(.*)</svg>", src, re.S).group(1)
        body = re.sub(r'<path stroke="none"[^>]*/>', "", body).strip()
        _icon_cache[name] = body
    return _icon_cache[name]


def icon(name, x, y, size=40, colour=None, stroke=1.75):
    colour = colour or C["ink"]
    s = size / 24
    return (f'<g transform="translate({x:.1f},{y:.1f}) scale({s:.4f})" fill="none" stroke="{colour}" '
            f'stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round">{icon_paths(name)}</g>')


# ---------- text ----------
def text(x, y, t, size=30, weight=400, colour=None, anchor="start", extra=""):
    colour = colour or C["ink"]
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="Lexend" font-size="{size}" font-weight="{weight}" '
            f'fill="{colour}" text-anchor="{anchor}" {extra}>{esc(t)}</text>')


def lines(x, y, rows, size=30, weight=400, colour=None, lh=None, anchor="start"):
    lh = lh or size * G["type"]["line_height"]
    return "".join(text(x, y + i * lh, r, size, weight, colour, anchor) for i, r in enumerate(rows))


# ---------- parts ----------
DEFS = (f'<defs><filter id="soft" x="-10%" y="-10%" width="120%" height="130%">'
        f'<feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="{C["shadow"]}" flood-opacity="0.08"/></filter></defs>')


_clip = [0]


def band_svg(x, y, w, h, colour, band, r):
    """Thin top band clipped to the card's rounded corners."""
    _clip[0] += 1
    cid = f"c{_clip[0]}"
    return (f'<clipPath id="{cid}"><rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}"/></clipPath>'
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{band}" fill="{colour}" clip-path="url(#{cid})"/>')


def card(x, y, w, h, accent=None, band=None, r=None):
    """White card, 1 px light border, rounded, soft shadow. Colour only as a thin top band (rule 1)."""
    r = r or G["space"]["radius"]
    band = band if band is not None else G["space"]["band"]
    out = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{C["card"]}" '
           f'stroke="{C["border"]}" stroke-width="1" filter="url(#soft)"/>')
    if accent:
        out += band_svg(x, y, w, h, accent, band, r)
    return out


def sunk(x, y, w, h, r=None):
    r = r or G["space"]["radius"]
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{C["sunk"]}"/>'


def chip(x, y, label, size=24, icon_name=None, colour=None, fill=None, h=None):
    """Plain neutral pill (rule 8). Returns (svg, width)."""
    colour = colour or C["ink"]
    h = h or int(size * 1.7)
    pad = int(size * 0.6)
    iw = int(size * 1.05) if icon_name else 0
    w = int(tw(label, size, 600) + pad * 2 + iw + (6 if icon_name else 0))
    out = (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h / 2}" fill="{fill or C["card"]}" '
           f'stroke="{C["border"]}" stroke-width="1"/>')
    tx = x + pad
    if icon_name:
        out += icon(icon_name, tx, y + (h - size) / 2, size, colour)
        tx += iw + 6
    out += text(tx, y + h / 2 + size * 0.36, label, size, 600, colour)
    return out, w


def status_chip(x, y, key, size=24):
    """Status = colour + icon + word, never colour alone (rule 7)."""
    st = next(s for s in G["statuses"] if s["key"] == key)
    return chip(x, y, st["word"], size, st["icon"], C["status"][key])


def vision_chip(x, y, size=24, anchor="start"):
    label = G["brand"]["vision_label"]
    w = int(tw(label, size, 600) + size * 1.2 + size * 1.05 + 6)
    if anchor == "end":
        x = x - w
    return chip(x, y, label, size, "sparkles")[0]


def attention(x, y, w, label, action, risk, size=28):
    """Tinted panel, dark left edge, only the risk word coloured (rule 9). Returns (svg, height)."""
    rows = wrap(action, size, w - 64, 700)
    h = int(40 + 30 + len(rows) * size * 1.3 + 20 + size * 1.3 + 10)
    out = sunk(x, y, w, h) + f'<rect x="{x}" y="{y}" width="6" height="{h}" rx="3" fill="{C["ink"]}"/>'
    out += text(x + 32, y + 44, label.upper(), 22, 700, C["muted"], extra='letter-spacing="2"')
    out += lines(x + 32, y + 44 + 46, rows, size, 700)
    ry = y + 44 + 46 + len(rows) * size * 1.3 + 8
    out += text(x + 32, ry, "Risk:", size, 400, C["ink"])
    out += text(x + 32 + tw("Risk: ", size), ry, risk, size, 700, C["risk_word"][risk])
    return out, h


def header(W, title, sub, gutter, title_size, sub_size, vision=False, top=None):
    """Dark text on page background, title + one muted line, thin dark rule (rule 2)."""
    top = top or gutter
    if vision:
        title_size = fit(title, title_size, W - 2 * gutter - 440, 700, 40)
    out = text(gutter, top + title_size, title, title_size, 700)
    out += text(gutter, top + title_size + sub_size * 1.6, sub, sub_size, 400, C["muted"])
    rule_y = top + title_size + sub_size * 1.6 + sub_size * 0.9
    out += f'<rect x="{gutter}" y="{rule_y:.1f}" width="{W - 2 * gutter}" height="2" fill="{C["ink"]}"/>'
    if vision:
        out += vision_chip(W - gutter, top + 4, 24 if W <= 1080 else 26, anchor="end")
    return out, rule_y + 2


def key_block(W, y, items, gutter, size=24, title="Key"):
    """Every symbol explained above the footer (rule 10). items: list of (kind, value, label).
    kind: 'icon' (icon name), 'swatch' (hex), 'chip' (text), 'status' (status key). Returns (svg, height)."""
    out = f'<rect x="{gutter}" y="{y}" width="{W - 2 * gutter}" height="1" fill="{C["border"]}"/>'
    out += text(gutter, y + 44, title, size + 2, 700)
    x, cy = gutter, y + 70
    row_h = int(size * 2.1)
    for kind, val, label in items:
        need = 44 + tw(label, size) + 40
        if kind in ("chip", "status"):
            need += 160
        if x + need > W - gutter:
            x, cy = gutter, cy + row_h
        if kind == "icon":
            out += icon(val, x, cy, size + 6)
            x += size + 18
        elif kind == "swatch":
            out += f'<rect x="{x}" y="{cy + 4}" width="{size + 4}" height="{size - 4}" rx="4" fill="{val}"/>'
            x += size + 18
        elif kind == "chip":
            s, w = chip(x, cy - 4, val, size - 2)
            out += s
            x += w + 12
        elif kind == "status":
            s, w = status_chip(x, cy - 4, val, size - 2)
            out += s
            x += w + 12
        out += text(x, cy + size * 0.95, label, size, 400, C["muted"])
        x += tw(label, size) + 40
    return out, (cy + row_h) - y


def footer(W, H, date, module, source, height=None, size=26):
    """Solid dark band: date (bold), module/version, small source line (rule 3). Source wraps to 2 lines."""
    g = 48 if W <= 1080 else 96
    src_rows = wrap(source, 22, W - 2 * g)[:2]
    height = height or int(size * 3.6 + (len(src_rows) - 1) * 30)
    y = H - height
    out = f'<rect x="0" y="{y}" width="{W}" height="{height}" fill="{C["ink"]}"/>'
    out += text(g, y + size * 1.6, date, size + 2, 700, C["footer_text"])
    out += text(g + tw(date, size + 2, 700) + 28, y + size * 1.6, module, size, 400, C["footer_text"])
    out += lines(g, y + size * 2.9, src_rows, 22, 400, C["border"], lh=30)
    return out, height


def svg_doc(W, H, body, title=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
            f'<title>{esc(title)}</title>{DEFS}<rect width="{W}" height="{H}" fill="{C["page"]}"/>{body}</svg>')


def save(path, svg):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    return path
