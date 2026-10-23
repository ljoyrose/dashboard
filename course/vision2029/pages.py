"""Vision 2029 · Illustrative screens (D11), drawn in the LIVE dashboard's own look (factory/index.html:
cream page, paper cards with a 1.5 px line border and 12 px corners, Lexend, Tabler icons, pill tabs, Palette A).
Only existing panels are extended; anything genuinely new is listed in CLASHES.md as NEW - TO CHECK.
All data comes from course/glossary.json and course/data/bricks-kits.json. Every name and number is fictional.

Pages: pulse.html · app-<slug>.html (x3) · launch-operate.html · flow.html
Run: python vision2029/pages.py   then   node build/shoot.mjs --html <page> --width 1440 --out <png>
"""
import json
import os
from html import escape as e

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
G = json.load(open(os.path.join(ROOT, "glossary.json"), encoding="utf-8"))
BK = json.load(open(os.path.join(ROOT, "data", "bricks-kits.json"), encoding="utf-8"))
PA = G["colours"]["palette_a"]
C = G["colours"]
V = G["vision2029"]
OUT = os.path.join(HERE, "pages")
FONTS = os.path.relpath(os.path.join(ROOT, "assets", "fonts"), OUT)
S = PA["slots"]

CSS = f"""
@font-face{{font-family:Lexend;font-weight:400;src:url('{FONTS}/Lexend-400.ttf')}}
@font-face{{font-family:Lexend;font-weight:600;src:url('{FONTS}/Lexend-600.ttf')}}
@font-face{{font-family:Lexend;font-weight:700;src:url('{FONTS}/Lexend-700.ttf')}}
:root{{--bg:{PA['cream']};--surface:{PA['paper']};--ink:{PA['ink']};--muted:{PA['muted']};--line:{PA['line']};--radius:12px;
--s2:{S['2']['text']};--s3:{S['3']['text']};--s4:{S['4']['text']};--s5:{S['5']['text']};--s6:{S['6']['text']};--s7:{S['7']['text']};
--t2:{S['2']['tint']};--t3:{S['3']['tint']};--t4:{S['4']['tint']};--t5:{S['5']['tint']};--t6:{S['6']['tint']};--t7:{S['7']['tint']};--sunk:{C['sunk']}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font-family:Lexend,system-ui,sans-serif;font-size:16px;line-height:1.5}}
.vbar{{background:var(--sunk);border-bottom:1px solid var(--line);text-align:center;font-weight:600;font-size:13px;padding:4px 16px}}
.vbar i{{vertical-align:-2px}}
header{{background:var(--bg);border-bottom:1px solid var(--line)}}
.top{{display:flex;gap:8px;align-items:center;padding:12px 16px;max-width:1180px;margin:0 auto}}
.top h1{{font-size:22px;margin:0 auto 0 0}}.top .sub{{color:var(--muted);font-size:14px;font-weight:400;margin-left:8px}}
nav{{display:flex;gap:8px;padding:0 16px 12px;max-width:1180px;margin:0 auto;overflow-x:auto}}
nav a{{flex:none;text-decoration:none;font-size:14px;font-weight:600;padding:8px 16px;border-radius:999px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);display:inline-flex;gap:8px;align-items:center}}
nav a.on{{border-color:var(--ink)}}
.n{{font-size:11px;font-weight:700;border:1px solid var(--line);border-radius:999px;padding:0 8px}}
main{{max-width:1180px;margin:0 auto;padding:16px}}
.grid{{display:grid;gap:16px}}.g4{{grid-template-columns:repeat(4,1fr)}}.g3{{grid-template-columns:repeat(3,1fr)}}.g2{{grid-template-columns:repeat(2,1fr)}}
@media(max-width:700px){{.g4,.g3{{grid-template-columns:repeat(2,1fr)}}.g2{{grid-template-columns:1fr}}}}
.card{{background:var(--surface);border:1.5px solid var(--line);border-radius:var(--radius);padding:12px 16px}}
.card h2{{font-size:16px;margin:0 0 8px;display:flex;gap:8px;align-items:center}}
.card h2 i{{font-size:20px}}
.stat{{font-size:32px;font-weight:700;line-height:1.1}}.lab{{color:var(--muted);font-size:13px}}
.row{{display:flex;gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}}.row:first-of-type{{border-top:0}}
.row .grow{{flex:1}}.mut{{color:var(--muted)}}.b{{font-weight:700}}
.chip{{display:inline-flex;gap:4px;align-items:center;font-size:13px;font-weight:600;padding:4px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);white-space:nowrap}}
.ok{{color:var(--s5)}}.warn{{color:var(--s3)}}.idle{{color:var(--muted)}}
.bar{{height:8px;border-radius:4px;background:var(--sunk);overflow:hidden}}.bar span{{display:block;height:100%;background:var(--s6)}}
table{{width:100%;border-collapse:collapse;font-size:14px}}th{{text-align:left;color:var(--muted);font-weight:600;padding:8px}}td{{padding:8px;border-top:1px solid var(--line)}}
.shelf{{display:inline-block;width:12px;height:12px;border-radius:4px;vertical-align:-1px;margin-right:4px}}
.key{{margin-top:24px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);display:flex;flex-wrap:wrap;gap:16px}}
.key b{{color:var(--ink)}}
footer{{margin-top:24px;background:var(--ink);color:var(--bg);padding:12px 16px;font-size:13px}}footer b{{margin-right:12px}}footer small{{display:block;color:{C['border']};margin-top:4px}}
.person{{display:inline-flex;gap:4px;align-items:center;font-weight:700}}
.flow{{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch}}
.step{{flex:1 1 150px;min-width:150px}}
.att{{background:var(--sunk);border-left:4px solid var(--ink);border-radius:12px;padding:12px 16px}}
"""
ICONS = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">'
STATUS_ICON = {"solid": ("ti-circle-check", "ok", "Solid"), "fragile": ("ti-alert-triangle", "warn", "Fragile"),
               "not_built": ("ti-circle-x", "", "Not Built"), "not_needed": ("ti-circle-minus", "idle", "Not Needed")}


def page(title, sub, tab, body, source, name):
    tabs = [("pulse", "Pulse", "ti-heart-rate-monitor"), ("me", "Me", "ti-user"), ("rooms", "Rooms", "ti-building-factory-2"),
            ("decide", "Decide", "ti-scale"), ("do", "Do", "ti-checkbox"), ("docs", "Docs", "ti-file-text")]
    nav = "".join(f'<a class="{"on" if t == tab else ""}"><i class="ti {ic}"></i>{lab}'
                  + (f' <span class="n">{V["decide_open"]}</span>' if t == "decide" else "") + "</a>" for t, lab, ic in tabs)
    html = f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} · Vision 2029</title>{ICONS}<style>{CSS}</style></head><body>
<div class="vbar"><i class="ti ti-sparkles"></i> {e(G['brand']['vision_label'])} · {e(G['brand']['fiction_label'])}</div>
<header><div class="top"><h1>{e(title)}<span class="sub">{e(sub)}</span></h1></div><nav>{nav}</nav></header>
<main>{body}</main>
<footer><b>{G['brand']['course_date']}</b>Vision 2029 · {e(title)} · v1<small>{e(source)}</small></footer></body></html>"""
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    open(path, "w", encoding="utf-8").write(html)
    return path


def money(n):
    return "£" + f"{n:,}"


def pulse():
    rooms = G["rooms"]["list"]
    stage_n = V["per_stage"]
    room_count = lambda r: sum(stage_n[str(s)] for s in r["stages"]) if r["stages"] else {"Rescue": V["rescue"], "Reserve": V["retired"], "Recycle": 0, "Recovery": 6, "Ready Room": 2}.get(r["name"], 0)
    strip = f"""<div class="grid g4">
<div class="card"><div class="lab">Live Apps</div><div class="stat">{V['live_apps']:,}</div><div class="lab"><i class="ti ti-rocket"></i> {V['new_per_day']} New Today</div></div>
<div class="card"><div class="lab">Decide Queue</div><div class="stat">{V['decide_open']} <span class="lab">of {V['decide_cap']}</span></div><div class="lab"><i class="ti ti-user"></i> Capped At {V['decide_cap']}</div></div>
<div class="card"><div class="lab">Leak Probe · {V['leak_probe_time']}</div><div class="stat ok"><i class="ti ti-shield-check"></i> {V['leak_probe']}</div><div class="lab">{V['tables_probed']:,} Tables Probed</div></div>
<div class="card"><div class="lab">Rescue</div><div class="stat">{V['rescue']}</div><div class="lab"><i class="ti ti-lifebuoy"></i> 1 Lane Kept Free</div></div>
</div>"""
    credits_pct = int(100 * V["credits_month"] / V["credits_stop_line"])
    money_card = f"""<div class="grid g2" style="margin-top:16px">
<div class="card"><h2><i class="ti ti-coin"></i>Credits This Month</h2><div class="stat">{V['credits_month']:,}</div>
<div class="bar" style="margin:8px 0"><span style="width:{credits_pct}%"></span></div><div class="lab">Stop Line {V['credits_stop_line']:,} · {credits_pct}% Used · Invest Auto-Passes At 1,500 Or Less</div></div>
<div class="card"><h2><i class="ti ti-currency-pound"></i>Money Line · This Month</h2><div class="stat">{money(V['money_in_month'])} <span class="lab">In</span></div>
<div class="lab">{money(V['money_out_month'])} Out · {money(V['money_in_month'] - V['money_out_month'])} Net · 0 Apps With Two Losing Months</div></div></div>"""
    room_rows = "".join(f'<div class="row"><span class="grow b">{e(r["name"])}</span><span class="mut">{e(r["tag"])}</span>'
                        f'<span class="chip">{", ".join(str(s) for s in r["stages"]) or "Lap"}</span><span class="b" style="min-width:56px;text-align:right">{room_count(r):,}</span></div>' for r in rooms)
    health = [("syncState", "Every 15 Min", "OK"), ("leakProbe", "Daily 06:40", "All Clear"), ("staleCheck", "Daily 06:10", "OK"),
              ("dailyDigest", "Weekdays 07:30", "OK"), ("weeklyBackup", "Mondays 05:20", "OK")]
    hrows = "".join(f'<div class="row"><i class="ti ti-circle-check ok"></i><span class="grow b">{j}</span><span class="mut">{w}</span><span class="ok b">{r}</span></div>' for j, w, r in health)
    body = strip + money_card + f"""<div class="grid g2" style="margin-top:16px">
<div class="card"><h2><i class="ti ti-building-factory-2"></i>Rooms · Apps In Each</h2>{room_rows}</div>
<div class="card"><h2><i class="ti ti-heart-rate-monitor"></i>Engine Jobs</h2>{hrows}
<div class="att" style="margin-top:12px"><div class="lab b">ATTENTION</div><div class="b">Rooms Tab Needs A Grouped View At This Scale</div><div>Risk: <span class="warn b">Medium</span></div></div></div></div>
<div class="key"><b>Key</b><span><i class="ti ti-circle-check ok"></i> Solid / OK</span><span><i class="ti ti-user"></i> Person Decides</span><span><i class="ti ti-lifebuoy"></i> Rescue Lane</span><span>Stage Numbers 0-8 In Chips</span><span><i class="ti ti-sparkles"></i> Vision 2029 · Illustrative</span></div>"""
    return page("Factory", "Pulse · About 1 New App A Day", "pulse", body,
                "Source: glossary.json vision2029 (illustrative) · rooms from Atlas floor plan · engine jobs and times AF-UNDERSTANDING-2026-10-22.md · strip extends the Factory Cockpit number strip (NEW - TO CHECK)", "pulse.html")


MARKET = {
    "litterline": {"keywords": ["Dog Breeding Licence Records", "Litter Register App", "Kennel Log For Inspection", "Puppy Buyer Portal", "Breeding Club Software"],
                   "size": "About 9,000 Licensed Breeders (Illustrative)", "demand": "Renewal Season Peaks Each Spring", "price": ["£19 Solo", "£39 Kennel", "£4 Per Member Via A Club"],
                   "rivals": [["Rival A · Generic Kennel Tool", "Partial", "None", "Not Built", "£25"], ["Rival B · Spreadsheet Pack", "None", "None", "Not Built", "£9"], ["Rival C · Club Database", "Partial", "Club Only", "Fragile", "£60"]]},
    "stayproof": {"keywords": ["Boarding Licence Checklist", "Kennel Inspection Pack", "Day Care Daily Log", "Cattery Records App", "Star Rating Evidence"],
                  "size": "About 12,000 Boarding Premises (Illustrative)", "demand": "Inspection Visits All Year", "price": ["£15 Home Boarder", "£35 Kennel", "£59 Multi-Site"],
                  "rivals": [["Rival A · Booking-Only Tool", "None", "Own Brand", "Not Built", "£30"], ["Rival B · Paper Templates", "Partial", "None", "Not Built", "£0"], ["Rival C · General Compliance App", "Partial", "None", "Fragile", "£45"]]},
    "trimtable": {"keywords": ["Dog Groomer Booking App", "Grooming Client Cards", "No-Show Reminders", "Groomer Shop", "Grooming Licence Wales"],
                  "size": "About 15,000 Grooming Businesses (Illustrative)", "demand": "Steady, Weekly Repeat Visits", "price": ["£12 Solo", "£29 Salon", "£49 Multi-Groomer"],
                  "rivals": [["Rival A · Salon Software", "Partial", "Own Brand", "Not Built", "£40"], ["Rival B · Calendar App", "None", "None", "Not Built", "£8"], ["Rival C · Pet CRM", "Partial", "None", "Fragile", "£35"]]},
}


def app_page(slug):
    a = G["sample_apps"][slug]
    m = MARKET[slug]
    kits = [k for k in BK["kits"] if k["id"] in a["kits"]]
    shelf_of = {b["id"]: b["shelf"] for b in BK["bricks"]}
    codes_rows = ""
    for grp in G["code_groups"]:
        cells = "".join(
            f'<span class="chip" title="{e(c["what"])}">{c["code"]}{a["codes"][c["code"]]}'
            + (f' <span class="mut">{c["wall"]}</span>' if c["wall"] else "") + "</span> "
            for c in G["codes"] if c["group"] == grp["n"])
        codes_rows += f'<div class="row"><span class="b" style="min-width:150px">{grp["n"]} · {e(grp["name"])}</span><span class="grow">{cells}</span></div>'
    brick_rows = ""
    for k in kits:
        chips = " ".join(f'<span class="chip"><span class="shelf" style="background:{C["layers"].get(shelf_of.get(b, "Body"), C["layers"]["Body"])}"></span>{e(b.replace("BR-", "").replace("-", " ").title())}</span>' for b in k["mandatory"])
        brick_rows += f'<div class="row"><span class="b" style="min-width:150px">{k["id"]} · {e(k["name"].title())}</span><span class="grow">{chips}</span><span class="mut">{k["table_count"]} Tables</span></div>'
    st = lambda key: f'<i class="ti {STATUS_ICON[key][0]} {STATUS_ICON[key][1]}"></i> {STATUS_ICON[key][2]}'
    st_word = {"Not Built": "not_built", "Fragile": "fragile", "Solid": "solid"}
    rival_rows = "".join(f"<tr><td class=b>{e(r[0])}</td><td>{e(r[1])}</td><td>{e(r[2])}</td><td>{st(st_word[r[3]])}</td><td>{e(r[4])}</td></tr>" for r in m["rivals"])
    rival_rows += f'<tr><td class=b>{e(a["name"])}</td><td>Full</td><td>{"A Brand Per Business" if a["codes"]["BRAND"] == 2 else "Own Brand"}</td><td>{st("solid")}</td><td>{e(m["price"][1].split()[0])}</td></tr>'
    body = f"""<div class="grid g3">
<div class="card"><h2><i class="ti ti-bulb"></i>Vision</h2><div class="b">{e(a['what'])}</div><div class="lab">Who Pays: {e(a['who_pays'])}</div></div>
<div class="card"><h2><i class="ti ti-alert-triangle"></i>Pain</h2><div class="b">{e(a['pain'])}</div><div class="lab">Rule: {e(a['rule_hook'])}</div></div>
<div class="card"><h2><i class="ti ti-clipboard-check"></i>Verdict · Data Role</h2><div class="b ok"><i class="ti ti-circle-check"></i> PASS</div><div class="lab">Kill Questions: 3 × No · Data Role: PROCESSOR (Breeders Control Their Records) · Leak: Ln</div></div></div>
<div class="card" style="margin-top:16px"><h2><i class="ti ti-forms"></i>20 Codes · Launch Values</h2>{codes_rows}</div>
<div class="card" style="margin-top:16px"><h2><i class="ti ti-box"></i>Kits And Bricks</h2>{brick_rows}</div>
<div class="grid g3" style="margin-top:16px">
<div class="card"><h2><i class="ti ti-search"></i>Keywords</h2>{''.join(f'<div class="row">{e(k)}</div>' for k in m['keywords'])}</div>
<div class="card"><h2><i class="ti ti-chart-line"></i>Market</h2><div class="row"><span class="grow mut">Size</span><span class="b">{e(m['size'])}</span></div><div class="row"><span class="grow mut">Demand</span><span class="b">{e(m['demand'])}</span></div>{''.join(f'<div class="row"><span class="grow mut">Price Point</span><span class="b">{e(p)}</span></div>' for p in m['price'])}</div>
<div class="card"><h2><i class="ti ti-scale"></i>Gates Passed</h2>{''.join(f'<div class="row"><i class="ti ti-circle-check ok"></i><span class="grow b">{g["name"]}</span><span class="mut">{"Person" if g["human"] else "Auto"}</span></div>' for g in G['gates'])}</div></div>
<div class="card" style="margin-top:16px"><h2><i class="ti ti-users-group"></i>Competitors (Fictional)</h2><table><tr><th>Rival</th><th>Licence Records</th><th>White-Label</th><th>Leak Tested</th><th>From</th></tr>{rival_rows}</table></div>
<div class="key"><b>Key</b><span>TEN3 = Code And Level</span><span>W1-W8 = Wall</span><span><span class="shelf" style="background:{C['layers']['Body']}"></span>Shelf Colour</span><span>{st('solid')}</span><span>{st('fragile')}</span><span>{st('not_built')}</span><span><i class="ti ti-sparkles"></i> Vision 2029 · Illustrative</span></div>"""
    return page(a["name"], "App Detail · The Document", "rooms", body,
                "Source: glossary.json sample_apps (invented; drawn from IDEAS.csv and REGULATION-WATCH.csv, disguised) · kits BRICK-KITS.csv · codes AF-CARD-TEMPLATE.md · market and rivals fictional", f"app-{slug}.html")


def launch_operate():
    a = G["sample_apps"]["litterline"]
    steps = [("ti-world-www", "Domain", "litterline.example", "DNS Records Set · SSL Live"),
             ("ti-file-text", "Sales Page", "Published", "Plan Buttons Carry Brand And Plan"),
             ("ti-chart-funnel", "Funnels", "3 Live", "Opt-In · Plan Choice · Thank You"),
             ("ti-palette", "Brand Jackets", "2 Brands", "LJR7 · Puppy Classroom"),
             ("ti-trending-up", "Boosts", "Weekly", "Reviews, SEO Page, One Email"),
             ("ti-droplet", "Leak Monitor", "All Clear", "Every Table, Daily 06:40")]
    cards = "".join(f'<div class="card"><h2><i class="ti {ic}"></i>{t}</h2><div class="stat" style="font-size:22px">{v}</div><div class="lab">{d}</div><div class="lab ok" style="margin-top:4px"><i class="ti ti-robot"></i> Runs By Itself</div></div>' for ic, t, v, d in steps)
    checks = [("Leak Test Every Table, Negative Cases, 2 Accounts", "solid"), ("Launch Walk On Desktop And Phone", "solid"), ("User-Switch Test", "solid"),
              ("Checkout On The Live Link (100%-Off Test Code)", "solid"), ("Account Delete And Data Export Work", "solid"), ("Support Route Tested", "solid")]
    crow = "".join(f'<div class="row"><i class="ti ti-circle-check ok"></i><span class="grow">{e(c)}</span><span class="ok b">Solid</span></div>' for c, _ in checks)
    probe = "".join(f'<div class="row"><span class="b" style="min-width:120px">{d}</span><span class="grow mut">{t:,} Tables · 2 Brands · Signed-Out, Brand A, Brand B, Owner</span><span class="ok b"><i class="ti ti-shield-check"></i> All Clear</span></div>'
                    for d, t in [("Thu 23 Oct", 31), ("Wed 22 Oct", 31), ("Tue 21 Oct", 31), ("Mon 20 Oct", 31)])
    body = f"""<div class="grid g3">{cards}</div>
<div class="grid g2" style="margin-top:16px">
<div class="card"><h2><i class="ti ti-flag"></i>Launch Gate · Checks</h2>{crow}<div class="row"><span class="person"><i class="ti ti-user"></i> Launch</span><span class="grow mut">Person Decides: Open It To Real Users?</span><span class="b">Yes · 09:12 UK time</span></div></div>
<div class="card"><h2><i class="ti ti-radar"></i>Operate · Leak Probe Log</h2>{probe}<div class="row"><i class="ti ti-currency-pound"></i><span class="grow">Money Line Oct 2029</span><span class="b">In £1,840 · Out £410</span></div></div></div>
<div class="key"><b>Key</b><span><i class="ti ti-robot"></i> Runs By Itself</span><span><i class="ti ti-user"></i> Person Decides</span><span><i class="ti ti-circle-check ok"></i> Solid</span><span><i class="ti ti-shield-check ok"></i> No Leak Found</span><span><i class="ti ti-sparkles"></i> Vision 2029 · Illustrative · Dates Shown As 2029 Days</span></div>"""
    return page(a["name"], "Automated Launch And Operate", "rooms", body,
                "Source: TEMPLATE-MIRROR.md (stage 7 and 8 lines) · OBLIGATIONS.csv OB-P14, OB-P22 · ClickFunnels-Platform-Reference.md · leak probe 06:40 AF-UNDERSTANDING-2026-10-22.md", "launch-operate.html")


if __name__ == "__main__":
    for p in [pulse(), app_page("litterline"), app_page("stayproof"), app_page("trimtable"), launch_operate()]:
        print(p)
