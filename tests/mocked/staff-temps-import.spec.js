// Temperature readings import (the owner 22 Nov 2026): paper or spreadsheet readings into BLD-area_reading, owner only.
// Pretend rooms and thermometers; fake code and fake save address only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const ROLE = { v: 'OWNER' };
const TABLES = {
  area: [{ id: 'area-a', code: '3A.1/2', group_sort: '2' }, { id: 'area-h', code: 'H5/6', group_sort: '3' }],
  subject: [], occupancy: [], subject_status: [], check_type: [], check_log: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [], qr_tag: [],
  temperature_band: [{ id: 'tb-1', band: 'Rest', age_from_days: '0', age_to_days: '', min_temp: '10', max_temp: '20' }],
  // the 11 Nov overnight slot for 3A.1/2 is already filled (read back as the sheet shows it)
  area_reading: [{ id: 'rdg-1', area_id: 'area-a', thermometer_id: 'thm-a', period_start: '2026-11-11 00:00', min_c: '12.0', max_c: '18.0' }],
  thermometer: [{ id: 'thm-a', name: '3A.1/2', area_id: 'area-a' }, { id: 'thm-h5', name: 'H5', area_id: 'area-h' }, { id: 'thm-h6', name: 'H6', area_id: 'area-h' }],
  requirement: []
};

async function setup(page) {
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'area_reading', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) {
      if (b.table && !TABLES[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: TABLES[b.table] || [], tables: TABLES, role: ROLE.v } } });
    }
    sent.push(b);
    // like the save script: an unusual temperature is "save anyway?" unless confirm_unusual is yes
    if (b.fields && parseFloat(b.fields.max_c) > 60 && b.fields.confirm_unusual !== 'yes') {
      return route.fulfill({ headers: CORS, json: { ok: false, code: 'INVALID', message: 'Check the entry.', fields: { max_c: 'Unusual.', confirm_unusual: 'Save anyway?' } } });
    }
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'rdg-' + (sent.length + 1) } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  await page.clock.setFixedTime(new Date('2026-11-12T09:00:00Z'));
  return sent;
}

test('Import readings: every row checked and shown, nothing saved before the press; a bad room says why; a filled slot is skipped; a past row saves with the confirm', async ({ page }) => {
  const sent = await setup(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('cdhub/staff/#m/temperature');
  await page.getByRole('button', { name: 'Import readings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import readings' })).toBeVisible();
  // the starter file: the heading row and one row per thermometer
  const href = decodeURIComponent((await page.locator('[data-timp-template]').getAttribute('href')).replace(/^data:text\/csv;charset=utf-8,/, ''));
  expect(href.split('\r\n')[0]).toBe('date,room,thermometer,slot,min,max,room_empty,note');
  expect(href).toContain('2026-11-11,3A.1/2,3A.1/2,overnight');
  expect(href).toContain('2026-11-11,H5/6,H6,overnight');
  const file = 'date,room,thermometer,slot,min,max,room_empty,note\n'
    + '2026-11-11,3A.1/2,,day,13.0,19.5,,from paper\n'     // ready
    + '2026-11-11,3A.1/2,,overnight,12.0,18.0,,\n'          // already filled: skipped
    + '2026-11-11,Nowhere,,day,13.0,19.0,,\n'               // unknown room
    + '2026-10-20,H5/6,H6,overnight,11.5,17.0,,\n';         // 23 days ago: saves with the confirm
  await page.locator('[data-timp-file]').setInputFiles({ name: 'readings.csv', mimeType: 'text/csv', buffer: Buffer.from(file) });
  await expect(page.locator('[data-timp-count]')).toHaveText('2 of 4 rows ready to import; the others show the reason and will not be saved. Each is saved as typed; its entry time shows it was entered later.');
  const rows = page.locator('.tg-tab tbody tr');
  await expect(rows.nth(1)).toContainText('already recorded for that slot');
  await expect(rows.nth(2)).toContainText('room not found: use its code as on the round');
  await expect(rows.nth(3)).toContainText('ready (older than 7 days)');
  expect(sent).toHaveLength(0);   // nothing saved before the press
  await page.locator('[data-timp-go]').click();
  await expect(page.locator('[data-timp-done]')).toHaveText('Imported 2 of 2.');
  expect(sent.map((b) => b.table)).toEqual(['area_reading', 'area_reading']);
  expect(sent[0].fields).toEqual({ area_id: 'area-a', thermometer_id: 'thm-a', period_start: '2026-11-11T12:00:00+00:00', min_c: '13.0', max_c: '19.5', read_method: 'typed', mitigation_note: 'from paper' });
  expect(sent[1].fields).toMatchObject({ area_id: 'area-h', thermometer_id: 'thm-h6', period_start: '2026-10-20T00:00:00+01:00', min_c: '11.5', max_c: '17.0', confirm_unusual: 'yes' });
  expect(sent[0].fields.taken_by).toBeUndefined();   // the save script stamps who (the owner) and when
  // the same file again: the two saved slots are now filled, nothing more to import
  await page.locator('[data-timp-file]').setInputFiles({ name: 'readings.csv', mimeType: 'text/csv', buffer: Buffer.from(file) });
  await expect(page.locator('[data-timp-count]')).toContainText('0 of 4 rows ready');
  await expect(page.locator('[data-timp-go]')).toHaveCount(0);
  expect(sent).toHaveLength(2);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Import readings is for an owner code only', async ({ page }) => {
  ROLE.v = 'STAFF';
  try {
    await setup(page);
    await page.goto('cdhub/staff/#m/temperature');
    await expect(page.locator('.tg-row').getByRole('button', { name: 'Earlier', exact: true })).toBeVisible();
    await expect(page.locator('.tg-row').getByRole('button', { name: 'Import readings', exact: true })).toHaveCount(0);
  } finally { ROLE.v = 'OWNER'; }
});
