"""Writes the speaker script for a deck from its JSON (one source): scripts/<name>-SCRIPT.md"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for path in sys.argv[1:]:
    d = json.load(open(path, encoding="utf-8"))
    total = 0
    out = [f"# {d['name']} · Speaker Script", f"{d['module']} · Framework: {d.get('framework', '')} · 23 Oct 2026", "",
           "Read at about 130 words a minute. Beat names show which part of the framework each slide uses.", ""]
    for i, s in enumerate(d["slides"], 1):
        words = len(s.get("notes", "").split())
        total += words
        out += [f"## Slide {i} · {s['title'].replace('{brand_long}', 'Title')}", f"**Beat:** {s.get('beat', '')} · {words} words · about {words / 130 * 60:.0f} s", "", s.get("notes", ""), ""]
    out.insert(4, f"**Total:** {total} words · about {total / 130:.1f} min spoken (plus pauses and questions).")
    name = os.path.join(ROOT, "scripts", f"{d['name']}-SCRIPT.md")
    open(name, "w", encoding="utf-8").write("\n".join(out))
    print(name, total, "words")
