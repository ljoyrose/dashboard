#!/usr/bin/env python3
import hashlib, os, re, subprocess, sys

NAME_SHA = "d84fe7e07bedb227cffff10009151d96fc944f6a1bd37cff60e8e4626a1eb1c3"
NAME_N = 4
ALLOW = {
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "COPYING",
    "tools/privacy-guard/allow.txt",
    "tools/prose-guard/patterns.txt",
}
PROSE_EXT = {".md", ".markdown", ".rst", ".txt"}
COMMENT_LIMIT = 60
TABLE_RE = re.compile(r"^\s*\|.+\|.+\|")
FICTION_RE = re.compile(r"^(7700900|11[3-8]4960|1[2-6]14960|2079460|1632960|3069990)")
SAFE_MAIL = re.compile(r"@example\.(?:com|net|org|test)$", re.I)
HERE = os.path.dirname(os.path.abspath(__file__))


def load_patterns():
    out = []
    path = os.path.join(HERE, "patterns.txt")
    for line in open(path, encoding="utf8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        kind, expr = line.split(" ", 1)
        out.append((kind, re.compile(expr)))
    return out


PATTERNS = load_patterns()


def has_name(text):
    t = text.lower()
    for i in range(0, max(0, len(t) - NAME_N + 1)):
        if hashlib.sha256(t[i:i + NAME_N].encode()).hexdigest() == NAME_SHA:
            return True
    return False


def is_title_line(line):
    return bool(re.match(r"\s*(?:test|it|describe)\(", line))


def is_fixture_path(path):
    p = path.replace("\\", "/")
    return "/fixtures/" in p or p.startswith("tests/fixtures/") or p.startswith("tests/budget-growth/")


def comment_chunks(line):
    s = line.lstrip()
    if s.startswith("//") or (s.startswith("#") and not s.startswith("#!")):
        return [s]
    if s.startswith("/*") or s.startswith("*") or s.startswith("<!--"):
        return [s]
    if " //" in line:
        return [line.split(" //", 1)[1]]
    return []


def mail_ok(addr):
    return bool(SAFE_MAIL.search(addr))


def phone_ok(national):
    digits = re.sub(r"\D", "", national)
    return bool(FICTION_RE.match(digits))


def scan_line(path, n, line, findings):
    if TABLE_RE.match(line) and not path.replace("\\", "/").startswith("tools/presend/"):
        findings.append("%s:%d: table" % (path, n))
    if has_name(line):
        findings.append("%s:%d: name" % (path, n))
    for chunk in comment_chunks(line):
        body = chunk.strip()
        if len(body) > COMMENT_LIMIT:
            findings.append("%s:%d: long comment" % (path, n))
        for kind, rx in PATTERNS:
            if kind == "date" and rx.search(body):
                findings.append("%s:%d: comment date" % (path, n))
            if kind == "word" and rx.search(body):
                findings.append("%s:%d: comment word" % (path, n))
    title = is_title_line(line)
    fixture = is_fixture_path(path)
    if title or fixture:
        for kind, rx in PATTERNS:
            if kind == "email":
                for m in rx.finditer(line):
                    if not mail_ok(m.group(0)):
                        findings.append("%s:%d: email" % (path, n))
            elif kind == "phone":
                for m in rx.finditer(line):
                    if not phone_ok(m.group(1)):
                        findings.append("%s:%d: phone" % (path, n))
            elif kind == "date" and rx.search(line):
                findings.append("%s:%d: dated text" % (path, n))
            elif kind == "word" and rx.search(line):
                findings.append("%s:%d: word" % (path, n))


def scan_text(path, text, findings):
    norm = path.replace("\\", "/")
    if norm in ALLOW:
        return
    ext = os.path.splitext(norm)[1].lower()
    if ext in PROSE_EXT:
        findings.append("%s: prose file" % norm)
        return
    for n, line in enumerate(text.splitlines(), 1):
        scan_line(norm, n, line, findings)


def added_lines(diff):
    files, cur = {}, None
    for line in diff.splitlines():
        if line.startswith("+++ "):
            cur = line[6:] if line.startswith("+++ b/") else None
            if cur == "/dev/null":
                cur = None
            if cur is not None:
                files.setdefault(cur, [])
        elif cur is not None and line.startswith("+") and not line.startswith("+++"):
            files[cur].append(line[1:])
    return files


def scan_body(body, findings):
    text = body or ""
    text = re.sub(r"<!--[\s\S]*?-->", "", text)
    text = re.sub(r"<[^>]*>", "", text)
    text = text.replace("&nbsp;", " ")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(lines) > 1:
        findings.append("pr body: more than one line")
    for ln in lines:
        if has_name(ln):
            findings.append("pr body: name")
        for kind, rx in PATTERNS:
            if kind in {"word", "email", "phone", "date"} and rx.search(ln):
                if kind == "email" and all(mail_ok(m.group(0)) for m in rx.finditer(ln)):
                    continue
                findings.append("pr body: %s" % kind)


def git_diff(range_expr):
    r = subprocess.run(["git", "diff", "-U0", "--no-color", range_expr], capture_output=True)
    if r.returncode:
        sys.stderr.write(r.stderr.decode("utf8", "replace"))
        sys.exit(2)
    return r.stdout.decode("utf8", "replace")


def main(argv):
    range_expr = None
    body = os.environ.get("PR_BODY", "")
    i = 0
    while i < len(argv):
        if argv[i] == "--range" and i + 1 < len(argv):
            range_expr = argv[i + 1]
            i += 2
            continue
        i += 1
    findings = []
    if range_expr:
        for path, lines in added_lines(git_diff(range_expr)).items():
            scan_text(path, "\n".join(lines), findings)
    if os.environ.get("CHECK_BODY", "1") != "0":
        scan_body(body, findings)
    if findings:
        print("\n".join(findings))
        return 1
    print("ok")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
