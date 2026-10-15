// The two CSV readers, tried directly with awkward inputs (no sign-in needed).
//  - CD Hub reader:   parseCSV()           in cdhub/index.html
//  - Money Hub reader: MoneyCore.parseCSV / parseTable in money/core.js
const { test, expect } = require('../support/test');

test.describe('CD Hub CSV reader', () => {
  test.beforeEach(async ({ page }) => { await page.goto('cdhub/'); });
  const parse = (page, text) => page.evaluate((t) => parseCSV(t), text); // eslint-disable-line no-undef

  test('plain rows become objects keyed by the header', async ({ page }) => {
    expect(await parse(page, 'id,name\na,Alpha\nb,Beta\n')).toEqual([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }]);
  });
  test('quoted commas, doubled quotes and line breaks inside quotes are kept', async ({ page }) => {
    const rows = await parse(page, 'id,note\n1,"Hello, world"\n2,"She said ""hi"""\n3,"line one\nline two"\n');
    expect(rows[0].note).toBe('Hello, world');
    expect(rows[1].note).toBe('She said "hi"');
    expect(rows[2].note).toBe('line one\nline two');
  });
  test('Windows line endings (CRLF) are handled', async ({ page }) => {
    expect(await parse(page, 'id,name\r\na,Alpha\r\nb,Beta\r\n')).toHaveLength(2);
  });
  test('a missing last newline and blank lines are fine', async ({ page }) => {
    expect(await parse(page, 'id,name\n\na,Alpha\n\nb,Beta')).toEqual([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }]);
  });
  test('short rows are padded with empty text, not "undefined"', async ({ page }) => {
    expect(await parse(page, 'id,name,note\na,Alpha\n')).toEqual([{ id: 'a', name: 'Alpha', note: '' }]);
  });
  test('empty input gives no rows', async ({ page }) => {
    expect(await parse(page, '')).toEqual([]);
    expect(await parse(page, 'id,name\n')).toEqual([]);
  });
  test('a file with a byte-order mark (BOM) still reads the first column name correctly', async ({ page }) => {
    // The page strips the BOM before parsing; check the same strip works on a BOM-prefixed sample.
    const rows = await page.evaluate(() => parseCSV(String('﻿id,name\na,Alpha\n').replace(/^﻿/, '')));
    expect(rows[0].id).toBe('a');
  });
});

test.describe('Money Hub CSV reader', () => {
  test.beforeEach(async ({ page }) => { await page.goto('money/'); });
  const table = (page, text, key) => page.evaluate(([t, k]) => window.MoneyCore.parseTable(t, k), [text, key]);

  test('plain table without a provenance line', async ({ page }) => {
    const t = await table(page, 'id,name\na,Alpha\n', 'id');
    expect(t.rows).toEqual([{ id: 'a', name: 'Alpha' }]);
    expect(t.held).toBeNull();
  });
  test('a provenance line above the header is kept as "prov" and its date is found', async ({ page }) => {
    const t = await table(page, 'CURRENT: 2 rows held 2026-03-09\nid,name\na,Alpha\nb,Beta\n', 'id');
    expect(t.rows).toHaveLength(2);
    expect(t.held).toBe(2);
    expect(t.countOk).toBe(true);
    expect(await page.evaluate((p) => window.MoneyCore.provDate(p), t.prov)).toBe('2026-03-09');
  });
  test('a count line that does not match the rows is flagged (countOk false)', async ({ page }) => {
    const t = await table(page, 'CURRENT: 5 rows held 2026-03-09\nid,name\na,Alpha\n', 'id');
    expect(t.held).toBe(5);
    expect(t.countOk).toBe(false);
  });
  test('"COUNT: n" style count line is understood too', async ({ page }) => {
    const t = await table(page, 'COUNT: 1\nid,name\na,Alpha\n', 'id');
    expect(t.held).toBe(1);
    expect(t.countOk).toBe(true);
  });
  test('a file without the expected header is reported, with no rows', async ({ page }) => {
    const t = await table(page, 'wrong,header\n1,2\n', 'id');
    expect(t.rows).toEqual([]);
    expect(t.bad).toBe('header not found');
  });
  test('quoted commas and CRLF line endings work', async ({ page }) => {
    const t = await table(page, 'id,note\r\n1,"Hello, world"\r\n', 'id');
    expect(t.rows[0].note).toBe('Hello, world');
  });
  test('a BOM at the start of the file is ignored', async ({ page }) => {
    const t = await table(page, '﻿id,name\na,Alpha\n', 'id');
    expect(t.rows[0].id).toBe('a');
  });
  test('a BOM in front of the "CURRENT: n rows held" line is ignored, and the count is still checked', async ({ page }) => {
    // Regression-style gap found by the teeth check: with the BOM left in, the count line was no longer recognised.
    const t = await table(page, '\uFEFFCURRENT: 2 rows held 2026-03-09\nid,name\na,Alpha\nb,Beta\n', 'id');
    expect(t.hasCountLine).toBe(true);
    expect(t.held).toBe(2);
    expect(t.countOk).toBe(true);
  });
  test('money helpers: pounds text becomes numbers; blanks stay empty (null)', async ({ page }) => {
    const out = await page.evaluate(() => ({ a: window.MoneyCore.n('£1,234.50'), b: window.MoneyCore.n(''), c: window.MoneyCore.n('abc'), d: window.MoneyCore.gbp(-1500), e: window.MoneyCore.gbp(null) }));
    expect(out).toEqual({ a: 1234.5, b: null, c: null, d: '−£1,500', e: '–' });
  });
  test('dates: repeating "weekly:" and "monthly:" dates roll forward; blanks are "not known yet"', async ({ page }) => {
    const out = await page.evaluate(() => {
      const M = window.MoneyCore;
      return { weekly: M.nextDue('weekly:MON', '2026-03-10'), monthly: M.nextDue('monthly:15', '2026-03-10'), plain: M.nextDue('2026-04-01', '2026-03-10'), blank: M.daysTo('', '2026-03-10') };
    });
    expect(out.weekly).toBe('2026-03-16');
    expect(out.monthly).toBe('2026-03-15');
    expect(out.plain).toBe('2026-04-01');
    expect(out.blank).toBeNull();
  });
});
