#!/usr/bin/env node
// LOCAL / MANUAL check (JOB 31b): do your REAL Factory and Home JSON files still have the shape the pages expect?
//
//   node tests/contract/check-real-state-b.js <folder-of-downloaded-files> [--all] [--counts]
//   node tests/contract/check-real-state-b.js --dry-run     builds that folder from the invented fixtures, counts only
//
// Files it knows: af-state.json (Factory), DROPBOX-TOTALS.json and BIN-GUARD-WEBAPP.json (Home; the last name comes from
// config.js binGuard.webAppFile). Other files are ignored. It prints key names and codes only, never a value.
// It needs no sign-in, no key and no internet, and GitHub never runs it on real files. Sibling of check-real-headers.js
// (JOB 31), kept separate so it touches no file in JOB 31's open PRs.
// Exit code: 0 = all good, 1 = a key is missing, renamed, of the wrong type, the file is empty, or nothing matched.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkState } = require('./shape');

const FACTORY = require('./expected-factory.json').factory['af-state.json'];
const HOME = require('./expected-home.json').home;
const LIST = { 'af-state.json': FACTORY, 'DROPBOX-TOTALS.json': HOME['DROPBOX-TOTALS.json'], 'BIN-GUARD-WEBAPP.json': HOME['BIN-GUARD-WEBAPP.json'] };
const REPO = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const COUNTS = DRY || argv.includes('--counts'); // counts only: no file or key names printed
const say = (line) => { if (!COUNTS) console.log(line); };

/** --dry-run: a throwaway folder holding the invented fixtures under the names the real downloads would have. */
function dryFolder() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'job31b-dry-'));
  const { build } = require('../fixtures/factory/state.js');
  fs.writeFileSync(path.join(d, 'af-state.json'), JSON.stringify(build(Date.now())));
  ['DROPBOX-TOTALS.json', 'BIN-GUARD-WEBAPP.json'].forEach((f) => fs.copyFileSync(path.join(REPO, LIST[f].fixture), path.join(d, f)));
  return d;
}

const dir = DRY ? dryFolder() : argv.find((a) => !a.startsWith('--'));
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error('Usage: node tests/contract/check-real-state-b.js <folder-with-downloaded-files> [--all] [--counts]   or   --dry-run');
  process.exit(2);
}
let checked = 0, bad = 0, skipped = 0;
const byCode = {};
for (const f of fs.readdirSync(dir).filter((x) => /\.json$/i.test(x)).sort()) {
  if (!LIST[f]) { skipped++; continue; }
  let obj = null;
  try { obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { obj = null; }
  const problems = checkState(f, LIST[f], obj).filter((x) => x.code !== 'EXTRA' || argv.includes('--all'));
  checked++;
  problems.forEach((x) => { byCode[x.code] = (byCode[x.code] || 0) + 1; });
  if (problems.length) { bad++; problems.forEach((x) => say('PROBLEM  ' + x.code + '  ' + x.msg)); } else say('ok       ' + f);
}
console.log(`${COUNTS ? '' : '\n'}Checked ${checked} file(s); ${bad} with a problem; ${skipped} not on the list (ignored).`);
if (COUNTS) console.log('Problems by kind: ' + (Object.keys(byCode).length ? Object.entries(byCode).map(([k, n]) => k + ' ' + n).join(', ') : 'none'));
if (DRY) fs.rmSync(dir, { recursive: true, force: true });
if (!checked) console.log('Nothing matched. Check the folder has af-state.json, DROPBOX-TOTALS.json or BIN-GUARD-WEBAPP.json.');
process.exit(bad || !checked ? 1 : 0);
