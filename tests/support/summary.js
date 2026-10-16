// Turns Playwright's results file into a short, readable table for the GitHub "Actions" page.
// Usage: node tests/support/summary.js [results.json]   (writes to $GITHUB_STEP_SUMMARY if set, else prints)
const fs = require('fs');
const { groupOf, load, isFailed, isRegression } = require('./results');

const file = process.argv[2] || 'test-results/results.json';
const out = [];

const tests = load(file);
if (!tests) {
  out.push('## ❌ Tests did not produce a results file', '', 'The test run stopped before it finished. Open the "Run tests" step above to see why.');
  finish(out);
  process.exit(0);
}

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

// Bug-fix tests ("@regression") and pretend-Drive drift, each as one plain line.
const reg = tests.filter(isRegression);
const regOk = reg.filter((t) => t.status === 'expected' || t.status === 'flaky').length;
out.push('', `**Regression tests** (each one guards a bug that was fixed): ${reg.length} in the suite, ${regOk} passing.`);
const drift = readDrift();
out.push(drift === null ? '' : `**Pretend-Drive drift:** the pages made ${drift} Drive request${drift === 1 ? '' : 's'} the pretend Drive did not know how to answer.${drift ? ' Not a failure. If this number grows, the pages have started asking Drive something new, and the pretend Drive needs teaching.' : ''}`);

// Docs check (a warning, never a failure): does TESTS.md quote the right total?
if (tests.some((t) => /(^|\/)mocked\//.test(t.file))) {
  const m = /That is (\d+) checks that must pass/.exec(fs.existsSync('TESTS.md') ? fs.readFileSync('TESTS.md', 'utf8') : '');
  const counted = total.pass + total.fail;
  if (m) out.push(Number(m[1]) === counted ? `**Docs check:** TESTS.md says ${m[1]} checks, this run counted ${counted}. ✅` : `**⚠ Docs check:** TESTS.md says ${m[1]} checks but this run counted ${counted}. Update the number in TESTS.md ("What is checked, page by page"). Not a failure.`);
}

const failed = tests.filter(isFailed);
if (failed.length) {
  out.push('', '### What failed', '');
  failed.slice(0, 25).forEach((t) => out.push(`- **${t.title}** (${groupOf(t.file)[1]})  \n  ${t.error.slice(0, 200)}`));
  if (failed.length > 25) out.push(`- …and ${failed.length - 25} more. See the report download below.`);
  out.push('', 'Screenshots and step-by-step recordings of each failure are in the **playwright-report** download at the bottom of this page.');
}
finish(out);

function readDrift() {
  const f = require('path').join(require('path').dirname(file), 'unhandled-drive.jsonl');
  if (!tests.some((t) => /(^|\/)(mocked|phone)\//.test(t.file))) return null; // the live check uses no pretend Drive
  if (!fs.existsSync(f)) return 0;
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length;
}

function finish(lines) {
  const text = lines.join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  else process.stdout.write(text);
}
