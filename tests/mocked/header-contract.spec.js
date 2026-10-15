// HEADER CONTRACT. No browser, no Google, no Drive.
// tests/contract/expected-headers.json lists the COLUMN NAMES each Drive file should have (names only, no values).
// These checks make sure the pages, the sample files and that list all still agree, so a renamed column
// cannot slip through just because the pretend Drive can never rename anything.
// To check your REAL files too, run the local script: node tests/contract/check-real-headers.js <folder> (see TESTS.md).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { EXPECTED, moneyCore, headerOf, compareHeader, readsColumn, pageSource } = require('../contract/headers');

const FIX = path.resolve(__dirname, '..', 'fixtures');
const files = (dir) => fs.readdirSync(path.join(FIX, dir)).filter((f) => f.endsWith('.csv')).sort();
const text = (rel) => fs.readFileSync(path.join(FIX, rel), 'utf8');

test.describe('Header contract: expected column names @contract', () => {
  test('Money: the sample files have exactly the expected columns', () => {
    const problems = [];
    for (const [name, e] of Object.entries(EXPECTED.money)) {
      if (name.includes('*')) continue; // Xero files: key column only, no sample
      problems.push(...compareHeader(name, e, headerOf(text('mon/' + name), e.key)));
    }
    expect(problems).toEqual([]);
  });

  test('Money: the personal sample balances file has the same columns as the company one', () => {
    expect(compareHeader('BALANCES-PERSONAL.csv', EXPECTED.money['BALANCES.csv'], headerOf(text('mon/BALANCES-PERSONAL.csv'), 'account'))).toEqual([]);
  });

  test('Money: every sample file is on the expected list (no file escapes the contract)', () => {
    const listed = new Set(Object.keys(EXPECTED.money));
    expect(files('mon').filter((f) => f !== 'BALANCES-PERSONAL.csv' && !listed.has(f))).toEqual([]);
  });

  test('CD Hub: the sample tables have exactly the expected columns, and every sample is on the list', () => {
    const problems = [];
    for (const f of files('bld')) {
      const e = EXPECTED.cdhub[f];
      if (!e) { problems.push(f + ': not on the expected list'); continue; }
      problems.push(...compareHeader(f, e, headerOf(text('bld/' + f), null)));
    }
    expect(problems).toEqual([]);
  });

  test('Money: the page code looks for the same files, folders and key columns as the list', () => {
    const mc = moneyCore();
    const fromCode = {};
    mc.INDEX.forEach((x) => { fromCode[x.name] = x.head; });
    Object.values(mc.LEDGER).forEach((x) => { fromCode[x.name] = x.head; });
    Object.values(mc.XERO).forEach((x) => { fromCode[x.base + '*.csv'] = x.head; });
    const fromList = Object.fromEntries(Object.entries(EXPECTED.money).map(([n, e]) => [n, e.key]));
    expect(fromCode).toEqual(fromList);
  });

  test('CD Hub: the page still asks for every table on the list', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '..', '..', 'cdhub', 'index.html'), 'utf8');
    const want = [...(/var WANT=\[([\s\S]*?)\];/.exec(html) || [, ''])[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(want.length).toBeGreaterThan(10);
    expect(Object.keys(EXPECTED.cdhub).filter((f) => !want.includes(f))).toEqual([]);
  });

  test('the page code still reads every column it read when the list was made', () => {
    const lost = [];
    for (const group of ['money', 'cdhub']) {
      const src = pageSource(group);
      for (const [name, e] of Object.entries(EXPECTED[group])) {
        (e.read || []).filter((c) => !readsColumn(src, c)).forEach((c) => lost.push(`${group} ${name}: the page no longer reads "${c}"`));
      }
    }
    // If this fails: either a column was renamed (update the page, the sample file and expected-headers.json together)
    // or the page was reworked on purpose (rebuild the list with tests/contract/make-expected.js and review the diff).
    expect(lost).toEqual([]);
  });
});

test.describe('Header contract: the comparison itself works', () => {
  const E = { key: 'id', columns: ['id', 'subject', 'owner'] };
  test('a renamed column is reported as missing plus new', () => {
    const p = compareHeader('X.csv', E, ['id', 'subject', 'owner_name']);
    expect(p.join('\n')).toMatch(/"owner" no longer in the file/);
    expect(p.join('\n')).toMatch(/new column "owner_name"/);
  });
  test('a different order is reported', () => {
    expect(compareHeader('X.csv', E, ['subject', 'id', 'owner']).join()).toMatch(/different order/);
  });
  test('the header is found below the "CURRENT: n rows held" line, and a hidden start-of-file marker is ignored', () => {
    expect(headerOf('﻿CURRENT: 1 rows held 2026-03-09\nid,subject,owner\nR1,a,b\n', 'id')).toEqual(['id', 'subject', 'owner']);
  });
  test('no header at all is reported, never passed', () => {
    expect(compareHeader('X.csv', E, headerOf('nothing,here\n1,2\n', 'id')).join()).toMatch(/could not find a header/);
  });
  test('the column-reading check notices a rename in page code', () => {
    expect(readsColumn('rows.map(r => r.due_on)', 'due_on')).toBe(true);
    expect(readsColumn("rows.map(r => r['due_on'])", 'due_on')).toBe(true);
    expect(readsColumn('rows.map(r => r.due_date)', 'due_on')).toBe(false);
  });
});
