// HOME HUB DATA CONTRACT (JOB 31b). No browser, no Google. Names and types only.
// Covers the two JSON files index.html reads from Drive: DROPBOX-TOTALS.json (loadDbx) and the Bin guard web-app
// file (loadBgUrl, name from config.js binGuard.webAppFile). The list is tests/contract/expected-home.json, rebuilt by
// tests/contract/make-expected-home.js. Each failure case proves itself: CONTRACT_PROVE_RED=1 flips it to expect
// "no problem", so it must go red.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');
const { extractFn, checkState, codes, readsColumn } = require('./shape');

const REPO = path.resolve(__dirname, '..', '..');
const HTML = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const EXP = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected-home.json'), 'utf8')).home;
const DBX = EXP['DROPBOX-TOTALS.json'];
const BG = EXP['BIN-GUARD-WEBAPP.json'];
const RED = !!process.env.CONTRACT_PROVE_RED;
const caught = (problems, code) => (RED ? expect(problems).toEqual([]) : expect(codes(problems)).toEqual([code]));
const load = (e) => JSON.parse(fs.readFileSync(path.join(REPO, e.fixture), 'utf8'));
const dbx = () => load(DBX);
const bg = () => load(BG);
const checkDbx = (o) => checkState('DROPBOX-TOTALS.json', DBX, o);
const checkBg = (o) => checkState('BIN-GUARD-WEBAPP.json', BG, o);

/** The page's own bgUrlOk() and BG_URL_RE, run in a sandbox: the same test loadBgUrl() applies to j.url. */
function pageBgUrlOk() {
  const m = /var BG_URL_RE = (\/.*\/);/.exec(HTML);
  if (!m) throw new Error('BG_URL_RE not found in index.html');
  const ctx = vm.createContext({ String });
  vm.runInContext('var BG_URL_RE = ' + m[1] + ';\n' + extractFn(HTML, 'bgUrlOk') + '\nthis.__fn = bgUrlOk;', ctx);
  return ctx.__fn;
}
// The Dropbox card is built inside the page's large render() (it needs S, foldOpen, stateBadge, num, fmtTime and more),
// so it is not sandboxed here. The contract pins what that code reads instead: every key in the list must still be read.

test.describe('Home contract: the invented files match the list @contract', () => {
  test('DROPBOX-TOTALS.json: every key has the expected type and every required key is there', () => { expect(checkDbx(dbx())).toEqual([]); });
  test('Bin guard file: "url" is a string', () => { expect(checkBg(bg())).toEqual([]); });
  test("the page's own bgUrlOk() accepts the invented web-app url (so loadBgUrl() would keep it)", () => {
    const ok = pageBgUrlOk();
    expect(ok(bg().url)).toBe(true);
    expect(ok('https://example.invalid/exec')).toBe(false);
  });
  test('index.html still reads every key in the list', () => {
    const keys = [...Object.keys(DBX.top), ...Object.keys(BG.top)];
    expect(keys.filter((k) => !readsColumn(HTML, k))).toEqual([]);
  });
});

test.describe('Home contract: DROPBOX-TOTALS.json changes give a named failure @contract', () => {
  test('missing field: "wasted_gb" is gone (the card would show a confident 0)', () => { const o = dbx(); delete o.wasted_gb; caught(checkDbx(o), 'MISSING'); });
  test('renamed field: "marked_files" becomes "marked_count"', () => { const o = dbx(); o.marked_count = o.marked_files; delete o.marked_files; caught(checkDbx(o), 'RENAMED'); });
  test('extra key: the file gains "newThing"', () => { const o = dbx(); o.newThing = 1; caught(checkDbx(o), 'EXTRA'); });
  test('wrong type: "marked_files" is the text "12"', () => { const o = dbx(); o.marked_files = '12'; caught(checkDbx(o), 'WRONG_TYPE'); });
  test('wrong type: "complete" is the text "false" (the "scan not finished" note would vanish)', () => { const o = dbx(); o.complete = 'false'; caught(checkDbx(o), 'WRONG_TYPE'); });
  test('empty file: {}', () => { caught(checkDbx({}), 'EMPTY'); });
  test('empty file: null', () => { caught(checkDbx(null), 'EMPTY'); });
});

test.describe('Home contract: Bin guard file changes give a named failure @contract', () => {
  // "url" is the only key, so losing it leaves {} (EMPTY); losing it with another key in its place reads as RENAMED.
  test('missing field: "url" is gone (the file is left as {})', () => { const o = bg(); delete o.url; caught(checkBg(o), 'EMPTY'); });
  test('renamed field: "url" becomes "link" (loadBgUrl() would find no address)', () => { const o = bg(); o.link = o.url; delete o.url; caught(checkBg(o), 'RENAMED'); });
  test('wrong type: "url" is a number', () => { caught(checkBg({ url: 42 }), 'WRONG_TYPE'); });
  test('empty file: {}', () => { caught(checkBg({}), 'EMPTY'); });
  test('empty file: null', () => { caught(checkBg(null), 'EMPTY'); });
});
