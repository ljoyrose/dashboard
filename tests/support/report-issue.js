// Keeps ONE GitHub Issue per kind of problem up to date. Uses only the GitHub CLI (`gh`) and the run's own
// built-in token (GITHUB_TOKEN). No Slack, no webhooks, no extra secrets. GitHub emails the repo owner about issues.
//
//   node tests/support/report-issue.js --state red   --label tests-red --title-prefix "Dashboard tests are red" --results test-results/results.json
//   node tests/support/report-issue.js --state green --label tests-red
//
// red   : opens the issue, or (if one is already open with that label) updates its title and adds one comment. Never a second issue.
// green : closes the open issue with that label (if any), with a short comment.
// Environment: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID (all provided by GitHub Actions).
const { execFileSync } = require('child_process');
const { groupOf, load, isFailed } = require('./results');

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : dflt; };
const state = arg('state');
const label = arg('label', 'tests-red');
const prefix = arg('title-prefix', 'Dashboard tests are red');
const results = arg('results', 'test-results/results.json');
const note = arg('note', '');
const repo = process.env.GITHUB_REPOSITORY;
const runUrl = `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const dry = process.argv.includes('--dry-run');

const gh = (...a) => {
  if (dry) { console.log('gh ' + a.join(' ')); return ''; }
  return execFileSync('gh', a, { encoding: 'utf8' }).trim();
};

function failingPages() {
  if (results === 'none') return { pages: [], lines: [] };
  const tests = load(results);
  if (!tests) return { pages: [], lines: ['The test run did not produce a results file (it stopped early).'] };
  const failed = tests.filter(isFailed);
  const pages = [...new Set(failed.map((t) => groupOf(t.file)[1]))];
  const lines = failed.slice(0, 15).map((t) => `- **${t.title}**: ${t.error.slice(0, 160)}`);
  if (failed.length > 15) lines.push(`- …and ${failed.length - 15} more.`);
  return { pages, lines };
}

function openIssue() {
  const out = dry ? '' : gh('issue', 'list', '--label', label, '--state', 'open', '--json', 'number', '--jq', '.[0].number // empty');
  return out || null;
}
function ensureLabel() {
  try { gh('label', 'create', label, '--color', 'B60205', '--description', 'Opened and closed by the test robot. Do not delete by hand.', '--force'); } catch (e) { /* label exists */ }
}

if (state === 'red') {
  const { pages, lines } = failingPages();
  const what = pages.length ? pages.join(', ') : (note || 'unknown page');
  const title = `${prefix}: ${what}`.slice(0, 120);
  const body = [
    `The robot found a problem on ${new Date().toISOString().slice(0, 10)}.`, '',
    `**Where:** ${what}`, note ? `**Note:** ${note}` : '', '',
    ...lines, '',
    `**Open the run:** ${runUrl}`, '',
    'This issue is opened and closed by the robot. It closes itself when the next scheduled run is green. See TESTS.md, "If something goes red".',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  ensureLabel();
  const n = openIssue();
  if (n) {
    gh('issue', 'edit', n, '--title', title);
    gh('issue', 'comment', n, '--body', `Still red, or red again. ${what}\n\n${lines.join('\n')}\n\nRun: ${runUrl}`);
    console.log(`Updated issue #${n}`);
  } else {
    gh('issue', 'create', '--title', title, '--label', label, '--body', body);
    console.log('Opened a new issue');
  }
} else if (state === 'green') {
  const n = openIssue();
  if (n) {
    gh('issue', 'close', n, '--comment', `Green again. Closing. Run: ${runUrl}`);
    console.log(`Closed issue #${n}`);
  } else console.log('Green, and no open issue. Nothing to do.');
} else {
  console.error('Use --state red or --state green');
  process.exit(2);
}
