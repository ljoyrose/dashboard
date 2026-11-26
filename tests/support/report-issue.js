// Keeps ONE GitHub Issue per kind of problem up to date. Uses only the GitHub CLI (`gh`) and the run's own
// built-in token (GITHUB_TOKEN). No Slack, no webhooks, no extra secrets. GitHub emails the repo owner about issues.
//
//   node tests/support/report-issue.js --state red   --label tests-red
//   node tests/support/report-issue.js --state green --label tests-red
//
// red   : opens the issue, or (if one is already open with that label) updates its title and adds one comment. Never a second issue.
// green : closes the open issue with that label (if any), with a short comment.
// Environment: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_SERVER_URL, GITHUB_RUN_ID (all provided by GitHub Actions).
const { execFileSync } = require('child_process');

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : dflt; };
const state = arg('state');
const label = arg('label', 'tests-red');
const dry = process.argv.includes('--dry-run');

const gh = (...a) => {
  if (dry) { console.log('gh ' + a.join(' ')); return ''; }
  return execFileSync('gh', a, { encoding: 'utf8' }).trim();
};

function openIssue() {
  const out = dry ? '' : gh('issue', 'list', '--label', label, '--state', 'open', '--json', 'number', '--jq', '.[0].number // empty');
  return out || null;
}
function ensureLabel() {
  try { gh('label', 'create', label, '--color', 'B60205', '--description', 'Opened and closed by the test robot. Do not delete by hand.', '--force'); } catch (e) { /* label exists */ }
}

if (state === 'red') {
  const title = 'cdhub: check failed';
  const body = 'Technical check failed.';
  ensureLabel();
  const n = openIssue();
  if (n) {
    gh('issue', 'edit', n, '--title', title);
    gh('issue', 'comment', n, '--body', body);
    console.log(`Updated issue #${n}`);
  } else {
    gh('issue', 'create', '--title', title, '--label', label, '--body', body);
    console.log('Opened a new issue');
  }
} else if (state === 'green') {
  const n = openIssue();
  if (n) {
    gh('issue', 'close', n, '--comment', 'Technical check passed.');
    console.log(`Closed issue #${n}`);
  } else console.log('Green, and no open issue. Nothing to do.');
} else {
  console.error('Use --state red or --state green');
  process.exit(2);
}
