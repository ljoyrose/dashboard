const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO, readsColumn, pageSource } = require('./headers');

const EXPECTED_STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected-state.json'), 'utf8'));
const FIX = path.join(REPO, 'tests', 'fixtures');
const fixture = (rel) => fs.readFileSync(path.join(FIX, rel), 'utf8');

function extractFn(html, name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('function ' + name + ' not found in the page');
  let i = html.indexOf('{', start), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error('function ' + name + ' has no end');
}
function pageFns(hub, names, pre) {
  const html = pageSource(hub);
  const ctx = vm.createContext({ Date, JSON, String, Number, Object, Array });
  vm.runInContext((pre || '') + '\n' + names.map((n) => extractFn(html, n)).join('\n') + '\nthis.__fns = {' + names.join(',') + '};', ctx);
  return { fns: ctx.__fns, ctx };
}
function constList(hub, name) {
  const m = new RegExp('var ' + name + ' = \\[([^\\]]*)\\]').exec(pageSource(hub));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
}

const p = (code, file, msg) => ({ code, file, msg: file + ': ' + msg });
const codes = (problems) => [...new Set(problems.map((x) => x.code))].sort();

function checkColumns(file, entry, found) {
  if (!found || !found.length || found.every((c) => !String(c).trim())) return [p('EMPTY', file, 'no header line found')];
  const want = entry.columns;
  const missing = want.filter((c) => !found.includes(c));
  const extra = found.filter((c) => c && !want.includes(c));
  const out = [];
  const pairs = Math.min(missing.length, extra.length);
  for (let i = 0; i < pairs; i++) out.push(p('RENAMED', file, `"${missing[i]}" looks renamed to "${extra[i]}"`));
  missing.slice(pairs).forEach((c) => out.push(p('MISSING', file, `column "${c}" is gone (the page reads it)`)));
  extra.slice(pairs).forEach((c) => out.push(p('EXTRA', file, `new column "${c}" (the page does not know it)`)));
  if (!out.length && entry.by === 'position' && found.slice(0, want.length).join('|') !== want.join('|')) out.push(p('RENAMED', file, 'same columns in a different order (the page reads by position)'));
  return out;
}
function checkRows(file, rows) { return rows && rows.length ? [] : [p('EMPTY', file, 'no data rows')]; }

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
function checkState(file, entry, obj) {
  if (obj === null || obj === undefined || typeOf(obj) !== 'object' || !Object.keys(obj).length) return [p('EMPTY', file, 'the file is empty or not a JSON object')];
  const out = [];
  const walk = (val, at, types) => {
    const items = at.endsWith('[]') || at === '' ? (Array.isArray(val) ? val : [val]) : [val];
    items.forEach((o, n) => {
      if (!o || typeof o !== 'object' || Array.isArray(o)) return;
      const where = at ? `${at.replace(/\[\]$/, '')}[${n}]` : 'top';
      const req = (entry.required || {})[at] || [];
      const unknown = Object.keys(o).filter((k) => !(k in types) && k !== 'example');
      const gone = req.filter((k) => !(k in o));
      const pairs = Math.min(gone.length, unknown.length);
      for (let i = 0; i < pairs; i++) out.push(p('RENAMED', file, `${where}: "${gone[i]}" looks renamed to "${unknown[i]}"`));
      gone.slice(pairs).forEach((k) => out.push(p('MISSING', file, `${where}: required "${k}" is gone`)));
      if (at === '') unknown.slice(pairs).forEach((k) => out.push(p('EXTRA', file, `${where}: new key "${k}" (the page does not know it)`)));
      Object.entries(types).forEach(([k, t]) => {
        if (!(k in o)) return;
        const got = typeOf(o[k]);
        const okNull = got === 'null' && !req.includes(k);
        if (got !== t && !okNull) out.push(p('WRONG_TYPE', file, `${where}: "${k}" should be ${t}, is ${got}`));
        else if (got === t && (t === 'object' || t === 'array')) {
          const sub = (at ? at + '.' : '') + k + (t === 'array' ? '[]' : '');
          if (entry.fields[sub]) walk(o[k], sub, entry.fields[sub]);
        }
      });
    });
  };
  walk(obj, '', entry.top);
  return out;
}

module.exports = { EXPECTED_STATE, FIX, fixture, extractFn, pageFns, constList, checkColumns, checkRows, checkState, codes, typeOf, readsColumn, pageSource };

