// Two named thermometers in one room (Lisa 11 Nov 2026, H5/6). Each is its own round item and reading
// (area_reading.thermometer_id). A thermometer QR opens that exact thermometer, with no picking; a room QR in a room
// with two shows both, by name. Pretend rooms and thermometers; fake code and fake save address only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const base = () => ({
  area: [{ id: 'area-h', code: 'H5/6', group_sort: '1' }, { id: 'area-s', code: 'S1', group_sort: '2' }],
  subject: [], occupancy: [], subject_status: [], check_type: [], check_log: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [], qr_tag: [], requirement: [],
  temperature_band: [{ id: 'tb-1', band: 'Rest', age_from_days: '0', age_to_days: '', min_temp: '10', max_temp: '20' }],
  area_reading: [],
  thermometer: [{ id: 'th-h6', name: 'H6', area_id: 'area-h' }, { id: 'th-h5', name: 'H5', area_id: 'area-h' }, { id: 'th-s', name: 'S1', area_id: 'area-s' }]
});

async function setup(page, tables, store) {
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'area_reading', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], tables, role: 'OWNER' } } });
    sent.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'rdg-' + sent.length } } });
  });
  await page.clock.setFixedTime(new Date('2026-11-12T09:00:00Z'));
  await page.addInitScript(([c, u, s, now]) => {
    localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u);
    Object.keys(s || {}).forEach((k) => localStorage.setItem(k, JSON.stringify(Object.assign({ at: now }, s[k]))));
  }, ['FAKE-CODE-1', SCRIPT, store || {}, new Date('2026-11-12T09:00:00Z').getTime()]);
  return sent;
}
const names = (page) => page.locator('.cards .card .nm');

test('the round lists each thermometer in a two-thermometer room by name; a save names its thermometer', async ({ page }) => {
  const sent = await setup(page, base());
  await page.goto('cdhub/staff/#m/temperature');
  await expect(names(page)).toHaveText(['H5/6 · H5', 'H5/6 · H6', 'S1']);
  await page.locator('.cards .card', { hasText: 'H5/6 · H6' }).click();
  await page.getByRole('button', { name: 'Type it' }).click();
  await page.getByLabel('MAX').fill('18.0');
  await page.getByLabel('MIN').fill('12.0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ table: 'area_reading', fields: { area_id: 'area-h', thermometer_id: 'th-h6' } });
  await page.getByRole('button', { name: 'CLR pressed' }).click();
  await expect(names(page)).toHaveText(['H5/6 · H5', '✓ H5/6 · H6', 'S1']);
});

test('a thermometer QR opens that exact thermometer, no picking, and saves its thermometer_id', async ({ page }) => {
  const sent = await setup(page, base(), { 'bld.temp.thermometer': { thermometerId: 'th-h6' } });
  await page.goto('cdhub/staff/#m/temperature');
  await expect(page.getByRole('button', { name: 'Type it' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'H5/6 · H6' })).toBeVisible();
  await expect(page.locator('.cards')).toHaveCount(0);   // no picking
  await page.getByRole('button', { name: 'Type it' }).click();
  await page.getByLabel('MAX').fill('18.0');
  await page.getByLabel('MIN').fill('12.0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].fields).toMatchObject({ area_id: 'area-h', thermometer_id: 'th-h6' });
});

test('a room QR in a room with two thermometers shows both, by name, first; nothing opens by itself', async ({ page }) => {
  await setup(page, base(), { 'bld.move.room': { areaId: 'area-h' } });
  await page.goto('cdhub/staff/#m/temperature');
  await expect(names(page)).toHaveText(['H5/6 · H5', 'H5/6 · H6', 'S1']);
  await expect(page.locator('.cards .card', { hasText: 'You scanned this' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Type it' })).toHaveCount(0);
});

test('a room QR in a room with one thermometer opens it straight away', async ({ page }) => {
  const sent = await setup(page, base(), { 'bld.move.room': { areaId: 'area-s' } });
  await page.goto('cdhub/staff/#m/temperature');
  await expect(page.getByRole('button', { name: 'Type it' })).toBeVisible();
  await page.getByRole('button', { name: 'Type it' }).click();
  await page.getByLabel('MAX').fill('18.0');
  await page.getByLabel('MIN').fill('12.0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].fields).toMatchObject({ area_id: 'area-s', thermometer_id: 'th-s' });
});

test('an older reading with no thermometer_id counts for a one-thermometer room only', async ({ page }) => {
  const t = base();
  t.area_reading = [
    { id: 'r1', area_id: 'area-s', period_start: '2026-11-12T00:00:00+00:00', min_c: '12.0', max_c: '15.0' },
    { id: 'r2', area_id: 'area-h', period_start: '2026-11-12T00:00:00+00:00', min_c: '12.0', max_c: '15.0' }
  ];
  await setup(page, t);
  await page.goto('cdhub/staff/#m/temperature');
  await expect(names(page)).toHaveText(['H5/6 · H5', 'H5/6 · H6', '✓ S1']);
});

test('year report: a room with two thermometers can be opened whole or per thermometer', async ({ page }) => {
  const t = base();
  t.area_reading = [
    { id: 'r1', area_id: 'area-h', thermometer_id: 'th-h5', period_start: '2026-11-11T00:00:00+00:00', min_c: '12.0', max_c: '15.0' },
    { id: 'r2', area_id: 'area-h', thermometer_id: 'th-h6', period_start: '2026-11-11T12:00:00+00:00', min_c: '13.0', max_c: '16.0' }
  ];
  await setup(page, t);
  await page.goto('cdhub/staff/#m/temperature');
  await page.getByRole('button', { name: 'Year report' }).click();
  await expect(page.getByLabel('Room').locator('option')).toContainText(['H5/6 (all)', 'H5/6 · H5', 'H5/6 · H6', 'S1']);
  await page.getByLabel('Room').selectOption({ label: 'H5/6 · H6' });
  await page.getByRole('button', { name: 'Open report' }).click();
  const rows = page.locator('.tg-tab').nth(1).locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('16.0');
});

// OVERSEER 5, 12 Nov 2026: each round card says Due, the reading, Outside (with the reading), or Room empty.
test('round cards show due, the reading, outside the limit, or room empty', async ({ page }) => {
  const t = base();
  t.area.push({ id: 'area-e', code: 'E1', group_sort: '3' });
  t.thermometer.push({ id: 'th-e', name: 'E1', area_id: 'area-e' });
  t.area_reading = [
    { id: 'r1', area_id: 'area-s', thermometer_id: 'th-s', period_start: '2026-11-12T00:00:00+00:00', min_c: '12.0', max_c: '15.0' },
    { id: 'r2', area_id: 'area-h', thermometer_id: 'th-h6', period_start: '2026-11-12T00:00:00+00:00', min_c: '8.5', max_c: '15.0', mitigation_note: 'Heater on' },
    { id: 'r3', area_id: 'area-e', thermometer_id: 'th-e', period_start: '2026-11-12T00:00:00+00:00', room_empty: 'yes' }
  ];
  await setup(page, t);
  await page.goto('cdhub/staff/#m/temperature');
  const ds = (name) => page.locator('.cards .card', { hasText: name }).locator('.ds');
  await expect(ds('H5/6 · H5')).toHaveText('Due');
  await expect(ds('H5/6 · H6')).toHaveText('Outside 8.5–15.0');
  await expect(page.locator('.cards .card', { hasText: 'H5/6 · H6' })).toHaveClass(/tg-out/);
  await expect(ds('S1')).toHaveText('12.0–15.0');
  await expect(ds('E1')).toHaveText('Room empty');
});
