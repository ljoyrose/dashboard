const fs = require('fs');
const path = require('path');
const { readsColumn } = require('./headers');

const REPO = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const json = (rel) => JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'));
const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
const top = (obj) => Object.fromEntries(Object.keys(obj).filter((k) => readsColumn(html, k)).map((k) => [k, typeOf(obj[k])]));

const DBX = 'tests/fixtures/dropbox/DROPBOX-TOTALS.json';
const BG = 'tests/contract/fixture-home-bin-guard.json';
const out = {
  _about: 'Field NAMES and JS types only (no values). What the Home hub (index.html) expects inside each JSON file it reads from Drive. Rebuild with tests/contract/make-expected-home.js, then review the diff.',
  home: {
    'DROPBOX-TOTALS.json': { fixture: DBX, top: top(json(DBX)), fields: {}, required: { '': ['complete', 'marked_files', 'marked_gb', 'duplicate_files', 'wasted_gb'] } },
    'BIN-GUARD-WEBAPP.json': { fixture: BG, top: top(json(BG)), fields: {}, required: { '': ['url'] } }
  }
};
fs.writeFileSync(path.join(__dirname, 'expected-home.json'), JSON.stringify(out, null, 2) + '\n');
console.log('Wrote tests/contract/expected-home.json');

