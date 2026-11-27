// The learning loop and the alarm wiring, made mechanical. No browser, no Google, no Drive.
// These checks stop the safety net itself from quietly rotting: docs that name tests that no longer exist,
// a fix-without-test nudge that went missing, parked tests with no owner, teeth breaks that stopped matching the page,
// a required check that was renamed, an alarm message nobody can act on.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { evaluate, REQUIRED_JOB, PRIVACY_JOB } = require('../support/check-protection');
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
    const { problems } = evaluate({ protected: true, protection: { enabled: true, required_status_checks: { contexts: [REQUIRED_JOB, PRIVACY_JOB], enforcement_level: 'everyone' } } }, read('.github/workflows/tests.yml'));
    expect(problems).toEqual([]);
  });

  test('protection check: off, switched off, wrong check, admin bypass and a renamed job are all reported', () => {
    const wf = read('.github/workflows/tests.yml');
    const on = { enabled: true, required_status_checks: { contexts: [REQUIRED_JOB, PRIVACY_JOB], enforcement_level: 'everyone' } };
    expect(evaluate({ protected: false }, wf).problems.join()).toMatch(/NO branch protection/);
    expect(evaluate({ protected: true, protection: { ...on, enabled: false } }, wf).problems.join()).toMatch(/switched off/);
    expect(evaluate({ protected: true, protection: { ...on, required_status_checks: { contexts: ['Something else'], enforcement_level: 'everyone' } } }, wf).problems.join()).toMatch(/no longer requires/);
    expect(evaluate({ protected: true, protection: { ...on, required_status_checks: { contexts: [REQUIRED_JOB, PRIVACY_JOB], enforcement_level: 'non_admins' } } }, wf).problems.join()).toMatch(/Admins can bypass/);
    expect(evaluate({ protected: true, protection: on }, wf.replace('name: ' + REQUIRED_JOB, 'name: Renamed job')).problems.join()).toMatch(/No job in tests.yml/);
    expect(evaluate({ protected: true }, wf).problems).toEqual([]); // token can't see details: only "is on" is checked
  });

  test('protection check: the privacy guard must stay a required check and its job must keep its name', () => {
    const wf = read('.github/workflows/tests.yml');
    const pg = read('.github/workflows/privacy-guard.yml');
    const on = { enabled: true, required_status_checks: { contexts: [REQUIRED_JOB, PRIVACY_JOB], enforcement_level: 'everyone' } };
    expect(evaluate({ protected: true, protection: on }, wf, null, pg).problems).toEqual([]);
    expect(evaluate({ protected: true, protection: { ...on, required_status_checks: { contexts: [REQUIRED_JOB], enforcement_level: 'everyone' } } }, wf, null, pg).problems.join()).toMatch(/does not require the check "Privacy guard/);
    expect(evaluate({ protected: true, protection: on }, wf, null, pg.replace('name: ' + PRIVACY_JOB, 'name: Renamed')).problems.join()).toMatch(/No job in privacy-guard.yml/);
    expect(evaluate({ protected: true, protection: on }, wf, null, null).problems.join()).toMatch(/No job in privacy-guard.yml/);
  });

  test('protection watch also reports GitHub Issues switched off (the alarm cannot open an Issue then)', () => {
    const wf = read('.github/workflows/tests.yml');
    const on = { enabled: true, required_status_checks: { contexts: [REQUIRED_JOB, PRIVACY_JOB], enforcement_level: 'everyone' } };
    expect(evaluate({ protected: true, protection: on }, wf, { has_issues: false }).problems.join()).toMatch(/Issues are switched OFF/);
    expect(evaluate({ protected: true, protection: on }, wf, { has_issues: true }).problems).toEqual([]);
    expect(evaluate({ protected: true, protection: on }, wf, null).problems).toEqual([]); // could not read: no false alarm
  });

  test('the alarm message is one technical line', () => {
    const out = execFileSync('node', ['tests/support/report-issue.js', '--state', 'red', '--label', 'x', '--results', 'none', '--note', 'drill', '--dry-run'], {
      cwd: REPO, encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '1' },
    });
    expect(out).toMatch(/--title cdhub: check failed/);
    expect(out).toMatch(/--body Technical check failed\./);
    expect(out).not.toMatch(/drill/);
  });

  test('every workflow that can open an issue does it with the built-in token only (no stored secrets but the privacy denylist)', () => {
    const secrets = [];
    fs.readdirSync(path.join(REPO, '.github', 'workflows')).forEach((f) => {
      // One exception: the privacy guard reads its denylist from the PRIVACY_DENYLIST secret (it can never live in this public repo).
      [...read('.github/workflows/' + f).matchAll(/secrets\.([A-Za-z0-9_]+)/g)].forEach((m) => { if (m[1] !== 'GITHUB_TOKEN' && !(f === 'privacy-guard.yml' && m[1] === 'PRIVACY_DENYLIST')) secrets.push(`${f}: uses secrets.${m[1]}`); });
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

test.describe('Publishing waits for the tests @ci-guard', () => {
  const pages = () => read('.github/workflows/pages.yml');
  const LIVE_FILES = ['index.html', 'auth.js', 'config.js', 'toolkit.js', 'tokens.css', 'house.css', 'manifest.webmanifest', 'sw.js', 'icons/icon.svg', 'cdhub/index.html', 'money/index.html', 'money/core.js', 'factory/index.html', 'marketplace/index.html', 'food/index.html', 'studio/index.html', 'estate/index.html', 'estate/core.js'];

  test('the publish job needs the gate job, and the gate runs the same suite as the required check', () => {
    const wf = pages();
    expect(wf).toMatch(/publish:[\s\S]*?needs:\s*gate\n/);
    expect(wf).toMatch(/npx playwright test --project=mocked --project=phone/);
    expect(read('.github/workflows/tests.yml')).toMatch(/npx playwright test --project=mocked --project=phone/);
  });

  // 27 Nov 2026: one job ran about 53 of its 60 minutes (#814 was cut off at 60), so the suite runs in shards.
  // Every shard runs the whole mocked+phone command with its own --shard=i/N; one job merges and carries the required name.
  test('the suite runs in at least 3 shards, each with at least 2x a quarter-suite of time, merged into the one required check', () => {
    const tests = read('.github/workflows/tests.yml');
    const shards = (wf, job) => {
      const m = new RegExp('\\n  ' + job + ':[\\s\\S]*?\\n        shard: \\[([\\d, ]+)\\]').exec(wf);
      return m ? m[1].split(',').map((x) => Number(x.trim())) : [];
    };
    for (const [wf, job] of [[tests, 'shards'], [pages(), 'gate-shards']]) {
      const list = shards(wf, job);
      expect(list.length, job + ': at least 3 shards').toBeGreaterThanOrEqual(3);
      expect(list, job + ': shards are 1..N, none missing (a missing one would skip tests)').toEqual(list.map((_, i) => i + 1));
      expect(wf).toContain('npx playwright test --project=mocked --project=phone --shard=${{ matrix.shard }}/' + list.length);
      // 53 min in one job on 27 Nov: a shard needs at least 2x its share of that.
      const t = Number(new RegExp('\\n  ' + job + ':[\\s\\S]*?\\n    timeout-minutes:\\s*(\\d+)').exec(wf)[1]);
      expect(t, job + ' timeout').toBeGreaterThanOrEqual(Math.ceil((2 * 53) / list.length));
    }
    // The required check: the merge job keeps the name, waits for every shard, still reports when one fails, and is red unless all passed.
    expect(tests).toMatch(/\n  tests:\n    name: Browser tests \(pretend Google and Drive\)\n    needs: \[shards, unit\]\n    if: \$\{\{ !cancelled\(\) \}\}/);
    expect(tests).toContain('test "${{ needs.shards.result }}" = success');
    // 27 Nov 2026: the node unit tests are part of the same required check (save script and page helpers, no browser)
    expect(tests).toContain('test "${{ needs.unit.result }}" = success');
    expect(tests).toMatch(/\n  unit:\n[\s\S]*?run: npm test\n        working-directory: cdhub-write\n[\s\S]*?run: npm run test:unit\n/);
    expect(JSON.parse(read('cdhub-write/package.json')).scripts.test).toBe('node --test tests/*.test.js');
    expect(tests).toMatch(/fail-fast: false/);
    expect(pages()).toContain('test "${{ needs.gate-shards.result }}" = success');
  });

  // 20-22 Nov 2026: the gate's 35-minute limit cut off every publish once the suite ran past it, so github.io (where
  // the printed QR codes point) went stale for two days while main moved on. The gate runs the same suite as the
  // required check, so it gets at least the same time limit.
  test('the publish gate has at least as long as the required check to run the suite @regression', () => {
    // Since 27 Nov 2026 the suite runs in shards: each gate shard gets at least as long as each required-check shard.
    const minutes = (wf, job) => Number(new RegExp('\\n  ' + job + ':[\\s\\S]*?\\n    timeout-minutes:\\s*(\\d+)').exec(wf)[1]);
    expect(minutes(pages(), 'gate-shards')).toBeGreaterThanOrEqual(minutes(read('.github/workflows/tests.yml'), 'shards'));
  });

  test('nothing can bypass the gate: no always(), no continue-on-error, only push to main or a manual run', () => {
    const wf = pages();
    expect(wf).not.toMatch(/if:\s*\$?\{?\{?\s*always\(\)[^\n]*\n[^\n]*uses:\s*actions\/deploy-pages/);
    expect(wf).not.toMatch(/continue-on-error/);
    expect(wf).not.toMatch(/workflow_run/);
    expect(wf).toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]\s*\n\s*workflow_dispatch:/);
  });

  test('only the four pages and the shared sign-in are published (never tests, docs or .github) and all four live files are in it', () => {
    const m = /cp -r ([^\n]+) _site\//.exec(pages());
    expect(m, 'the copy line').toBeTruthy();
    const copied = m[1].trim().split(/\s+/);
    expect(copied.sort()).toEqual(['auth.js', 'breed-better', 'cdhub', 'config.js', 'enquiries', 'estate', 'factory', 'food', 'house.css', 'icons', 'index.html', 'manifest.webmanifest', 'marketplace', 'money', 'studio', 'sw.js', 'tokens.css', 'toolkit.js']);
    LIVE_FILES.forEach((f) => expect(copied.some((c) => f === c || f.startsWith(c + '/')), f + ' must be published').toBe(true));
    // and the live-match test compares exactly these files
    LIVE_FILES.forEach((f) => expect(read('tests/live/live-smoke.spec.js')).toContain(`'${f}'`));
  });

  // A hub is a top-level folder with its own index.html. Each one must be copied and checked by pages.yml,
  // or it merges green and stays 404 (the Web Estate hub did, 30 Oct 2026).
  test('every hub folder on main is copied and checked by pages.yml', () => {
    const wf = pages();
    const copied = /cp -r ([^\n]+) _site\//.exec(wf)[1].trim().split(/\s+/);
    // Tracked files only, so local leftovers (playwright-report/) never count as a hub.
    const hubs = execFileSync('git', ['ls-files', '*/index.html'], { cwd: REPO, encoding: 'utf8' }).split('\n')
      .map((f) => f.split('/')).filter((p) => p.length === 2 && !['tests', 'tools', 'docs', 'icons'].includes(p[0])).map((p) => p[0]);
    expect(hubs.length).toBeGreaterThan(5);
    const missing = hubs.filter((h) => !copied.includes(h) || !wf.includes(`test -f _site/${h}/index.html`));
    expect(missing, 'hub folders missing from pages.yml (cp line or test line)').toEqual([]);
  });

  // Cloudflare Pages runs tools/build-site/build.sh. It must publish exactly the pages.yml list: no tests, docs or tools.
  test('the Cloudflare build publishes the same files as pages.yml and nothing else', () => {
    const out = path.join(REPO, '_site');
    execFileSync('sh', [path.join(REPO, 'tools/build-site/build.sh')], { stdio: 'pipe' });
    const copied = /cp -r ([^\n]+) _site\//.exec(pages())[1].trim().split(/\s+/);
    expect(fs.readdirSync(out).sort()).toEqual([...copied].sort());
    LIVE_FILES.forEach((f) => expect(fs.existsSync(path.join(out, f)), f + ' must be built').toBe(true));
    fs.rmSync(out, { recursive: true, force: true });
  });

  // the owner's minutes plan (2 Nov 2026): once the repo is private, pushes skip the browser suite (weekly and hand-started runs keep it).
  test('private repo: pushes and PRs skip the browser suite; schedule and hand-started runs keep it', () => {
    const scope = (event, ref, priv) => execFileSync('bash', [path.join(REPO, 'tools/ci-local/docs-only.sh'), event, ref],
      { cwd: REPO, env: { ...process.env, GITHUB_OUTPUT: '', REPO_PRIVATE: priv } }).toString().trim();
    expect(scope('push', 'refs/heads/main', 'true')).toBe('browser=false');
    expect(scope('push', 'refs/heads/some-branch', 'true')).toBe('browser=false');
    expect(scope('pull_request', 'refs/pull/1/merge', 'true')).toBe('browser=false');
    expect(scope('schedule', 'refs/heads/main', 'true')).toBe('browser=true');
    expect(scope('workflow_dispatch', 'refs/heads/main', 'true')).toBe('browser=true');
    expect(scope('push', 'refs/heads/main', 'false')).toBe('browser=true');
    expect(read('.github/workflows/tests.yml')).toMatch(/REPO_PRIVATE: \$\{\{ github\.event\.repository\.private \}\}/);
    expect(pages()).toMatch(/\n  gate-shards:[\s\S]*?if: \$\{\{ !github\.event\.repository\.private \}\}/);
    expect(pages()).toMatch(/\n  gate:[\s\S]*?if: \$\{\{ !cancelled\(\) && !github\.event\.repository\.private \}\}/);
  });

  // Minutes trim (20 Nov 2026): the suite runs for pull requests and nightly, never on a plain push, and never twice for main.
  test('minutes trim: browser suite on pull requests, nightly and by hand only; main is not run twice; small checks are not doubled', () => {
    const on = (f) => { const t = read('.github/workflows/' + f); return t.slice(t.indexOf('\non:\n'), t.indexOf('\npermissions:')); };
    const tests = on('tests.yml');
    expect(tests).toMatch(/\n {2}pull_request:\n/);
    expect(tests, 'a merge queue, if ever used, still gets the required check').toMatch(/\n {2}merge_group:/);
    expect(tests).toMatch(/\n {2}schedule:\n/);
    expect(tests).toMatch(/\n {2}workflow_dispatch:\n/);
    expect(tests, 'tests.yml must not run on pushes: the publish gate already runs the suite on main').not.toMatch(/\n {2}push:/);
    expect(read('.github/workflows/tests.yml')).toMatch(/group: tests-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n {2}cancel-in-progress: true/);
    // The publish gate still runs the full suite on every push to main while the repo is public.
    expect(pages()).toMatch(/push:\n\s+branches: \[main\]/);
    expect(pages()).toMatch(/npx playwright test --project=mocked --project=phone/);
    // Small checks: once per pull request push and on main, not on every branch push as well.
    for (const f of ['gate.yml', 'lint.yml']) {
      expect(on(f), f).toMatch(/\n {2}push:\n {4}branches: \[main\]\n/);
      expect(on(f), f).toMatch(/\n {2}pull_request:\n/);
    }
    // The privacy guard is deliberately NOT trimmed: in a public repo a pushed branch is public at once, pull request or not.
    expect(on('privacy-guard.yml')).toMatch(/\n {2}push:\n {2}pull_request:\n/);
  });

  test('minutes trim: a pull request is judged like a branch push, and a quiet night skips the browser only when asked to', () => {
    const run = (event, ref, env) => execFileSync('bash', [path.join(REPO, 'tools/ci-local/docs-only.sh'), event, ref],
      { cwd: REPO, env: { ...process.env, GITHUB_OUTPUT: '', REPO_PRIVATE: 'false', NIGHTLY_SKIP_IDLE: '', NOW_EPOCH: '', ...env } }).toString().trim();
    const last = Number(execFileSync('git', ['log', '-1', '--format=%ct', 'HEAD'], { cwd: REPO }).toString().trim());
    // Nightly: fresh commit = run; older than 26 hours = skip; without the switch = always run.
    expect(run('schedule', 'refs/heads/main', { NIGHTLY_SKIP_IDLE: 'true', NOW_EPOCH: String(last + 3600) })).toBe('browser=true');
    expect(run('schedule', 'refs/heads/main', { NIGHTLY_SKIP_IDLE: 'true', NOW_EPOCH: String(last + 27 * 3600) })).toBe('browser=false');
    expect(run('schedule', 'refs/heads/main', { NOW_EPOCH: String(last + 27 * 3600) })).toBe('browser=true');
    // A hand-started run always runs the browser, whatever the age of the last commit.
    expect(run('workflow_dispatch', 'refs/heads/main', { NIGHTLY_SKIP_IDLE: 'true', NOW_EPOCH: String(last + 27 * 3600) })).toBe('browser=true');
    expect(read('.github/workflows/tests.yml')).toMatch(/NIGHTLY_SKIP_IDLE: 'true'/);
    // The script takes the pull request path (same rule as a branch push) instead of always saying true.
    expect(read('tools/ci-local/docs-only.sh')).toMatch(/\[ "\$event" = pull_request \]; then/);
    expect(run('pull_request', 'refs/pull/1/merge', {})).toMatch(/^browser=(true|false)$/);
    // Private repo: a merge-queue run skips the browser like pushes and pull requests do; public: it runs it.
    expect(run('merge_group', 'refs/heads/gh-readonly-queue/main/pr-1', { REPO_PRIVATE: 'true' })).toBe('browser=false');
    expect(run('merge_group', 'refs/heads/gh-readonly-queue/main/pr-1', {})).toBe('browser=true');
  });

  test('every action in pages.yml is pinned to a full commit id', () => {
    const loose = [...pages().matchAll(/uses:\s*([^\s#]+)/g)].map((x) => x[1]).filter((u) => !/@[0-9a-f]{40}$/.test(u));
    expect(loose).toEqual([]);
  });

  test('the live check after deploy runs the live feature check, and at least 8 tests carry the live tag', () => {
    const wf = read('.github/workflows/live-after-deploy.yml');
    expect(wf).toMatch(/npx playwright test --project=live-features/);
    expect(wf).toMatch(/LIVE_FEATURES: '1'/);
    expect(wf).toMatch(/report-issue\.js --state red --label live-site-red --title "cdhub: live feature check failed" --sha "\$MERGED_SHA" --failed /);
    expect(read('playwright.config.js')).toMatch(/name: 'live-features'[\s\S]*?grep: \/@live\\b\//);
    const live = fs.readdirSync(path.join(REPO, 'tests', 'mocked')).filter((f) => f.endsWith('.spec.js'))
      .flatMap((f) => [...read('tests/mocked/' + f).matchAll(/^\s*test\((['`])(?:(?!\1).|\\\1)*@live\b/gm)]);
    expect(live.length).toBeGreaterThanOrEqual(8);
  });

  test('the live check after deploy listens for the new publish workflow by its exact name', () => {
    const name = /^name:\s*(.+)$/m.exec(pages())[1].trim();
    expect(read('.github/workflows/live-after-deploy.yml')).toContain(`'${name}'`);
  });

  test('no page references a file that is not published', () => {
    const bad = [];
    ['index.html', 'cdhub/index.html', 'money/index.html'].forEach((f) => {
      [...read(f).matchAll(/\b(?:src|href)="([^"#:?]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?|mailto|tel|data)/.test(u) && !/^['"+\s]/.test(u)).forEach((u) => {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), u)).replace(/^\.\/$/, '.');
        const published = ['index.html', 'auth.js', 'config.js', 'toolkit.js', 'tokens.css', 'house.css', 'manifest.webmanifest', 'sw.js', 'icons/', 'cdhub/', 'money/', 'factory/', 'marketplace/', 'food/', 'studio/', 'estate/', 'enquiries/', 'breed-better/'].some((p) => target === p || target.startsWith(p) || target === '.' || target === '');
        if (!published) bad.push(`${f} refers to ${u}`);
      });
    });
    expect(bad).toEqual([]);
  });
});
