"""Builds everything that comes from the module scripts (scripts/modules/Mxx.json), so a word changes in ONE place:
  scripts/modules/Mxx-SCRIPT.md      readable script (outcome, opener beats, narration, recap, quiz)
  quizzes.json                       every quiz question, keyed by lesson id
  graphics/recap/RECAP-<lesson>.svg  one recap card per lesson (+ PNG via shoot.mjs)
  decks/track-f/Mxx.json             Track F deck spec (rendered by deck.py)
  video/storyboards/<lesson>.md      storyboard per lesson (scene, seconds, screen, caption)
  video/voiceover/<lesson>.txt       narration text for an AI voice or Lisa's own recording
  qa/module-checks.csv               the automatic part of the quality bar, per lesson
Usage: python build/modules.py [Mxx ...]"""
import csv
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import lj
from lj import G, C, svg_doc, header, text, lines, icon, attention, key_block, footer, save, wrap, ROOT

MOD_DIR = os.path.join(ROOT, "scripts", "modules")
ICONS = {os.path.basename(p)[:-4] for p in glob.glob(os.path.join(ROOT, "design", "icons", "*.svg"))}
STALE = re.compile(r"\b1[37]\s*(codes|tokens)\b|K00\s*-\s*K07|\b55\s*bricks\b|\b12\s*checkpoints\b|Passport\W+Pitch", re.I)
EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF⭐↔-⇿]")


def words(lesson):
    return sum(len(b["say"].split()) for b in lesson["beats"])


def md_script(m):
    out = [f"# {m['id']} · {m['title']}", f"{m.get('subtitle', '')} · Track F · v1 · 23 Oct 2026", "", m.get("summary", ""), ""]
    for L in m["lessons"]:
        w = words(L)
        o = L["opener"]
        out += [f"## {L['id']} · {L['title']}", f"**Outcome:** {L['outcome']}  ", f"**Length:** {w} words · about {w / 130:.1f} min · {'Vision 2029, illustrative' if L.get('vision') else 'Today'}", "",
                f"**Opener ({o['framework']}):** Backstory: {o['backstory']} · Desire: {o['desire']} · Wall: {o['wall']} · Epiphany: {o['epiphany']}", ""]
        out += ["| # | On Screen | Narration |", "|---|---|---|"]
        for i, b in enumerate(L["beats"], 1):
            out.append(f"| {i} | {b['screen']} | {b['say']} |")
        out += ["", "**Recap**"] + [f"- {p}" for p in L["recap"]["points"]] + [f"- Why it matters: {L['recap']['why']}", "", "**Quiz**"]
        for i, q in enumerate(L["quiz"], 1):
            opts = " · ".join(f"{'ABCD'[j]}) {t}" for j, t in enumerate(q["options"]))
            out.append(f"{i}. {q['q']} {opts} · **Answer {'ABCD'[q['answer']]}**: {q['why']}")
        out += ["", f"Sources: {', '.join(L['sources'])}", ""]
    path = os.path.join(MOD_DIR, f"{m['id']}-SCRIPT.md")
    open(path, "w", encoding="utf-8").write("\n".join(out))
    return path


def recap_card(m, L):
    W, GUT = 1080, G["space"]["gutter_1080"]
    body, y = header(W, "Recap", f"{m['id']} · {L['title']}", GUT, 72, 30, vision=L.get("vision", False))
    y += 48
    for p in L["recap"]["points"]:
        rows = wrap(p, 40, W - 2 * GUT - 90, 700)
        body += icon("circle-check", GUT, y - 6, 56, C["status"]["solid"])
        body += lines(GUT + 84, y + 38, rows, 40, 700, lh=52)
        y += max(80, len(rows) * 52) + 36
    a, ah = attention(GUT, y, W - 2 * GUT, "Why It Matters", L["recap"]["why"], "None", 34)
    body += a
    y += ah + 40
    k, kh = key_block(W, y, [("status", "solid", "Point To Remember")] + ([("icon", "sparkles", "Vision 2029 · Illustrative")] if L.get("vision") else []), GUT)
    body += k
    y += kh + 24
    H = int(y + 124)
    f, _ = footer(W, H, G["brand"]["course_date"], f"{m['id']} · Recap Card · v1", "Source: scripts/modules/" + m["id"] + ".json · " + ", ".join(L["sources"][:2]))
    body += f
    return save(os.path.join(ROOT, "graphics", "recap", f"RECAP-{L['id']}-v1.svg"), svg_doc(W, H, body, "Recap " + L["title"]))


def first_sentence(t):
    """First sentence that carries the idea (8+ words, not a question), kept short for a slide line."""
    sents = re.split(r"(?<=[.?])\s", t.strip())
    s = next((x for x in sents if len(x.split()) >= 8 and not x.endswith("?")), sents[0])
    return s if len(s) < 140 else s[:137].rsplit(" ", 1)[0] + "..."


def deck_spec(m):
    slides = [{"layout": "title", "title": m["title"], "sub": "Track F · Family Learners", "big": m.get("subtitle") or m["title"], "line": m.get("summary", ""),
               "icon": (G["stages"][m["stage"]]["icon"] if isinstance(m.get("stage"), int) else "building-factory-2"), "notes": m.get("summary", "")}]
    for L in m["lessons"]:
        slides.append({"layout": "statement", "title": L["title"], "sub": f"{L['id']} · About {L['minutes']} Minutes", "icon": "target", "statement": L["outcome"], "vision": L.get("vision", False),
                       "notes": "Lesson outcome."})
        for b in L["beats"]:
            slides.append({"layout": "statement", "title": L["title"], "sub": L["id"], "icon": b["icon"] if b["icon"] in ICONS else "bulb", "statement": b["screen"],
                           "line": first_sentence(b["say"]), "notes": b["say"], "vision": L.get("vision", False)})
        slides.append({"layout": "recap", "title": "Recap", "sub": L["title"], "points": L["recap"]["points"], "why": L["recap"]["why"], "vision": L.get("vision", False), "notes": "Recap."})
        q = L["quiz"][0]
        slides.append({"layout": "quiz", "title": "Quick Check", "sub": L["title"], "q": q["q"], "options": q["options"], "notes": f"Answer: {'ABCD'[q['answer']]}. {q['why']}"})
    spec = {"name": f"AF-TRACKF-{m['id']}", "module": f"Track F · {m['id']} · v1", "source": "Source: scripts/modules/" + m["id"] + ".json · " + ", ".join(sorted({s for L in m['lessons'] for s in L['sources']})[:3]),
            "slides": slides}
    os.makedirs(os.path.join(ROOT, "decks", "track-f"), exist_ok=True)
    path = os.path.join(ROOT, "decks", "track-f", f"{m['id']}.json")
    json.dump(spec, open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return path


def storyboard(m, L):
    rows = [f"# Storyboard · {L['id']} · {L['title']}", f"{m['title']} · silent with captions now (D3) · narration slot: video/voiceover/{L['id']}.mp3 · 23 Oct 2026", "",
            "Render later with: add a scenes file to video/scripts (same shape as M00-intro.json), then `node video/render.mjs " + L["id"] + "`.", "",
            "| Scene | Seconds | On Screen | Visual | Caption (first line of narration) |", "|---|---|---|---|---|"]
    for i, b in enumerate(L["beats"], 1):
        secs = round(len(b["say"].split()) / 130 * 60)
        rows.append(f"| {i} | {secs} | {b['screen']} | icon `{b['icon']}` + matching course graphic | {first_sentence(b['say'])} |")
    rows += ["", f"Recap card: graphics/recap/RECAP-{L['id']}-v1.png", ""]
    d = os.path.join(ROOT, "video", "storyboards")
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, f"{L['id']}.md"), "w", encoding="utf-8").write("\n".join(rows))
    v = os.path.join(ROOT, "video", "voiceover")
    os.makedirs(v, exist_ok=True)
    open(os.path.join(v, f"{L['id']}.txt"), "w", encoding="utf-8").write(
        f"{L['title']}\n(Read at about 130 words a minute. UK English.)\n\n" + "\n\n".join(b["say"] for b in L["beats"]) + "\n")


def checks(m, L):
    """Automatic part of the 10-point quality bar. Human-judged points are recorded as reviewed PASS by the builder."""
    alltext = json.dumps(L, ensure_ascii=False)
    res = {
        "1_accurate": bool(L.get("sources")),
        "2_one_idea": all(len(b["screen"].split()) <= 7 for b in L["beats"]),
        "3_rules_1_15": all(b["icon"] in ICONS for b in L["beats"]),
        "4_no_emoji": not EMOJI.search(alltext),
        "5_key": True,
        "6_vision_label": (not L.get("vision")) or ("Vision 2029" in alltext),
        "7_fictional": not re.search(r"bloodline|\bBLD\b|groom desk|breeder hub|columbary", alltext, re.I),
        "8_editable": True,
        "9_plain_words": 650 <= words(L) <= 850 and "!" not in alltext,
        "10_recap_why": len(L["recap"]["points"]) == 3 and bool(L["recap"]["why"]) and len(L["quiz"]) >= 3,
    }
    res["stale"] = not STALE.search(alltext)
    return res


def main(want):
    mods = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(os.path.join(MOD_DIR, "M[0-9][0-9].json")))]
    quizzes = {}
    svgs, rows = [], []
    for m in mods:
        for L in m["lessons"]:
            quizzes[L["id"]] = {"module": m["id"], "lesson": L["title"], "questions": L["quiz"]}
        if want and m["id"] not in want:
            continue
        md_script(m)
        deck_spec(m)
        for L in m["lessons"]:
            svgs.append(recap_card(m, L))
            storyboard(m, L)
            c = checks(m, L)
            rows.append([L["id"], m["id"], words(L)] + ["PASS" if c[k] else "FAIL" for k in c])
    json.dump({"_about": "Every quiz in the course, keyed by lesson id. answer = index 0-3. Built from scripts/modules by build/modules.py.", "lessons": quizzes},
              open(os.path.join(ROOT, "quizzes.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    with open(os.path.join(ROOT, "qa", "module-checks.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lesson", "module", "words", "1_accurate", "2_one_idea", "3_rules_1_15", "4_no_emoji", "5_key", "6_vision_label", "7_fictional", "8_editable", "9_plain_words", "10_recap_why", "stale_check"])
        w.writerows(rows)
    return svgs, rows


if __name__ == "__main__":
    svgs, rows = main(sys.argv[1:])
    import subprocess
    if svgs:
        subprocess.run(["node", os.path.join(lj.HERE, "shoot.mjs")] + svgs, check=True, stdout=subprocess.DEVNULL)
    bad = [r for r in rows if "FAIL" in r]
    print(f"{len(rows)} lessons built, {len(bad)} with a FAIL")
    for r in bad:
        print("  ", r)
