// The learning loop and the alarm wiring, made mechanical. No browser, no Google, no Drive.
// These checks stop the safety net itself from quietly rotting: docs that name tests that no longer exist,
// a fix-without-test nudge that went missing, parked tests with no owner, teeth breaks that stopped matching the page,
// a required check that was renamed, an alarm message nobody can act on.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { evaluate, REQUIRED_JOB } = require('../support/check-protection');
const { BREAKS } = require('../teeth/breaks');

const REPO = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const specFiles = () => ['mocked', 'phone', 'live'].flatMap((d) => fs.readdirSync(path.join(REPO, 'tests', d)).filter((f) => f.endsWith('.spec.js')).map((f) => `tests/${d}/${f}`));
const allSpecText = () => specFiles().map(read).join('\n');

test.describe('Learning loop is mechanical @ci-guard', () => {
  const caught = () => {
    const md = read('TESTS.md');
    const sec = md.slice(md.indexOf('## Caught after merge'));
    const end = sec.indexOf('\n## ', 5);
    return (end > 0 ? sec.slice(0, end) : sec).split('\n').filter((l) => /^\|/.test(l) && !/^\|[-| ]+\|$/.test(l) && !/^\| Date /.test(l));
  };

  test('every test named in "Caught after merge" really exists', () => {
    const specs = allSpecText();
    const missing = [];
    caught().forEach((row) => {
      const lastCell = row.split('|').map((c) => c.trim()).filter(Boolean).pop() || '';
      [...lastCell.matchAll(/"([^"]{12,})"/g)].map((m) => m[1].replace(/…|\.\.\.$/g, '').trim()).forEach((frag) => {
        if (!specs.includes(frag)) missing.push(`TESTS.md names a test starting "${frag}" but no test has that name (renamed or deleted?)`);
      });
    });
    expect(caught().length, 'the table should have rows').toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  test('every @regression test is listed in "Caught after merge"', () => {
    const table = caught().join('\n');
    const unlisted = [];
    specFiles().forEach((f) => {
      read(f).split('\n').filter((l) => /^\s*test\(/.test(l) && /@regression['"`]\s*,/.test(l)).forEach((l) => {
        const m = /test\((['"`])(.*?)\s*@regression/.exec(l);
        const start = (m ? m[2] : l).replace(/\\'/g, "'").slice(0, 40);
        if (!table.includes(start)) unlisted.push(`${f}: "${start}…" is tagged @regression but is not in the "Caught after merge" table in TESTS.md`);
      });
    });
    expect(unlisted).toEqual([]);
  });

  test('the pull request checklist still asks "Bug fix? Regression test added?"', () => {
    expect(read('.github/pull_request_template.md')).toMatch(/Bug fix\? Regression test added\?/);
  });

  test('the fix-without-a-test warning workflow is still there and still only warns', () => {
    const wf = read('.github/workflows/fix-needs-test.yml');
    expect(wf).toMatch(/::warning/);
    expect(wf).not.toMatch(/exit 1/);
  });

  test('a parked test (test.fixme) must say what decision is needed, who owns it, and by when', () => {
    const bad = [];
    specFiles().forEach((f) => {
      const lines = read(f).split('\n');
      lines.forEach((l, i) => {
        if (!/^\s*test\.fixme\(/.test(l)) return;
        const above = lines.slice(Math.max(0, i - 6), i).join('\n');
        if (!/DECISION NEEDED/.test(above) || !/OWNER:/.test(above) || !/BY \d{4}-\d{2}-\d{2}/.test(above)) bad.push(`${f}:${i + 1} needs a comment above it with: DECISION NEEDED, OWNER: <who>, BY <YYYY-MM-DD>`);
      });
    });
    expect(bad).toEqual([]);
  });
});

test.describe('Alarm wiring @ci-guard', () => {
  test('the required check name exists as a job in tests.yml (so merges can never wait forever)', () => {
    const { problems } = evaluate({ protected: true, protection: { enabled: true, required_status_checks: { contexts: [REQUIRED_JOB], enforcement_level: 'everyone' } } }, read('.github/workflows/tests.yml'));
    expect(problems).toEqual([]);
  });

  test('protection check: off, switched off, wrong check, admin bypass and a renamed job are all reported', () => {
    const wf = read('.github/workflows/tests.yml');
    const on = { enabled: true, required_status_checks: { contexts: [REQUIRED_JOB], enforcement_level: 'everyone' } };
    expect(evaluate({ protected: false }, wf).problems.join()).toMatch(/NO branch protection/);
    expect(evaluate({ protected: true, protection: { ...on, enabled: false } }, wf).problems.join()).toMatch(/switched off/);
    expect(evaluate({ protected: true, protection: { ...on, required_status_checks: { contexts: ['Something else'], enforcement_level: 'everyone' } } }, wf).problems.join()).toMatch(/no longer requires/);
    expect(evaluate({ protected: true, protection: { ...on, required_status_checks: { contexts: [REQUIRED_JOB], enforcement_level: 'non_admins' } } }, wf).problems.join()).toMatch(/Admins can bypass/);
    expect(evaluate({ protected: true, protection: on }, wf.replace('name: ' + REQUIRED_JOB, 'name: Renamed job')).problems.join()).toMatch(/No job in tests.yml/);
    expect(evaluate({ protected: true }, wf).problems).toEqual([]); // token can't see details: only "is on" is checked
  });

  test('the alarm message starts with a plain "What to do" line', () => {
    const out = execFileSync('node', ['tests/support/report-issue.js', '--state', 'red', '--label', 'x', '--results', 'none', '--note', 'drill', '--dry-run'], {
      cwd: REPO, encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '1' },
    });
    expect(out).toMatch(/\*\*What to do:\*\* open the run link/);
  });

  test('every workflow that can open an issue does it with the built-in token only (no stored secrets)', () => {
    const secrets = [];
    fs.readdirSync(path.join(REPO, '.github', 'workflows')).forEach((f) => {
      [...read('.github/workflows/' + f).matchAll(/secrets\.([A-Za-z0-9_]+)/g)].forEach((m) => { if (m[1] !== 'GITHUB_TOKEN') secrets.push(`${f}: uses secrets.${m[1]}`); });
    });
    expect(secrets).toEqual([]);
  });
});

test.describe('Teeth list stays in step with the pages @ci-guard', () => {
  test('every deliberate break still matches the page text exactly once (caught here, not a week later)', () => {
    const stale = [];
    BREAKS.forEach((b) => {
      const n = read(b.file).split(b.find).length - 1;
      if (n !== 1) stale.push(`${b.id}: expected the text once in ${b.file}, found ${n}`);
      if (!fs.existsSync(path.join(REPO, 'tests', b.project === 'phone' ? 'phone' : 'mocked', b.spec + '.spec.js'))) stale.push(`${b.id}: spec ${b.spec} does not exist`);
    });
    expect(BREAKS.length).toBeGreaterThanOrEqual(8);
    expect(stale).toEqual([]);
  });
});
