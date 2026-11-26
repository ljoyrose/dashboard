#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { headerOf, compareHeader, entryFor } = require('./headers');

const os = require('os');
const { EXPECTED } = require('./headers');
const { checkColumns, checkState, EXPECTED_STATE, fixture } = require('./shape');
const DRY = process.argv.includes('--dry-run');
const COUNTS = DRY || process.argv.includes('--counts');
const say = (line) => { if (!COUNTS) console.log(line); };

/** --dry-run: a throwaway folder holding the invented fixtures under the names the owner's downloads would have. */
function dryFolder() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'job31-dry-'));
  const csv = (rows) => rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : String(c))).join(',')).join('\n') + '\n';
  const book = JSON.parse(fixture('food/book.json'));
  Object.keys(EXPECTED.food).forEach((tab) => fs.writeFileSync(path.join(d, 'RR_FOOD - ' + tab + '.csv'), csv(book[tab])));
  fs.writeFileSync(path.join(d, 'Open work - Marketplace.csv'), csv(JSON.parse(fixture('marketplace/open-work.json')).rows));
  fs.writeFileSync(path.join(d, 'RR_LISTINGS.csv'), fixture('marketplace/RR_LISTINGS.csv'));
  fs.writeFileSync(path.join(d, 'MKT-WAKE-WEBAPP.json'), fixture('marketplace/MKT-WAKE-WEBAPP.json'));
  fs.writeFileSync(path.join(d, 'studio-state.json'), fixture('studio/contract-state.json'));
  ['mon', 'bld'].forEach((g) => fs.readdirSync(path.join(__dirname, '..', 'fixtures', g)).filter((f) => f.endsWith('.csv') && f !== 'BALANCES-PERSONAL.csv').forEach((f) => fs.copyFileSync(path.join(__dirname, '..', 'fixtures', g, f), path.join(d, f))));
  return d;
}
function hubEntryFor(name) {
  const tab = (/(?:^|[ -])([A-Za-z]+)\.csv$/i.exec(name) || [])[1];
  if (tab && /^RR_FOOD/i.test(name) && EXPECTED.food[tab]) return { group: 'food', name: tab, entry: EXPECTED.food[tab], key: EXPECTED.food[tab].columns[0] };
  if (/ - Marketplace\.csv$/i.test(name)) return { group: 'marketplace', name: 'Open work tab', entry: EXPECTED.marketplace['Open work tab'], key: 'key' };
  if (name === 'RR_LISTINGS.csv') return { group: 'marketplace', name, entry: EXPECTED.marketplace[name], key: 'listing_id' };
  return null;
}
const JSONS = { 'studio-state.json': EXPECTED_STATE.studio['studio-state.json'], 'MKT-WAKE-WEBAPP.json': EXPECTED_STATE.marketplace['MKT-WAKE-WEBAPP.json'] };

const dir = DRY ? dryFolder() : process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error('Usage: node tests/contract/check-real-headers.js <folder-with-downloaded-CSV-files> [--all] [--counts]   or   --dry-run');
  process.exit(2);
}
const files = fs.readdirSync(dir).filter((f) => /\.(csv|json)$/i.test(f)).sort();
let checked = 0, bad = 0, skipped = 0;
const byCode = {};
const tally = (problems) => problems.forEach((x) => { byCode[x.code] = (byCode[x.code] || 0) + 1; });
for (const f of files) {
  if (JSONS[f]) {
    let obj = null;
    try { obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { obj = null; }
    const problems = checkState(f, JSONS[f], obj).filter((x) => x.code !== 'EXTRA' || process.argv.includes('--all'));
    checked++; tally(problems);
    if (problems.length) { bad++; problems.forEach((x) => say('PROBLEM  ' + x.code + '  ' + x.msg)); } else say('ok       ' + f);
    continue;
  }
  const hub = hubEntryFor(f);
  if (hub) {
    const top = fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 8192); // top of the file only
    const found = headerOf(top, hub.key) || headerOf(top, null);
    const problems = checkColumns(f, hub.entry, found).filter((x) => x.code !== 'EXTRA' || process.argv.includes('--all'));
    checked++; tally(problems);
    if (problems.length) { bad++; problems.forEach((x) => say('PROBLEM  ' + x.code + '  ' + x.msg)); } else say('ok       ' + f);
    continue;
  }
  if (!f.toLowerCase().endsWith('.csv')) { skipped++; continue; }
  const hit = entryFor(f);
  if (!hit) { skipped++; continue; }
  const fd = fs.openSync(path.join(dir, f), 'r');
  const buf = Buffer.alloc(8192); // top of the file only
  const n = fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  const found = headerOf(buf.slice(0, n).toString('utf8'), hit.group === 'money' ? hit.entry.key : null);
  const problems = compareHeader(f, hit.entry, found).filter((p) => !/harmless/.test(p) || process.argv.includes('--all'));
  checked++;
  if (problems.length) { bad++; byCode.COLUMNS = (byCode.COLUMNS || 0) + problems.length; problems.forEach((p) => say('PROBLEM  ' + p)); } else say('ok       ' + f);
}
console.log(`${COUNTS ? '' : '\n'}Checked ${checked} file(s); ${bad} with a problem; ${skipped} not on the list (ignored).`);
if (COUNTS) console.log('Problems by kind: ' + (Object.keys(byCode).length ? Object.entries(byCode).map(([k, n]) => k + ' ' + n).join(', ') : 'none'));
if (DRY) fs.rmSync(dir, { recursive: true, force: true });
if (!checked) console.log('Nothing matched. Check the folder has files such as MON-REGISTER.csv or BLD-subject.csv.');
process.exit(bad || !checked ? 1 : 0);

