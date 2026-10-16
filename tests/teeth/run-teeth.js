#!/usr/bin/env node
// "TEETH" CHECK. Proves the tests can actually fail.
// For each deliberate break below: copy the site to a temporary folder, break ONE thing in the copy, run the
// matching tests there, and expect them to go RED. If a break goes unnoticed, this check fails loudly.
// The real files in this repo are never touched. Weekly in GitHub (teeth.yml); locally: node tests/teeth/run-teeth.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SKIP = /^(\.git|node_modules|test-results|playwright-report|docs)$/;

// find: exact text that must appear exactly once in `file` (if not, this list is out of date: reported, not ignored)
const BREAKS = [
  { id: 'back-link', what: 'Money Hub "← Dashboard" link goes to the wrong place', file: 'money/index.html',
    find: '<a class="back" href="../">', replace: '<a class="back" href="../nowhere/">', project: 'mocked', spec: 'main-dashboard' },
  { id: 'write-scope', what: 'Main dashboard asks Google for more than read-only access', file: 'index.html',
    find: "var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';", replace: "var SCOPE = 'https://www.googleapis.com/auth/drive';", project: 'mocked', spec: 'main-dashboard' },
  { id: 'rr-inside-folder', what: 'Bin stops noticing an RR_ item inside a ZZ_ folder', file: 'index.html',
    find: "if (isArchiveName(r.files[i].name)) return true;", replace: "", project: 'mocked', spec: 'bin-safety' },
  { id: 'rr-folder-chain', what: 'Bin stops protecting ZZ_ items that sit inside an RR_ folder', file: 'index.html',
    find: "if (chain.some(isArchiveName)) {", replace: "if (false) {", project: 'mocked', spec: 'bin-safety' },
  { id: 'rename-prefix', what: 'PC-Personal rename stops adding the ZZ_DELETE_DRIVE_ prefix', file: 'index.html',
    find: "{ name: PCP_PREFIX + f.name }", replace: "{ name: f.name }", project: 'mocked', spec: 'personal-and-drive-check' },
  { id: 'bom', what: 'Money CSV reader stops ignoring the hidden start-of-file marker', file: 'money/core.js',
    find: ".replace(/^\\uFEFF/, '')", replace: "", project: 'mocked', spec: 'csv-parsing' },
  { id: 'renamed-column', what: 'Money page starts reading "income_vs_avg" instead of the Drive column "income_vs_avg_pct"', file: 'money/index.html',
    find: "income_vs_avg_pct", replace: "income_vs_avg", project: 'mocked', spec: 'header-contract' },
  { id: 'sideways-scroll', what: 'Money Hub becomes wider than a phone screen', file: 'money/index.html',
    find: '</head>', replace: '<style>body{min-width:700px}</style></head>', project: 'phone', spec: 'phone' },
];

const only = process.argv[2]; // optional: run just one break id
const results = [];
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'teeth-'));

BREAKS.filter((b) => !only || b.id === only).forEach((b, i) => {
  const copy = path.join(tmpRoot, b.id);
  fs.cpSync(REPO, copy, { recursive: true, filter: (src) => !SKIP.test(path.basename(src)) || src === REPO });
  fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(copy, 'node_modules'));
  const target = path.join(copy, b.file);
  const text = fs.readFileSync(target, 'utf8');
  const count = text.split(b.find).length - 1;
  if (count !== 1) { results.push({ ...b, outcome: 'OUT OF DATE', note: `expected the text once in ${b.file}, found ${count}` }); return; }
  fs.writeFileSync(target, text.replace(b.find, () => b.replace));
  const run = spawnSync('npx', ['playwright', 'test', `--project=${b.project}`, b.spec, '--reporter=dot', '--retries=0', '--workers=2'], {
    cwd: copy, encoding: 'utf8', env: { ...process.env, CI: 'true', PORT: String(4300 + i) }, timeout: 240000,
  });
  const failures = (/(\d+) failed/.exec(run.stdout || '') || [])[1];
  results.push({ ...b, outcome: run.status === 0 ? 'SURVIVED' : 'caught', note: run.status === 0 ? 'the tests did NOT notice this break' : `${failures || 'some'} test(s) failed, as they should` });
});

fs.rmSync(tmpRoot, { recursive: true, force: true });

const lines = ['## Teeth check: can the tests still fail?', '', '| Result | Deliberate break | Detail |', '|---|---|---|'];
results.forEach((r) => lines.push(`| ${r.outcome === 'caught' ? '✅ caught' : '❌ ' + r.outcome} | ${r.what} | ${r.note} |`));
const bad = results.filter((r) => r.outcome !== 'caught');
lines.push('', bad.length ? `**${bad.length} problem(s).** A "SURVIVED" line means a real break would also have gone unnoticed. "OUT OF DATE" means the page text changed and this list needs updating.` : `All ${results.length} deliberate breaks were caught.`);
const text = lines.join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
process.stdout.write(text);
process.exit(bad.length ? 1 : 0);
