"""20 Codes card per app, in the LC-VISUAL-STANDARD v4 layout (the AF-WALLS v4 look), ported from the existing
renderer SRC_render_codes_card.py to SVG + Lexend + line icons (the original draws text glyphs and uses DejaVu).
Same rows in the same order: [W chip] CODE (0-max) · What It Is · Status · Now · Launch · Comparison · Attention box.
Data: data/apps/<slug>.json (codes copied from glossary.json sample_apps). One JSON per app, never new drawing code.
Usage: python build/g_codes_card.py litterline"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from lj import G, C, svg_doc, header, card, text, icon, chip, status_chip, attention, key_block, footer, save, tw, ROOT, ring

W, GUT = 1080, G["space"]["gutter_1080"]
WALL_TEST = {"W1": "Brand A Cannot See Brand B", "W2": "Member Cannot See Another Member", "W3": "Layer Above Reads Only What It Is Granted",
             "W4": "Staff See Only Their Role", "W5": "Joins Only Through The Right Brand", "W6": "Signed-Out Read Returns 401",
             "W7": "Only The Owner's Data Leaves", "W8": "Held Until The DPIA Is Signed"}
HIGH = {"W1", "W2", "W8"}


def status_of(now, launch):
    if launch == 0 and now == 0:
        return "not_needed"
    if now == launch:
        return "solid"
    return "fragile" if now > 0 else "not_built"


def build(slug, out_dir):
    app = json.load(open(os.path.join(ROOT, "data", "apps", f"{slug}.json"), encoding="utf-8"))
    body, y = header(W, "20 Codes", f'{app["name"]} · {app["label"]} · Vision 2029 · Illustrative', GUT, 72, 30)
    y += 36
    colw, gap = (W - 2 * GUT - 24) // 2, 24
    for gi, grp in enumerate(G["code_groups"]):
        if gi:
            body += f'<rect x="{GUT}" y="{y}" width="{W - 2 * GUT}" height="2" fill="{C["border"]}"/>'
            y += 36
        body += f'<rect x="{GUT}" y="{y + 8}" width="48" height="12" rx="6" fill="{ring(grp["ring"])}"/>'
        body += icon(grp["icon"], GUT + 64, y - 6, 40)
        body += text(GUT + 116, y + 26, f'{grp["n"]} · {grp["name"]}', 44, 700)
        body += text(W - GUT, y + 26, f'Ring {grp["ring"]}', 28, 400, C["muted"], "end")
        y += 64
        codes = [c for c in G["codes"] if c["group"] == grp["n"]]
        for i in range(0, len(codes), 2):
            row_h, drawn = 0, []
            for j, c in enumerate(codes[i:i + 2]):
                x = GUT + j * (colw + gap)
                now, launch, comp = app["now"][c["code"]], app["launch"][c["code"]], app["compare"][c["code"]]
                st = status_of(now, launch)
                parts, cy = "", y + 36
                wc, ww = chip(x + 24, cy, c["wall"] or "No W", 22)
                parts += wc
                parts += text(x + 24 + ww + 12, cy + 30, c["code"], 40, 700)
                parts += text(x + 24 + ww + 12 + tw(c["code"], 40, 700) + 10, cy + 30, f'(0-{c["max"]})', 24, 400, C["muted"])
                cy += 66
                parts += text(x + 24, cy + 24, c["what"], 26, 600)
                cy += 44
                sc, _ = status_chip(x + 24, cy, st, 22)
                parts += sc
                cy += 56
                parts += f'<rect x="{x + 24}" y="{cy}" width="{colw - 48}" height="1" fill="{C["border"]}"/>'
                cy += 16
                for lab, val in (("Now", f'{c["code"]}{now}'), ("Launch", "Same" if launch == now else f'{launch - now:+d} To {c["code"]}{launch}'), (app["compare_label"], "Same" if comp == launch else f'{comp - launch:+d} To {c["code"]}{comp}')):
                    parts += text(x + 24, cy + 26, lab, 24, 400, C["muted"])
                    colr = C["status"]["solid"] if val == "Same" else C["ink"]
                    parts += text(x + colw - 24, cy + 26, val, 26, 700, colr, "end")
                    cy += 40
                parts += f'<rect x="{x + 24}" y="{cy + 4}" width="{colw - 48}" height="2" fill="{C["ink"]}"/>'
                cy += 20
                risk = "None" if not c["wall"] or launch == 0 else ("High" if c["wall"] in HIGH else "Medium")
                att, ah = attention(x + 16, cy, colw - 32, "Wall Test", WALL_TEST.get(c["wall"], "No Wall Test Needed"), risk, 24)
                parts += att
                cy += ah + 20
                row_h = max(row_h, cy - y)
                drawn.append((x, parts))
            for x, parts in drawn:
                body += card(x, y, colw, row_h, ring(grp["ring"])) + parts
            y += row_h + 24
    y += 12
    k, kh = key_block(W, y, [("chip", "W1", "Wall Number (W1-W8)"), ("chip", "No W", "No Wall"), ("swatch", ring(1), "Ring 1 Inside"), ("swatch", ring(4), "Ring 4 Public"),
                             ("status", "solid", "Launch Value Reached"), ("status", "fragile", "Partly Built"), ("status", "not_built", "Gap Is Work"), ("status", "not_needed", "Level 0")], GUT)
    body += k
    y += kh + 24
    H = int(y + 124)
    f, _ = footer(W, H, G["brand"]["course_date"], f'{app["name"]} · Codes Card · v1',
                  "Source: AF-CARD-TEMPLATE.md (frozen 19 Oct 2026) · codes-catalogue.json walls · layout from SRC_render_codes_card.py (LC-VISUAL-STANDARD v4) · invented app")
    body += f
    return save(os.path.join(out_dir, f"AF-CODES-W-{slug.upper()}-v1.svg"), svg_doc(W, H, body, f"20 Codes {app['name']}"))


if __name__ == "__main__":
    for s in sys.argv[1:]:
        print(build(s, os.path.join(ROOT, "graphics")))
