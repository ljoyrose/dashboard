// FOOD DATA CONTRACT (JOB 31). No browser, no Google. Names and types only.
// If the food engine changes a tab of RR_FOOD, a test here goes red before Lisa's page breaks.
// Each failure case proves itself: CONTRACT_PROVE_RED=1 flips it to expect "no problem", so it must go red.
const { test, expect } = require('@playwright/test');
const { EXPECTED } = require('./headers');
const { fixture, pageFns, constList, checkColumns, checkRows, codes } = require('./shape');

const E = EXPECTED.food;
const book = () => JSON.parse(fixture('food/book.json'));
const RED = !!process.env.CONTRACT_PROVE_RED;
const caught = (problems, code) => (RED ? expect(problems).toEqual([]) : expect(codes(problems)).toEqual([code]));
const { fns } = pageFns('food', ['table']); // the page's own tab reader
// Number cells the page runs through num(): text there silently becomes 0, so it counts as a wrong type.
const NUMBERS = { Orders: ['customer_orders', 'profit_est', 'boxes', 'ga_total'], Invoices: ['total', 'goods', 'delivery', 'vat'], Statements: ['total_outstanding'], DirectDebits: ['amount'],
  Products: ['fresh_meat_pct', 'protein_pct', 'ga_price_ex_vat_portal_oct26', 'ga_price_ex_vat_list_aug25', 'shopify_price_inc_vat', 'subscription_price_inc_vat', 'profit_ex_vat_1bag_1box'] };

/** Every problem in one tab: header names, data rows, number cells and (Cards) the detail JSON. */
function checkTab(tab, values) {
  const e = E[tab];
  const out = checkColumns(tab, e, values[0] && values[0].map(String));
  if (out.some((x) => x.code === 'EMPTY')) return out;
  const rows = e.by === 'position'
    ? values.slice(1).map((v) => Object.fromEntries(constList('food', 'CARD_COLS').map((c, k) => [c, v[k] || ''])))
    : fns.table(values);
  out.push(...checkRows(tab, rows));
  rows.forEach((r, i) => {
    (NUMBERS[tab] || []).forEach((c) => { const v = String(r[c] === undefined ? '' : r[c]); if (v !== '' && !isFinite(Number(v.replace(/[£,]/g, '')))) out.push({ code: 'WRONG_TYPE', msg: `${tab} row ${i + 1}: "${c}" is not a number` }); });
    if (tab === 'Cards') { let d; try { d = JSON.parse(r.detail || '{}'); } catch (err) { d = null; } if (!d || typeof d !== 'object' || Array.isArray(d)) out.push({ code: 'WRONG_TYPE', msg: `Cards row ${i + 1}: "detail" is not a JSON object` }); }
  });
  return out;
}

test.describe('Food contract: the invented workbook matches the list @contract', () => {
  test('every tab the page asks for is on the list, in the same order', () => {
    expect(constList('food', 'RANGES')).toEqual(Object.values(E).map((e) => e.range));
  });
  for (const tab of Object.keys(E)) {
    test(`${tab}: names, rows and types are clean`, () => { expect(checkTab(tab, book()[tab])).toEqual([]); });
  }
  test("the page's own reader gives every column the page reads, on every row", () => {
    const b = book(), lost = [];
    for (const [tab, e] of Object.entries(E)) {
      if (e.by === 'position') continue;
      fns.table(b[tab]).forEach((r, i) => e.read.filter((c) => !(c in r)).forEach((c) => lost.push(`${tab} row ${i + 1}: ${c}`)));
    }
    expect(lost).toEqual([]);
  });
  test('Settings: every setting key the page reads has a row', () => {
    const have = book().Settings.slice(1).map((r) => r[0]);
    expect(E.Settings.keys_read.filter((k) => !have.includes(k))).toEqual([]);
  });
});

test.describe('Food contract: each kind of change gives a named failure @contract', () => {
  test('missing column: Orders loses "profit_est"', () => {
    const v = book().Orders, i = v[0].indexOf('profit_est');
    caught(checkTab('Orders', v.map((r) => r.filter((_, k) => k !== i))), 'MISSING');
  });
  test('renamed column: Invoices "total" becomes "total_gbp"', () => {
    const v = book().Invoices; v[0] = v[0].map((c) => (c === 'total' ? 'total_gbp' : c));
    caught(checkTab('Invoices', v), 'RENAMED');
  });
  test('renamed by position: Cards swaps "title" and "detail"', () => {
    const v = book().Cards; v[0] = v[0].map((c) => (c === 'title' ? 'detail' : c === 'detail' ? 'title' : c));
    caught(checkTab('Cards', v), 'RENAMED');
  });
  test('extra column: Codes gains "colour"', () => {
    const v = book().Codes; v.forEach((r, i) => r.push(i ? 'blue' : 'colour'));
    caught(checkTab('Codes', v), 'EXTRA');
  });
  test('wrong type: an Orders "profit_est" holds words', () => {
    const v = book().Orders; v[1][v[0].indexOf('profit_est')] = 'twelve pounds';
    caught(checkTab('Orders', v), 'WRONG_TYPE');
  });
  test('wrong type: a Cards "detail" is not JSON', () => {
    const v = book().Cards; v[1][4] = 'not json';
    caught(checkTab('Cards', v), 'WRONG_TYPE');
  });
  test('empty tab: Products comes back with nothing', () => { caught(checkTab('Products', []), 'EMPTY'); });
  test('empty tab: Statements has a header but no rows', () => { caught(checkTab('Statements', book().Statements.slice(0, 1)), 'EMPTY'); });
});
