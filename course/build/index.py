"""Writes INDEX.csv: one row per asset. Columns: asset, track, module, type, final_file, EDITABLE_LINK_OR_PATH, status.
Paths are relative to course/. Several editable paths are separated by ';'. The checker (qa/check.py) proves each exists."""
import csv, glob, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = []
def add(asset, track, module, typ, final, editable, status="Done"):
    R.append([asset, track, module, typ, final, editable, status])

add("Stage 0 Proposal", "All", "-", "proposal", "STAGE0-PROPOSAL.md", "STAGE0-PROPOSAL.md")
add("Questions For Lisa", "All", "-", "decision list", "QUESTIONS.md", "QUESTIONS.md")
add("Clashes For Lisa", "All", "-", "decision list", "CLASHES.md", "CLASHES.md")
add("Glossary (all names, hexes, numbers)", "All", "-", "design system", "glossary.json", "glossary.json")
add("Design System (kit, tokens, icons)", "All", "-", "design system", "design/DESIGN-SYSTEM.md", "build/lj.py;build/deck.py;build/tokens.py;design/tokens.css;design/icons")
add("Sample Slide", "All", "Design System", "slide", "slides/SAMPLE-SLIDE/SAMPLE-SLIDE-v1.pdf", "slides/SAMPLE-SLIDE/SAMPLE-SLIDE-v1.pptx;decks/sample.json")
add("Syllabus", "All", "-", "course map", "SYLLABUS.md", "build/syllabus.py;scripts/modules")
add("Framework Map", "B", "-", "script", "scripts/FRAMEWORK-MAP.md", "scripts/FRAMEWORK-MAP.md")
add("Keynote (22 slides)", "B", "Keynote", "keynote", "slides/AF-KEYNOTE/AF-KEYNOTE-v1.pdf", "slides/AF-KEYNOTE/AF-KEYNOTE-v1.pptx;decks/keynote.json")
add("Keynote Speaker Script", "B", "Keynote", "script", "scripts/AF-KEYNOTE-SCRIPT.md", "decks/keynote.json;build/export_script.py")
add("Keynote · Puppy Classroom Jacket", "R", "Keynote", "reseller deck", "slides/AF-KEYNOTE/AF-KEYNOTE-PPP-v1.pdf", "slides/AF-KEYNOTE/AF-KEYNOTE-PPP-v1.pptx;decks/keynote.json")
add("Partner Webinar Cut", "B", "Partner", "deck", "slides/AF-PARTNER-WEBINAR/AF-PARTNER-WEBINAR-v1.pdf", "slides/AF-PARTNER-WEBINAR/AF-PARTNER-WEBINAR-v1.pptx;decks/partner-webinar.json")
add("Partner Webinar · Puppy Classroom", "R", "Partner", "reseller deck", "slides/AF-PARTNER-WEBINAR/AF-PARTNER-WEBINAR-PPP-v1.pdf", "slides/AF-PARTNER-WEBINAR/AF-PARTNER-WEBINAR-PPP-v1.pptx;decks/partner-webinar.json")
add("Partner Webinar Script", "B", "Partner", "script", "scripts/AF-PARTNER-WEBINAR-SCRIPT.md", "decks/partner-webinar.json")
add("Partner Email (Epiphany Bridge)", "B", "Partner", "script", "scripts/PARTNER-EMAIL-EPIPHANY-BRIDGE.md", "scripts/PARTNER-EMAIL-EPIPHANY-BRIDGE.md")
for p in sorted(glob.glob(os.path.join(ROOT, "scripts", "modules", "M[0-9][0-9].json"))):
    m = json.load(open(p, encoding="utf-8")); mid = m["id"]
    add(f"{mid} · {m['title']} · Script", "F", mid, "module script", f"scripts/modules/{mid}-SCRIPT.md", f"scripts/modules/{mid}.json")
    add(f"{mid} · Deck", "F", mid, "deck", f"slides/AF-TRACKF-{mid}/AF-TRACKF-{mid}-v1.pdf", f"slides/AF-TRACKF-{mid}/AF-TRACKF-{mid}-v1.pptx;decks/track-f/{mid}.json")
    for L in m["lessons"]:
        add(f"{L['id']} · Recap Card", "F", mid, "recap card", f"graphics/recap/RECAP-{L['id']}-v1.png", f"graphics/recap/RECAP-{L['id']}-v1.svg;build/modules.py")
        add(f"{L['id']} · Storyboard And Voice-Over", "F", mid, "storyboard", f"video/storyboards/{L['id']}.md", f"video/voiceover/{L['id']}.txt;scripts/modules/{mid}.json", "Storyboard (video TO RENDER)" if L["id"] != "M00-L1" else "Done")
add("M00 Deck · Puppy Classroom", "R", "M00", "reseller deck", "slides/AF-TRACKF-M00/AF-TRACKF-M00-PPP-v1.pdf", "slides/AF-TRACKF-M00/AF-TRACKF-M00-PPP-v1.pptx;decks/track-f/M00.json")
add("Quizzes (all lessons)", "F", "All", "quiz", "quizzes.json", "scripts/modules;build/modules.py")
gr = json.load(open(os.path.join(ROOT, "data", "graphics.json"), encoding="utf-8"))
for g in gr["graphics"]:
    add(f"{g['id']} · {g['title']}", "All", g["module"].replace("Module ", "M").replace("M1", "M01") if False else g["module"], "graphic", f"graphics/{g['file']}.png", f"graphics/{g['file']}.svg;data/graphics.json;build/g_set.py")
add("G01 · The Factory Road", "All", "Module M0", "graphic", "graphics/AF-ROAD-9-STAGES-v1.png", "graphics/AF-ROAD-9-STAGES-v1.svg;build/g_road.py")
add("G11 · Fully Automated Flow (Vision 2029)", "All", "Module M10", "graphic", "graphics/AF-VISION2029-AUTOMATED-FLOW-v1.png", "graphics/AF-VISION2029-AUTOMATED-FLOW-v1.svg;build/g_flow.py")
for s in ["LITTERLINE", "STAYPROOF", "TRIMTABLE"]:
    add(f"20 Codes Card W · {s.title()}", "All", "Module M1", "graphic", f"graphics/AF-CODES-W-{s}-v1.png", f"graphics/AF-CODES-W-{s}-v1.svg;data/apps/{s.lower()}.json;build/g_codes_card.py")
add("Vision 2029 Factory Dashboard (real page, 5 tabs x 2 sizes)", "All", "Stage 4", "dashboard mockup", "vision2029/out/dashboard-2029-me-desktop.png", "vision2029/shoot-dashboard.cjs;vision2029/state-2029.js")
add("Vision 2029 Pulse Tab (NEW - TO CHECK)", "All", "Stage 4", "dashboard mockup", "vision2029/pages/pulse-desktop.png", "vision2029/pages/pulse.html;vision2029/pages.py", "Done · NEW - TO CHECK")
for s in ["litterline", "stayproof", "trimtable"]:
    add(f"Vision 2029 App Detail · {s.title()}", "All", "Stage 4", "app detail", f"vision2029/pages/app-{s}-desktop.png", f"vision2029/pages/app-{s}.html;vision2029/pages.py", "Done · NEW - TO CHECK")
add("Vision 2029 Automated Launch And Operate", "All", "Stage 4", "dashboard mockup", "vision2029/pages/launch-operate-desktop.png", "vision2029/pages/launch-operate.html;vision2029/pages.py", "Done · NEW - TO CHECK")
for s, t in [("litterline", "Litterline"), ("stayproof", "Stayproof"), ("trimtable", "Trimtable")]:
    add(f"Sample App · {t}", "All", "Stage 5", "sample app", f"apps/out/app-{s}.png", f"apps/out/app-{s}.html;apps/screens.py")
add("White-Label: One App, Three Jackets", "R", "Stage 5", "sample app", "apps/out/white-label-litterline.png", "apps/out/white-label-litterline.html;apps/screens.py")
add("Hero Animation (30 s)", "All", "Shared", "video", "video/out/Shared/AF-HERO-LJR7-v1.mp4", "video/src/index.tsx;video/render.mjs;glossary.json")
add("Hero Animation · Puppy Classroom", "R", "Shared", "video", "video/out/Shared/AF-HERO-PPP-v1.mp4", "video/src/index.tsx;video/render.mjs")
add("Hero Loop (8 s)", "All", "Shared", "video", "video/out/Shared/AF-HERO-LOOP-LJR7-v1.mp4", "video/src/index.tsx;video/render.mjs")
add("Hero Still (thumbnail)", "All", "Shared", "video still", "video/out/Shared/AF-HERO-STILL-LJR7-v1.png", "video/src/index.tsx;video/render.mjs")
add("Intro Pilot Video M00 (103 s)", "F", "M00", "pilot video", "video/out/Track F/M00-intro-LJR7-v1.mp4", "video/scripts/M00-intro.json;video/src/index.tsx;video/render.mjs;video/out/Track F/M00-intro-LJR7-v1.srt")
add("Intro Pilot Video · Puppy Classroom", "R", "M00", "video", "video/out/Track F/M00-intro-PPP-v1.mp4", "video/scripts/M00-intro.json;video/src/index.tsx")
add("Video README (one command, RoseQuest checklist)", "All", "-", "guide", "video/README.md", "video/README.md")
add("Workbook (PDF)", "F", "All", "workbook", "workbook/WORKBOOK-LJR7-v1.pdf", "workbook/WORKBOOK-LJR7.md;build/workbook.py")
add("Ebook (EPUB, Kindle)", "F", "All", "ebook", "workbook/WORKBOOK-LJR7-v1.epub", "workbook/WORKBOOK-LJR7.md;workbook/WORKBOOK-LJR7-v1.docx")
add("Workbook · Puppy Classroom", "R", "All", "workbook", "workbook/WORKBOOK-PPP-v1.pdf", "workbook/WORKBOOK-PPP.md;build/workbook.py")
add("ClickFunnels Lesson Pack", "F", "All", "cf lesson pack", "cf-pack/lessons.csv", "cf-pack/lessons.json;cf-pack/lessons;build/cf_pack.py")
add("Reseller Guide", "R", "-", "guide", "reseller/README.md", "reseller/README.md")
add("QA Checker", "All", "-", "qa", "qa/check.py", "qa/check.py")
add("Scorecard", "All", "-", "qa", "qa/scorecard.csv", "qa/scorecard.csv;qa/module-checks.csv")
with open(os.path.join(ROOT, "INDEX.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["asset", "track", "module", "type", "final_file", "EDITABLE_LINK_OR_PATH", "status"]); w.writerows(R)
print(len(R), "rows")
