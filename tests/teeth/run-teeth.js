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

const { BREAKS } = require('./breaks');

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
