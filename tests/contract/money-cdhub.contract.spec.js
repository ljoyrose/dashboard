// MONEY AND CD HUB DATA CONTRACT (JOB 31b). No browser, no Google. Names and types only.
// tests/mocked/header-contract.spec.js already pins the column lists for these two hubs. This file adds what JOB 31 added
// for Food, Marketplace and Studio: every sample file read through the page's own CSV reader (money/core.js parseCSV),
// date and number cells checked, and each kind of change (MISSING, RENAMED, EXTRA, WRONG_TYPE, EMPTY) giving a named failure.
// Each failure case proves itself: CONTRACT_PROVE_RED=1 flips it to expect "no problem", so it must go red.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { EXPECTED, moneyCore } = require('./headers');
const { FIX, checkColumns, checkRows, codes } = require('./shape');

const RED = !!process.env.CONTRACT_PROVE_RED;
const caught = (problems, code) => (RED ? expect(problems).toEqual([]) : expect(codes(problems)).toEqual([code]));
const { parseCSV } = moneyCore();
// Cell kinds by column name. Dates must be YYYY-MM or YYYY-MM-DD (the pages compare them as text); numbers must parse.
const DATE = /^(as_of|due|due_on|next_due|last_received|expected_on|cash_as_of|runs_dry_on|week_of|month|born_on|dob|performed_on|mated_on|due_date)$/;
const NUMBER = /^(amount|balance|cash_bank|net_month|projected_balance|income_vs_avg_pct|expense_vs_avg_pct|weight_kg|body_condition_score|bcs_scale)$/;

const SAMPLES = [
  ...Object.entries(EXPECTED.money).filter(([n]) => !n.includes('*')).map(([name, e]) => ({ group: 'money', name, e, file: path.join(FIX, 'mon', name) })),
  ...Object.entries(EXPECTED.cdhub).map(([name, e]) => ({ group: 'cdhub', name, e, file: path.join(FIX, 'bld', name) }))
];
const text = (s) => fs.readFileSync(s.file, 'utf8');

/** Every problem in one file: header names (found by key below any "CURRENT:" line), data rows, date and number cells. */
function checkFile(name, e, body) {
  const rows = parseCSV(String(body).replace(/^﻿/, ''));
  const at = e.key ? rows.findIndex((r, i) => i < 6 && r.some((c) => c.trim() === e.key)) : 0;
  const head = at >= 0 && rows[at] ? rows[at].map((c) => c.trim()) : null;
  const out = checkColumns(name, e, head && head.some(Boolean) ? head : (e.key && rows.length ? rows[0].map((c) => c.trim()) : null));
  if (out.some((x) => x.code === 'EMPTY')) return out;
  const data = rows.slice((at < 0 ? 0 : at) + 1).filter((r) => r.some((c) => c.trim()));
  out.push(...checkRows(name, data));
  data.forEach((r, i) => (head || []).forEach((c, k) => {
    const v = String(r[k] == null ? '' : r[k]).trim();
    if (!v) return;
    if (DATE.test(c) && !/^\d{4}-\d{2}(-\d{2})?/.test(v)) out.push({ code: 'WRONG_TYPE', msg: `${name} row ${i + 1}: "${c}" is not a date` });
    if (NUMBER.test(c) && !isFinite(Number(v.replace(/[£,]/g, '')))) out.push({ code: 'WRONG_TYPE', msg: `${name} row ${i + 1}: "${c}" is not a number` });
  }));
  return out;
}
/** Change one header cell, or one cell in the first data row, of a CSV text. */
function edit(body, fn) {
  const lines = body.split(/\r?\n/);
  const at = lines.findIndex((l, i) => i < 6 && !/^CURRENT:/.test(l) && l.includes(','));
  const head = parseCSV(lines[at])[0], row = parseCSV(lines[at + 1])[0];
  fn(head, row);
  const csv = (r) => r.map((c) => (/[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(',');
  lines[at] = csv(head); lines[at + 1] = csv(row);
  return lines.join('\n');
}
const sample = (name) => SAMPLES.find((s) => s.name === name);

test.describe('Money and CD Hub contract: the invented samples match the list @contract', () => {
  for (const s of SAMPLES) {
    test(`${s.group} ${s.name}: names, rows and types are clean through the page's own reader`, () => { expect(checkFile(s.name, s.e, text(s))).toEqual([]); });
  }
});

test.describe('Money and CD Hub contract: each kind of change gives a named failure @contract', () => {
  const run = (name, body) => checkFile(name, sample(name).e, body);
  test('missing column: MON-DATES.csv loses "due_on"', () => {
    caught(run('MON-DATES.csv', edit(text(sample('MON-DATES.csv')), (h) => { h.splice(h.indexOf('due_on'), 1); })), 'MISSING');
  });
  test('renamed column: BALANCES.csv "balance" becomes "balance_gbp"', () => {
    caught(run('BALANCES.csv', edit(text(sample('BALANCES.csv')), (h) => { h[h.indexOf('balance')] = 'balance_gbp'; })), 'RENAMED');
  });
  test('renamed column: BLD-subject.csv "dob" becomes "date_of_birth"', () => {
    caught(run('BLD-subject.csv', edit(text(sample('BLD-subject.csv')), (h) => { h[h.indexOf('dob')] = 'date_of_birth'; })), 'RENAMED');
  });
  test('extra column: BLD-weight.csv gains "colour"', () => {
    const body = text(sample('BLD-weight.csv')).split('\n').map((l, i) => (l ? l + (i ? ',x' : ',colour') : l)).join('\n');
    caught(run('BLD-weight.csv', body), 'EXTRA');
  });
  test('wrong type: a CASHFLOW.csv "amount" holds words', () => {
    caught(run('CASHFLOW.csv', edit(text(sample('CASHFLOW.csv')), (h, r) => { r[h.indexOf('amount')] = 'five hundred'; })), 'WRONG_TYPE');
  });
  test('wrong type: a MON-DATES.csv "due_on" is written as a UK date (text sort would misorder it)', () => {
    caught(run('MON-DATES.csv', edit(text(sample('MON-DATES.csv')), (h, r) => { r[h.indexOf('due_on')] = '01/03/2026'; })), 'WRONG_TYPE');
  });
  test('empty file: MON-REGISTER.csv comes back with nothing', () => { caught(run('MON-REGISTER.csv', ''), 'EMPTY'); });
  test('empty file: BLD-litter.csv has a header but no rows', () => { caught(run('BLD-litter.csv', text(sample('BLD-litter.csv')).split('\n')[0] + '\n'), 'EMPTY'); });
});
