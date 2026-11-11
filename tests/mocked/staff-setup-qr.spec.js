// Private set-up QR on the staff page. Fake code and fake save address only: a real code never goes near a test.
const { test, expect } = require('../support/test');

// The temperature module is optional and not on main yet, so its file answers 404.
test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CODE = 'FAKE-CODE-1';
const CORS = { 'access-control-allow-origin': '*' };
const empty = { rows: [], tables: { area: [], subject: [], occupancy: [], subject_status: [], qr_tag: [], litter: [] } };

async function fakeScript(page, good) {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: good ? { ok: true, result: empty } : { ok: false, code: 'BAD_CODE', message: 'no' } });
  });
}
const stored = (page) => page.evaluate(() => [localStorage.getItem('bld.device.code'), localStorage.getItem('bld.scriptUrl')]);

test('a good private QR sets the phone up and leaves no code in the address', async ({ page }) => {
  await fakeScript(page, true);
  await page.goto('cdhub/staff/#join=' + encodeURIComponent(CODE) + '&url=' + SCRIPT);
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
  expect(page.url()).not.toContain(CODE);
  expect(page.url()).not.toContain('join=');
  expect(await stored(page)).toEqual([CODE, SCRIPT]);
  await expect(page.locator('a[data-link="checks"]')).toHaveAttribute('href', '../checks/');
});

test('a refused code is not remembered', async ({ page }) => {
  await fakeScript(page, false);
  await page.goto('cdhub/staff/#join=' + encodeURIComponent(CODE) + '&url=' + SCRIPT);
  await expect(page.getByText('That code was not accepted')).toBeVisible();
  expect(page.url()).not.toContain(CODE);
  expect((await stored(page))[0]).toBeNull();
});

test('the print page draws the QR on screen only and keeps nothing', async ({ page }) => {
  await fakeScript(page, true);
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  const sent = [];
  page.on('request', (r) => { if (r.postData()) sent.push(r.postData()); sent.push(r.url()); });
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Private set-up QR' }).click();
  const box = page.locator('[data-private]');
  await expect(box).toHaveClass(/noprint/);
  await expect(box).toContainText('Do not screenshot');
  await box.getByLabel('Their staff code').fill(CODE);
  await box.getByRole('button', { name: 'Show QR' }).click();
  await expect(box.locator('svg')).toBeVisible();
  await expect(box.getByLabel('Their staff code')).toHaveValue('');
  expect(sent.join(' ')).not.toContain(CODE);
  expect(await page.evaluate((c) => JSON.stringify(Object.assign({}, localStorage, sessionStorage)).includes(c), CODE)).toBe(false);
  await box.getByRole('button', { name: 'Remove QR' }).click();
  await expect(box.locator('svg')).toHaveCount(0);
});

test('dog kennel cards are only for dogs on site: none for a dog that has left', async ({ page }) => {
  const dog = (id) => ({ id, name: 'Test ' + id });
  const tag = (ref, t) => ({ tag: t, kind: 'subject', ref_id: ref, active: 'true' });
  const tables = {
    area: [{ id: 'area-t1', code: 'T1' }], subject: [dog('here'), dog('offsite'), dog('sold'), dog('died')], subject_status: [], litter: [],
    occupancy: [
      { subject_id: 'here', area_id: 'area-t1', moved_in: '2026-10-01' },
      { subject_id: 'offsite', area_id: 'area-t1', moved_in: '2026-10-01' }, { subject_id: 'offsite', off_site_kind: 'temporary', moved_in: '2026-10-09' },
      { subject_id: 'sold', area_id: 'area-t1', moved_in: '2026-10-01' }, { subject_id: 'sold', off_site_kind: 'sold', moved_in: '2026-10-09' },
      { subject_id: 'died', area_id: 'area-t1', moved_in: '2026-10-01' }, { subject_id: 'died', off_site_kind: 'deceased', moved_in: '2026-10-09' }
    ],
    qr_tag: [tag('here', 'AAAAAAAA'), tag('offsite', 'BBBBBBBB'), tag('sold', 'CCCCCCCC'), tag('died', 'DDDDDDDD')]
  };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Dog kennel cards' }).click();
  await expect(page.locator('.qcard b')).toHaveText(['Test here', 'Test offsite']);
});

test('thermometer cards: one per active thermometer, by name; adding one saves it and makes its card', async ({ page }) => {
  const tables = {
    area: [{ id: 'area-t1', code: 'T1' }, { id: 'area-zz', code: 'ZZ_OLD' }], subject: [], subject_status: [], litter: [], occupancy: [], qr_tag: [],
    thermometer: [{ id: 'thm-1', name: 'Hall', area_id: 'area-t1', active: 'true' }, { id: 'thm-2', name: 'Old one', area_id: 'area-t1', active: 'false' }]
  };
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }, { key: 'thermometer', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [] } } });
    sent.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: b.table === 'thermometer' ? 'thm-3' : 'qrt-' + sent.length } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Thermometer cards' }).click();
  await expect(page.locator('.qcard b')).toHaveText(['Hall']);
  expect(sent.map((b) => [b.table, b.fields.kind, b.fields.ref_id])).toEqual([['qr_tag', 'thermometer', 'thm-1']]);
  await page.getByRole('button', { name: 'Add thermometer' }).click();
  await expect(page.getByRole('combobox', { name: 'Room' }).locator('option')).toHaveText(['Room', 'T1']);   // never a retired room
  await page.getByRole('textbox', { name: 'Thermometer name' }).fill('Corridor 1');
  await page.getByRole('combobox', { name: 'Room' }).selectOption('area-t1');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.qcard b')).toHaveText(['Corridor 1']);
  expect(sent.slice(1).map((b) => [b.table, b.fields.name || b.fields.kind, b.fields.area_id || b.fields.ref_id])).toEqual([['thermometer', 'Corridor 1', 'area-t1'], ['qr_tag', 'thermometer', 'thm-3']]);
});

test('room signs are never made for a retired room (code starting ZZ_)', async ({ page }) => {
  const tables = {
    area: [{ id: 'area-t1', code: 'T1' }, { id: 'area-zz', code: 'ZZ_OLD' }], subject: [], subject_status: [], litter: [], occupancy: [],
    qr_tag: [{ tag: 'EEEEEEEE', kind: 'area', ref_id: 'area-t1', active: 'true' }, { tag: 'FFFFFFFF', kind: 'area', ref_id: 'area-zz', active: 'true' }]
  };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Room signs' }).click();
  await expect(page.locator('.qcard b')).toHaveText(['T1']);
});
