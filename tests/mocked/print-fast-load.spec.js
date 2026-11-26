// Print opens at once (the owner's demo, 22 Nov 2026: "Loading..." for over 2 minutes while 21 script calls ran one after
// another). The buttons show before any list is read; a card type reads only its lists, four at a time, once per visit;
// "Lists as of" with Refresh. Invented rows and codes only.
const { test, expect } = require('../fixtures/job34/load');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const tables = { area: [{ id: 'ar-a', code: 'Room A' }], requirement: [], subject: [], occupancy: [], subject_status: [], area_capacity: [], area_access: [], check_type: [], breeding_rule: [],
  qr_tag: [{ tag: 'AAAAAAAA', kind: 'area', ref_id: 'ar-a', active: 'true' }] };

test('the buttons show before any read; Room cards reads only its lists, four at a time, once; Refresh reads again', async ({ page }) => {
  const reads = [], gets = [];
  let open = 0, most = 0;
  await page.route(SCRIPT, async (route) => {
    if (route.request().method() === 'GET') { gets.push(1); return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } }); }
    const body = JSON.parse(route.request().postData());
    reads.push(body.table); open++; most = Math.max(most, open);
    await new Promise((r) => setTimeout(r, 150));   // a slow script: each read takes a while
    open--;
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[body.table] || [], role: 'OWNER' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await expect(page.getByRole('button', { name: 'Dog cards' })).toBeVisible();
  expect(reads).toEqual([]);                     // nothing read until a card type is chosen
  expect(gets).toEqual([]);                      // no status call holds the page

  await page.getByRole('button', { name: 'Room cards' }).click();
  await expect(page.locator('.sheet [data-room="ar-a"]')).toHaveCount(1);
  expect(reads.sort()).toEqual(['area', 'area_access', 'area_capacity', 'breeding_rule', 'check_type', 'qr_tag', 'requirement']);
  expect(reads).not.toContain('links');          // dog-card lists are not read for room cards
  expect(most).toBeGreaterThan(1);
  expect(most).toBeLessThanOrEqual(4);
  await expect(page.locator('[data-print-asof]')).toContainText(/Lists as of \d\d:\d\d/);

  reads.length = 0;
  await page.getByRole('button', { name: 'Room cards' }).click();
  await expect(page.locator('.sheet [data-room="ar-a"]')).toHaveCount(1);
  expect(reads).toEqual([]);                     // kept for this visit

  await page.locator('[data-print-refresh]').click();
  await expect(page.locator('[data-print-asof]')).toBeEmpty();
  await page.getByRole('button', { name: 'Room cards' }).click();
  await expect(page.locator('[data-print-asof]')).toContainText('Lists as of');
  expect(reads.length).toBe(7);                  // Refresh reads again
});

test('a list that cannot be read says why and draws nothing', async ({ page }) => {
  await page.route(SCRIPT, (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.table === 'area') return route.fulfill({ headers: CORS, json: { ok: false, code: 'BUSY', message: 'The records are busy. Try again in a moment.' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[body.table] || [], role: 'OWNER' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Room cards' }).click();
  await expect(page.locator('.msg')).toHaveText('The records are busy. Try again in a moment.');
  await expect(page.locator('.sheet > *')).toHaveCount(0);
});
