#!/usr/bin/env python3
"""privacy_guard.py - stop private material reaching this PUBLIC repo.

Checks (each FAIL names file:line and a rule id, never the matched private text):
  DENY   a term from the private denylist (in content, file paths or commit messages)
  EMAIL  an email address not on the allow list
  DRIVE  a Google Drive / Docs / shared-drive id, or a docs.google.com / drive.google.com link
         holding an id, outside allow-listed paths (made-up ids containing SAMPLE or FAKE are fine)
  PHONE  a UK phone number (07..., 01..., 02..., 03..., +44 ...), except Ofcom's fiction ranges
  PATH   a path that must never be committed (data, sends, runs, regression sets, .pyc, zips)
  AUTHOR a commit author/committer email that is not a GitHub/bot noreply address

The denylist is NEVER in the repo. It is read from env PRIVACY_DENYLIST (GitHub secret,
one term per line) or from the file named by env PRIVACY_DENYLIST_FILE, which must be
outside the repo. No denylist -> exit 2 (fail closed).

Modes:
  --staged               the staged diff (pre-commit hook)
  --range A..B           every commit in the range, one by one (pre-push hook, CI)
  --tree [REF]           every file in REF (default HEAD)
  --history              every commit reachable from any ref
Option (any mode, last two arguments):
  --report OUT.md        REPORT-ONLY: write rule counts + locations to OUT.md (must be outside
                         the repo), print counts only, exit 0 even with findings.
Exit 0 clean, 1 findings, 2 setup error (no denylist, bad args, report path inside the repo).
"""
import fnmatch, os, re, subprocess, sys

RULES = ("DENY", "EMAIL", "DRIVE", "PHONE", "PATH", "AUTHOR")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
DRIVE_RES = [
    re.compile(r"(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{32}(?![A-Za-z0-9_-])"),   # file / folder id
    re.compile(r"(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])"),   # Docs / Sheets id
    re.compile(r"(?<![A-Za-z0-9_-])0A[A-Za-z0-9_-]{17}(?![A-Za-z0-9_-])"),  # shared drive id
    re.compile(r"(?i)\b(?:docs|drive)\.google\.com/[^\s'\"<>`]*?[A-Za-z0-9_-]{25,}"),  # Docs / Drive link with an id
]
# Made-up ids in tests and samples say so (1SAMPLE..., 1FAKEFAKE...): not flagged.
FIXTURE_ID = re.compile(r"SAMPLE|FAKE")
# UK numbers: 0 or +44, then 10 national digits starting 1, 2, 3 or 7; spaces, dashes, (0) allowed.
PHONE_RE = re.compile(r"(?<![\w+.])(\+44[\s-]?(?:\(0\)[\s-]?)?|0)([1237](?:[\s-]?\d){9})(?![\w.])")
# Ofcom's ranges reserved for fiction (07700 900xxx, 020 7946 0xxx, 0113 496 0xxx ...): safe for tests and samples.
FICTION_RE = re.compile(r"^(7700900|11[3-8]4960|1[2-6]14960|2079460|1632960|3069990)")
BLOCKED_PATHS = ["*/data/*", "data/*", "*/sends/*", "*/runs/*", "*/outbox/*", "*/regression/*",
                 "*PROMPT-REGRESSION-SET*", "*PROMPT-LESSONS*.csv", "*.pyc", "*/__pycache__/*",
                 "*.zip", "*.env", "*INPUTS-*.json", "*denylist*"]
OK_AUTHOR = re.compile(r"(@users\.noreply\.github\.com|^noreply@github\.com|^noreply@anthropic\.com|^cursoragent@cursor\.com|\[bot\]@users\.noreply\.github\.com)$")
HERE = os.path.dirname(os.path.abspath(__file__))
ALLOW_FILE = "tools/privacy-guard/allow.txt"


def git(*args, check=True):
    """Run a git command and return its output; on failure with check=True, print the error and exit 2."""
    r = subprocess.run(["git", *args], capture_output=True)
    if check and r.returncode:
        sys.stderr.write(r.stderr.decode("utf8", "replace"))
        sys.exit(2)
    return r.stdout.decode("utf8", "replace")


def repo_root():
    """Return the real path of the top folder of the current git repo."""
    return os.path.realpath(git("rev-parse", "--show-toplevel").strip())


def inside_repo(p):
    """Return True when the given path is the repo root or inside it."""
    root = repo_root()
    real = os.path.realpath(p)
    return real == root or real.startswith(root + os.sep)


def load_denylist():
    """Load denylist terms from the env var or env-named file and return them as case-insensitive regexes; exit 2 if none."""
    raw = os.environ.get("PRIVACY_DENYLIST", "")
    f = os.environ.get("PRIVACY_DENYLIST_FILE", "")
    if f:
        if inside_repo(f):
            print("SETUP: PRIVACY_DENYLIST_FILE is inside the repo. It must live outside it (Drive copy only).")
            sys.exit(2)
        raw += "\n" + open(os.path.realpath(f), encoding="utf8").read()
    terms = [t.strip() for t in raw.splitlines() if t.strip() and not t.strip().startswith("#")]
    if not terms:
        print("SETUP: no denylist (PRIVACY_DENYLIST secret or PRIVACY_DENYLIST_FILE). Failing closed.")
        sys.exit(2)
    return [re.compile(r"(?<![A-Za-z0-9])" + re.escape(t) + r"(?![A-Za-z0-9])", re.I) for t in terms]


def load_allow():
    """allow.txt beside this script: 'email <addr> <path-glob>' or 'drive <path-glob>' or 'path <glob>'."""
    allow = {"email": [], "drive": [], "path": []}
    p = os.path.join(HERE, "allow.txt")
    if os.path.exists(p):
        for line in open(p, encoding="utf8"):
            parts = line.split()
            if not parts or parts[0].startswith("#"):
                continue
            if parts[0] == "email" and len(parts) == 3:
                allow["email"].append((parts[1].lower(), parts[2]))
            elif parts[0] in ("drive", "path") and len(parts) == 2:
                allow[parts[0]].append(parts[1])
    return allow


def email_ok(addr, path, allow):
    """Return True when an email-like match is a file reference, a safe or noreply address, or on the allow list."""
    a = addr.lower()
    if re.search(r"\.(tsx?|jsx?|mjs|py|md|html?|css|json|csv|ya?ml|svg|png)$", a):
        return True  # 'name@File.tsx' style references, not mail
    if a.endswith("@example.test") or a.endswith("@example.com") or OK_AUTHOR.search(a):
        return True
    if path == ALLOW_FILE and any(a == e for e, _ in allow["email"]):
        return True  # the allow list names its own addresses
    return any(a == e and fnmatch.fnmatch(path, g) for e, g in allow["email"])


def redact(path, deny):
    """file names can hold a private term too: never print it."""
    for i, rx in enumerate(deny, 1):
        path = rx.sub(f"[term#{i}]", path)
    return path


def scan_text(path, text, deny, allow, where, out):
    """Scan one file's text and name for denylist terms, emails, Drive ids and phone numbers; append findings to out."""
    shown = redact(path, deny)
    if any(fnmatch.fnmatch(path, g) for g in allow["path"]):
        return
    for i, rx in enumerate(deny, 1):
        if rx.search(path):
            out.append(("DENY", f"{where}{shown}: DENY term #{i} in the file name"))
    drive_ok = any(fnmatch.fnmatch(path, g) for g in allow["drive"])
    for n, line in enumerate(text.splitlines(), 1):
        for i, rx in enumerate(deny, 1):
            if rx.search(line):
                out.append(("DENY", f"{where}{shown}:{n}: DENY term #{i}"))
        for m in EMAIL_RE.finditer(line):
            if not email_ok(m.group(0), path, allow):
                out.append(("EMAIL", f"{where}{shown}:{n}: EMAIL address not on the allow list"))
        if not drive_ok and any(not FIXTURE_ID.search(m.group(0)) for rx in DRIVE_RES for m in rx.finditer(line)):
            out.append(("DRIVE", f"{where}{shown}:{n}: DRIVE id or link outside allow-listed files"))
        if any(not FICTION_RE.match(re.sub(r"\D", "", m.group(2))) for m in PHONE_RE.finditer(line)):
            out.append(("PHONE", f"{where}{shown}:{n}: PHONE number"))


def scan_path(path, where, allow, out, deny=()):
    """Append a PATH finding when the path matches a blocked pattern and is not allow-listed."""
    if any(fnmatch.fnmatch(path, g) for g in allow["path"]):
        return
    if any(fnmatch.fnmatch(path, g) for g in BLOCKED_PATHS):
        out.append(("PATH", f"{where}{redact(path, deny)}: PATH never committed in this public repo (keep it on Drive)"))


def added_lines(diff):
    """yield (path, added_text) per file from a unified diff."""
    files, cur = {}, None
    for line in diff.splitlines():
        if line.startswith("+++ "):
            cur = line[6:] if line.startswith("+++ b/") else None
            if cur is not None:
                files.setdefault(cur, [])
        elif cur is not None and line.startswith("+") and not line.startswith("+++"):
            files[cur].append(line[1:])
    return {p: "\n".join(v) for p, v in files.items()}


def scan_commit(sha, deny, allow, out):
    """Scan one commit: author emails, message, changed paths and added lines; append findings to out."""
    where = f"{sha[:7]} "
    meta = git("show", "-s", "--format=%ae%n%ce%n%B", sha)
    ae, ce, msg = (meta.split("\n", 2) + ["", ""])[:3]
    for e in (ae, ce):
        if e and not OK_AUTHOR.search(e.lower()):
            out.append(("AUTHOR", f"{where}AUTHOR email is not a noreply address (turn on GitHub 'Keep my email private')"))
    for i, rx in enumerate(deny, 1):
        if rx.search(msg):
            out.append(("DENY", f"{where}commit message: DENY term #{i}"))
    for p in git("diff-tree", "--no-commit-id", "--name-only", "-r", "--root", "--diff-filter=AMR", sha).split("\n"):
        if p:
            scan_path(p, where, allow, out, deny)
    for p, text in added_lines(git("show", "--format=", "--unified=0", "--no-color", "--text", "--remerge-diff", sha)).items():
        scan_text(p, text, deny, allow, where, out)


def summary(found):
    """Return a one-line count of findings per rule."""
    counts = {r: 0 for r in RULES}
    for rule, _ in found:
        counts[rule] += 1
    return " ".join(f"{r}={counts[r]}" for r in RULES)


def main(argv):
    """Command-line entry point: run the chosen scan mode and return the exit code."""
    args = list(argv[1:])
    report = None
    if len(args) >= 2 and args[-2] == "--report":
        report = args[-1]
        args = args[:-2]
        if inside_repo(report):
            print("SETUP: --report file is inside the repo. Write it outside (it holds locations).")
            return 2
    if not args or args[0] not in ("--staged", "--range", "--tree", "--history"):
        print(__doc__)
        return 2
    deny, allow, out = load_denylist(), load_allow(), []
    mode = args[0]
    if mode == "--staged":
        for p in git("diff", "--cached", "--name-only", "--diff-filter=AMR").split("\n"):
            if p:
                scan_path(p, "staged ", allow, out, deny)
        for p, text in added_lines(git("diff", "--cached", "--unified=0", "--no-color", "--text")).items():
            scan_text(p, text, deny, allow, "staged ", out)
    elif mode == "--range":
        if len(args) < 2:
            return 2
        for sha in git("rev-list", "--reverse", *args[1].split()).split():
            scan_commit(sha, deny, allow, out)
    elif mode == "--tree":
        ref = args[1] if len(args) > 1 else "HEAD"
        for p in git("ls-tree", "-r", "--name-only", ref).splitlines():
            scan_path(p, f"{ref} ", allow, out, deny)
            blob = subprocess.run(["git", "show", f"{ref}:{p}"], capture_output=True).stdout
            if b"\0" not in blob[:8000]:
                scan_text(p, blob.decode("utf8", "replace"), deny, allow, f"{ref} ", out)
    else:
        for sha in git("rev-list", "--all").split():
            scan_commit(sha, deny, allow, out)
    found = sorted(set(out))
    counts = summary(found)
    if report:
        with open(report, "w", encoding="utf8") as fh:
            fh.write(f"# privacy-guard report ({mode})\n\nCounts: {counts}\n\nLocations (no values):\n\n")
            fh.writelines(f"- {text}\n" for _, text in found)
        print(f"privacy-guard REPORT-ONLY ({mode}): {len(found)} finding(s): {counts}")
        return 0
    for _, text in found:
        print("FAIL " + text)
    print(f"privacy-guard: {'CLEAN' if not found else str(len(found)) + ' finding(s)'} ({mode}) {counts}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
