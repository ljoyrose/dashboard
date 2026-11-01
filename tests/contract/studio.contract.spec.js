// STUDIO DATA CONTRACT (JOB 31). No browser, no Google. Names and types only.
// The shape is JOB 3's (the Studio engine). This file only reads it: if JOB 3 changes the shape, JOB 3's PR updates
// tests/fixtures/studio/contract-state.json and reruns tests/contract/make-expected.js.
// Each failure case proves itself: CONTRACT_PROVE_RED=1 flips it to expect "no problem", so it must go red.
const { test, expect } = require('@playwright/test');
const { EXPECTED_STATE, fixture, pageFns, checkState, codes } = require('./shape');

const E = EXPECTED_STATE.studio['studio-state.json'];
const RED = !!process.env.CONTRACT_PROVE_RED;
const caught = (problems, code) => (RED ? expect(problems).toEqual([]) : expect(codes(problems)).toEqual([code]));
const state = () => JSON.parse(fixture('studio/contract-state.json'));
const check = (s) => checkState('studio-state.json', E, s);
/** The page's own prep() (the defaults it applies after reading the file), run on a state. */
function prep(s) {
  const { fns, ctx } = pageFns('studio', ['prep', 'all', 'brand', 'brandOf', 'ownerId'], 'var S; function applyPend() {} function applyCpend() {}');
  ctx.S = s; fns.prep(); return ctx.S;
}

test.describe('Studio contract: the invented state matches the list @contract', () => {
  test('studio-state.json: every key has the expected type and every required key is there', () => { expect(check(state())).toEqual([]); });
  test("the page's own prep() reads it without an error and keeps every asset and idea", () => {
    const s = state(), n = s.assets.length + s.ideas.length;
    const out = prep(s);
    expect(out.assets.concat(out.ideas).filter((a) => typeof a.stage === 'number').length).toBe(n);
  });
  test('the existing Studio page fixture (JOB 3) also passes the contract', () => {
    const { build } = require('../fixtures/studio/state.js');
    expect(check(JSON.parse(JSON.stringify(build(Date.parse('2026-10-28T10:10:00Z')))))).toEqual([]);
  });
});

test.describe('Studio contract: each kind of change gives a named failure @contract', () => {
  test('missing field: a kit loses "needs" (the Kits tab would crash)', () => { const s = state(); delete s.kits[0].needs; caught(check(s), 'MISSING'); });
  test('missing key: the file loses "assets"', () => { const s = state(); delete s.assets; caught(check(s), 'MISSING'); });
  test('renamed key: "kits" becomes "kitList"', () => { const s = state(); s.kitList = s.kits; delete s.kits; caught(check(s), 'RENAMED'); });
  test('renamed field: a brand "name" becomes "title"', () => { const s = state(); s.brands[0].title = s.brands[0].name; delete s.brands[0].name; caught(check(s), 'RENAMED'); });
  test('extra key: the file gains "newThing"', () => { const s = state(); s.newThing = []; caught(check(s), 'EXTRA'); });
  test('wrong type: an asset "stage" is the text "3" (it would drop out of every list)', () => { const s = state(); s.assets[0].stage = '3'; caught(check(s), 'WRONG_TYPE'); });
  test('wrong type: "brands" is an object, not a list', () => { const s = state(); s.brands = { one: s.brands[0] }; caught(check(s), 'WRONG_TYPE'); });
  test('empty file: {}', () => { caught(check({}), 'EMPTY'); });
  test('empty file: null', () => { caught(check(null), 'EMPTY'); });
});
