// MARKETPLACE DATA CONTRACT (JOB 31). No browser, no Google. Names and types only.
// Covers the Open work tab (read by position), RR_LISTINGS.csv (read by header) and the wake file (JSON).
// Each failure case proves itself: CONTRACT_PROVE_RED=1 flips it to expect "no problem", so it must go red.
const { test, expect } = require('@playwright/test');
const { EXPECTED } = require('./headers');
const { EXPECTED_STATE, fixture, pageFns, constList, checkColumns, checkRows, checkState, codes } = require('./shape');

const E = EXPECTED.marketplace;
const WAKE = EXPECTED_STATE.marketplace['MKT-WAKE-WEBAPP.json'];
const RED = !!process.env.CONTRACT_PROVE_RED;
const caught = (problems, code) => (RED ? expect(problems).toEqual([]) : expect(codes(problems)).toEqual([code]));
const { fns } = pageFns('marketplace', ['csvRows']); // the page's own CSV reader
const openWork = () => JSON.parse(fixture('marketplace/open-work.json')).rows;
const listings = () => fixture('marketplace/RR_LISTINGS.csv');
const IDEAS = require('../../marketplace/ideas-core.js');
const ideas = () => JSON.parse(fixture('marketplace/ideas.json')).rows;

/** Ideas tab (product ideas): header in contract order (read by position), words in the pick-list columns from the allowed list,
 *  and every invented id in the fixture says FAKE or SAMPLE. Names and types only. */
function checkIdeas(values) {
  const out = checkColumns('Ideas tab', E['Ideas tab'], values[0]);
  if (out.some((x) => x.code === 'EMPTY')) return out;
  const rows = values.slice(1).map((v) => Object.fromEntries(IDEAS.COLS.map((c, k) => [c, v[k] || ''])));
  out.push(...checkRows('Ideas tab', rows));
  rows.forEach((r, i) => {
    Object.keys(IDEAS.ENUMS).forEach((c) => { if (r[c] && IDEAS.ENUMS[c].indexOf(r[c]) < 0) out.push({ code: 'WRONG_TYPE', msg: `Ideas row ${i + 1}: "${c}" is not one of the allowed words` }); });
    if (!r.name) out.push({ code: 'WRONG_TYPE', msg: `Ideas row ${i + 1}: "name" is empty (the only required field)` });
    if (!/FAKE|SAMPLE/.test(r.id)) out.push({ code: 'WRONG_TYPE', msg: `Ideas row ${i + 1}: an invented id must contain FAKE or SAMPLE` });
  });
  return out;
}

/** Open work: row 1 header in page order, rows mapped by position like the page, detail must be a JSON object. */
function checkOpenWork(values) {
  const out = checkColumns('Open work tab', E['Open work tab'], values[0]);
  if (out.some((x) => x.code === 'EMPTY')) return out;
  const cols = constList('marketplace', 'COLS');
  const rows = values.slice(1).map((v) => Object.fromEntries(cols.map((c, k) => [c, v[k] || ''])));
  out.push(...checkRows('Open work tab', rows));
  rows.forEach((r, i) => { let d; try { d = JSON.parse(r.detail || '{}'); } catch (err) { d = null; } if (!d || typeof d !== 'object' || Array.isArray(d)) out.push({ code: 'WRONG_TYPE', msg: `Open work row ${i + 1}: "detail" is not a JSON object` }); });
  return out;
}
/** RR_LISTINGS.csv: the page scans the first 5 lines for "listing_id"; without it the photos silently vanish. */
function checkListings(text) {
  const t = fns.csvRows(text).filter((r) => r.some((c) => c.trim()));
  if (!t.length) return [{ code: 'EMPTY', msg: 'RR_LISTINGS.csv: empty file' }];
  let h = t.slice(0, 5).findIndex((r) => r.indexOf('listing_id') >= 0);
  const header = h >= 0 ? t[h] : t.slice(0, 5).find((r) => r.length > 1) || t[0];
  if (h < 0) h = t.indexOf(header);
  const out = checkColumns('RR_LISTINGS.csv', E['RR_LISTINGS.csv'], header);
  out.push(...checkRows('RR_LISTINGS.csv', t.slice(h + 1)));
  const id = header.indexOf('platform_item_id');
  t.slice(h + 1).forEach((r, i) => { if (id >= 0 && r[id] && !/^\d{6,}$/.test(r[id])) out.push({ code: 'WRONG_TYPE', msg: `RR_LISTINGS.csv row ${i + 1}: "platform_item_id" is not an item number` }); });
  return out;
}

test.describe('Marketplace contract: the invented files match the list @contract', () => {
  test('Open work tab: names, rows and detail JSON are clean', () => { expect(checkOpenWork(openWork())).toEqual([]); });
  test('RR_LISTINGS.csv: names and rows are clean, found below a junk first line', () => { expect(checkListings(listings())).toEqual([]); });
  test('Ideas tab: 25 columns in order, allowed words, invented ids, the range matches', () => {
    expect(checkIdeas(ideas())).toEqual([]);
    expect(IDEAS.COLS.length).toBe(25);
    expect(IDEAS.RANGE).toBe('Ideas!A2:Y');
    expect(E['Ideas tab'].range).toBe(IDEAS.RANGE);
  });
  test('wake file: the one field has the right type', () => { expect(checkState('MKT-WAKE-WEBAPP.json', WAKE, JSON.parse(fixture('marketplace/MKT-WAKE-WEBAPP.json')))).toEqual([]); });
  test("the page's own CSV reader keeps quoted commas and drops a start-of-file marker", () => {
    expect(fns.csvRows('﻿listing_id,title\r\nL-1,"Sample, with comma"\n')).toEqual([['listing_id', 'title'], ['L-1', 'Sample, with comma']]);
  });
});

test.describe('Marketplace contract: each kind of change gives a named failure @contract', () => {
  test('missing column: Open work loses "applied_by"', () => { caught(checkOpenWork(openWork().map((r) => r.slice(0, 11))), 'MISSING'); });
  test('renamed column: RR_LISTINGS "image_url" becomes "image"', () => { caught(checkListings(listings().replace('image_url', 'image')), 'RENAMED'); });
  test('renamed by position: Open work swaps "answer" and "note"', () => {
    const v = openWork(); v[0] = v[0].map((c) => (c === 'answer' ? 'note' : c === 'note' ? 'answer' : c));
    caught(checkOpenWork(v), 'RENAMED');
  });
  test('extra column: RR_LISTINGS gains "colour"', () => { caught(checkListings(listings().split('\n').map((l, i) => (!l || i === 0 ? l : l + (i === 1 ? ',colour' : ',blue'))).join('\n')), 'EXTRA'); });
  test('wrong type: an Open work "detail" is not JSON', () => { const v = openWork(); v[1][4] = 'not json'; caught(checkOpenWork(v), 'WRONG_TYPE'); });
  test('wrong type: the wake "url" is a number', () => { caught(checkState('MKT-WAKE-WEBAPP.json', WAKE, { url: 42 }), 'WRONG_TYPE'); });
  test('wrong type: an RR_LISTINGS "platform_item_id" holds words', () => { caught(checkListings(listings().replace(',100000000001\n', ',sample\n')), 'WRONG_TYPE'); });
  test('empty file: RR_LISTINGS has nothing in it', () => { caught(checkListings(''), 'EMPTY'); });
  test('empty file: the wake file is {}', () => { caught(checkState('MKT-WAKE-WEBAPP.json', WAKE, {}), 'EMPTY'); });
  test('empty tab: Open work has no header row', () => { caught(checkOpenWork([]), 'EMPTY'); });
  test('missing column: Ideas loses "dropped_reason"', () => { caught(checkIdeas(ideas().map((r) => r.slice(0, 24))), 'MISSING'); });
  test('renamed by position: Ideas swaps "verdict" and "gate"', () => {
    const v = ideas(); v[0] = v[0].map((c) => (c === 'verdict' ? 'gate' : c === 'gate' ? 'verdict' : c));
    caught(checkIdeas(v), 'RENAMED');
  });
  test('extra column: Ideas gains "colour"', () => { caught(checkIdeas(ideas().map((r, i) => r.concat(i === 0 ? ['colour'] : ['blue']))), 'EXTRA'); });
  test('wrong type: an Ideas "buyer" is not b2c or b2b', () => { const v = ideas(); v[1][IDEAS.COLS.indexOf('buyer')] = 'everyone'; caught(checkIdeas(v), 'WRONG_TYPE'); });
  test('wrong type: an Ideas row with no name', () => { const v = ideas(); v[1][IDEAS.COLS.indexOf('name')] = ''; caught(checkIdeas(v), 'WRONG_TYPE'); });
  test('wrong type: an invented Ideas id without FAKE or SAMPLE', () => { const v = ideas(); v[1][0] = 'IDEA-0001'; caught(checkIdeas(v), 'WRONG_TYPE'); });
  test('empty tab: Ideas has no header row', () => { caught(checkIdeas([]), 'EMPTY'); });
});
