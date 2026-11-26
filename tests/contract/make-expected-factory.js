const fs = require('fs');
const path = require('path');
const { readsColumn } = require('./headers');

const REPO = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(REPO, 'factory', 'index.html'), 'utf8');
const { build } = require('../fixtures/factory/state.js');
const state = JSON.parse(JSON.stringify(build(Date.parse('2026-10-28T10:10:00Z'))));

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
function shape(obj, at, into) {
  const items = Array.isArray(obj) ? obj : [obj];
  const map = into[at] || (into[at] = {});
  items.filter((o) => o && typeof o === 'object' && !Array.isArray(o)).forEach((o) => Object.keys(o).forEach((k) => {
    if (at && !readsColumn(html, k)) return;
    const v = o[k];
    if (v !== null || !(k in map)) map[k] = typeOf(v);
    if (v && typeof v === 'object' && (!Array.isArray(v) || (v.length && typeof v[0] === 'object'))) shape(v, (at ? at + '.' : '') + k + (Array.isArray(v) ? '[]' : ''), into);
  }));
  return into;
}
const NULLABLE = { parent: 'string', pri: 'object', due: 'number' };
const fields = shape(state, '', {});
Object.keys(fields).filter((at) => /^lists\.\w+\[\]$/.test(at)).forEach((at) => {
  Object.keys(fields[at]).forEach((k) => { if (fields[at][k] === 'null' && NULLABLE[k]) fields[at][k] = NULLABLE[k]; });
});
const top = fields['']; delete fields[''];

const TASK = ['id', 'name', 'status', 'tags', 'updated'];
const REQUIRED = { '': ['generated_at', 'mode', 'lists'], lists: ['apps', 'decisions', 'sends', 'work', 'incidents'] };
['apps', 'decisions', 'sends', 'work', 'incidents'].forEach((l) => { if (fields['lists.' + l + '[]']) REQUIRED['lists.' + l + '[]'] = TASK; });

const out = {
  _about: 'Field NAMES and JS types only (no values). What the Factory page expects inside af-state.json. Rebuild with tests/contract/make-expected-factory.js, then review the diff.',
  factory: { 'af-state.json': { fixture: 'tests/fixtures/factory/state.js (build)', top, fields, required: REQUIRED } }
};
fs.writeFileSync(path.join(__dirname, 'expected-factory.json'), JSON.stringify(out, null, 2) + '\n');
console.log('Wrote tests/contract/expected-factory.json');

