// Reads Playwright's results file into a plain list of tests. Shared by summary.js and report-issue.js.
const fs = require('fs');

// [file name fragment, plain name, where]. First match wins.
const GROUPS = [
  ['main-dashboard', 'Main dashboard', '/dashboard/'],
  ['bin-safety', 'Bin safety (RR_ archives never taken)', '/dashboard/#/bin'],
  ['personal-and-drive-check', 'PC-Personal and Drive check (rename and bin)', '/dashboard/#/personal, #/usb'],
  ['cdhub', 'CD Hub', '/dashboard/cdhub/'],
  ['money', 'Money Hub', '/dashboard/money/'],
  ['csv-parsing', 'Reading CSV files', 'both CSV readers'],
  ['ci-guards', 'Learning loop and alarm wiring (docs and CI scripts)', 'TESTS.md, .github, tests/support'],
  ['header-contract', 'Header contract (column names)', 'expected-headers.json'],
  ['look-and-access', 'Dark mode, accessibility, text size', 'all three pages'],
  ['phone', 'Phone-sized screen', 'all three pages, 390 x 844'],
  ['repo-hygiene', 'Safety checks (no secrets, no real data)', 'whole repo'],
  ['live-smoke', 'Live site check (optional)', 'ljoyrose.github.io'],
];
const groupOf = (f) => GROUPS.find((g) => f.includes(g[0])) || [f, f, ''];

function load(file) {
  if (!fs.existsSync(file)) return null;
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
  return tests;
}
const isFailed = (t) => t.status === 'unexpected' || t.status === 'timedOut' || t.status === 'failed';
const isRegression = (t) => /@regression\b/.test(t.title);

module.exports = { GROUPS, groupOf, load, isFailed, isRegression };
