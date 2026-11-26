// Keep-photo setting (the owner 16 Nov 2026): a photo is kept with a temperature reading ONLY while the owner's dated rule
// row job.temps_keep_photo = yes is in force. Off by default. Pretend room; fake code, fake save address, fake picture.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function tables(rules) {
  return {
    area: [{ id: 'area-1', code: 'H1', group_sort: '1' }],
    subject: [], occupancy: [], subject_status: [], check_type: [], check_log: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [], qr_tag: [],
    temperature_band: [{ id: 'tb-1', band: 'Rest', age_from_days: '0', age_to_days: '', min_temp: '10', max_temp: '20' }],
    area_reading: [], thermometer: [{ id: 'thm-1', name: 'H1', area_id: 'area-1' }],
    requirement: [{ id: 'req-1', need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'thm-1', from_date: '2025-01-01', to_date: '' }],
    breeding_rule: rules
  };
}

async function setup(page, rules) {
  const sent = [], T = tables(rules);
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'area_reading', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) {
      if (b.table && !T[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: T[b.table] || [], tables: T, role: 'STAFF' } } });
    }
    sent.push(b);
    if (b.action === 'file_add') return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'fil-1' } } });
    if (b.action === 'link_add') return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'lnk-1' } } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'rdg-1' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  await page.clock.setFixedTime(new Date('2026-11-16T09:00:00Z'));
  return sent;
}

async function saveReading(page) {
  await page.goto('cdhub/staff/#m/temperature');
  await page.locator('.cards .card').first().click();
  await page.getByLabel('MAX').fill('18.5');
  await page.getByLabel('MIN').fill('12.0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('✓ Saved')).toBeVisible();
}

test('setting off (no row): no photo is offered and only the reading is sent', async ({ page }) => {
  const sent = await setup(page, []);
  await saveReading(page);
  await expect(page.getByText('Now press CLR on the thermometer.')).toBeVisible();
  await expect(page.getByText('Photo for the records')).toHaveCount(0);
  expect(sent.map((b) => b.action)).toEqual(['add']);
});

test('setting off outside its dates: no photo is offered', async ({ page }) => {
  await setup(page, [{ rule_key: 'job.temps_keep_photo', value: 'yes', effective_from: '2026-11-20', to_date: '2026-11-22' }]);
  await saveReading(page);
  await page.waitForTimeout(300);
  await expect(page.getByText('Photo for the records')).toHaveCount(0);
});

test('setting on: a chosen photo is stored (file_add) and linked to the reading as evidence (link_add)', async ({ page }) => {
  const sent = await setup(page, [{ rule_key: 'job.temps_keep_photo', value: 'yes', effective_from: '2026-11-16', to_date: '' }]);
  await saveReading(page);
  await expect(page.getByText('Photo for the records')).toBeVisible();
  await expect(page.getByText('Take the photo first, then press CLR on the thermometer.')).toBeVisible();
  await page.locator('.tg-evidence input[type=file]').setInputFiles({ name: 'thermo.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
  await expect(page.getByText('✓ Photo kept with the reading.')).toBeVisible();
  expect(sent.map((b) => b.action)).toEqual(['add', 'file_add', 'link_add']);
  expect(sent[1].fields).toMatchObject({ kind: 'photo', mime: 'image/jpeg', taken_on: '2026-11-16' });
  expect(sent[1].fields.data_base64.length).toBeGreaterThan(20);
  expect(sent[2].fields).toEqual({ from_table: 'area_reading', from_id: 'rdg-1', role: 'evidence', to_table: 'files', to_id: 'fil-1', from_date: '2026-11-16' });
});

test('setting on: Skip leaves the reading saved and sends nothing more', async ({ page }) => {
  const sent = await setup(page, [{ rule_key: 'job.temps_keep_photo', value: 'yes', effective_from: '2026-11-01', to_date: '' }]);
  await saveReading(page);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('Photo for the records')).toHaveCount(0);
  expect(sent.map((b) => b.action)).toEqual(['add']);
});
