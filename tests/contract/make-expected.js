const fs = require('fs');
const path = require('path');
const FIX = path.join(__dirname, '..', 'fixtures');
const MC = (() => { const ctx = { window: {} }; require('vm').createContext(ctx); require('vm').runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'money', 'core.js'), 'utf8'), ctx); return ctx.window.MoneyCore; })();

const { parseCSV } = MC;
const { readsColumn, pageSource } = require('./headers');
const out = { _about: 'Column NAMES only (no values). What each page expects to find in the header line of each Drive file. Rebuild with tests/contract/make-expected.js, then review the diff.', money: {}, cdhub: {} };
const headOf = (file, key) => {
  const rows = parseCSV(fs.readFileSync(file, 'utf8'));
  for (let i = 0; i < Math.min(rows.length, 6); i++) if (rows[i].some((c) => c.trim() === key)) return rows[i].map((c) => c.trim());
  throw new Error('no header with ' + key + ' in ' + file);
};
const money = [...MC.INDEX.map((x) => ({ name: x.name, key: x.head })), ...Object.values(MC.LEDGER).map((x) => ({ name: x.name, key: x.head }))];
money.forEach((m) => { out.money[m.name] = { key: m.key, columns: headOf(path.join(FIX, 'mon', m.name === 'BALANCES.csv' ? 'BALANCES.csv' : m.name), m.key) }; });
Object.values(MC.XERO).forEach((x) => { out.money[x.base + '*.csv'] = { key: x.head, columns: [x.head], note: 'only the key column is pinned (no sample file)' }; });
fs.readdirSync(path.join(FIX, 'bld')).filter((f) => f.endsWith('.csv')).sort().forEach((f) => {
  const first = fs.readFileSync(path.join(FIX, 'bld', f), 'utf8').split(/\r?\n/)[0];
  out.cdhub[f] = { columns: parseCSV(first)[0].map((c) => c.trim()) };
});
for (const group of ['money', 'cdhub']) {
  const src = pageSource(group);
  Object.values(out[group]).forEach((e) => { e.read = e.columns.filter((c) => readsColumn(src, c)); });
}
const pretty = JSON.stringify(out, null, 2).replace(/\[\s+("[^\]]*?)\s+\]/g, (m, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ') + ']');
fs.writeFileSync(path.join(__dirname, 'expected-headers.json'), pretty + '\n');
console.log('Wrote tests/contract/expected-headers.json');

const STATE_OUT = path.join(__dirname, 'expected-state.json');
const src = (g) => pageSource(g);
const constList = (html, name) => [...(new RegExp('var ' + name + ' = \\[([^\\]]*)\\]').exec(html) || [, ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const json = (rel) => JSON.parse(fs.readFileSync(path.join(FIX, rel), 'utf8'));
const withRead = (group, e) => Object.assign(e, { read: e.columns.filter((c) => readsColumn(src(group), c)) });

const foodHtml = src('food');
const book = json('food/book.json');
out.food = {};
constList(foodHtml, 'RANGES').forEach((range) => {
  const tab = range.split('!')[0];
  if (tab === 'Cards') { out.food[tab] = withRead('food', { range, by: 'position', columns: constList(foodHtml, 'CARD_COLS') }); return; }
  const e = withRead('food', { range, by: 'header', header_row: Number(/!A(\d+)/.exec(range)[1]), columns: book[tab][0].map(String) });
  if (tab === 'Settings') e.keys_read = book.Settings.slice(1).map((r) => r[0]).filter((k) => readsColumn(foodHtml, k));
  out.food[tab] = e;
});

const mktHtml = src('marketplace');
out.marketplace = {
  'Open work tab': withRead('marketplace', { range: '<tab>!A2:L', by: 'position', columns: constList(mktHtml, 'COLS') }),
  'RR_LISTINGS.csv': withRead('marketplace', { key: 'listing_id', columns: headOf(path.join(FIX, 'marketplace', 'RR_LISTINGS.csv'), 'listing_id') })
};
fs.writeFileSync(path.join(__dirname, 'expected-headers.json'), JSON.stringify(out, null, 2).replace(/\[\s+("[^\]]*?)\s+\]/g, (m, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ') + ']') + '\n');

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
function shape(obj, html, at, into) {
  const items = Array.isArray(obj) ? obj : [obj];
  const map = into[at] || (into[at] = {});
  items.filter((o) => o && typeof o === 'object' && !Array.isArray(o)).forEach((o) => Object.keys(o).forEach((k) => {
    if (!readsColumn(html, k)) return;
    const v = o[k];
    map[k] = typeOf(v);
    if (v && typeof v === 'object' && (!Array.isArray(v) || (v.length && typeof v[0] === 'object'))) shape(v, html, (at ? at + '.' : '') + k + (Array.isArray(v) ? '[]' : ''), into);
  }));
  return into;
}
const studioHtml = src('studio');
const studioFields = shape(json('studio/contract-state.json'), studioHtml, '', {});
const top = studioFields['']; delete studioFields[''];
const REQUIRED = {
  '': ['generated_at', 'studio', 'health', 'accounts', 'products', 'brands', 'groups', 'assets', 'ideas', 'playbooks', 'packs', 'kits', 'bricks', 'frameworks', 'voices', 'looks', 'formats', 'sources', 'tools', 'gaps', 'failed'],
  'assets[]': ['id', 'title', 'stage'], 'ideas[]': ['id', 'title'], 'brands[]': ['id', 'name'],
  'kits[]': ['needs', 'formatIds', 'brickIds'], 'packs[]': ['kitIds']
};
const state = {
  _about: 'Field NAMES and JS types only (no values). What each page expects inside each JSON state file. Rebuild with tests/contract/make-expected.js, then review the diff.',
  studio: { 'studio-state.json': { fixture: 'tests/fixtures/studio/contract-state.json', top, fields: studioFields, required: REQUIRED } },
  marketplace: { 'MKT-WAKE-WEBAPP.json': { fixture: 'tests/fixtures/marketplace/MKT-WAKE-WEBAPP.json', top: shape(json('marketplace/MKT-WAKE-WEBAPP.json'), mktHtml, '', {})[''], fields: {}, required: { '': ['url'] } } }
};
fs.writeFileSync(STATE_OUT, JSON.stringify(state, null, 2) + '\n');
console.log('Wrote tests/contract/expected-state.json');

