// Temperature round on the staff page. Pretend rooms and thermometers; fake code and fake save address only.
// Lisa, 11 Nov 2026: a thermometer that ended on 11 Nov is not in the 12 Nov round, but a missed reading for a
// day it was needed (10 Nov) can still be typed on 12 Nov, and is saved for that day.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const TABLES = {
  area: [{ id: 'area-old', code: 'ZZ_3A.2/3', group_sort: '2' }, { id: 'area-new', code: '3A.1/2', group_sort: '2' }],
  subject: [], occupancy: [], subject_status: [], check_type: [], check_log: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [], qr_tag: [],
  temperature_band: [{ id: 'tb-1', band: 'Rest', age_from_days: '0', age_to_days: '', min_temp: '10', max_temp: '20' }],
  area_reading: [],
  thermometer: [
    { id: 'thm-old', name: '3A.2/3', area_id: 'area-old', active: 'true', valid_from: '2025-01-01', valid_to: '2026-11-11' },
    { id: 'thm-new', name: '3A.1/2', area_id: 'area-new', active: 'true', valid_from: '2026-11-12', valid_to: '' }
  ]
};

async function setup(page) {
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'area_reading', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) {
      if (b.table && !TABLES[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: TABLES[b.table] || [], tables: TABLES } } });
    }
    sent.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'rdg-' + sent.length } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  await page.clock.setFixedTime(new Date('2026-11-12T09:00:00Z'));
  return sent;
}

test('a thermometer ended 11 Nov is not in the 12 Nov round; its 10 Nov reading can still be typed on 12 Nov', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  const cards = page.locator('.cards .card .nm');
  await expect(cards).toHaveText(['3A.1/2']);

  await page.getByRole('button', { name: 'Missed reading' }).click();
  await page.getByLabel('Day').fill('2026-11-10');
  await page.getByLabel('Day').dispatchEvent('change');
  await expect(cards).toHaveText(['3A.2/3 (retired)']);
  await cards.first().click();
  await expect(page.getByText('Missed reading · 10/11/26 Morning reading')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Read with camera' })).toHaveCount(0);
  await page.getByLabel('MAX').fill('18.5');
  await page.getByLabel('MIN').fill('12.0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ table: 'area_reading', fields: { area_id: 'area-old', max_c: '18.5', min_c: '12.0', period_start: '2026-11-10T00:00:00+00:00', read_method: 'typed' } });
  await expect(page.getByText('Now press CLR')).toHaveCount(0);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.cards .card .nm')).toHaveText(['✓ 3A.2/3 (retired)']);
});

test('a missed reading cannot be for now or later: that is the round', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  await page.getByRole('button', { name: 'Missed reading' }).click();
  await page.getByLabel('Day').fill('2026-11-12');
  await page.getByLabel('Day').dispatchEvent('change');
  await expect(page.getByText('That is now or later: use the round.')).toBeVisible();
});

test('Lisa 11 Nov: how a reading was taken is saved only; the year report never shows camera, typed or photo', async ({ page }) => {
  TABLES.area_reading = [
    { id: 'r1', area_id: 'area-new', period_start: '2026-11-12T00:00:00+00:00', taken_at: '2026-11-12T08:00:00Z', min_c: '12.0', max_c: '18.0', read_method: 'camera', camera_value_changed: 'true' },
    { id: 'r2', area_id: 'area-new', period_start: '2026-11-12T12:00:00+00:00', taken_at: '2026-11-12T15:00:00Z', min_c: '12.5', max_c: '18.5', read_method: 'typed' },
    { id: 'r3', area_id: 'area-new', period_start: '2026-11-11T12:00:00+00:00', taken_at: '2026-11-12T15:00:00Z', min_c: '11.5', max_c: '17.5', read_method: 'photo' }
  ];
  try {
    await setup(page);
    await page.goto('cdhub/staff/#m/temperature');
    await page.getByRole('button', { name: 'Year report' }).click();
    await page.getByLabel('Room').selectOption('area-new');
    await page.getByRole('button', { name: 'Open report' }).click();
    await expect(page.locator('.tg-tab tbody tr')).not.toHaveCount(0);
    await expect(page.locator('#screen, body').first()).not.toContainText(/camera|typed|photo|corrected/i);
  } finally { TABLES.area_reading = []; }
});

test('Lisa 11 Nov: a missed reading outside the limit asks "What was done?", as the round does, and saves the note', async ({ page }) => {
  const sent = await setup(page);
  await page.clock.setFixedTime(new Date('2026-11-12T15:00:00Z'));   // afternoon: this morning is now a missed slot
  await page.goto('cdhub/staff/#m/temperature');
  await page.getByRole('button', { name: 'Missed reading' }).click();
  await page.getByLabel('Day').fill('2026-11-12');
  await page.getByLabel('Day').dispatchEvent('change');
  await page.locator('.cards .card').first().click();
  await expect(page.getByText('Limit 10.0 to 20.0 C')).toBeVisible();
  await page.getByLabel('MAX').fill('14.0');
  await page.getByLabel('MIN').fill('8.5');
  await expect(page.getByText('Below the limit.')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Say what was done.')).toBeVisible();
  expect(sent).toHaveLength(0);
  await page.getByLabel('What was done').fill('Heater on, rechecked at 12:00');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].fields).toMatchObject({ area_id: 'area-new', min_c: '8.5', period_start: '2026-11-12T00:00:00+00:00', mitigation_note: 'Heater on, rechecked at 12:00' });
});
