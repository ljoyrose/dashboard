// Print never shows a code that is not saved (Lisa, 15 Nov 2026). A staff code is told plainly that new codes need an
// owner code; a refused save stops the sheet. Invented rows and codes only.
const { test, expect } = require('../fixtures/job34/load');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const tables = { area: [{ id: 'ar-a', code: 'Room A' }, { id: 'ar-b', code: 'Room B' }], requirement: [], subject: [], occupancy: [], qr_tag: [] };

async function open(page, role, saveReply) {
  const posts = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    const body = JSON.parse(route.request().postData());
    if (body.table === 'qr_tag' && body.fields) { posts.push(body); return route.fulfill({ headers: CORS, json: saveReply }); }
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[body.table] || [], role } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  return posts;
}

test('print: a staff code is told new codes need an owner code, and nothing is saved or drawn', async ({ page }) => {
  const posts = await open(page, 'STAFF', { ok: true, result: { status: 'saved' } });
  await page.getByRole('button', { name: 'Room signs' }).click();
  await expect(page.locator('[role="status"], .msg, #msg').filter({ hasText: 'Not printed' }).first()).toContainText('owner code');
  await expect(page.locator('.sheet > *')).toHaveCount(0);
  expect(posts.length).toBe(0);
});

test('print: a code that could not be saved is never drawn; the saved one is, and the rest are named as not printed', async ({ page }) => {
  tables.qr_tag = [{ tag: 'AAAAAAAA', kind: 'area', ref_id: 'ar-a', active: 'true' }];
  await open(page, 'OWNER', { ok: false, code: 'NOT_ALLOWED', message: 'Your role is not allowed to do this.' });
  await page.getByRole('button', { name: 'Room signs' }).click();
  await expect(page.locator('[role="status"], .msg, #msg').filter({ hasText: 'Not printed' }).first()).toContainText('Not printed: 1 card');
  await expect(page.locator('.sheet > *')).toHaveCount(1);
  await expect(page.locator('.sheet [data-room="ar-a"]')).toHaveCount(1);
  await expect(page.locator('.sheet [data-room="ar-b"]')).toHaveCount(0);   // its save was refused, so no card
  tables.qr_tag = [];
});
