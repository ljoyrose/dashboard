"""Draws every course graphic listed in data/graphics.json with the same page frame (rule 13), phone portrait 1080.
Section kinds: steps (vertical cards with optional gate chip between), grid (2 cards a row), matrix (rows x columns
of status marks), rows (one card of label/value rows), attention (tinted risk panel), heading (group heading).
Usage: python build/g_set.py [graphic-id ...]   (no id = all). Then node build/shoot.mjs graphics/*.svg"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from lj import (G, C, svg_doc, header, card, text, lines, icon, chip, status_chip, attention, key_block, footer, save, tw, wrap,
                ROOT, layer, ring)

W, GUT = 1080, G["space"]["gutter_1080"]
CW = W - 2 * GUT


def accent_of(item):
    if item.get("layer"):
        return layer(item["layer"])
    if item.get("ring"):
        return ring(item["ring"])
    return None


def sec_heading(s, y):
    out = ""
    if s.get("ring") or s.get("layer"):
        out += f'<rect x="{GUT}" y="{y + 10}" width="48" height="12" rx="6" fill="{accent_of(s)}"/>'
        x = GUT + 64
    else:
        x = GUT
    if s.get("icon"):
        out += icon(s["icon"], x, y - 4, 40)
        x += 52
    out += text(x, y + 28, s["text"], 44, 700)
    if s.get("right"):
        out += text(W - GUT, y + 28, s["right"], 28, 400, C["muted"], "end")
    return out, 72


def sec_steps(s, y):
    out, y0 = "", y
    for i, it in enumerate(s["items"]):
        rows = wrap(it.get("line", ""), 28, CW - 200) if it.get("line") else []
        h = 56 + 44 + len(rows) * 36 + 24
        out += card(GUT, y, CW, h, accent_of(it))
        tx = GUT + 28
        if it.get("n") is not None:
            out += text(tx, y + 72, str(it["n"]), 48, 700, C["muted"])
            tx += 64
        if it.get("icon"):
            out += icon(it["icon"], tx, y + 36, 48)
            tx += 72
        out += text(tx, y + 72, it["title"], 36, 700)
        if rows:
            out += lines(tx, y + 112, rows, 28, 400, C["muted"], lh=36)
        if it.get("chip"):
            c, w = chip(GUT + CW - 28 - int(tw(it["chip"], 22, 600) + 26 + (24 if it.get("chip_icon") else 0)), y + 30, it["chip"], 22, it.get("chip_icon"))
            out += c
        y += h
        if it.get("gate") or (s.get("connect") and i < len(s["items"]) - 1):
            out += f'<rect x="{GUT + 60}" y="{y}" width="3" height="72" fill="{C["border"]}"/>'
            if it.get("gate"):
                g = it["gate"]
                c, _ = chip(GUT + 96, y + 12, g["text"], 24, "user" if g.get("human") else (g.get("icon") or "robot"), C["ink"] if g.get("human") else C["muted"])
                out += c
            y += 72
        else:
            y += 20
    return out, y - y0


def sec_grid(s, y):
    out, y0 = "", y
    cols = s.get("cols", 2)
    gap = 24
    cw = (CW - gap * (cols - 1)) // cols
    items = s["items"]
    for i in range(0, len(items), cols):
        row = items[i:i + cols]
        hs = []
        for it in row:
            rows = wrap(it.get("line", ""), 26, cw - 56) if it.get("line") else []
            trows = wrap(it["title"], 32, cw - 56, 700)
            hs.append(40 + (64 if it.get("icon") else 0) + len(trows) * 42 + len(rows) * 34 + 32 + (56 if it.get("status") else 0))
        h = max(hs)
        for j, it in enumerate(row):
            x = GUT + j * (cw + gap)
            out += card(x, y, cw, h, accent_of(it))
            cy = y + 36
            if it.get("icon"):
                out += icon(it["icon"], x + 28, cy, 48)
                if it.get("tag"):
                    out += text(x + cw - 28, cy + 34, it["tag"], 28, 700, C["muted"], "end")
                cy += 64
            trows = wrap(it["title"], 32, cw - 56, 700)
            out += lines(x + 28, cy + 32, trows, 32, 700, lh=42)
            cy += len(trows) * 42
            if it.get("line"):
                rows = wrap(it["line"], 26, cw - 56)
                out += lines(x + 28, cy + 30, rows, 26, 400, C["muted"], lh=34)
                cy += len(rows) * 34
            if it.get("status"):
                sc, _ = status_chip(x + 28, cy + 16, it["status"], 22)
                out += sc
        y += h + gap
    return out, y - y0


def sec_matrix(s, y):
    cols, rows = s["columns"], s["rows"]
    first = s.get("first_width", 330)
    cw = (CW - first - 32) / len(cols)
    rh = 64
    h = rh * (len(rows) + 1) + 32
    out = card(GUT, y, CW, h)
    for i, c in enumerate(cols):
        cx = GUT + first + 16 + i * cw + cw / 2
        out += text(cx, y + 50, c, 24, 700, C["ink"], "middle")
    for r, row in enumerate(rows, 1):
        ry = y + 16 + r * rh
        out += f'<rect x="{GUT + 16}" y="{ry}" width="{CW - 32}" height="1" fill="{C["border"]}"/>'
        out += text(GUT + 28, ry + 42, row[0], 26, 600)
        for i, cell in enumerate(row[1:]):
            cx = GUT + first + 16 + i * cw + cw / 2
            st = next(t for t in G["statuses"] if t["key"] == cell)
            out += icon(st["icon"], cx - 18, ry + 14, 36, C["status"][cell])
    return out, h + 24


def sec_rows(s, y):
    items = s["items"]
    h = 32 + len(items) * 72
    out = card(GUT, y, CW, h, accent_of(s))
    for i, it in enumerate(items):
        ry = y + 20 + i * 72
        if i:
            out += f'<rect x="{GUT + 24}" y="{ry}" width="{CW - 48}" height="1" fill="{C["border"]}"/>'
        x = GUT + 28
        if it.get("icon"):
            out += icon(it["icon"], x, ry + 18, 36, C["status"][it["status"]] if it.get("status") else None)
            x += 56
        out += text(x, ry + 46, it["label"], 28, 600)
        if it.get("value"):
            colr = C["status"][it["status"]] if it.get("status") else C["muted"]
            out += text(GUT + CW - 28, ry + 46, it["value"], 26, 700 if it.get("status") else 400, colr, "end")
    return out, h + 24


def sec_attention(s, y):
    a, h = attention(GUT, y, CW, s["label"], s["action"], s["risk"], 30)
    return a, h + 24


KINDS = {"heading": sec_heading, "steps": sec_steps, "grid": sec_grid, "matrix": sec_matrix, "rows": sec_rows, "attention": sec_attention}


def build(gr, out_dir):
    body, y = header(W, gr["title"], gr["sub"], GUT, 72 if len(gr["title"]) < 22 else 60, 30, vision=gr.get("vision", False))
    y += 40
    for s in gr["sections"]:
        part, h = KINDS[s["kind"]](s, y)
        body += part
        y += h
    y += 8
    k, kh = key_block(W, y, [tuple(x) for x in gr.get("key", [])], GUT)
    body += k
    y += kh + 24
    H = int(y + 124)
    f, _ = footer(W, H, G["brand"]["course_date"], f'{gr["module"]} · Graphic {gr["id"]} · v1', "Source: " + gr["source"])
    body += f
    return save(os.path.join(out_dir, gr["file"] + ".svg"), svg_doc(W, H, body, gr["title"]))


if __name__ == "__main__":
    data = json.load(open(os.path.join(ROOT, "data", "graphics.json"), encoding="utf-8"))
    want = sys.argv[1:]
    for gr in data["graphics"]:
        if not want or gr["id"] in want:
            print(build(gr, os.path.join(ROOT, "graphics")))
