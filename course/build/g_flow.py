"""Graphic: Vision 2029 Fully Automated Flow Map. Every step runs by itself; the ONLY human touch points are
the gates marked with a person icon. Data: glossary.json stages, gates, automated steps below (from TEMPLATE-MIRROR.md
stage lines, filled forward). Output: graphics/AF-VISION2029-AUTOMATED-FLOW-v1.svg"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from lj import G, C, svg_doc, header, card, text, icon, chip, key_block, footer, save, tw, ROOT

W, GUT = 1080, G["space"]["gutter_1080"]
AUTO = {0: ["Card Written", "Codes Read", "Verdict Suggested"], 1: ["Competitor Sweep", "Market Size", "Rules Flag"],
        2: ["Base Found", "Template Cloned", "Dedup Check"], 3: ["Kits Picked", "Who Sees What", "Duties Listed"],
        4: ["Tables Made", "Access Modes", "Table Tests"], 5: ["Test Tenants", "Test Plan", "Credit Estimate"],
        6: ["Prompts Sent", "Re-Probe Tables", "Member Tests"], 7: ["Domain And DNS", "Sales Page", "Funnels"],
        8: ["Leak Probe 06:40", "Money Line", "Weekly Boost"]}


def build(out_dir):
    body, y = header(W, "Fully Automated Flow", "Every Step Runs By Itself · People Only At Gates", GUT, 64, 28, vision=True)
    y += 36
    gates = {g["from"]: g for g in G["gates"]}
    cw = W - 2 * GUT
    for s in G["stages"]:
        ch = 150
        body += card(GUT, y, cw, ch)
        body += text(GUT + 24, y + 56, f'{s["n"]} · {s["name"]}', 36, 700)
        body += icon(s["icon"], GUT + cw - 24 - 44, y + 22, 44)
        x = GUT + 24
        for a in AUTO[s["n"]]:
            c, w = chip(x, y + 84, a, 22, "robot", C["muted"])
            body += c
            x += w + 12
        y += ch
        g = gates.get(s["n"])
        if g:
            body += f'<rect x="{GUT + 60}" y="{y}" width="3" height="76" fill="{C["border"]}"/>'
            if g["human"]:
                c, w = chip(GUT + 96, y + 14, f'{g["name"]} · Person Decides', 26, "user")
            else:
                c, w = chip(GUT + 96, y + 14, f'{g["name"]} · Opens By Itself', 24, "robot", C["muted"])
            body += c
            y += 76
        else:
            y += 24
    y += 16
    k, kh = key_block(W, y, [("icon", "robot", "Runs By Itself"), ("icon", "user", "Person Decides (Gate)"),
                             ("icon", "sparkles", "Vision 2029 · Illustrative")], GUT)
    body += k
    y += kh + 24
    H = int(y + 124)
    f, _ = footer(W, H, G["brand"]["course_date"], "Vision 2029 · Graphic G11 · v1",
                  "Source: glossary.json gates · TEMPLATE-MIRROR.md stage lines · AF-UNDERSTANDING-2026-10-22.md")
    body += f
    return save(os.path.join(out_dir, "AF-VISION2029-AUTOMATED-FLOW-v1.svg"), svg_doc(W, H, body, "Fully Automated Flow"))


if __name__ == "__main__":
    print(build(os.path.join(ROOT, "graphics")))
