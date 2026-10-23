"""ClickFunnels-ready lesson pack, built from scripts/modules (one source). Per lesson: title, body text, video slot,
download, quiz. The video slot stores ONLY provider + video id + type (v or f), keyed by lesson id, never a URL or
embed code (RR_KNOWLEDGE_ROSEQUEST.md); ids are TO CONFIRM until the videos are uploaded to RoseQuest.
Outputs: cf-pack/lessons.json, cf-pack/lessons.csv (copy-paste), cf-pack/lessons/<id>.md
Note: ClickFunnels courses do NOT inherit the site Theme; set the course Style explicitly (ClickFunnels-Platform-Reference.md)."""
import csv, glob, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = json.load(open(os.path.join(ROOT, "glossary.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "cf-pack")
os.makedirs(os.path.join(OUT, "lessons"), exist_ok=True)
mods = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(os.path.join(ROOT, "scripts", "modules", "M[0-9][0-9].json")))]
lessons, rows = [], []
for mi, m in enumerate(mods, 1):
    for li, L in enumerate(m["lessons"], 1):
        body = "\n\n".join(b["say"] for b in L["beats"])
        rec = {"course": G["brand"]["course_title"], "module_order": mi, "module": f"{m['id']} · {m['title']}", "lesson_order": li, "lesson_id": L["id"], "title": L["title"],
               "outcome": L["outcome"], "body": body, "minutes": L["minutes"],
               "video_slot": {"provider": "rosequest", "video_id": "TO CONFIRM", "type": "v", "key": L["id"], "file_ready": f"video/out/Track F/{L['id']}-LJR7-v1.mp4 (render from video/storyboards/{L['id']}.md)"},
               "downloads": [f"graphics/recap/RECAP-{L['id']}-v1.png", "workbook/WORKBOOK-LJR7-v1.pdf"],
               "recap": L["recap"], "quiz": L["quiz"], "vision": L.get("vision", False)}
        if L["id"] == "M00-L1":
            rec["video_slot"]["file_ready"] = "video/out/Track F/M00-intro-LJR7-v1.mp4 (pilot, 103 s)"
        lessons.append(rec)
        md = [f"# {L['title']}", f"{m['id']} · {m['title']} · Lesson {li} · about {L['minutes']} min · {G['brand']['course_date']}", "",
              f"**Video slot:** provider `rosequest` · id `TO CONFIRM` · type `v` · key `{L['id']}`", "", f"**You can:** {L['outcome']}", ""]
        if L.get("vision"):
            md += [f"*{G['brand']['vision_label']}*", ""]
        md += [body, "", "## Recap"] + [f"- {p}" for p in L["recap"]["points"]] + [f"- **Why It Matters:** {L['recap']['why']}", "", "## Quiz"]
        for i, q in enumerate(L["quiz"], 1):
            md += [f"{i}. {q['q']}"] + [f"   - {'ABCD'[j]}) {o}" for j, o in enumerate(q["options"])] + [f"   - Answer: {'ABCD'[q['answer']]}. {q['why']}"]
        md += ["", "## Downloads"] + [f"- {d}" for d in rec["downloads"]]
        open(os.path.join(OUT, "lessons", f"{L['id']}.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
        rows.append([mi, m["title"], li, L["id"], L["title"], L["outcome"], "rosequest", "TO CONFIRM", "v", "; ".join(rec["downloads"]), len(L["quiz"])])
json.dump({"_about": "ClickFunnels lesson pack. Video slots hold provider + id + type only. Set the course Style explicitly in ClickFunnels (courses do not inherit the Theme).", "lessons": lessons},
          open(os.path.join(OUT, "lessons.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
with open(os.path.join(OUT, "lessons.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["module_order", "module", "lesson_order", "lesson_id", "title", "outcome", "video_provider", "video_id", "video_type", "downloads", "quiz_questions"])
    w.writerows(rows)
print(len(lessons), "lessons")
