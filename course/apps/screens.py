"""Sample app screens for 3 invented apps (Stage 5), drawn in the live app look (Palette A, paper cards, Lexend,
Tabler icons) inside phone frames. Litterline is also shown in two brand jackets (LJR7 and the Puppy Classroom
reseller) to teach white-label: only name, initials, accent and join link change (tokens from glossary.json brands).
Every business, person and number is invented. Run: python apps/screens.py, then shoot each page with
node build/shoot.mjs --html apps/out/<page>.html --width 1440 --out apps/out/<page>.png"""
import json
import os
from html import escape as e

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
G = json.load(open(os.path.join(ROOT, "glossary.json"), encoding="utf-8"))
PA, C = G["colours"]["palette_a"], G["colours"]
S = PA["slots"]
OUT = os.path.join(HERE, "out")
FONTS = os.path.relpath(os.path.join(ROOT, "assets", "fonts"), OUT)
P = G["sample_apps"]["people"]

CSS = f"""
@font-face{{font-family:Lexend;font-weight:400;src:url('{FONTS}/Lexend-400.ttf')}}@font-face{{font-family:Lexend;font-weight:600;src:url('{FONTS}/Lexend-600.ttf')}}@font-face{{font-family:Lexend;font-weight:700;src:url('{FONTS}/Lexend-700.ttf')}}
*{{box-sizing:border-box}}body{{margin:0;background:{PA['cream']};color:{PA['ink']};font-family:Lexend,system-ui,sans-serif}}
.page{{max-width:1360px;margin:0 auto;padding:24px 16px}}
.head h1{{font-size:32px;margin:0}}.head p{{color:{PA['muted']};margin:4px 0 12px}}.rule{{height:2px;background:{PA['ink']};margin-bottom:24px}}
.vchip{{float:right;font-size:13px;font-weight:600;border:1px solid {PA['line']};background:{PA['paper']};border-radius:999px;padding:4px 12px}}
.row{{display:flex;gap:24px;justify-content:center;flex-wrap:wrap}}
.cap{{text-align:center;font-weight:700;margin-top:12px}}.cap span{{display:block;font-weight:400;color:{PA['muted']};font-size:13px}}
.phone{{width:390px;border:12px solid {PA['ink']};border-radius:48px;background:{PA['cream']};overflow:hidden;min-height:780px}}
.bar{{display:flex;align-items:center;gap:8px;padding:16px;border-bottom:1px solid {PA['line']};background:{PA['paper']}}}
.logo{{width:36px;height:36px;border-radius:12px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}}
.bar b{{font-size:16px}}.bar small{{display:block;color:{PA['muted']};font-size:12px}}.bar .ic{{margin-left:auto;font-size:22px;color:{PA['muted']}}}
.body{{padding:16px;display:flex;flex-direction:column;gap:12px}}
.card{{background:{PA['paper']};border:1.5px solid {PA['line']};border-radius:12px;padding:12px 16px}}
.card h3{{margin:0 0 8px;font-size:15px;display:flex;gap:8px;align-items:center}}.card h3 i{{font-size:18px}}
.it{{display:flex;gap:8px;align-items:center;padding:8px 0;border-top:1px solid {PA['line']};font-size:14px}}.it:first-of-type{{border-top:0}}
.it .grow{{flex:1}}.mut{{color:{PA['muted']};font-size:13px}}
.ok{{color:{S['5']['text']}}}.warn{{color:{S['3']['text']}}}.idle{{color:{PA['muted']}}}
.big{{font-size:28px;font-weight:700}}
.bar2{{height:8px;border-radius:4px;background:{C['sunk']};overflow:hidden;margin:8px 0}}.bar2 span{{display:block;height:100%}}
.btn{{display:block;text-align:center;color:#fff;font-weight:600;border-radius:12px;padding:12px;font-size:15px}}
.pill{{display:inline-block;font-size:12px;font-weight:600;border:1px solid {PA['line']};border-radius:999px;padding:2px 8px;background:{PA['paper']}}}
.nav{{display:flex;justify-content:space-around;border-top:1px solid {PA['line']};background:{PA['paper']};padding:8px 0;font-size:11px;color:{PA['muted']};margin-top:auto}}
.nav div{{text-align:center}}.nav i{{display:block;font-size:20px}}.nav .on{{color:{PA['ink']};font-weight:700}}
.key{{margin-top:24px;padding-top:12px;border-top:1px solid {PA['line']};font-size:13px;color:{PA['muted']};display:flex;flex-wrap:wrap;gap:16px}}.key b{{color:{PA['ink']}}}
footer{{margin-top:24px;background:{PA['ink']};color:{PA['cream']};padding:12px 16px;font-size:13px}}footer b{{margin-right:12px}}footer small{{display:block;color:{C['border']};margin-top:4px}}
"""
ICONS = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">'
ST = {"solid": ("ti-circle-check", "ok", "Solid"), "fragile": ("ti-alert-triangle", "warn", "Fragile"), "not_built": ("ti-circle-x", "", "Not Built"), "not_needed": ("ti-circle-minus", "idle", "Not Needed")}


def st(k):
    i, c, w = ST[k]
    return f'<span class="{c}"><i class="ti {i}"></i> {w}</span>'


def phone(brand, app, title, inner, nav_on):
    b = G["brands"][brand]
    name = app["name"] if brand == "ljr7" else f'{app["name"]} · {b["name"]}'
    navs = [("ti-home-2", "Home"), ("ti-list-check", "Records"), ("ti-clipboard-check", "Inspection"), ("ti-user", "Account")]
    nav = "".join(f'<div class="{"on" if n == nav_on else ""}"><i class="ti {i}"></i>{n}</div>' for i, n in navs)
    return (f'<div><div class="phone" style="display:flex;flex-direction:column"><div class="bar"><div class="logo" style="background:{b["accent"]}">{b["initials"]}</div>'
            f'<div><b>{e(name)}</b><small>{e(title)}</small></div><i class="ti ti-bell ic"></i></div><div class="body">{inner}</div><div class="nav">{nav}</div></div></div>')


def page(name, title, sub, phones_caps, source):
    cells = "".join(f'<div>{ph}<div class="cap">{e(c1)}<span>{e(c2)}</span></div></div>' for ph, c1, c2 in phones_caps)
    html = f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title>{ICONS}<style>{CSS}</style></head><body>
<div class="page"><div class="head"><span class="vchip"><i class="ti ti-sparkles"></i> {e(G['brand']['vision_label'])}</span><h1>{e(title)}</h1><p>{e(sub)}</p></div><div class="rule"></div>
<div class="row">{cells}</div>
<div class="key"><b>Key</b><span>{st('solid')} Done</span><span>{st('fragile')} Due Soon</span><span>{st('not_built')} Missing</span><span><i class="ti ti-sparkles"></i> Vision 2029 · Illustrative</span><span>{e(G['brand']['fiction_label'])}</span></div></div>
<footer><b>{G['brand']['course_date']}</b>Sample App Screens · {e(title)} · v1<small>{e(source)}</small></footer></body></html>"""
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + ".html")
    open(p, "w", encoding="utf-8").write(html)
    return p


def litterline(brand):
    a = G["sample_apps"]["litterline"]
    acc = G["brands"][brand]["accent"]
    home = f"""<div class="card"><h3><i class="ti ti-license"></i>Licence Renewal</h3><div class="big">74%</div><div class="bar2"><span style="width:74%;background:{acc}"></span></div><div class="mut">Evidence Ready · Renewal 14 Mar 2027</div></div>
<div class="card"><h3><i class="ti ti-checklist"></i>This Week</h3><div class="it"><span class="grow">Kennel Temperature Log</span>{st('solid')}</div><div class="it"><span class="grow">Worming Record · Litter B</span>{st('fragile')}</div><div class="it"><span class="grow">Buyer Contract · Pip</span>{st('not_built')}</div></div>
<div class="card"><h3><i class="ti ti-paw"></i>Litters</h3><div class="it"><span class="grow"><b>Litter B</b><br><span class="mut">Born 2 Sep 2026 · 6 Puppies</span></span><span class="pill">3 Reserved</span></div><div class="it"><span class="grow"><b>Litter A</b><br><span class="mut">Born 11 May 2026 · 5 Puppies</span></span><span class="pill">All Homed</span></div></div>
<a class="btn" style="background:{acc}">Add A Health Record</a>"""
    reg = """<div class="card"><h3><i class="ti ti-dog"></i>Litter B · 6 Puppies</h3>""" + "".join(
        f'<div class="it"><span class="grow"><b>{n}</b><br><span class="mut">{s} · Microchip Logged</span></span>{st(k)}</div>' for n, s, k in
        [("Bramble", "Female", "solid"), ("Pip", "Male", "fragile"), ("Juniper", "Female", "solid"), ("Moss", "Male", "solid"), ("Wren", "Female", "solid"), ("Fennel", "Male", "fragile")]) + "</div>"
    reg += """<div class="card"><h3><i class="ti ti-heart-rate-monitor"></i>Health Checks</h3><div class="it"><span class="grow">Vet Check 6 Weeks</span><span class="mut">14 Oct 2026</span></div><div class="it"><span class="grow">Vaccination 1</span><span class="mut">21 Oct 2026</span></div></div>"""
    insp = """<div class="card"><h3><i class="ti ti-clipboard-check"></i>Inspection Evidence Pack</h3>""" + "".join(
        f'<div class="it"><span class="grow">{n}</span>{st(k)}</div>' for n, k in
        [("Breeding Records Up To Date", "solid"), ("Kennel Size And Temperature Logs", "solid"), ("Socialisation Plan", "solid"), ("Puppy Buyer Information", "fragile"), ("Emergency Vet Contact", "solid"), ("Staff Training Notes", "not_built")]) + "</div>"
    insp += f"""<div class="card"><h3><i class="ti ti-download"></i>Export For The Inspector</h3><div class="mut">One PDF · Only Your Kennel's Records</div></div><a class="btn" style="background:{acc}">Download Pack</a>"""
    return [phone(brand, a, "Home", home, "Home"), phone(brand, a, "Litter Register", reg, "Records"), phone(brand, a, "Inspection", insp, "Inspection")]


def stayproof():
    a = G["sample_apps"]["stayproof"]
    today = """<div class="card"><h3><i class="ti ti-calendar"></i>Today · 23 Oct 2029</h3><div class="big">14 Dogs · 3 Cats</div><div class="mut">Hollin Lane Kennels</div></div>
<div class="card"><h3><i class="ti ti-checklist"></i>Daily Logs</h3><div class="it"><span class="grow">Morning Feed</span>""" + st("solid") + """</div><div class="it"><span class="grow">Kennel Clean · Block A</span>""" + st("solid") + """</div><div class="it"><span class="grow">Medication · Kennel 6</span>""" + st("fragile") + """</div><div class="it"><span class="grow">Evening Walk Notes</span>""" + st("not_built") + "</div></div>"
    pack = """<div class="card"><h3><i class="ti ti-file-certificate"></i>Boarding Licence Pack</h3>""" + "".join(
        f'<div class="it"><span class="grow">{n}</span>{st(k)}</div>' for n, k in [("Licence Conditions Checklist", "solid"), ("Fire And Emergency Plan", "solid"), ("Isolation Kennel Ready", "solid"), ("Vaccination Proof Per Guest", "fragile"), ("Staff Ratio Record", "solid")]) + """</div>
<div class="card"><h3><i class="ti ti-target"></i>Star Rating Evidence</h3><div class="big">4 Of 5</div><div class="mut">Higher Standards: 9 Of 12 Shown (Illustrative)</div></div>"""
    guest = """<div class="card"><h3><i class="ti ti-dog"></i>Guest · Biscuit</h3><div class="it"><span class="grow">Owner</span><span class="mut">A. Field</span></div><div class="it"><span class="grow">Vaccinations</span>""" + st("solid") + """</div><div class="it"><span class="grow">Diet</span><span class="mut">Grain-Free, Twice Daily</span></div><div class="it"><span class="grow">Stay</span><span class="mut">20-27 Oct 2029</span></div></div>
<div class="card"><h3><i class="ti ti-lock"></i>Owner Sees Only Biscuit</h3><div class="mut">Member Wall (W2): No Other Guest Is Visible</div></div>"""
    return [phone("ljr7", a, "Today", today, "Home"), phone("ljr7", a, "Licence Pack", pack, "Inspection"), phone("ljr7", a, "Guest Record", guest, "Records")]


def trimtable():
    a = G["sample_apps"]["trimtable"]
    acc = G["brands"]["ljr7"]["accent"]
    day = """<div class="card"><h3><i class="ti ti-calendar"></i>Thursday · The Tidy Paw</h3>""" + "".join(
        f'<div class="it"><span class="grow"><b>{t}</b> · {d}<br><span class="mut">{s}</span></span>{st(k)}</div>' for t, d, s, k in
        [("09:00", "Clover", "Full Groom · Cockapoo", "solid"), ("10:30", "Rufus", "Bath And Tidy · Spaniel", "solid"), ("12:00", "Mabel", "Puppy Intro · Poodle", "fragile"), ("14:00", "Otis", "Hand Strip · Terrier", "solid")]) + "</div>"
    day += f'<a class="btn" style="background:{acc}">New Booking</a>'
    client = """<div class="card"><h3><i class="ti ti-dog"></i>Clover · Cockapoo</h3><div class="it"><span class="grow">Coat Notes</span><span class="mut">Matting Behind Ears</span></div><div class="it"><span class="grow">Blade</span><span class="mut">No. 7 Body, 4 Legs</span></div><div class="it"><span class="grow">Behaviour</span><span class="mut">Nervous Of Dryer</span></div><div class="it"><span class="grow">Last Visit</span><span class="mut">25 Sep 2029</span></div></div>
<div class="card"><h3><i class="ti ti-users"></i>Owner Portal</h3><div class="mut">Owner Sees Clover's Visits And Photos Only</div></div>"""
    rem = """<div class="card"><h3><i class="ti ti-bell"></i>Reminders · Run By Themselves</h3><div class="it"><span class="grow">48-Hour Booking Reminder</span>""" + st("solid") + """</div><div class="it"><span class="grow">6-Week Rebook Nudge</span>""" + st("solid") + """</div><div class="it"><span class="grow">No-Show Follow-Up</span>""" + st("fragile") + """</div></div>
<div class="card"><h3><i class="ti ti-chart-line"></i>No-Shows This Month</h3><div class="big">2</div><div class="mut">Down From 9 Before Reminders (Illustrative)</div></div>"""
    return [phone("ljr7", a, "Today's Bookings", day, "Home"), phone("ljr7", a, "Client Card", client, "Records"), phone("ljr7", a, "Reminders", rem, "Account")]


SRC = "Source: glossary.json sample_apps (invented, drawn from IDEAS.csv and REGULATION-WATCH.csv and disguised) · brands from glossary.json · style from factory/index.html (Palette A)"
if __name__ == "__main__":
    L = litterline("ljr7")
    out = [page("app-litterline", "Litterline", "Licence And Records Hub For Dog Breeders · LJR7", list(zip(L, ["Home", "Litter Register", "Inspection Pack"], ["Renewal Progress And This Week", "Every Puppy, Its Health Checks", "Evidence For The Council Visit"])), SRC),
           page("app-stayproof", "Stayproof", "Inspection Pack For Boarding Kennels · LJR7", list(zip(stayproof(), ["Today", "Licence Pack", "Guest Record"], ["Daily Logs", "Conditions And Star Rating", "Member Wall In Action"])), SRC),
           page("app-trimtable", "Trimtable", "Booking And Client Desk For Dog Groomers · LJR7", list(zip(trimtable(), ["Bookings", "Client Card", "Reminders"], ["The Groomer's Day", "Dog Notes And Owner Portal", "Bots Cut No-Shows"])), SRC)]
    P1, P2 = litterline("ljr7")[0], litterline("ppp")[0]
    Y = litterline("yours")[0]
    out.append(page("white-label-litterline", "One App, Three Jackets", "White-Label: Only Name, Initials, Accent And Join Link Change",
                    [(P1, "LJR7", "Sold Direct · Free Plan Allowed"), (P2, "Puppy Classroom", "Reseller · /join/ppp · Never On A Free Plan"), (Y, "Your Brand Here", "Reseller · /join/your-brand · Never Free")], SRC))
    for p in out:
        print(p)
