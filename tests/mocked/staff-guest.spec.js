// Guest (visitor) temperature page. Fake guest code and fake save address only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };

test('a guest code opens the room temperature form with the room list, and nothing is saved by opening it', async ({ page }) => {
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'guest_reading', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: b.table === 'area' ? [{ id: 'area-1', code: 'R1' }] : [] } } });
    sent.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'grd-1' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.guest.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKEGUESTCODE', SCRIPT]);
  await page.goto('cdhub/staff/guest/');
  await expect(page.getByText('R1').first()).toBeVisible();
  expect(sent).toHaveLength(0);
});
