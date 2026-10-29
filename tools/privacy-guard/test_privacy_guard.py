"""Tests for privacy_guard.py. Fake data only, built at run time so this file passes its own guard:
fake terms (ZEBRA+QUILL, MOON+KETTLE), fake Drive ids (1FAKEFAKE...), fake numbers (07000-style, assembled below)."""
import os, re, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
GUARD = os.path.join(HERE, "privacy_guard.py")
T1, T2 = "ZEBRA" + "QUILL", "Moon" + "kettle"
FAKE = T1 + "\n" + T2
AT = "@"
BIZ = [l.split()[1] for l in open(os.path.join(HERE, "allow.txt"), encoding="utf8") if l.startswith("email ")][0]
FAKE_ID = "1" + "FAKE" * 8                       # 33 chars, Drive file id shape, marked made-up (not flagged)
ID_SHAPE = "1" + "aB3dE5" * 5 + "xy"              # 33 chars, unmarked: the guard must treat it as real
MOBILE = "0" + "7000 000000"
FICTION = "07700 900123"                          # Ofcom fiction range: allowed


def fails(p):
    """only the FAIL lines (the summary line names every rule, so it must not count)."""
    return "\n".join(l for l in (p.stdout + p.stderr).splitlines() if l.startswith("FAIL "))


def sh(cwd, *a):
    return subprocess.run(list(a), cwd=cwd, capture_output=True, text=True)


class Repo:
    def __init__(self):
        self.d = tempfile.mkdtemp()
        sh(self.d, "git", "init", "-q", "-b", "main")
        sh(self.d, "git", "config", "user.email", "1+bot" + AT + "users.noreply.github.com")
        sh(self.d, "git", "config", "user.name", "t")
        sh(self.d, "git", "config", "core.hooksPath", "/dev/null")
        self.write("README.md", "hello\n"); self.commit("init")

    def write(self, p, text):
        full = os.path.join(self.d, p); os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as fh: fh.write(text)
        sh(self.d, "git", "add", "-A")

    def commit(self, msg):
        sh(self.d, "git", "commit", "-q", "-m", msg)
        return self.head()

    def head(self):
        return sh(self.d, "git", "rev-parse", "HEAD").stdout.strip()

    def run(self, *args, deny=FAKE, env_extra=None):
        env = dict(os.environ); env.pop("PRIVACY_DENYLIST", None); env.pop("PRIVACY_DENYLIST_FILE", None)
        if deny is not None: env["PRIVACY_DENYLIST"] = deny
        env.update(env_extra or {})
        return subprocess.run([sys.executable, GUARD, *args], cwd=self.d, capture_output=True, text=True, env=env)


class T(unittest.TestCase):
    def setUp(self): self.r = Repo()

    # --- the 17 draft tests (same checks, fake data built at run time) ---
    def test_clean_passes(self):
        self.r.write("a.md", "nothing private\n"); self.assertEqual(self.r.run("--staged").returncode, 0)

    def test_term_in_content_blocked_any_case(self):
        self.r.write("a.md", f"about {T1.lower()} app\n"); p = self.r.run("--staged")
        self.assertEqual(p.returncode, 1); self.assertIn("DENY term #1", fails(p))

    def test_term_inside_longer_word_not_flagged(self):
        self.r.write("a.md", T1 + "S2x\n"); self.assertEqual(self.r.run("--staged").returncode, 0)

    def test_term_in_file_name_blocked_and_never_printed(self):
        self.r.write(f"x/{T2.upper()}-T01.txt", "hi\n"); p = self.r.run("--staged")
        self.assertEqual(p.returncode, 1); self.assertIn("[term#2]", p.stdout)
        self.assertNotIn(T2.upper(), p.stdout.upper().replace("[TERM#2]", ""))

    def test_output_never_echoes_term(self):
        self.r.write("a.md", T1 + " secret plan\n"); p = self.r.run("--staged")
        self.assertNotIn(T1, p.stdout.upper()); self.assertNotIn("secret plan", p.stdout)

    def test_email_blocked_example_test_allowed(self):
        self.r.write("a.md", "mail someone" + AT + "mail.example.org\n"); self.assertEqual(self.r.run("--staged").returncode, 1)
        r2 = Repo(); r2.write("a.md", "owner" + AT + "example.test\n"); self.assertEqual(r2.run("--staged").returncode, 0)

    def test_code_file_reference_is_not_an_email(self):
        self.r.write("a.csv", "Log out" + AT + "Dashboard.tsx" + AT + "the header\n"); self.assertEqual(self.r.run("--staged").returncode, 0)

    def test_plus_address_blocked(self):
        self.r.write("a.md", "send to box+links-zip" + AT + "mail.example.org\n"); self.assertIn("EMAIL", fails(self.r.run("--staged")))

    def test_allow_listed_email_only_in_its_file(self):
        self.r.write("config.js", f"owner: '{BIZ}'\n"); self.assertEqual(self.r.run("--staged").returncode, 0)
        r2 = Repo(); r2.write("docs/x.md", BIZ + "\n"); self.assertEqual(r2.run("--staged").returncode, 1)

    def test_drive_ids_blocked_outside_allow_list(self):
        self.r.write("docs/x.md", f"folder {ID_SHAPE}\n"); self.assertIn("DRIVE", fails(self.r.run("--staged")))
        r2 = Repo(); r2.write("docs/y.md", "shared 0A" + "B" * 17 + "\n"); self.assertIn("DRIVE", fails(r2.run("--staged")))
        r3 = Repo(); r3.write("docs/z.md", "doc 1" + "F" * 43 + "\n"); self.assertIn("DRIVE", fails(r3.run("--staged")))
        r4 = Repo(); r4.write("config.js", f"id: '{ID_SHAPE}'\n"); self.assertEqual(r4.run("--staged").returncode, 0)

    def test_blocked_paths(self):
        for p in ["tools/presend/regression/T1.txt", "tools/presend/sends/F2.txt", "tools/presend/runs/R.md",
                  "x/__pycache__/a.pyc", "docs/job.zip", "tools/presend/data/in.json", "a/.env", "x/my-denylist.txt"]:
            r = Repo(); r.write(p, "x\n"); self.assertIn("PATH", fails(r.run("--staged")), p)

    def test_fail_closed_without_denylist(self):
        self.r.write("a.md", "x\n"); self.assertEqual(self.r.run("--staged", deny=None).returncode, 2)

    def test_denylist_file_inside_repo_refused(self):
        self.r.write("dl.txt", T1 + "\n")
        p = self.r.run("--staged", deny=None, env_extra={"PRIVACY_DENYLIST_FILE": os.path.join(self.r.d, "dl.txt")})
        self.assertEqual(p.returncode, 2)

    def test_denylist_file_outside_repo_used(self):
        f = tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt"); f.write(T1 + "\n"); f.close()
        self.r.write("a.md", T1.lower() + "\n")
        p = self.r.run("--staged", deny=None, env_extra={"PRIVACY_DENYLIST_FILE": f.name}); self.assertEqual(p.returncode, 1)

    def test_range_catches_term_added_then_removed(self):
        base = self.r.head()
        self.r.write("t/a.md", T1 + " text\n"); self.r.commit("add")
        os.remove(os.path.join(self.r.d, "t/a.md")); sh(self.r.d, "git", "add", "-A"); self.r.commit("remove")
        p = self.r.run("--range", f"{base}..HEAD"); self.assertEqual(p.returncode, 1); self.assertIn("DENY", fails(p))

    def test_commit_message_and_author_checked(self):
        base = self.r.head()
        self.r.write("b.md", "ok\n"); self.r.commit("about " + T2)
        self.assertIn("commit message: DENY", fails(self.r.run("--range", f"{base}..HEAD")))
        sh(self.r.d, "git", "config", "user.email", "person" + AT + "mail.example.org")
        self.r.write("c.md", "ok\n"); self.r.commit("plain")
        self.assertIn("AUTHOR", fails(self.r.run("--range", f"{base}..HEAD")))

    def test_history_mode_scans_all_refs(self):
        sh(self.r.d, "git", "checkout", "-q", "-b", "side"); self.r.write("s.md", T1.lower() + "\n"); self.r.commit("s")
        sh(self.r.d, "git", "checkout", "-q", "main")
        self.assertEqual(self.r.run("--history").returncode, 1)

    # --- PHONE (+) ---
    def test_phone_mobile_landline_and_plus44_blocked(self):
        for n in [MOBILE, "0" + "7000000000", "+44 " + "7000 000000", "+44 (0)" + "20 0000 0000", "0" + "161 000 0000"]:
            r = Repo(); r.write("a.md", f"call {n} today\n"); self.assertIn("PHONE", fails(r.run("--staged")), n)

    def test_phone_fiction_range_allowed(self):
        self.r.write("a.md", f"call {FICTION} or 020 7946 0000\n"); self.assertEqual(self.r.run("--staged").returncode, 0)

    def test_phone_never_printed(self):
        self.r.write("a.md", f"call {MOBILE}\n"); p = self.r.run("--staged")
        self.assertNotIn(MOBILE, p.stdout); self.assertNotIn(MOBILE.replace(" ", ""), p.stdout)

    def test_phone_not_flagged_in_hashes_versions_or_long_numbers(self):
        self.r.write("a.md", "sha abc" + "0" + "7000000000def\nv1.0" + "7000000000\nid 4" + "07000000000123\nfee 0.50\n")
        self.assertEqual(self.r.run("--staged").returncode, 0)

    # --- Drive links (+) ---
    def test_drive_and_docs_links_blocked_outside_config(self):
        for host in ["docs", "drive"]:
            r = Repo(); r.write("x.html", f'<a href="https://{host}.google' + '.com/file/d/1abcdefghijklmnopqrstuvwxyz0/view">x</a>\n')
            self.assertIn("DRIVE", fails(r.run("--staged")), host)
        r1 = Repo(); r1.write("x.js", "u = 'https://drive.google" + ".com/drive/folders/' + id;\n"); self.assertEqual(r1.run("--staged").returncode, 0)
        r2 = Repo(); r2.write("config.js", "u: 'https://drive.google" + ".com/drive/folders/'\n"); self.assertEqual(r2.run("--staged").returncode, 0)

    def test_made_up_ids_marked_sample_or_fake_are_fine(self):
        self.r.write("t.js", "a = '1SAMPLE" + "0" * 26 + "'; b = '" + FAKE_ID + "x" * 11 + "'\n"); self.assertEqual(self.r.run("--staged").returncode, 0)
        r2 = Repo(); r2.write("t.js", "a = '1sample" + "0" * 26 + "'\n"); self.assertIn("DRIVE", fails(r2.run("--staged")))

    # --- report mode (+) ---
    def test_report_mode_counts_only_on_screen(self):
        self.r.write("docs/a.md", f"{T1} {MOBILE} someone" + AT + "mail.example.org\n")
        self.r.commit("x"); out = os.path.join(tempfile.mkdtemp(), "r.md")
        p = self.r.run("--tree", "HEAD", "--report", out)
        self.assertEqual(p.returncode, 0); self.assertIn("DENY=1", p.stdout); self.assertIn("PHONE=1", p.stdout)
        for leak in ["docs/a.md", T1, MOBILE, "example.org"]:
            self.assertNotIn(leak.upper(), p.stdout.upper())
        with open(out) as fh: body = fh.read()
        self.assertIn("docs/a.md:1", body); self.assertNotIn(T1, body.upper()); self.assertNotIn(MOBILE, body)

    def test_report_file_inside_repo_refused(self):
        self.assertEqual(self.r.run("--history", "--report", os.path.join(self.r.d, "r.md")).returncode, 2)

    def test_report_on_old_history_but_pr_range_ignores_it(self):
        self.r.write("old.md", T1 + "\n"); self.r.commit("old")
        os.remove(os.path.join(self.r.d, "old.md")); sh(self.r.d, "git", "add", "-A"); self.r.commit("rm")
        base = self.r.head(); self.r.write("new.md", "fine\n"); self.r.commit("new")
        out = os.path.join(tempfile.mkdtemp(), "h.md")
        self.assertIn("DENY=1", self.r.run("--history", "--report", out).stdout)
        self.assertEqual(self.r.run("--range", f"{base}..HEAD").returncode, 0)

    # --- allow list (+) ---
    def test_allow_list_small_and_business_only(self):
        lines = open(os.path.join(HERE, "allow.txt"), encoding="utf8").read().splitlines()
        self.assertLessEqual(len(lines), 10, "allow.txt must stay at 10 lines or fewer")
        emails = {l.split()[1].lower() for l in lines if l.startswith("email ")}
        self.assertLessEqual(len(emails), 1, "only the one business address may be allow-listed")
        consumer = r"@(gmail|googlemail|me|icloud|mac|hotmail|outlook|live|yahoo|aol|proton|protonmail)\."
        self.assertFalse([e for e in emails if re.search(consumer, e)], "no personal mail domains in allow.txt")
        self.assertEqual([l.split()[1] for l in lines if l.startswith("drive ")], ["config.js"])

    def test_allow_file_may_name_its_own_address_only(self):
        self.r.write("tools/privacy-guard/allow.txt", f"email {BIZ} config.js\n")
        self.assertEqual(self.r.run("--staged").returncode, 0)
        r2 = Repo(); r2.write("tools/privacy-guard/allow.txt", "email other" + AT + "mail.example.org config.js\n")
        self.assertIn("EMAIL", fails(r2.run("--staged")))

    # --- denylist handling (+) ---
    def test_denylist_comments_and_blanks_only_fail_closed(self):
        self.r.write("a.md", "x\n"); self.assertEqual(self.r.run("--staged", deny="# note\n\n   \n").returncode, 2)

    def test_merge_resolution_text_is_scanned(self):
        self.r.write("m.md", "a\n"); self.r.commit("m")
        sh(self.r.d, "git", "checkout", "-q", "-b", "b"); self.r.write("m.md", "b\n"); self.r.commit("b")
        sh(self.r.d, "git", "checkout", "-q", "main"); self.r.write("m.md", "c\n"); self.r.commit("c")
        base = self.r.head()
        sh(self.r.d, "git", "merge", "-q", "b"); self.r.write("m.md", T1 + "\n"); self.r.commit("merge")
        self.assertIn("DENY", fails(self.r.run("--range", f"{base}..HEAD")))

    # --- hooks (+) ---
    def _hooked(self):
        r = Repo(); sh(r.d, "git", "config", "core.hooksPath", os.path.join(REPO, ".githooks"))
        os.makedirs(os.path.join(r.d, "tools"), exist_ok=True)
        shutil.copytree(HERE, os.path.join(r.d, "tools", "privacy-guard"), ignore=shutil.ignore_patterns("__pycache__", "test_*"))
        open(os.path.join(r.d, ".git", "info", "exclude"), "a").write("tools/\n")
        return r

    def _env(self):
        env = dict(os.environ); env.pop("PRIVACY_DENYLIST_FILE", None); env["PRIVACY_DENYLIST"] = FAKE; return env

    def test_pre_commit_hook_refuses_fake_term(self):
        r = self._hooked(); r.write("a.md", T1 + "\n")
        p = subprocess.run(["git", "commit", "-q", "-m", "x"], cwd=r.d, capture_output=True, text=True, env=self._env())
        self.assertNotEqual(p.returncode, 0); self.assertIn("DENY", fails(p) + p.stderr)

    def test_pre_push_hook_refuses_added_then_removed(self):
        r = self._hooked(); remote = tempfile.mkdtemp(); sh(remote, "git", "init", "-q", "--bare")
        sh(r.d, "git", "remote", "add", "origin", remote); sh(r.d, "git", "push", "-q", "origin", "main")
        f = os.path.join(r.d, "a.md"); open(f, "w").write(T1 + "\n"); sh(r.d, "git", "add", "-A")
        sh(r.d, "git", "commit", "-q", "--no-verify", "-m", "add"); os.remove(f); sh(r.d, "git", "add", "-A")
        sh(r.d, "git", "commit", "-q", "--no-verify", "-m", "rm")
        p = subprocess.run(["git", "push", "origin", "main"], cwd=r.d, capture_output=True, text=True, env=self._env())
        self.assertNotEqual(p.returncode, 0); self.assertIn("DENY", fails(p) + p.stderr)

    # --- the workflow (+) ---
    def test_workflow_masks_terms_fails_closed_and_is_pinned(self):
        with open(os.path.join(REPO, ".github", "workflows", "privacy-guard.yml"), encoding="utf8") as fh: wf = fh.read()
        self.assertRegex(wf, r"(?m)^\s*name: Privacy guard \(public repo\)\s*$")
        self.assertIn("::add-mask::", wf)
        self.assertIn("secret missing: failing closed", wf)
        self.assertIn("--report", wf)
        self.assertRegex(wf, r"(?m)^permissions:\n  contents: read")
        loose = [u for u in re.findall(r"uses:\s*([^\s#]+)", wf) if not re.search(r"@[0-9a-f]{40}$", u)]
        self.assertEqual(loose, [], "every action pinned to a full commit id")
        self.assertNotRegex(wf, r"upload-artifact", "report-only runs upload nothing")

    def test_no_fake_term_literal_in_repo_files(self):
        hits = subprocess.run(["git", "grep", "-l", "-i", "-e", T1, "-e", T2], cwd=REPO, capture_output=True, text=True).stdout.split()
        self.assertEqual(hits, [], "fake terms are only built at run time inside this test")


if __name__ == "__main__":
    unittest.main(verbosity=1)
