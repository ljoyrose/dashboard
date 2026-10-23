"""Writes SYLLABUS.md (course map for both tracks) from scripts/modules and decks/keynote.json."""
import glob, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mods = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(os.path.join(ROOT, "scripts", "modules", "M[0-9][0-9].json")))]
k = json.load(open(os.path.join(ROOT, "decks", "keynote.json"), encoding="utf-8"))
tot_w = sum(len(b["say"].split()) for m in mods for L in m["lessons"] for b in L["beats"])
out = ["# App Factory Course · Syllabus (v1, 23 Oct 2026)", "One master course, three cuts. Built from scripts/modules/*.json, so this page never drifts from the scripts.", "",
       f"## Track F · Family Learners · {len(mods)} Modules · {sum(len(m['lessons']) for m in mods)} Lessons · about {tot_w / 130 / 60:.1f} Hours", "",
       "| Module | Lesson | Outcome | Min |", "|---|---|---|---|"]
for m in mods:
    for i, L in enumerate(m["lessons"]):
        out.append(f"| {m['id'] + ' · ' + m['title'] if i == 0 else ''} | {L['id']} · {L['title']} | {L['outcome']} | {L['minutes']} |")
out += ["", "Every lesson: outcome, Epiphany Bridge opener (light), 7-9 one-idea beats, recap card with Why It Matters, 4-question quiz (quizzes.json), storyboard and voice-over text.", "",
        f"## Track B · Business Keynote · {len(k['slides'])} Slides · about 22 Minutes (Perfect Webinar)", ""]
out += [f"{i}. {s['title'].replace('{brand_long}', 'Title')} · {s.get('beat', '')}" for i, s in enumerate(k["slides"], 1)]
out += ["", "Also: partner webinar cut (10 slides), partner email (Epiphany Bridge). See scripts/FRAMEWORK-MAP.md.", "",
        "## Reseller Version", "Same course and decks with a brand jacket (tokens only): LJR7 · Puppy Classroom (worked example, join link /join/ppp, never on a Free plan) · Your Brand Here. See reseller/README.md.", "",
        "## Platforms (one source, many cuts)", "- ClickFunnels course: cf-pack/ (per lesson: title, body, video slot, download, quiz)", "- Udemy: same lessons as lectures; needs voice before review (see STAGE0-PROPOSAL.md section 3)",
        "- Kindle ebook: workbook/ (EPUB and DOCX)", "- Slides: slides/ (PPTX + PDF; drag the PPTX into Canva to edit there)"]
open(os.path.join(ROOT, "SYLLABUS.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("SYLLABUS.md", tot_w, "words")
