// Guest page hides retired rooms (code starting ZZ_). Fake guest code and fake save address only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };


test('a guest never sees a retired room (code starting ZZ_)', async ({ page }) => {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'guest_reading', on: true, mode: 'direct' }], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: [{ id: 'area-1', code: 'R1' }, { id: 'area-zz', code: 'ZZ_OLD' }] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.guest.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKEGUESTCODE', SCRIPT]);
  await page.goto('cdhub/staff/guest/');
  await expect(page.getByText('R1').first()).toBeVisible();
  await expect(page.getByText('ZZ_OLD')).toHaveCount(0);
});
