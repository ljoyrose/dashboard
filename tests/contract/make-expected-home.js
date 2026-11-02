// ONE-OFF helper, kept so the list can be rebuilt: node tests/contract/make-expected-home.js
// JOB 31b: the Home hub (root index.html). Writes tests/contract/expected-home.json from the invented fixtures and the
// page code. Field NAMES and JS types only: no values are copied. Same entry layout as expected-state.json, so
// checkState(file, entry, obj) in shape.js works unchanged. After running, read the diff: a changed list is a decision.
const fs = require('fs');
const path = require('path');
const { readsColumn } = require('./headers');

const REPO = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8'); // pageSource() has no 'home' group, so read it here
const json = (rel) => JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'));
const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
/** Top-level key -> type, keeping only the keys index.html reads (.key, ['key'] or "key"). Both files are flat. */
const top = (obj) => Object.fromEntries(Object.keys(obj).filter((k) => readsColumn(html, k)).map((k) => [k, typeOf(obj[k])]));

const DBX = 'tests/fixtures/dropbox/DROPBOX-TOTALS.json';
const BG = 'tests/contract/fixture-home-bin-guard.json';
const out = {
  _about: 'Field NAMES and JS types only (no values). What the Home hub (index.html) expects inside each JSON file it reads from Drive. Rebuild with tests/contract/make-expected-home.js, then review the diff.',
  home: {
    // Required: the four counts. The page writes num(dd.x || 0), so a lost or renamed count shows a confident "0"
    // instead of an error. "complete" too: the page only says "(scan not finished)" when it is exactly false, so a lost
    // or text "false" hides an unfinished scan. "generated" stays optional: without it the page honestly says "date unknown".
    'DROPBOX-TOTALS.json': { fixture: DBX, top: top(json(DBX)), fields: {}, required: { '': ['complete', 'marked_files', 'marked_gb', 'duplicate_files', 'wasted_gb'] } },
    // The Bin guard web-app file (config.js binGuard.webAppFile). loadBgUrl() reads j.url and keeps it only if bgUrlOk().
    'BIN-GUARD-WEBAPP.json': { fixture: BG, top: top(json(BG)), fields: {}, required: { '': ['url'] } }
  }
};
fs.writeFileSync(path.join(__dirname, 'expected-home.json'), JSON.stringify(out, null, 2) + '\n');
console.log('Wrote tests/contract/expected-home.json');
