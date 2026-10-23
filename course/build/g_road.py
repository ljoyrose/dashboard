"""Graphic: The Factory Road (9 stages and the gates between them). Phone portrait, 1080 wide.
Data: glossary.json stages + gates. Output: graphics/AF-ROAD-9-STAGES-v1.svg (+ .png by shoot.mjs)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from lj import G, C, svg_doc, header, card, text, icon, chip, key_block, footer, save, tw, ROOT, layer

W = 1080
GUT = G["space"]["gutter_1080"]


def build(out_dir):
    body, y = header(W, "The Factory Road", "9 Stages · 8 Gates · Idea To Live App", GUT, 72, 30)
    y += 40
    gates = {g["from"]: g for g in G["gates"]}
    cw, ch = W - 2 * GUT, 118
    for s in G["stages"]:
        body += card(GUT, y, cw, ch)
        body += text(GUT + 28, y + 72, str(s["n"]), 56, 700, C["muted"])
        body += icon(s["icon"], GUT + 100, y + 32, 52)
        body += text(GUT + 176, y + 56, s["name"], 40, 700)
        body += text(GUT + 176, y + 94, "Room: " + s["room"], 26, 400, C["muted"])
        if s["n"] == 6:
            c, w = chip(GUT + cw - 28 - 190, y + 38, "Paid Stage", 24, "coin")
            body += c
        y += ch
        g = gates.get(s["n"])
        if g:
            # connector with gate pill
            body += f'<rect x="{GUT + 64}" y="{y}" width="3" height="78" fill="{C["border"]}"/>'
            who_icon = "user" if g["human"] else "robot"
            c, w = chip(GUT + 104, y + 14, f'{g["name"]} Gate', 26, g["icon"])
            body += c
            c2, w2 = chip(GUT + 104 + w + 14, y + 14, "Person Decides" if g["human"] else "Runs By Itself", 24, who_icon, C["ink"] if g["human"] else C["muted"])
            body += c2
            y += 78
    y += 30
    k, kh = key_block(W, y, [("icon", "user", "Person Decides At This Gate"), ("icon", "robot", "Gate Opens By Itself"),
                             ("icon", "coin", "Paid Stage"), ("chip", "Gate", "Check Between Stages")], GUT)
    body += k
    y += kh + 30
    H = int(y + 110)
    f, fh = footer(W, H, G["brand"]["course_date"], "Module M0 · Graphic G01 · v1",
                   "Source: AF-UNDERSTANDING-2026-10-22.md Part 1 · glossary.json")
    body += f
    return save(os.path.join(out_dir, "AF-ROAD-9-STAGES-v1.svg"), svg_doc(W, H, body, "The Factory Road"))


if __name__ == "__main__":
    print(build(os.path.join(ROOT, "graphics")))
