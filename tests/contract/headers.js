const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '..', '..');
const EXPECTED = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected-headers.json'), 'utf8'));

function moneyCore() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(REPO, 'money', 'core.js'), 'utf8'), ctx);
  return ctx.window.MoneyCore;
}

function headerOf(text, keyCol) {
  const mc = moneyCore();
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).slice(0, 8).join('\n');
  const rows = mc.parseCSV(lines);
  if (keyCol) {
    for (let i = 0; i < Math.min(rows.length, 6); i++) if (rows[i].some((c) => c.trim() === keyCol)) return rows[i].map((c) => c.trim());
    return null;
  }
  return rows[0] ? rows[0].map((c) => c.trim()) : null;
}

function compareHeader(file, expected, found) {
  if (!found) return [`${file}: could not find a header line${expected.key ? ` containing "${expected.key}"` : ''}`];
  const problems = [];
  const missing = expected.columns.filter((c) => !found.includes(c));
  const extra = found.filter((c) => !expected.columns.includes(c));
  if (missing.length) problems.push(`${file}: column${missing.length > 1 ? 's' : ''} ${missing.map((c) => `"${c}"`).join(', ')} no longer in the file (the page expects ${missing.length > 1 ? 'them' : 'it'})`);
  if (extra.length) problems.push(`${file}: new column${extra.length > 1 ? 's' : ''} ${extra.map((c) => `"${c}"`).join(', ')} (the page does not know ${extra.length > 1 ? 'them' : 'it'}; harmless, but update expected-headers.json)`);
  if (!missing.length && !extra.length && found.join('|') !== expected.columns.join('|')) problems.push(`${file}: same columns but in a different order`);
  return problems;
}

function entryFor(name) {
  for (const group of ['money', 'cdhub']) {
    const g = EXPECTED[group];
    if (g[name]) return { group, name, entry: g[name] };
    for (const k of Object.keys(g)) if (k.endsWith('*.csv') && name.startsWith(k.slice(0, -5)) && name.endsWith('.csv')) return { group, name: k, entry: g[k] };
  }
  return null;
}

function readsColumn(source, col) {
  const esc = col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('\\.' + esc + '\\b|[\'"`]' + esc + '[\'"`]').test(source);
}
function pageSource(group) {
  const r = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
  if (group === 'money') return r('money/core.js') + r('money/index.html') + r('index.html');
  if (group === 'food' || group === 'marketplace' || group === 'studio') return r(group + '/index.html');
  return r('cdhub/index.html') + r('cdhub/enquiries-view.js');
}

module.exports = { readsColumn, pageSource, EXPECTED, REPO, moneyCore, headerOf, compareHeader, entryFor };

