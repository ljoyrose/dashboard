#!/usr/bin/env python3
"""Mocked tests for prompt-lint.py and inputs-gate.py. Stdlib only, no network, no real data.

Every test builds its own invented data (app alias APP-A, ids like OB-X01, terms like ZQX1) in a fresh
temp folder outside the repo, points the checker at it and restores the checker afterwards.
Run from the repo root:  python3 -m unittest tools/presend/test_presend.py -v
"""
import contextlib, csv, hashlib, importlib.util, io, json, os, re, shutil, subprocess, sys, tempfile, unittest
from datetime import datetime, timezone
from unittest import mock

sys.dont_write_bytecode = True  # never leave __pycache__ beside the tools
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.realpath(os.path.join(HERE, '..', '..'))
LINT = os.path.join(HERE, 'prompt-lint.py')
GATE = os.path.join(HERE, 'inputs-gate.py')


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


PL = load('prompt_lint_under_test', LINT)
IG = load('inputs_gate_under_test', GATE)

NOW = datetime(2030, 1, 1, 10, 0, tzinfo=timezone.utc)  # 10:00 UK (GMT in January)

GOOD = """Standing rules apply. APP-A build.
Code described below was read live on 1 January 2030 at 09:00 UK time.
SCOPE OF READING: the only existing files in scope are the two files this prompt may change: src/pages/Home.tsx and src/lib/store.ts. READ ONLY: src/lib/auth.ts.
Known and out of scope, do not change or report: brand names, logos and colours shown in the header; plans and checkout.
THE WORK. Three numbered items.
1. In src/pages/Home.tsx, make one Enter save the note once. Look at src/lib/auth.ts READ ONLY. Make the Sign out button on the Home page clear the note. Do not edit any other sign-out or log-out button.
2. In src/lib/store.ts, add one function that clears the saved note.
3. Re-read all two changed files after all edits and confirm each change with file and line.
Create no table, column or endpoint. Change no file other than src/pages/Home.tsx and src/lib/store.ts. Add no test page.
END OF PROMPT
"""
PIN = ' Do not edit any other sign-out or log-out button.'
FENCE = 'Change no file other than src/pages/Home.tsx and src/lib/store.ts.'
CONTROLS = 'Log out@Header.tsx@the header@sign[- ]?out|log[- ]?out;Sign out@Home.tsx@the Home page@sign[- ]?out|log[- ]?out'
APP = {'ui_controls': CONTROLS}

LESSON_COLS = ['id', 'status', 'check', 'kind', 'pattern', 'trigger', 'severity', 'what_went_wrong', 'fix', 'control']
APP_COLS = ['app_id', 'key', 'name', 'match', 'inputs_file', 'ledger_file', 'ledger_section', 'roles_section',
            'snags_file', 'roadmap_file', 'clickup_tag', 'clickup_workspace', 'ui_controls', 'notes']


def lesson(id_, kind, pattern, trigger='', severity='FAIL', check='', control='', status='CHECK'):
    return {'id': id_, 'status': status, 'check': check, 'kind': kind, 'pattern': pattern, 'trigger': trigger,
            'severity': severity, 'what_went_wrong': 'invented ' + id_, 'fix': 'invented fix', 'control': control}


LESSONS = [lesson('L01', 'absent', r'\bZQX-BANNED\b', control='ZQX-BANNED'),
           lesson('L02', 'present_if', 'END OF PROMPT', trigger='THE WORK', control='THE WORK. 1. x'),
           lesson('L03', 'max_chars', '100000', severity='WARN')]

LEDGER = """# APP-A document (invented)
### 3.7 Obligations ledger
| Id | Type | Owner | Due | Status | Obligation | Note |
|---|---|---|---|---|---|---|
| OB-X01 | PROMPT | CLAUDE | each prompt | RULE | A rule every prompt carries. | - |
| OB-X02 | DATA | OWNER | P1 | OPEN | Data keyed in before P1. | - |
| OB-X03 | DATA | OWNER | P2 session | WAITING | Data asked for before P2. | - |
| OB-X04 | PROMPT | CLAUDE | later | OPEN | Not due at any send here. | - |
## 4.0 Tables
| Table | Purpose | Role gate |
|---|---|---|
| notes | invented notes | owner |
| tenants | invented tenants |  |
"""
SNAGS = """# APP-A snags (invented)
### 1. Home page (Home.tsx, store.ts)
| Id | Snag | Fix | Where | Status | Cheap |
|---|---|---|---|---|---|
| A1 | **Enter saves twice** | guard the key | Home | open | yes |
| A2 | Platform limit | none | Home | platform gap | no |
| A3 | Already folded | x | Home | in P1 | yes |
### 2. Other page (Other.tsx)
| B1 | Other file only | x | Other | open | no |
"""
ROADMAP = """| Id | What | Where |
|---|---|---|
| L1 | Note export | src/pages/Home.tsx |
| R2 | Unrelated | src/pages/Zed.tsx |
"""
INPUTS = {'app': 'A0001 APP-A', 'checked_at': '2030-01-01T09:30:00Z', 'app_updated_at': '2029-12-30T10:00:00Z',
          'brief_file_mtime': '2029-12-30T09:00:00Z', 'export_zip_at': '2029-12-31T10:00:00Z',
          'custom_instructions_read_at': '2029-12-31T11:00:00Z', 'project_brief_read_at': '2029-12-31T11:00:00Z',
          'chat_log_last_turn_at': '2029-12-01T00:00:00Z', 'simulated_at': '2030-01-01T09:00:00Z',
          'prompt_file': 'APP-A-P1-v2.txt'}
META = {'app': 'app-a', 'send_id': 'P9', 'clickup_task_id': 'task-x01',
        'clickup_pulled_at': '2030-01-01T08:00:00Z', 'register_read_at': '2030-01-01T08:30:00Z',
        'credit_estimate': [3300, 5900], 'ledger_stop': 8850, 'fold_in_decided': ['A1', 'A3', 'L1'],
        'dashboard_lines': ['APP-A P1 ready to send (invented)']}


def quiet(fn, *a, **k):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        r = fn(*a, **k)
    return r, buf.getvalue()


class Base(unittest.TestCase):
    """A fresh invented data folder per test; the checker's DATA and the PRESEND_DATA env are restored after."""

    def setUp(self):
        self.d = os.path.realpath(tempfile.mkdtemp(prefix='presend-test-'))
        self.assertFalse(self.d == ROOT or self.d.startswith(ROOT + os.sep), 'temp folder must be outside the repo')
        self.addCleanup(shutil.rmtree, self.d, True)
        keep_data, keep_env = PL.DATA, os.environ.get('PRESEND_DATA')

        def restore():
            PL.DATA = keep_data
            if keep_env is None: os.environ.pop('PRESEND_DATA', None)
            else: os.environ['PRESEND_DATA'] = keep_env
        self.addCleanup(restore)
        PL.DATA = self.d

    def w(self, rel, text):
        p = os.path.join(self.d, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf8') as f: f.write(text)
        return p

    def wcsv(self, rel, cols, rows):
        p = os.path.join(self.d, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf8', newline='') as f:
            wr = csv.DictWriter(f, fieldnames=cols); wr.writeheader(); wr.writerows(rows)
        return p

    def lessons(self, rows=LESSONS, name='PROMPT-LESSONS.csv'):
        return self.wcsv(name, LESSON_COLS, rows)

    def apps(self, **over):
        row = {'app_id': 'A0001', 'key': 'app-a', 'name': 'APP-A', 'match': r'\bAPP-A\b',
               'inputs_file': 'data/INPUTS-A.json', 'ledger_file': 'data/DOC-A.md', 'ledger_section': '3.7',
               'roles_section': '4.0', 'snags_file': 'data/SNAGS-A.md', 'roadmap_file': 'data/ROADMAP-A.md',
               'clickup_tag': 'app-a', 'clickup_workspace': '0', 'ui_controls': CONTROLS, 'notes': 'invented'}
        row.update(over)
        other = dict(row, app_id='B0002', key='app-b', name='APP-B', match='')
        self.wcsv('APPS.csv', APP_COLS, [row, other])
        return row

    def ready_folder(self, text=GOOD, meta=None, name='APP-A-P1-v2.txt'):
        """Every input a READY send needs, all invented."""
        self.lessons()
        self.apps()
        self.w('data/CK56-PATTERN.txt', r'\bZQX[0-9]\b' + '\n')
        self.w('data/OB-LESSON-MAP.csv', 'ob,lessons\nOB-X01,L01\n')
        self.w('data/INPUTS-A.json', json.dumps(INPUTS))
        self.w('data/DOC-A.md', LEDGER)
        self.w('data/SNAGS-A.md', SNAGS)
        self.w('data/ROADMAP-A.md', ROADMAP)
        draft = self.w('sends/' + name, text)
        self.w('sends/' + name[:-4] + '.meta.json', json.dumps(META if meta is None else meta))
        return draft


# ---------------------------------------------------------------- data folder
class DataDir(Base):
    def test_unset_exits(self):
        os.environ.pop('PRESEND_DATA', None)
        with self.assertRaises(SystemExit) as e: PL.data_dir()
        self.assertIn('set PRESEND_DATA', str(e.exception.code))

    def test_inside_repo_exits(self):
        for inside in (ROOT, HERE):
            os.environ['PRESEND_DATA'] = inside
            with self.assertRaises(SystemExit) as e: PL.data_dir()
            self.assertIn('inside the repo', str(e.exception.code))

    def test_missing_folder_exits(self):
        os.environ['PRESEND_DATA'] = os.path.join(self.d, 'nope')
        with self.assertRaises(SystemExit) as e: PL.data_dir()
        self.assertIn('not found', str(e.exception.code))

    def test_good_folder_outside_repo(self):
        PL.DATA = None
        os.environ['PRESEND_DATA'] = self.d
        self.assertEqual(PL.data_dir(), self.d)
        self.assertEqual(PL.DATA, self.d)


# ---------------------------------------------------------------- lessons
class Lessons(Base):
    def test_lessons_file_and_rows(self):
        self.assertIsNone(PL.lessons_file()); self.assertIsNone(PL.lessons())
        self.lessons(LESSONS + [lesson('L09', 'absent', 'x', status='RETIRED')], name='PROMPT-LESSONS-CHECKS.csv')
        self.assertTrue(PL.lessons_file().endswith('PROMPT-LESSONS-CHECKS.csv'))
        self.assertEqual([r['id'] for r in PL.lessons()], ['L01', 'L02', 'L03'])  # RETIRED is not run
        PL.DATA = None
        self.assertIsNone(PL.lessons_file())

    def test_absent(self):
        r = lesson('X', 'absent', r'\bZQX1\b')
        self.assertTrue(PL.hit(r, 'say ZQX1 here')); self.assertFalse(PL.hit(r, 'all clean'))

    def test_absent_affirmed(self):
        r = lesson('X', 'absent_affirmed', r'\brename the table\b')
        self.assertFalse(PL.hit(r, 'Do not rename the table. Keep it.'))
        self.assertFalse(PL.hit(r, 'Never\nrename the table.'))  # flattened before the negation strip
        self.assertTrue(PL.hit(r, 'Please rename the table.'))

    def test_present_if(self):
        r = lesson('X', 'present_if', 'END OF PROMPT', trigger='THE WORK')
        self.assertFalse(PL.hit(r, 'no trigger at all'))
        self.assertTrue(PL.hit(r, 'THE WORK. 1. x'))
        self.assertFalse(PL.hit(r, 'THE WORK. 1. x END OF PROMPT'))

    def test_present(self):
        r = lesson('X', 'present', 'Standing rules')
        self.assertTrue(PL.hit(r, 'nothing')); self.assertFalse(PL.hit(r, 'Standing rules apply'))

    def test_max_chars(self):
        r = lesson('X', 'max_chars', '10')
        self.assertTrue(PL.hit(r, 'x' * 11)); self.assertFalse(PL.hit(r, 'x' * 10))

    def test_blank_lines(self):
        r = lesson('X', 'absent', 'x', check='blank_lines')
        self.assertTrue(PL.hit(r, 'a\n \t\nb')); self.assertFalse(PL.hit(r, 'a\nb'))

    def test_report_counts(self):
        fails, out = quiet(PL.report, 'ZQX-BANNED THE WORK.', LESSONS + [lesson('W1', 'max_chars', '5', severity='WARN')], 'case')
        self.assertEqual([r['id'] for r in fails], ['L01', 'L02'])
        self.assertIn('== case:', out)
        self.assertIn('RESULT: 2 FAIL, 1 WARN, 1 PASS', out)
        self.assertIn('FAIL L01 invented L01 -> FIX: invented fix', out)
        fails, out = quiet(PL.report, 'clean', LESSONS)
        self.assertEqual(fails, []); self.assertIn('0 FAIL, 0 WARN, 3 PASS', out)

    def test_selftest_with_no_data_uses_invented_rows(self):
        PL.DATA = None
        bad, out = quiet(PL.selftest, None)
        self.assertEqual(bad, 0, out)
        self.assertIn('invented rows', out)
        self.assertIn('selftest: 4 controls, 0 silent', out)

    def test_selftest_counts_malformed_bad_regex_and_silent_controls(self):
        p = self.lessons(LESSONS + [lesson('L04', 'absent', '(', control='')])
        with open(p, 'a', encoding='utf8') as f:
            f.write('L05,CHECK,,absent,a,b,FAIL,w,f,c,EXTRA\n')        # extra field: malformed
            f.write('L06,BOGUS,,absent,a,,FAIL,w,f,\n')               # unknown status: malformed
            f.write('L07,RETIRED,,absent,(,,FAIL,w,f,\n')             # retired: regex not checked
        rows = [lesson('S1', 'absent', 'ZQX9', control='clean text'),  # control does not fire
                lesson('S2', 'absent', 'ZQX9', control='')]           # no control: skipped
        bad, out = quiet(PL.selftest, rows)
        self.assertEqual(bad, 4, out)  # 2 malformed + 1 bad regex + 1 silent control
        self.assertIn('MALFORMED ROW (quote patterns with commas): L05', out)
        self.assertIn('MALFORMED ROW (quote patterns with commas): L06', out)
        self.assertIn('BAD REGEX: L04', out)
        self.assertIn('CONTROL DID NOT FIRE: S1', out)
        self.assertIn('selftest: 1 controls, 4 silent', out)
        self.assertEqual(PL.DATA, self.d)  # presend_selftest restores DATA

    def test_selftest_real_rows_clean(self):
        self.lessons()
        bad, out = quiet(PL.selftest, PL.lessons())
        self.assertEqual(bad, 0, out)
        self.assertIn('selftest: 2 controls, 0 silent', out)


class PresendSelftest(Base):
    def test_clean(self):
        bad, out = quiet(PL.presend_selftest)
        self.assertEqual(bad, 0, out)

    def test_every_control_reports_when_its_check_is_broken(self):
        """Break every check so each pre-send control has to speak up."""
        x = lambda *a, **k: ('X', 'broken')
        with mock.patch.multiple(PL, ck56=x, file_scope=x, oos_clash=x, cost=x, freshness=x, ck57=x,
                                 ck51=lambda *a, **k: ('X', 'broken', []), verify=lambda *a: False,
                                 text_sha=lambda p: 'same'):
            bad, out = quiet(PL.presend_selftest)
        self.assertEqual(bad, 15, out)
        for msg in ('CONTROL TEXT FAILS CK56', 'CONTROL DID NOT FIRE: OOSCLASH', 'FILESCOPE extra file', 'COST',
                    'FRESHNESS', 'CK57', 'CK51 missing ledger', 'CK51 open row', 'CK51 rule with no lesson',
                    'STAMP verify', 'STAMP hash'):
            self.assertIn(msg, out)
        self.assertEqual(PL.DATA, self.d)

    def test_data_restored_after_error(self):
        with mock.patch.object(PL, '_presend_selftest', side_effect=RuntimeError('boom')):
            with self.assertRaises(RuntimeError): PL.presend_selftest()
        self.assertEqual(PL.DATA, self.d)


# ---------------------------------------------------------------- text-only pre-send checks
class Ck56(Base):
    def test_no_pattern_file_not_run(self):
        self.assertEqual(PL.ck56(GOOD)[0], 'NOT RUN')
        self.assertIsNone(PL.ck56_pattern())
        PL.DATA = None
        self.assertEqual(PL.ck56(GOOD)[0], 'NOT RUN')

    def test_hit_and_clean(self):
        self.w('data/CK56-PATTERN.txt', r'\bZQX[0-9]\b' + '\n')
        st, why = PL.ck56('see ZQX2 and ZQX1 and ZQX1')
        self.assertEqual(st, 'FAIL'); self.assertEqual(why, 'internal terms: ZQX1, ZQX2')
        self.assertEqual(PL.ck56(GOOD), ('PASS', 'internal-terms scan: 0 hits'))
        self.assertEqual(PL.ck56('ZQX7', r'ZQX7')[0], 'FAIL')  # explicit pattern wins over the file
        self.assertEqual(PL.TEXT_CHECKS['CK56']('ZQX3', None)[0], 'FAIL')


class FileScope(Base):
    def test_good_passes(self):
        st, why = PL.file_scope(GOOD, APP)
        self.assertEqual(st, 'PASS', why); self.assertIn('2 files', why); self.assertIn('scope of reading', why)
        self.assertEqual(PL.file_scope(GOOD, None)[0], 'PASS')

    def test_no_fence(self):
        st, why = PL.file_scope(GOOD.replace(FENCE, ''), APP)
        self.assertEqual(st, 'FAIL'); self.assertIn('no "Change no file other than', why)

    def test_item_names_file_outside_fence(self):
        t = GOOD.replace('clears the saved note.', 'clears the saved note. Also update src/lib/extra.ts.')
        st, why = PL.file_scope(t, APP)
        self.assertEqual(st, 'FAIL'); self.assertIn("items name files outside the change list: ['extra']", why)

    def test_unused_file_in_fence(self):
        t = GOOD.replace('and src/lib/store.ts. Add no', 'and src/lib/store.ts and src/pages/Other.tsx. Add no')
        st, why = PL.file_scope(t, APP)
        self.assertEqual(st, 'FAIL'); self.assertIn("change list has files no item names: ['other']", why)
        self.assertIn('re-read list says two files, change list holds 3', why)

    def test_reread_count(self):
        st, why = PL.file_scope(GOOD.replace('Re-read all two', 'Re-read all three'), APP)
        self.assertEqual(st, 'FAIL'); self.assertIn('re-read list says three files, change list holds 2', why)
        self.assertEqual(PL.file_scope(GOOD.replace('Re-read all two', 'Re-read all 2'), APP)[0], 'PASS')
        st, why = PL.file_scope(GOOD.replace('Re-read all two', 'Re-read all several'), APP)
        self.assertIn('re-read list says several files', why)

    def test_missing_reread_item(self):
        t = GOOD.replace('3. Re-read all two changed files after all edits and confirm each change with file and line.\n', '')
        st, why = PL.file_scope(t, APP)
        self.assertEqual(st, 'FAIL'); self.assertIn('no "Re-read all N changed files" item', why)

    def test_scope_of_reading_mismatch(self):
        t = GOOD.replace('may change: src/pages/Home.tsx and src/lib/store.ts.', 'may change: src/pages/Home.tsx.')
        st, why = PL.file_scope(t, APP)
        self.assertEqual(st, 'FAIL'); self.assertIn("scope-of-reading list ['home'] differs", why)

    def test_signout_family_unpinned_fails_pinned_passes(self):
        st, why = PL.file_scope(GOOD.replace(PIN, ''), APP)
        self.assertEqual(st, 'FAIL'); self.assertIn('"Log out" (the header) in header', why)
        self.assertNotIn('Home page', why)  # the one inside the fence is fine
        self.assertEqual(PL.file_scope(GOOD, APP)[0], 'PASS')
        self.assertEqual(PL.file_scope(GOOD.replace(PIN, ''), None)[0], 'PASS')  # no controls known

    def test_items_without_the_work_heading(self):
        self.assertEqual(PL.items('1. one\nnot an item\n2. two'), ['1. one', '2. two'])

    def test_controls_parsing(self):
        self.assertEqual(PL.controls(APP), [('Log out', 'header', 'the header', 'sign[- ]?out|log[- ]?out'),
                                            ('Sign out', 'home', 'the Home page', 'sign[- ]?out|log[- ]?out')])
        self.assertEqual(PL.controls({'ui_controls': ' Only@src/X.tsx ; ;'}), [('Only', 'x', '', '')])
        self.assertEqual(PL.controls(None), []); self.assertEqual(PL.controls({}), [])


class OosClash(Base):
    def test_no_list(self):
        self.assertEqual(PL.oos_clash('THE WORK.\n1. Change the brand logos.\n'), ('PASS', 'no out-of-scope list'))

    def test_clean_and_clash(self):
        st, why = PL.oos_clash(GOOD)
        self.assertEqual(st, 'PASS'); self.assertIn('2 out-of-scope entries', why)
        st, why = PL.oos_clash(GOOD.replace('clears the saved note.', 'clears the saved note. Also change the brand logos shown in the header.'))
        self.assertEqual(st, 'FAIL'); self.assertIn('item asks for brand header logo, listed out of scope', why)

    def test_negated_and_short_clauses_ignored(self):
        t = ('Deliberately out of scope for this prompt: brand logos shown in the header; billing (cards and plans); x.\n'
             'THE WORK.\n1. Do not change the brand logos shown in the header.\n2. Update billing now.\n')
        self.assertEqual(PL.oos_clash(t)[0], 'PASS')


# ---------------------------------------------------------------- checks that read the data folder
class FoldIn(Base):
    def test_no_snags_file_not_run(self):
        st, why, out = PL.fold_in(GOOD, {'snags_file': 'data/none.md'}, {})
        self.assertEqual(st, 'NOT RUN'); self.assertIn('no snags file', why); self.assertEqual(out, [])
        self.assertEqual(PL.fold_in(GOOD, None, None)[0], 'NOT RUN')

    def test_undecided_fails(self):
        self.w('data/SNAGS-A.md', SNAGS)
        st, why, out = PL.fold_in(GOOD, {'snags_file': 'data/SNAGS-A.md'}, {'send_id': 'P1'})
        self.assertEqual(st, 'FAIL'); self.assertIn('no in/out decision recorded for A1', why)
        self.assertIn('roadmap file not configured', why)
        self.assertEqual([i for i, _ in out], ['A1'])  # A2 platform gap, A3 'in P1' and B1 (other file) skipped
        self.assertIn('Home page: Enter saves twice | fix: guard the key | open | cheap: yes', out[0][1])

    def test_in_send_row_only_skipped_for_that_send(self):
        self.w('data/SNAGS-A.md', SNAGS)
        _, _, out = PL.fold_in(GOOD, {'snags_file': 'data/SNAGS-A.md'}, {'send_id': 'P2'})
        self.assertEqual([i for i, _ in out], ['A1', 'A3'])

    def test_decided_without_roadmap_not_run(self):
        self.w('data/SNAGS-A.md', SNAGS)
        st, why, _ = PL.fold_in(GOOD, {'snags_file': 'data/SNAGS-A.md'}, {'send_id': 'P1', 'fold_in_decided': ['A1']})
        self.assertEqual(st, 'NOT RUN'); self.assertIn('roadmap file not configured', why)

    def test_decided_with_roadmap_passes(self):
        self.w('data/SNAGS-A.md', SNAGS); self.w('data/ROADMAP-A.md', ROADMAP)
        app = {'snags_file': 'data/SNAGS-A.md', 'roadmap_file': 'data/ROADMAP-A.md'}
        st, why, out = PL.fold_in(GOOD, app, {'send_id': 'P1', 'fold_in_decided': ['A1']})
        self.assertEqual(st, 'FAIL'); self.assertIn('L1', why)
        st, why, out = PL.fold_in(GOOD, app, {'send_id': 'P1', 'fold_in_decided': ['A1', 'L1']})
        self.assertEqual(st, 'PASS'); self.assertIn('2 open snag/roadmap rows touch these files, each decided', why)
        self.assertEqual([i for i, _ in out], ['A1', 'L1'])

    def test_absolute_snags_path(self):
        p = self.w('elsewhere/snags.md', SNAGS)
        self.assertEqual(PL.fold_in(GOOD, {'snags_file': p}, {'send_id': 'P1'})[0], 'FAIL')
        PL.DATA = None
        self.assertFalse(PL.exists('data/SNAGS-A.md')); self.assertTrue(PL.exists(p)); self.assertFalse(PL.exists(''))


class Freshness(Base):
    META = {'clickup_pulled_at': '2030-01-01T08:00:00Z', 'register_read_at': '2030-01-01T08:30:00'}  # naive = UK

    def test_missing(self):
        st, why = PL.freshness('no read line', {}, NOW)
        self.assertEqual(st, 'FAIL')
        self.assertEqual(why, 'code read missing; ClickUp pull missing; register read missing')
        st, why = PL.freshness('no read line', self.META, NOW)
        self.assertIn('code read missing', why); self.assertIn('(have: ClickUp pull 01 Jan 2030 08:00 UK', why)

    def test_stale(self):
        st, why = PL.freshness(GOOD, self.META, datetime(2030, 1, 1, 20, 0, tzinfo=timezone.utc))
        self.assertEqual(st, 'FAIL'); self.assertIn('code read 01 Jan 2030 09:00 UK is 11.0 h old', why)

    def test_fresh(self):
        st, why = PL.freshness(GOOD, self.META, NOW)
        self.assertEqual(st, 'PASS'); self.assertTrue(why.startswith('all under 6 h: code read 01 Jan 2030 09:00 UK'))

    def test_ts(self):
        self.assertIsNone(PL.ts('')); self.assertIsNone(PL.ts(None))
        self.assertEqual(PL.ts('2030-07-01T12:00:00').utcoffset().total_seconds(), 3600)  # BST
        self.assertEqual(PL.ukfmt(PL.ts('2030-07-01T12:00:00Z')), '01 Jul 2030 13:00 UK')


class Inputs(Base):
    APP = {'inputs_file': 'data/INPUTS-A.json'}

    def test_no_file_not_run(self):
        self.assertEqual(PL.inputs(self.APP, NOW)[0], 'NOT RUN'); self.assertEqual(PL.inputs(None, NOW)[0], 'NOT RUN')

    def test_pass(self):
        self.w('data/INPUTS-A.json', json.dumps(INPUTS))
        self.assertEqual(PL.inputs(self.APP, NOW), ('PASS', 'I1-I5 pass (INPUTS-A.json)'))

    def test_stale_checked_at_I0(self):
        self.w('data/INPUTS-A.json', json.dumps(INPUTS))
        st, why = PL.inputs(self.APP, datetime(2030, 1, 1, 16, 0, tzinfo=timezone.utc))
        self.assertEqual(st, 'FAIL'); self.assertIn('I0 inputs file checked 01 Jan 2030 09:30 UK, over 6 h ago', why)

    def test_gate_fail(self):
        self.w('data/INPUTS-A.json', json.dumps(dict(INPUTS, carried=['export_zip_at'])))
        st, why = PL.inputs(self.APP, NOW)
        self.assertEqual(st, 'FAIL'); self.assertIn('I6 export_zip_at is CARRIED', why)


class Cost(Base):
    def test_all(self):
        self.assertEqual(PL.cost(None), ('FAIL', 'no credit estimate'))
        self.assertEqual(PL.cost({'credit_estimate': [3300, 5900]}), ('FAIL', 'estimate [3300, 5900] but no ledger stop (should be 8,850)'))
        st, why = PL.cost({'credit_estimate': [3300, 5900], 'ledger_stop': 9000})
        self.assertEqual(st, 'FAIL'); self.assertIn('ledger stop 9,000 is not 1.5 x the top of the estimate (8,850)', why)
        self.assertEqual(PL.cost({'credit_estimate': [3300, 5900], 'ledger_stop': 8850}), ('PASS', 'estimate 3,300-5,900, ledger stop 8,850'))
        self.assertEqual(PL.cost({'credit_estimate': 4000, 'ledger_stop': 6000}), ('PASS', 'estimate 4000, ledger stop 6,000'))
        self.assertEqual(PL.cost({'credit_estimate': 4000, 'ledger_stop': 6030})[0], 'PASS')  # within 1 %


class Ck51(Base):
    APP = {'ledger_file': 'data/DOC-A.md', 'ledger_section': '3.7'}

    def setUp(self):
        super().setUp()
        self.w('data/DOC-A.md', LEDGER)

    def test_missing_ledger_not_run(self):
        st, why, q = PL.ck51(GOOD, {'ledger_file': 'data/none.md'}, {})
        self.assertEqual(st, 'NOT RUN'); self.assertIn('ledger not found', why); self.assertEqual(q, [])
        self.assertEqual(PL.ck51(GOOD, None, None)[0], 'NOT RUN')

    def test_no_heading_not_run(self):
        st, why, _ = PL.ck51(GOOD, dict(self.APP, ledger_section='9.9'), {})
        self.assertEqual(st, 'NOT RUN'); self.assertIn('no "9.9" heading', why)

    def test_default_section(self):
        self.assertEqual(PL.ledger_rows({'ledger_file': 'data/DOC-A.md'})[1], 'DOC-A.md 3.7 (4 rows)')

    def test_open_row_due_fails(self):
        st, why, q = PL.ck51(GOOD, self.APP, {'send_id': 'P1'})
        self.assertEqual(st, 'FAIL'); self.assertIn('2 rows due at this send', why); self.assertIn('OB-X02', why)
        self.assertTrue(any(x.startswith('OB-X02 [DATA, OPEN] OPEN') for x in q))

    def test_data_row_not_done_fails_for_its_session(self):
        st, why, _ = PL.ck51(GOOD, self.APP, {'send_id': 'P2'})  # 'P2 session' is due at P2
        self.assertEqual(st, 'FAIL'); self.assertIn('OB-X03', why); self.assertNotIn('OB-X04', why)

    def test_rule_with_no_lesson_not_run(self):
        st, why, q = PL.ck51(GOOD, self.APP, {})
        self.assertEqual(st, 'NOT RUN'); self.assertIn('rule text not checkable for OB-X01', why)
        self.assertIn('NOT CHECKED', q[0])

    def test_mapped_lesson_fires_fails_and_passes(self):
        self.lessons(); self.w('data/OB-LESSON-MAP.csv', 'ob,lessons\nOB-X01,L01 L02\n')
        st, why, q = PL.ck51(GOOD + ' ZQX-BANNED', self.APP, {})
        self.assertEqual(st, 'FAIL'); self.assertIn('OB-X01', why); self.assertIn('carried (lessons L01 L02 FAIL)', q[0])
        st, why, q = PL.ck51(GOOD, self.APP, {})
        self.assertEqual(st, 'PASS'); self.assertIn('1 rows due at this send (DOC-A.md 3.7 (4 rows)), all carried', why)
        self.assertIn('carried (lessons L01 L02 pass)', q[0])


class Ck57(Base):
    SERVER = 'THE WORK.\n1. Add an endpoint /api/notes that reads notes.\n'
    APP = {'ledger_file': 'data/DOC-A.md', 'roles_section': '4.0'}

    def test_no_server_code_na(self):
        self.assertEqual(PL.ck57(GOOD, self.APP)[0], 'N/A')
        self.assertEqual(PL.ck57('THE WORK.\n1. Do not add an endpoint here.\n', self.APP)[0], 'N/A')

    def test_no_register_not_run(self):
        st, why = PL.ck57(self.SERVER, {})
        self.assertEqual(st, 'NOT RUN'); self.assertIn('table register not found', why)

    def test_no_heading_not_run(self):
        self.w('data/DOC-A.md', LEDGER)
        st, why = PL.ck57(self.SERVER, dict(self.APP, roles_section='7.7'))
        self.assertEqual(st, 'NOT RUN'); self.assertIn('no "7.7" heading', why)

    def test_default_section_and_no_role_gate_column(self):
        self.w('data/DOC-A.md', '## 4.0 Tables\n| Table | Purpose |\n|---|---|\n| notes | x |\n')
        st, why = PL.ck57(self.SERVER, {'ledger_file': 'data/DOC-A.md'})
        self.assertEqual(st, 'FAIL'); self.assertIn('no Role gate column', why)

    def test_blank_gate_fails_and_gated_passes(self):
        self.w('data/DOC-A.md', LEDGER)
        st, why = PL.ck57('THE WORK.\n1. Create a server function that reads notes and tenants.\n', self.APP)
        self.assertEqual(st, 'FAIL'); self.assertEqual(why, 'Role gate blank or none for tenants')
        self.assertEqual(PL.ck57(self.SERVER, self.APP), ('PASS', '1 tables read by the new server code all carry a Role gate'))


class NewerDraftAndDash(Base):
    def test_newer_draft(self):
        self.assertEqual(PL.newer_draft(self.w('draft.txt', 'x'))[0], 'PASS')
        v1 = self.w('APP-A-P1-v1.txt', 'x'); v2 = self.w('APP-A-P1-v2.txt', 'x'); self.w('APP-A-P1-vX.txt', 'x')
        self.assertEqual(PL.newer_draft(v1), ('FAIL', 'a newer draft exists: APP-A-P1-v2.txt'))
        self.assertEqual(PL.newer_draft(v2), ('PASS', 'v2 is the newest draft in its folder'))

    def test_dash_lines(self):
        self.assertEqual(PL.dash_lines(None)[0], 'FAIL'); self.assertEqual(PL.dash_lines({'dashboard_lines': []})[0], 'FAIL')
        self.assertEqual(PL.dash_lines({'dashboard_lines': ['a', 'b']}), ('PASS', '2 Dashboard lines in the pack'))


class AppRow(Base):
    def test_lookups(self):
        self.assertIsNone(PL.app_row('A0001'))  # no APPS.csv yet
        self.apps()
        self.assertEqual(PL.app_row('A0001')['name'], 'APP-A')
        self.assertEqual(PL.app_row('app-b')['name'], 'APP-B')
        self.assertEqual(PL.app_row(None, 'a prompt for APP-A')['name'], 'APP-A')
        self.assertEqual(PL.app_row('zzz', 'a prompt for APP-A')['name'], 'APP-A')
        self.assertIsNone(PL.app_row(None, 'nothing'))
        PL.DATA = None
        self.assertIsNone(PL.app_row('A0001'))


# ---------------------------------------------------------------- end to end
class Presend(Base):
    def run_presend(self, draft, **k):
        return quiet(PL.presend, draft, now=NOW, **k)

    def test_ready_writes_stamp_and_request(self):
        draft = self.ready_folder()
        (ready, stamp, lines), out = self.run_presend(draft)
        sha = PL.text_sha(draft)
        self.assertTrue(ready, out)
        self.assertEqual(stamp, f'presend: READY sha256:{sha} 01 Jan 2030 UK')
        self.assertEqual(lines[-1], f'READY · stamp sha256:{sha}')
        self.assertIn('APP-A', lines[0])
        for k in ('LESSONS', 'CK56', 'FILESCOPE', 'OOSCLASH', 'FOLD-IN', 'FRESHNESS', 'INPUTS-GATE', 'COST', 'CK51', 'CK57', 'NEWER-DRAFT', 'DASHBOARD'):
            self.assertTrue(any(re.match(r'(PASS|N/A)\s+' + k + r'\s', l) for l in lines), k + '\n' + out)
        self.assertTrue(any(l.startswith('CONSIDER A1') for l in lines))
        self.assertTrue(any(l.startswith('QUOTE    CK51') for l in lines))
        run = os.path.join(self.d, 'runs', 'RUN-APP-A-P1-v2-20300101-1000.md')
        body = open(run, encoding='utf8').read()
        self.assertIn('\n' + stamp + '\n', body)
        self.assertTrue(PL.verify(draft, stamp))
        req = json.load(open(os.path.join(self.d, 'outbox', 'stamp-APP-A-P1-v2-20300101-1000.json'), encoding='utf8'))
        self.assertEqual((req['kind'], req['ready'], req['taskId'], req['sha256'], req['line']), ('stamp', True, 'task-x01', sha, stamp))

    def test_explicit_meta_and_app(self):
        draft = self.ready_folder(meta=dict(META, app='nope'))
        meta = self.w('other.meta.json', json.dumps(META))
        (ready, _, _), out = self.run_presend(draft, meta_path=meta, app_id='A0001', write=False)
        self.assertTrue(ready, out)

    def test_not_ready(self):
        meta = dict(META); meta.pop('dashboard_lines'); meta.pop('clickup_task_id')
        draft = self.ready_folder(meta=meta)
        (ready, stamp, lines), out = self.run_presend(draft)
        self.assertFalse(ready)
        self.assertTrue(stamp.startswith('presend: NOT READY (1 FAIL, 0 NOT RUN) sha256:' + PL.text_sha(draft)))
        self.assertEqual(lines[-1], 'NOT READY · 1 FAIL, 0 NOT RUN · no stamp')
        self.assertIn(stamp, open(os.path.join(self.d, 'runs', 'RUN-APP-A-P1-v2-20300101-1000.md'), encoding='utf8').read())
        self.assertEqual(os.listdir(os.path.join(self.d, 'outbox')), [])  # no clickup_task_id, no request
        self.assertFalse(PL.verify(draft, stamp))

    def test_not_ready_request_says_false_and_lessons_fail_warn(self):
        draft = self.ready_folder(text=GOOD + 'ZQX-BANNED\n')
        self.lessons(LESSONS + [lesson('L04', 'max_chars', '10', severity='WARN')])
        (ready, stamp, lines), out = self.run_presend(draft)
        self.assertFalse(ready)
        self.assertTrue(any(l.startswith('FAIL     LESSONS') and 'FAIL L01' in l and 'WARN L04' in l for l in lines), out)
        req = json.load(open(os.path.join(self.d, 'outbox', 'stamp-APP-A-P1-v2-20300101-1000.json'), encoding='utf8'))
        self.assertEqual((req['kind'], req['ready']), ('stamp', False))

    def test_no_lessons_not_run(self):
        draft = self.ready_folder()
        os.remove(os.path.join(self.d, 'PROMPT-LESSONS.csv'))
        (ready, stamp, lines), _ = self.run_presend(draft, write=False)
        self.assertFalse(ready)
        self.assertIn('NOT RUN  LESSONS     no PROMPT-LESSONS.csv in PRESEND_DATA', lines)
        self.assertIn('NOT RUN)', stamp)

    def test_write_false_writes_nothing(self):
        draft = self.ready_folder()
        (ready, _, _), _ = self.run_presend(draft, write=False)
        self.assertTrue(ready)
        self.assertFalse(os.path.exists(os.path.join(self.d, 'runs')))
        self.assertFalse(os.path.exists(os.path.join(self.d, 'outbox')))

    def test_no_meta_no_apps(self):
        draft = self.w('sends/plain.txt', GOOD)
        (ready, _, lines), _ = self.run_presend(draft, write=False)
        self.assertFalse(ready)
        self.assertIn('app not found in APPS.csv', lines[0])


class Stamp(Base):
    def test_text_sha(self):
        a = self.w('a.txt', GOOD); b = self.w('b.txt', '\n  \n' + GOOD.rstrip('\n') + '\n\n\n'); c = self.w('c.txt', GOOD.replace('one Enter', 'one  Enter'))
        self.assertEqual(PL.text_sha(a), hashlib.sha256(GOOD.strip().encode()).hexdigest())
        self.assertEqual(PL.text_sha(b), PL.text_sha(a))
        self.assertNotEqual(PL.text_sha(c), PL.text_sha(a))

    def test_verify(self):
        p = self.w('a.txt', GOOD); sha = PL.text_sha(p)
        self.assertTrue(PL.verify(p, f'presend: READY sha256:{sha} 01 Jan 2030 UK'))
        self.assertFalse(PL.verify(p, f'presend: READY sha256:{"f" * 64} 01 Jan 2030 UK'))
        self.assertFalse(PL.verify(p, f'presend: NOT READY (1 FAIL, 0 NOT RUN) sha256:{sha} 01 Jan 2030 10:00 UK'))
        self.assertFalse(PL.verify(p, 'inputs-gate: PASS'))
        self.assertFalse(PL.verify(p, None))


# ---------------------------------------------------------------- regression bundles
BUNDLE = """Header text before the first case is ignored.

=== case one | expect: L01 FILESCOPE
Has ZQX-BANNED in it.
THE WORK.
1. do it
END OF PROMPT

=== case two | expect: L01 FILESCOPE +presend
Also ZQX-BANNED.
THE WORK.
1. do it
END OF PROMPT
"""


class Regression(Base):
    def setUp(self):
        super().setUp()
        self.rows = LESSONS
        self.w('PROMPT-REGRESSION-SET-x.txt', BUNDLE)

    def test_bundles(self):
        cases = PL.bundles()
        self.assertEqual([(n, e) for n, e, _ in cases], [('case one', {'L01', 'FILESCOPE'}), ('case two', {'L01', 'FILESCOPE', '+presend'})])
        self.assertTrue(cases[0][2].endswith('END OF PROMPT\n'))

    def test_regress_reads_bundles_then_split(self):
        bad, out = quiet(PL.regress, self.rows)
        self.assertEqual(bad, 0, out); self.assertIn('regress: 2 old prompts, 0 misses', out)
        n, out = quiet(PL.split)
        self.assertEqual(n, 0); self.assertIn('split: 2 cases', out)
        reg = os.path.join(self.d, 'regression')
        self.assertEqual(sorted(os.listdir(reg)), ['case-one.expect', 'case-one.txt', 'case-two.expect', 'case-two.txt'])
        self.assertEqual(open(os.path.join(reg, 'case-two.expect')).read(), '+presend FILESCOPE L01\n')
        bad, out = quiet(PL.regress, self.rows)
        self.assertEqual(bad, 0, out); self.assertIn('case-two.txt: expected', out); self.assertIn(' OK', out)

    def test_missed_and_false_alarm(self):
        self.w('regression/missed.txt', 'clean text\n'); self.w('regression/missed.expect', 'L01\n')
        bad, out = quiet(PL.regress, self.rows)
        self.assertEqual(bad, 1, out); self.assertIn("MISSED ['L01']", out)
        os.remove(os.path.join(self.d, 'regression', 'missed.txt'))
        self.w('regression/alarm.txt', 'ZQX-BANNED\n'); self.w('regression/alarm.expect', '\n')
        bad, out = quiet(PL.regress, self.rows)
        self.assertEqual(bad, 1, out); self.assertIn("FALSE ALARM ['L01']", out)
        self.w('regression/alarm.expect', '+presend\n')  # with +presend the text checks count too
        bad, out = quiet(PL.regress, self.rows)
        self.assertEqual(bad, 2, out); self.assertIn("FALSE ALARM ['FILESCOPE', 'L01']", out)


# ---------------------------------------------------------------- command line
def run(script, *args, data=None, cwd=None):
    env = {k: v for k, v in os.environ.items() if k != 'PRESEND_DATA'}
    env['PYTHONDONTWRITEBYTECODE'] = '1'
    if data: env['PRESEND_DATA'] = data
    return subprocess.run([sys.executable, script, *args], capture_output=True, text=True, env=env, cwd=cwd or ROOT, timeout=60)


class Cli(Base):
    def test_no_args(self):
        r = run(LINT)
        self.assertEqual(r.returncode, 2); self.assertIn('prompt-lint', r.stdout)

    def test_selftest_without_data(self):
        r = run(LINT, '--selftest')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertIn('0 silent', r.stdout)

    def test_selftest_with_data(self):
        self.lessons()
        r = run(LINT, '--selftest', data=self.d)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertIn('selftest: 2 controls, 0 silent', r.stdout)
        self.lessons([lesson('S1', 'absent', 'ZQX9', control='clean')])
        self.assertEqual(run(LINT, '--selftest', data=self.d).returncode, 1)

    def test_presend_without_data_is_setup_error(self):
        r = run(LINT, '--presend', os.path.join(self.d, 'x.txt'))
        self.assertNotEqual(r.returncode, 0); self.assertIn('SETUP', r.stderr)

    def test_no_lessons_is_setup_error_except_presend(self):
        r = run(LINT, '--regress', data=self.d)
        self.assertEqual(r.returncode, 1); self.assertIn('SETUP: no PROMPT-LESSONS.csv', r.stderr)

    def test_verify(self):
        p = self.w('a.txt', GOOD); sha = PL.text_sha(p)
        self.assertEqual(run(LINT, '--verify', p, f'presend: READY sha256:{sha} 01 Jan 2030 UK').returncode, 0)
        self.assertEqual(run(LINT, '--verify', p, f'presend: READY sha256:{"f" * 64} 01 Jan 2030 UK').returncode, 1)
        self.assertEqual(run(LINT, '--verify', p, 'presend: NOT READY').returncode, 1)

    def test_presend_cli_ready_and_not_ready(self):
        draft = self.ready_folder()
        r = run(LINT, '--presend', draft, '--now', '2030-01-01T10:00:00Z', data=self.d)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertIn('READY · stamp sha256:', r.stdout)
        r = run(LINT, '--presend', draft, '--now', '2030-01-02T10:00:00Z', '--app', 'A0001', data=self.d)
        self.assertEqual(r.returncode, 1); self.assertIn('NOT READY', r.stdout)

    def test_report_regress_split_cli(self):
        self.lessons()
        self.assertEqual(run(LINT, self.w('bad.txt', 'ZQX-BANNED'), data=self.d).returncode, 1)
        self.assertEqual(run(LINT, self.w('ok.txt', 'clean'), data=self.d).returncode, 0)
        self.w('PROMPT-REGRESSION-SET-x.txt', BUNDLE)
        self.assertEqual(run(LINT, '--split', data=self.d).returncode, 0)
        self.assertEqual(run(LINT, '--regress', data=self.d).returncode, 0)
        self.w('regression/missed.txt', 'clean'); self.w('regression/missed.expect', 'L01')
        self.assertEqual(run(LINT, '--regress', data=self.d).returncode, 1)


# ---------------------------------------------------------------- inputs-gate.py
GOOD_INPUTS = {'checked_at': '2030-01-05T12:00:00Z', 'app_updated_at': '2030-01-04T21:00:00Z',
               'brief_file_mtime': '2030-01-04T20:00:00Z', 'export_zip_at': '2030-01-05T11:00:00Z',
               'custom_instructions_read_at': '2030-01-05T11:05:00Z', 'project_brief_read_at': '2030-01-05T11:05:00Z',
               'chat_log_last_turn_at': '2029-11-01T00:00:00Z', 'simulated_at': '2030-01-05T11:30:00Z',
               'app': 'A0001 APP-A', 'prompt_file': 'APP-A-P1-v2.txt'}


class InputsGate(Base):
    def codes(self, **over):
        m = dict(GOOD_INPUTS, **over)
        for k, v in over.items():
            if v is None: m.pop(k)
        return [c for c, _ in IG.gate(m)]

    def test_good_passes(self):
        self.assertEqual(IG.gate(GOOD_INPUTS), [])

    def test_I1_missing(self):
        r = IG.gate({k: v for k, v in GOOD_INPUTS.items() if k != 'export_zip_at'})
        self.assertIn(('I1', 'missing: export_zip_at'), r)

    def test_I2_export_older_than_change(self):
        self.assertEqual(self.codes(export_zip_at='2030-01-04T20:00:00Z'), ['I2'])

    def test_I3_settings_older_than_brief(self):
        self.assertEqual(self.codes(custom_instructions_read_at='2030-01-04T19:00:00Z'), ['I3'])
        self.assertEqual(self.codes(project_brief_read_at='2030-01-04T19:00:00Z'), ['I3'])

    def test_I4_older_than_7_days(self):
        self.assertEqual(self.codes(checked_at='2030-01-20T12:00:00Z'), ['I4', 'I4', 'I4'])

    def test_I5_simulation(self):
        self.assertEqual(self.codes(simulated_at=None), ['I5'])
        self.assertEqual(self.codes(simulated_at='2030-01-05T11:01:00Z'), ['I5'])

    def test_I6_carried(self):
        self.assertEqual(self.codes(carried=['export_zip_at', 'project_brief_read_at']), ['I6', 'I6'])

    def test_no_checked_at_uses_now(self):
        far = '2999-01-01T00:00:00Z'
        m = {k: far for k in IG.REQ}; m['simulated_at'] = far
        self.assertEqual(IG.gate(m), [])

    def test_report(self):
        p = self.w('INPUTS-A.json', json.dumps(GOOD_INPUTS))
        n, out = quiet(IG.report, p)
        self.assertEqual(n, 0); self.assertIn('== inputs-gate A0001 APP-A · APP-A-P1-v2.txt', out); self.assertIn('RESULT: 0 FAIL', out)
        p = self.w('INPUTS-B.json', json.dumps(dict(GOOD_INPUTS, carried=['export_zip_at'], simulated_at=None)))
        n, out = quiet(IG.report, p)
        self.assertEqual(n, 2); self.assertIn('FAIL I6 export_zip_at is CARRIED', out); self.assertIn('RESULT: 2 FAIL', out)

    def test_selftest(self):
        self.assertEqual(quiet(IG.selftest)[0], 0)
        with mock.patch.object(IG, 'gate', lambda m: []):
            r, out = quiet(IG.selftest)
        self.assertEqual(r, 1); self.assertIn('selftest: FAILED', out)

    def test_cli(self):
        r = run(GATE)
        self.assertEqual(r.returncode, 2); self.assertIn('inputs-gate', r.stdout)
        r = run(GATE, '--selftest')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr); self.assertIn('selftest: OK', r.stdout)
        self.assertEqual(run(GATE, self.w('ok.json', json.dumps(GOOD_INPUTS))).returncode, 0)
        self.assertEqual(run(GATE, self.w('bad.json', json.dumps(dict(GOOD_INPUTS, carried=['x'])))).returncode, 1)


if __name__ == '__main__':
    unittest.main()
