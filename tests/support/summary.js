// Turns Playwright's results file into a short, readable table for the GitHub "Actions" page.
// Usage: node tests/support/summary.js [results.json]   (writes to $GITHUB_STEP_SUMMARY if set, else prints)
const fs = require('fs');

const file = process.argv[2] || 'test-results/results.json';
const out = [];
const GROUPS = [
  ['main-dashboard', 'Main dashboard', '/dashboard/'],
  ['cdhub', 'CD Hub', '/dashboard/cdhub/'],
  ['money', 'Money Hub', '/dashboard/money/'],
  ['csv-parsing', 'Reading CSV files', 'both CSV readers'],
  ['repo-hygiene', 'Safety checks (no secrets, no real data)', 'whole repo'],
  ['live-smoke', 'Live site check (optional)', 'ljoyrose.github.io'],
];

if (!fs.existsSync(file)) {
  out.push('## ❌ Tests did not produce a results file', '', 'The test run stopped before it finished. Open the "Run tests" step above to see why.');
  finish(out);
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const tests = [];
(function walk(suite, trail) {
  const here = suite.title && !/\.spec\.js$/.test(suite.title) ? trail.concat(suite.title) : trail;
  (suite.specs || []).forEach((spec) =>
    spec.tests.forEach((t) => {
      const last = t.results[t.results.length - 1] || {};
      tests.push({
        file: spec.file, title: here.concat(spec.title).join(' › '), status: t.status,
        ms: t.results.reduce((a, r) => a + (r.duration || 0), 0),
        error: ((last.error && last.error.message) || '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').find((l) => l.trim()) || '',
      });
    })
  );
  (suite.suites || []).forEach((s) => walk(s, here));
})({ suites: data.suites }, []);

const groupOf = (f) => GROUPS.find((g) => f.includes(g[0])) || [f, f, ''];
const rows = new Map();
tests.forEach((t) => {
  const g = groupOf(t.file);
  const r = rows.get(g[0]) || { name: g[1], where: g[2], pass: 0, fail: 0, flaky: 0, skip: 0, ms: 0 };
  if (t.status === 'expected') r.pass++;
  else if (t.status === 'flaky') { r.pass++; r.flaky++; }
  else if (t.status === 'skipped') r.skip++;
  else r.fail++;
  r.ms += t.ms;
  rows.set(g[0], r);
});

const total = [...rows.values()].reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail, skip: a.skip + r.skip, flaky: a.flaky + r.flaky }), { pass: 0, fail: 0, skip: 0, flaky: 0 });
const green = total.fail === 0 && total.pass > 0;
out.push(green ? '## ✅ All green' : '## ❌ Something needs a look', '');
out.push(`**${total.pass} passed**, **${total.fail} failed**${total.skip ? `, ${total.skip} skipped` : ''}${total.flaky ? `, ${total.flaky} needed a retry` : ''}.`, '');
out.push('Google sign-in and Drive were **pretend** in every one of these checks. Nothing real was contacted.', '');
out.push('| Result | Page or area | Where | Passed | Failed | Skipped | Time |', '|---|---|---|---:|---:|---:|---:|');
[...rows.values()].forEach((r) => {
  const icon = r.fail ? '❌' : r.pass ? '✅' : '⏭️';
  out.push(`| ${icon} | ${r.name} | ${r.where} | ${r.pass} | ${r.fail} | ${r.skip} | ${(r.ms / 1000).toFixed(0)}s |`);
});
const failed = tests.filter((t) => t.status === 'unexpected' || t.status === 'timedOut' || t.status === 'failed');
if (failed.length) {
  out.push('', '### What failed', '');
  failed.slice(0, 25).forEach((t) => out.push(`- **${t.title}** (${groupOf(t.file)[1]})  \n  ${t.error.slice(0, 200)}`));
  if (failed.length > 25) out.push(`- …and ${failed.length - 25} more. See the report download below.`);
  out.push('', 'Screenshots and step-by-step recordings of each failure are in the **playwright-report** download at the bottom of this page.');
}
finish(out);

function finish(lines) {
  const text = lines.join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  else process.stdout.write(text);
}
