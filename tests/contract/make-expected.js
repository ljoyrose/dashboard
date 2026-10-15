// ONE-OFF helper, kept so the list can be rebuilt: node tests/contract/make-expected.js
// Reads the column NAMES (first header line only) from the invented sample files and writes expected-headers.json.
// No cell values are copied. After running, read the diff: a changed column list is a decision, not an accident.
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
// "read": the columns the page code actually reads today. The test fails if the page stops reading one of them.
for (const group of ['money', 'cdhub']) {
  const src = pageSource(group);
  Object.values(out[group]).forEach((e) => { e.read = e.columns.filter((c) => readsColumn(src, c)); });
}
const pretty = JSON.stringify(out, null, 2).replace(/\[\s+("[^\]]*?)\s+\]/g, (m, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ') + ']');
fs.writeFileSync(path.join(__dirname, 'expected-headers.json'), pretty + '\n');
console.log('Wrote tests/contract/expected-headers.json');
