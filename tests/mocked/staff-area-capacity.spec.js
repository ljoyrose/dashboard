// Room capacity on the staff page (LD-SC audit, OV11 15 Nov 2026): the flap and the limits are the dated rows in force
// today; the flap buttons follow the owner's setting (starting default: owner only); a room's jobs show its capacity;
// the printed room sign reads from_date. Pretend rooms, dogs and rows; fake code and fake save address only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const NOW = new Date('2026-11-15T10:00:00Z');
const TABLES = {
  area: [{ id: 'area-1', code: 'R1' }],
  subject: [{ id: 'dog-1', name: 'Pretend A', size_band: 'small' }, { id: 'dog-2', name: 'Pretend B', size_band: 'small' }],
  occupancy: [{ subject_id: 'dog-1', area_id: 'area-1', moved_in: '2026-10-01' }, { subject_id: 'dog-2', area_id: 'area-1', moved_in: '2026-10-01' }],
  subject_status: [], litter: [], capacity_setting: [], check_log: [], breeding_rule: [],
  check_type: [{ id: 'cty-clean', type_key: 'clean', label: 'Room clean', target: 'area', active: 'true', effective_from: '2026-01-01', asks_outcome: 'true', every_days: '1' }],
  // the flap: an older free row, then limited from 1 Nov, and a free row that has not started yet
  area_access: [
    { id: 'acc-1', area_id: 'area-1', access_type: 'free', from_date: '2026-01-01' },
    { id: 'acc-2', area_id: 'area-1', access_type: 'limited', from_date: '2026-11-01' },
    { id: 'acc-3', area_id: 'area-1', access_type: 'free', from_date: '2099-01-01' }],
  // limits: an old open row (5 small) and the newer row (2 small) both open; the newer one is in force
  area_capacity: [
    { id: 'cap-1', area_id: 'area-1', access_type: 'limited', size_band: 'small', max_dogs: '5', from_date: '2026-01-01' },
    { id: 'cap-2', area_id: 'area-1', access_type: 'limited', size_band: 'small', max_dogs: '2', from_date: '2026-11-11' },
    { id: 'cap-3', area_id: 'area-1', access_type: 'free', size_band: 'small', max_dogs: '6', from_date: '2026-01-01' }],
  qr_tag: [{ tag: 'ROOMTAG9', kind: 'area', ref_id: 'area-1', active: 'true' }]
};

async function setup(page, role, over) {
  const data = Object.assign({}, TABLES, over || {}), sent = [];
  await page.clock.setFixedTime(NOW);
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'check_log', on: true, mode: 'direct' }, { key: 'occupancy', on: true, mode: 'direct' }, { key: 'area_access', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: data[b.table] || [], tables: data, role } } });
    sent.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'acc-new' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  return sent;
}

test('Move dogs: the flap and the limit are the rows in force today; a staff code sees the flap and who to ask, no buttons', async ({ page }) => {
  const sent = await setup(page, 'STAFF');
  await page.goto('cdhub/staff/#mv/ROOMTAG9');
  await expect(page.getByRole('heading', { name: 'R1' })).toBeVisible();
  await expect(page.locator('.sub').filter({ hasText: 'Takes' })).toContainText('Takes 2 small with limited access. 2 of 2 now.');
  await expect(page.locator('[data-flap-locked]')).toHaveText('Flap limited. Ask the owner to change it.');
  await expect(page.getByRole('button', { name: 'Flap free' })).toHaveCount(0);
  expect(sent).toHaveLength(0);
});

test('Move dogs: an owner code changes the flap; the owner\'s setting row can let a staff code do it too', async ({ page }) => {
  const sent = await setup(page, 'OWNER');
  await page.goto('cdhub/staff/#mv/ROOMTAG9');
  await expect(page.getByRole('button', { name: 'Flap limited' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Flap free' }).click();
  await expect(page.getByText('Flap saved as free.')).toBeVisible();
  expect(sent[0]).toMatchObject({ table: 'area_access', fields: { area_id: 'area-1', access_type: 'free' } });
});

test('Move dogs: capacity_setting flap.who_may_change "OWNER, STAFF" shows the buttons to a staff code', async ({ page }) => {
  await setup(page, 'STAFF', { capacity_setting: [{ setting_key: 'flap.who_may_change', value: 'OWNER, STAFF' }] });
  await page.goto('cdhub/staff/#mv/ROOMTAG9');
  await expect(page.getByRole('button', { name: 'Flap free' })).toBeVisible();
  await expect(page.locator('[data-flap-locked]')).toHaveCount(0);
});

test('a room\'s jobs show its capacity: the rows in force today, the same line as Move dogs', async ({ page }) => {
  await setup(page, 'STAFF');
  await page.goto('cdhub/staff/#s/ROOMTAG9');
  await expect(page.getByRole('heading', { name: 'R1' })).toBeVisible();
  await expect(page.locator('[data-k="capacity"]')).toHaveText('Takes 2 small with limited access. 2 of 2 now.');
});

test('the printed room sign reads the dated flap and limit rows (from_date), never the old open row', async ({ page }) => {
  await setup(page, 'OWNER');
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Room signs' }).click();
  await expect(page.locator('.rcard[data-room="area-1"] .sz')).toHaveText(['2 small']);
});

test('room sign: one limit per size, only rows in force today; an ended row and an undated repeat never print twice (OV11 15 Nov)', async ({ page }) => {
  await setup(page, 'OWNER', {
    area_access: [{ id: 'acc-f', area_id: 'area-1', access_type: 'free', from_date: '2026-01-01' }],
    area_capacity: [
      { id: 'old-s', area_id: 'area-1', access_type: 'free', size_band: 'small', max_dogs: '4', from_date: '', to_date: '' },        // undated
      { id: 'new-s', area_id: 'area-1', access_type: 'free', size_band: 'small', max_dogs: '4', from_date: '', to_date: '' },        // undated repeat
      { id: 'end-m', area_id: 'area-1', access_type: 'free', size_band: 'medium', max_dogs: '9', from_date: '', to_date: '2026-11-10' }, // ended
      { id: 'now-m', area_id: 'area-1', access_type: 'free', size_band: 'medium', max_dogs: '3', from_date: '2026-11-11', to_date: '' },
      { id: 'lim-l', area_id: 'area-1', access_type: 'limited', size_band: 'large', max_dogs: '2', from_date: '2026-01-01' }]          // other flap setting
  });
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Room signs' }).click();
  await expect(page.locator('.rcard[data-room="area-1"] .sz')).toHaveText(['4 small', 'or 3 medium']);
});
