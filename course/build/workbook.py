"""Workbook and Kindle-ready ebook, built from scripts/modules (one source):
  workbook/WORKBOOK-<brand>.md    editable source (Markdown)
  workbook/WORKBOOK-<brand>.html  print layout (Lexend, cream page)
  workbook/WORKBOOK-<brand>-v1.pdf  via headless Chromium, dated footer on every page
  workbook/WORKBOOK-<brand>-v1.docx and .epub  via pandoc (Kindle takes EPUB best; test in Kindle Previewer)
Brand jacket swaps the title and owner line only (D8). Usage: python build/workbook.py [ljr7|ppp|yours]"""
import glob
import html
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = json.load(open(os.path.join(ROOT, "glossary.json"), encoding="utf-8"))
C = G["colours"]
WB = os.path.join(ROOT, "workbook")
GRAPHIC = {"M00": ["AF-ROAD-9-STAGES-v1", "AF-FACTORY-MAP-11-ROOMS-v1"], "M01": ["AF-FRONT-DOOR-4-DOORS-v1", "AF-IDEA-FORM-FLOW-v1", "AF-VERDICT-DATA-ROLE-v1"],
           "M03": ["AF-SHELVES-AND-KITS-v1"], "M05": ["AF-TABLES-ASSEMBLE-v1", "AF-WALLS-W1-W8-v1"], "M06": ["AF-TEST-IDENTITIES-MATRIX-v1"],
           "M07": ["AF-AFTER-EVERY-PAID-TURN-v1"], "M08": ["AF-LAUNCH-KIT-v1", "AF-RESELLER-NEVER-FREE-v1"], "M09": ["AF-OPERATE-LAP-v1"],
           "M10": ["AF-VALUE-LADDER-v1", "AF-VISION2029-AUTOMATED-FLOW-v1"]}


def first(t):
    """The first sentence that carries the idea: at least 8 words and not a question."""
    sents = re.split(r"(?<=[.?])\s", t.strip())
    for x in sents:
        if len(x.split()) >= 8 and not x.endswith("?"):
            return x
    return sents[0]


def build_md(brand):
    b = G["brands"][brand]
    mods = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(os.path.join(ROOT, "scripts", "modules", "M[0-9][0-9].json")))]
    md = [f"---\ntitle: \"{G['brand']['course_title']} · Workbook\"\nsubtitle: \"{G['brand']['course_subtitle']}\"\nauthor: \"{b['long_name']}\"\ndate: \"{G['brand']['course_date']}\"\nlang: en-GB\n---", "",
          f"# Before You Start", "", f"This workbook goes with the {G['brand']['course_title']} course. One idea per page section, a recap and a short quiz after every lesson.",
          f"All businesses, people and figures are invented. Anything about the future is marked *{G['brand']['vision_label']}*.", "", f"Published by {b['long_name']}. {G['cta']['partner_note']}", ""]
    for m in mods:
        md += [f"# {m['id']} · {m['title']}", "", f"*{m.get('subtitle', '')}*", "", m.get("summary", ""), ""]
        for g in GRAPHIC.get(m["id"], []):
            md += [f"![](../graphics/{g}.png){{width=60%}}", ""]
        for L in m["lessons"]:
            md += [f"## {L['title']}", "", f"**You can:** {L['outcome'][8:] if L['outcome'].startswith('You can ') else L['outcome']}", ""]
            if L.get("vision"):
                md += [f"*{G['brand']['vision_label']}*", ""]
            md += ["**Key Ideas**", ""] + [f"- **{bt['screen']}.** {first(bt['say'])}" for bt in L["beats"]] + [""]
            md += ["**Recap**", ""] + [f"- {p}" for p in L["recap"]["points"]] + ["", f"> **Why It Matters:** {L['recap']['why']}", "", "**Quick Quiz**", ""]
            for i, q in enumerate(L["quiz"], 1):
                md += [f"{i}. {q['q']}", ""] + [f"    {'ABCD'[j]}) {o}" for j, o in enumerate(q["options"])] + [""]
            md += ["**My Notes**", "", "\\_" * 40, "", "\\_" * 40, ""]
    md += ["# Quiz Answers", ""]
    for m in mods:
        for L in m["lessons"]:
            md.append(f"- **{L['id']} {L['title']}:** " + " · ".join(f"{i}{'ABCD'[q['answer']]}" for i, q in enumerate(L["quiz"], 1)))
    md += ["", "# Next Step", "", f"Fill in the Idea Form ({G['cta']['idea_form_link']}). Resellers: {G['cta']['reseller_rule']}. Partner link: {G['cta']['partner_link']}.", "", G["cta"]["partner_note"], ""]
    os.makedirs(WB, exist_ok=True)
    path = os.path.join(WB, f"WORKBOOK-{brand.upper()}.md")
    open(path, "w", encoding="utf-8").write("\n".join(md))
    return path


CSS = f"""
@font-face{{font-family:Lexend;font-weight:400;src:url('../assets/fonts/Lexend-400.ttf')}}@font-face{{font-family:Lexend;font-weight:700;src:url('../assets/fonts/Lexend-700.ttf')}}
@page{{size:A4;margin:18mm 16mm 22mm}}html{{background:{C['page']}}}
body{{font-family:Lexend,sans-serif;color:{C['ink']};background:{C['page']};font-size:11.5pt;line-height:1.5;max-width:760px;margin:0 auto;padding:16px}}
h1{{font-size:24pt;border-bottom:2px solid {C['ink']};padding-bottom:6px;page-break-before:always;margin-top:0}}h1:first-of-type{{page-break-before:avoid}}
h2{{font-size:16pt;margin-top:28px;page-break-after:avoid}}
blockquote{{background:{C['sunk']};border-left:4px solid {C['ink']};border-radius:12px;margin:12px 0;padding:8px 16px}}
img{{display:block;margin:16px auto;max-height:240mm;border:1px solid {C['border']};border-radius:8px}}
li{{margin:4px 0}}header.title{{text-align:left;margin-bottom:24px}}p.subtitle{{color:{C['muted']}}}
"""


def build(brand):
    md = build_md(brand)
    base = os.path.splitext(md)[0]
    htm = base + ".html"
    subprocess.run(["pandoc", md, "-s", "-o", htm, "--metadata", "pagetitle=Workbook", "-c", "workbook.css"], check=True, cwd=WB)
    open(os.path.join(WB, "workbook.css"), "w").write(CSS)
    foot = f'<div style="font-family:Lexend,sans-serif;font-size:8pt;width:100%;padding:0 16mm;color:{C["muted"]}"><b style="color:{C["ink"]}">{G["brand"]["course_date"]}</b> · {html.escape(G["brands"][brand]["long_name"])} · Workbook v1 · Page <span class="pageNumber"></span></div>'
    js = f"""
import {{ chromium }} from 'playwright-core'; import fs from 'node:fs'; import path from 'node:path'; import {{ pathToFileURL }} from 'node:url';
const base='/opt/pw-browsers'; const d=fs.existsSync(base)?fs.readdirSync(base).filter(x=>x.startsWith('chromium_headless_shell-')).sort().reverse()[0]:null;
const b=await chromium.launch({{executablePath: process.env.CHROME || (d?path.join(base,d,'chrome-linux','headless_shell'):undefined)}}); const p=await b.newPage();
await p.goto(pathToFileURL({json.dumps(htm)}).href,{{waitUntil:'load'}}); await p.evaluate(()=>document.fonts.ready);
await p.pdf({{path:{json.dumps(base + '-v1.pdf')},format:'A4',printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:{json.dumps(foot)},margin:{{top:'18mm',bottom:'22mm',left:'16mm',right:'16mm'}}}});
await b.close();"""
    jsf = os.path.join(ROOT, "build", ".wb-pdf.mjs")
    open(jsf, "w").write(js)
    subprocess.run(["node", jsf], check=True, cwd=ROOT)
    os.remove(jsf)
    subprocess.run(["pandoc", md, "-o", base + "-v1.docx"], check=True, cwd=WB)
    subprocess.run(["pandoc", md, "-o", base + "-v1.epub", "--toc", "--toc-depth=1", "--css", "workbook.css"], check=True, cwd=WB)
    return [md, htm, base + "-v1.pdf", base + "-v1.docx", base + "-v1.epub"]


if __name__ == "__main__":
    for br in sys.argv[1:] or ["ljr7"]:
        for p in build(br):
            print(p)
