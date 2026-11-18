// Guest page hides a room whose room.in_use need rows have ended (Lisa 11 Nov 2026, "A standard"). Fake guest code and fake save address only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };

const TABLES = {
  area: [{ id: 'area-1', code: 'R1' }, { id: 'area-old', code: 'OLD9' }, { id: 'area-zz', code: 'ZZ_NAME' }],
  requirement: [{ need_type: 'room.in_use', target_table: 'area', target_id: 'area-old', from_date: '2026-01-01', to_date: '2026-01-31' }]
};

test('a guest never sees a room whose in-use rows have ended; a ZZ_ name alone hides nothing', async ({ page }) => {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'guest_reading', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: TABLES[b.table] || [] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.guest.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKEGUESTCODE', SCRIPT]);
  await page.goto('cdhub/staff/guest/');
  await expect(page.getByText('R1').first()).toBeVisible();
  await expect(page.getByText('OLD9')).toHaveCount(0);
  await expect(page.getByText('ZZ_NAME').first()).toBeVisible();
});

test('the guest page still lists rooms when the need list cannot be read', async ({ page }) => {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'guest_reading', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.table === 'requirement') return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: TABLES[b.table] || [] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.guest.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKEGUESTCODE', SCRIPT]);
  await page.goto('cdhub/staff/guest/');
  await expect(page.getByText('OLD9').first()).toBeVisible();
});
