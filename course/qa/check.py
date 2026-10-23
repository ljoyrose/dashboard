"""QA checker for the App Factory course. Run:  python course/qa/check.py
Exits 0 only when every check passes. Each check prints PASS or FAIL with the reasons.
Checks (paste DONE test + Lisa's 23 Oct graphics rule):
  1 no emoji in any text, slide, script, caption or graphic source
  2 every hex used in a course asset is in glossary.json (tokens)
  3 every PNG graphic/slide has a footer date (its SVG source carries the course date)
  4 every forward-looking asset carries "Vision 2029"
  5 every INDEX.csv row has an EDITABLE_LINK_OR_PATH that exists
  6 scorecard.csv has no FAIL
  7 no stale counts from the old artefacts (13/17 codes, K07 as last kit, 55 bricks, 12 checkpoints, P-documents)
  8 INDEX.csv lists the required assets
"""
import csv
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = json.load(open(os.path.join(ROOT, "glossary.json"), encoding="utf-8"))
SKIP_DIRS = {"node_modules", ".git", "__pycache__", "out-tmp", ".iconcache"}
# Files that DISCUSS old values on purpose (the clash list, the proposal, questions, this checker).
META = {"CLASHES.md", "STAGE0-PROPOSAL.md", "QUESTIONS.md", "check.py", "README.md", "scorecard.csv", "glossary.json"}
TEXT_EXT = {".md", ".txt", ".srt", ".json", ".csv", ".html", ".svg", ".tsx", ".ts", ".mjs", ".js", ".py", ".css"}
results = []


def walk(exts=None):
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if exts is None or os.path.splitext(f)[1].lower() in exts:
                yield os.path.join(d, f)


def rel(p):
    return os.path.relpath(p, ROOT)


def read(p):
    return open(p, encoding="utf-8", errors="replace").read()


def pptx_text(p):
    out = []
    with zipfile.ZipFile(p) as z:
        for n in z.namelist():
            if n.startswith("ppt/slides/slide") and n.endswith(".xml"):
                out.append(re.sub(r"<[^>]+>", " ", z.read(n).decode("utf-8", "replace")))
    return " ".join(out)


def docx_text(p):
    with zipfile.ZipFile(p) as z:
        return re.sub(r"<[^>]+>", " ", z.read("word/document.xml").decode("utf-8", "replace"))


def all_texts(include_meta=False):
    for p in walk(TEXT_EXT | {".pptx", ".docx"}):
        if not include_meta and os.path.basename(p) in META:
            continue
        ext = os.path.splitext(p)[1].lower()
        try:
            if ext == ".pptx":
                yield p, pptx_text(p)
            elif ext == ".docx":
                yield p, docx_text(p)
            else:
                yield p, read(p)
        except Exception as e:  # unreadable file is itself a failure elsewhere
            yield p, ""


def check(name, fails):
    results.append((name, not fails, fails))


# 1 emoji
EMOJI = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF\u2B50\u2B06\u2194-\u21FF\uFE0F\u200D]")
fails = []
for p, t in all_texts(include_meta=True):
    m = EMOJI.search(t)
    if m:
        fails.append(f"{rel(p)}: {m.group(0)!r} (U+{ord(m.group(0)):04X})")
check("1 No emoji", fails)

# 2 hexes in tokens
allowed = set()


def collect(o):
    if isinstance(o, dict):
        for v in o.values():
            collect(v)
    elif isinstance(o, list):
        for v in o:
            collect(v)
    elif isinstance(o, str):
        for h in re.findall(r"#[0-9A-Fa-f]{6}\b", o):
            allowed.add(h.upper())


collect(G)
HEX = re.compile(r"#[0-9A-Fa-f]{6}\b")
fails = []
for p in walk({".svg", ".html", ".css", ".tsx", ".ts", ".py", ".mjs", ".js"}):
    if os.path.basename(p) in META or "sources" in rel(p):
        continue
    for h in set(x.upper() for x in HEX.findall(read(p))):
        if h not in allowed:
            fails.append(f"{rel(p)}: {h}")
check("2 Every hex is in glossary.json", fails)

# 3 footer date on every PNG (via its SVG or HTML source)
date = G["brand"]["course_date"]
fails = []
for p in walk({".png"}):
    r = rel(p)
    if r.startswith(("assets", "design")):
        continue
    base = os.path.splitext(p)[0]
    src = next((base + e for e in (".svg", ".html") if os.path.exists(base + e)), None)
    if not src:
        side = os.path.join(os.path.dirname(p), "SOURCE.txt")
        if os.path.exists(side) and date in read(side):
            continue
        fails.append(f"{r}: no SVG/HTML source beside it")
    elif date not in read(src):
        fails.append(f"{r}: footer date '{date}' missing in {rel(src)}")
check("3 Every PNG has a footer date", fails)

# 4 Vision 2029 label on forward-looking assets
fails = []
FWD = re.compile(r"(vision2029|vision-2029|dashboard-2029|automated-flow|app-detail|launch-operate|hero)", re.I)
for p in walk({".svg", ".html", ".tsx", ".md", ".json"}):
    r = rel(p)
    if FWD.search(r) and "Vision 2029" not in read(p) and os.path.basename(p) not in META and "node_modules" not in r:
        fails.append(r)
check("4 Vision 2029 label on forward-looking items", fails)

# 5 + 8 INDEX.csv
idx = os.path.join(ROOT, "INDEX.csv")
fails = []
rows = []
if not os.path.exists(idx):
    fails.append("INDEX.csv missing")
else:
    rows = list(csv.DictReader(open(idx, encoding="utf-8")))
    for r in rows:
        e = (r.get("EDITABLE_LINK_OR_PATH") or "").strip()
        if not e:
            fails.append(f"{r.get('asset')}: empty EDITABLE_LINK_OR_PATH")
        elif not e.startswith("http"):
            for part in e.split(";"):
                if not os.path.exists(os.path.join(ROOT, part.strip())):
                    fails.append(f"{r.get('asset')}: missing {part.strip()}")
check("5 INDEX.csv editable paths exist", fails)

need = {"proposal": 1, "design system": 1, "module script": 11, "dashboard mockup": 1, "sample app": 3,
        "keynote": 1, "pilot video": 1, "workbook": 1, "cf lesson pack": 1}
fails = []
for k, n in need.items():
    have = sum(1 for r in rows if (r.get("type") or "").strip().lower() == k)
    if have < n:
        fails.append(f"type '{k}': {have} of {n}")
check("8 INDEX.csv lists the required assets", fails)

# 6 scorecard
sc = os.path.join(ROOT, "qa", "scorecard.csv")
fails = []
if not os.path.exists(sc):
    fails.append("qa/scorecard.csv missing")
else:
    for r in csv.reader(open(sc, encoding="utf-8")):
        if any(c.strip().upper() == "FAIL" for c in r):
            fails.append(",".join(r[:3]))
check("6 Scorecard has no FAIL", fails)

# 7 stale counts from old artefacts (Lisa 23 Oct 03:04)
STALE = [
    (re.compile(r"\b1[37]\s*(tenancy\s*)?(codes|tokens|parts)\b", re.I), "13/17 codes"),
    (re.compile(r"\bK00\s*[-–to ]+\s*K07\b", re.I), "K07 as last kit"),
    (re.compile(r"\b55\s*bricks\b", re.I), "55 bricks"),
    (re.compile(r"\b17\s*bots\b", re.I), "17 Bots"),
    (re.compile(r"\b12\s*(checkpoints|gates)\b", re.I), "12 checkpoints"),
    (re.compile(r"\b(seven|7)\s*P[- ]?(documents|sections|docs)\b", re.I), "7 P-documents"),
    (re.compile(r"Passport\W+Pitch\W+Proposal", re.I), "P-documents list"),
]
fails = []
for p, t in all_texts():
    for rx, label in STALE:
        m = rx.search(t)
        if m:
            fails.append(f"{rel(p)}: {label} ('{m.group(0)}')")
check("7 No stale artefact counts", fails)

ok = True
for name, passed, fl in results:
    print(("PASS " if passed else "FAIL ") + name)
    for f in fl[:12]:
        print("     - " + f)
    if len(fl) > 12:
        print(f"     ... and {len(fl) - 12} more")
    ok = ok and passed
print("RESULT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
