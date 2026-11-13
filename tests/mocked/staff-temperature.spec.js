// Temperature round on the staff page. Pretend rooms and thermometers; fake code and fake save address only.
// Lisa, 11 Nov 2026: a thermometer that ended on 11 Nov is not in the 12 Nov round, but an earlier reading for a
// day it was needed (10 Nov) can still be typed on 12 Nov, and is saved for that day.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const ROLE = { v: 'OWNER' };   // the role a read reply reports (STAFF PR 443)
const TABLES = {
  area: [{ id: 'area-old', code: '3A.2/3', group_sort: '2' }, { id: 'area-new', code: '3A.1/2', group_sort: '2' }],
  subject: [], occupancy: [], subject_status: [], check_type: [], check_log: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [], qr_tag: [],
  temperature_band: [{ id: 'tb-1', band: 'Rest', age_from_days: '0', age_to_days: '', min_temp: '10', max_temp: '20' }],
  area_reading: [],
  thermometer: [
    { id: 'thm-old', name: '3A.2/3', area_id: 'area-old' },
    { id: 'thm-new', name: '3A.1/2', area_id: 'area-new' }
  ],
  // Lisa 11 Nov 2026, "A standard": when things are needed is need rows, never dates on the thing.
  requirement: [
    { id: 'req-1', need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'thm-old', from_date: '2025-01-01', to_date: '2026-11-11' },
    { id: 'req-2', need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'thm-new', from_date: '2026-11-12', to_date: '' },
    { id: 'req-3', need_type: 'room.in_use', target_table: 'area', target_id: 'area-old', from_date: '', to_date: '2026-11-11' }
  ]
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
    // STAFF PR 458: an unusual temperature is a warning the script gives; confirm_unusual = yes saves it
    if (b.fields && parseFloat(b.fields.max_c) > 60 && b.fields.confirm_unusual !== 'yes') {
      return route.fulfill({ headers: CORS, json: { ok: false, code: 'INVALID', message: 'Check the entry.', fields: { max_c: 'That is very high for a room.', confirm_unusual: 'Save anyway?' } } });
    }
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

  await page.getByRole('button', { name: 'Add earlier reading' }).click();
  await page.getByLabel('Day').fill('2026-11-10');
  await page.getByLabel('Day').dispatchEvent('change');
  await expect(cards).toHaveText(['3A.2/3 (retired 11/11/26)']);
  await cards.first().click();
  await expect(page.getByText('Earlier reading · 10/11/26 Morning')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Read with camera' })).toHaveCount(0);
  await page.getByLabel('MAX').fill('18.5');
  await page.getByLabel('MIN').fill('12.0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ table: 'area_reading', fields: { area_id: 'area-old', max_c: '18.5', min_c: '12.0', period_start: '2026-11-10T00:00:00+00:00', read_method: 'photo' } });   // Lisa 11 Nov: earlier readings are from photos
  await expect(page.getByText('Now press CLR')).toHaveCount(0);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.cards .card .nm')).toHaveText(['✓ 3A.2/3 (retired 11/11/26)']);
});

test('an earlier reading cannot be for now or later: that is the round', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  await page.getByRole('button', { name: 'Add earlier reading' }).click();
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

test('Lisa 11 Nov: an earlier reading outside the limit asks "What was done?", as the round does, and saves the note', async ({ page }) => {
  const sent = await setup(page);
  await page.clock.setFixedTime(new Date('2026-11-12T15:00:00Z'));   // afternoon: this morning is now a missed slot
  await page.goto('cdhub/staff/#m/temperature');
  await page.getByRole('button', { name: 'Add earlier reading' }).click();
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

// Room empty (Lisa 11 Nov 2026): no dog present. A flag on the slot's reading; a reading is optional with it, and an
// outside reading in an empty room is never a non-compliance, so "What was done" is not asked.
test('Room empty with no reading saves room_empty yes and no temperatures; no CLR step', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  await page.locator('.cards .card').first().click();
  await page.getByLabel('Room empty').check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ table: 'area_reading', fields: { area_id: 'area-new', room_empty: 'yes', period_start: '2026-11-12T00:00:00+00:00' } });
  expect(sent[0].fields).not.toHaveProperty('min_c');
  expect(sent[0].fields).not.toHaveProperty('max_c');
  expect(sent[0].fields).not.toHaveProperty('read_method');
  await expect(page.getByText('Now press CLR')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
});

test('Room empty with an outside reading saves without "What was done"; one temperature alone is refused', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  await page.locator('.cards .card').first().click();
  await page.getByLabel('Room empty').check();
  await page.getByLabel('MAX').fill('24.0');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Type MAX and MIN, or leave both blank.')).toBeVisible();
  await page.getByLabel('MIN').fill('8.0');
  await expect(page.getByLabel('What was done')).toBeHidden();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].fields).toMatchObject({ area_id: 'area-new', room_empty: 'yes', max_c: '24.0', min_c: '8.0', read_method: 'typed' });
  expect(sent[0].fields).not.toHaveProperty('mitigation_note');
});

test('Room empty with dogs recorded in the room warns but still allows it', async ({ page }) => {
  TABLES.subject = [{ id: 'dog-1', name: 'Test Dog', dob: '2020-01-01' }];
  TABLES.occupancy = [{ id: 'occ-1', subject_id: 'dog-1', area_id: 'area-new', moved_in: '2026-11-01' }];
  try {
    const sent = await setup(page);
    await page.goto('cdhub/staff/#m/temperature');
    await page.locator('.cards .card').first().click();
    await page.getByLabel('Room empty').check();
    await expect(page.getByText('Dogs are recorded in this room.')).toBeVisible();
    await page.getByLabel('MAX').fill('18.0');
    await page.getByLabel('MIN').fill('12.0');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => sent.length).toBe(1);
  } finally { TABLES.subject = []; TABLES.occupancy = []; }
});

test('year report: an empty room\'s outside reading is flagged "Room empty" but not counted as outside the limit', async ({ page }) => {
  TABLES.area_reading = [
    { id: 'r1', area_id: 'area-new', period_start: '2026-11-12T00:00:00+00:00', min_c: '8.0', max_c: '24.0', room_empty: 'yes' },
    { id: 'r2', area_id: 'area-new', period_start: '2026-11-12T12:00:00+00:00', room_empty: 'yes' }
  ];
  try {
    await setup(page);
    await page.goto('cdhub/staff/#m/temperature');
    await page.getByRole('button', { name: 'Year report' }).click();
    await page.getByLabel('Room').selectOption('area-new');
    await page.getByRole('button', { name: 'Open report' }).click();
    const month = page.locator('.tg-tab').first().locator('tbody tr').first();
    await expect(month.locator('td')).toHaveText(['11/26', '1', '8.0', '24.0', '0']);
    const rows = page.locator('.tg-tab').nth(1).locator('tbody tr');
    await expect(rows.first()).toHaveClass(/tg-br/);
    await expect(rows.first()).toContainText('Room empty');
    await expect(rows.nth(1)).toContainText('Room empty');
    await expect(rows.nth(1)).not.toHaveClass(/tg-br/);
  } finally { TABLES.area_reading = []; }
});

// Links (Lisa 12 Nov 2026): the year report for a new room includes the old room linked into it, each such row
// marked "From <old room>"; the old room's own report is unchanged.
test('year report: a new room includes readings from the old room linked into it, marked "From"', async ({ page }) => {
  TABLES.area_reading = [
    { id: 'r1', area_id: 'area-old', period_start: '2026-11-10T00:00:00+00:00', min_c: '11.0', max_c: '15.0' },
    { id: 'r2', area_id: 'area-new', period_start: '2026-11-12T00:00:00+00:00', min_c: '12.0', max_c: '16.0' }
  ];
  TABLES.area_link = [{ id: 'l1', from_area_id: 'area-old', to_area_id: 'area-new', from_date: '2025-01-01', to_date: '2026-11-11' }];
  try {
    await setup(page);
    await page.goto('cdhub/staff/#m/temperature');
    await page.addScriptTag({ path: 'cdhub/staff/lib/area-link.js' });   // the staff shell loads it once STAFF adds it to FILES
    await page.getByRole('button', { name: 'Year report' }).click();
    await page.getByLabel('Room').selectOption('area-new');
    await page.getByRole('button', { name: 'Open report' }).click();
    const rows = page.locator('.tg-tab').nth(1).locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('From 3A.2/3');
    await expect(rows.first()).toContainText('11.0');
    await expect(rows.nth(1)).not.toContainText('From');
  } finally { TABLES.area_reading = []; delete TABLES.area_link; }
});

test('Lisa 12 Nov: a reading is judged by the limit row in force on its own day, never today\'s', async ({ page }) => {
  const keep = { b: TABLES.temperature_band, r: TABLES.area_reading };
  TABLES.temperature_band = [
    { id: 'tb-old', band: 'Rest', min_temp: '10', max_temp: '20', from_date: '', to_date: '2026-11-11' },
    { id: 'tb-new', band: 'Rest', min_temp: '10', max_temp: '26', from_date: '2026-11-12', to_date: '' }
  ];
  TABLES.area_reading = [
    { id: 'r1', area_id: 'area-new', period_start: '2026-11-11T00:00:00+00:00', taken_at: '2026-11-11T08:00:00Z', min_c: '12.0', max_c: '21.0' },
    { id: 'r2', area_id: 'area-new', period_start: '2026-11-12T00:00:00+00:00', taken_at: '2026-11-12T08:00:00Z', min_c: '12.0', max_c: '22.0' }
  ];
  try {
    await setup(page);
    await page.goto('cdhub/staff/#m/temperature');
    await page.getByRole('button', { name: 'Year report' }).click();
    await page.getByLabel('Room').selectOption('area-new');
    await page.getByRole('button', { name: 'Open report' }).click();
    const rows = page.locator('.tg-tab').last().locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveClass(/tg-br/);       // 11/11: 21.0 is over 20.0, the row in force that day
    await expect(rows.nth(1)).not.toHaveClass(/tg-br/);   // 12/11: 22.0 is inside 26.0, the row in force that day
  } finally { TABLES.temperature_band = keep.b; TABLES.area_reading = keep.r; }
});

test('Year report and Sensor CSV show for an owner code only; a staff code sees the round and Add earlier reading', async ({ page }) => {
  ROLE.v = 'STAFF';
  try {
    await setup(page);
    await page.goto('cdhub/staff/#m/temperature');
    await expect(page.getByRole('button', { name: 'Add earlier reading' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Year report' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sensor CSV' })).toHaveCount(0);
  } finally { ROLE.v = 'OWNER'; }
});

// Found by the click-crawl, 13 Nov 2026: Sensor CSV threw "thermos is not defined", so the owner got a title and nothing else.
test('Sensor CSV opens for an owner: room picker and file box; a sensor file is read and saved one day at a time @regression', async ({ page }) => {
  const sent = await setup(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // this test's save script also has the sensor back-up list switched on
  await page.route(SCRIPT, (route) => (route.request().method() === 'GET'
    ? route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'area_reading', on: true, mode: 'direct' }, { key: 'sensor_reading', on: true, mode: 'direct' }] } })
    : route.fallback()));
  await page.goto('cdhub/staff/#m/temperature');
  await page.getByRole('button', { name: 'Sensor CSV' }).click();
  await expect(page.getByRole('heading', { name: 'Sensor back-up import' })).toBeVisible();
  const room = page.getByLabel('Room');
  await expect(room.locator('option')).toHaveText(['Choose the room', '3A.1/2']);   // rooms in use today, one choice each
  await expect(room.locator('option').nth(1)).toHaveAttribute('value', 'area-new');   // a room id, so the save names a room
  await expect(page.getByLabel('Sensor name')).toBeVisible();
  await page.getByLabel('Sensor CSV file').setInputFiles({ name: 'sample-sensor.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Timestamp,Temperature_Celsius\n2026-11-10 08:00:00,12.0\n2026-11-10 15:00:00,18.5\n2026-11-11 09:00:00,13.0\n') });
  await expect(page.getByText('2 days.')).toBeVisible();
  const saveAll = page.getByRole('button', { name: 'Save 2 days' });
  await saveAll.click();
  await expect(page.getByText('Choose the room.')).toBeVisible();   // nothing is sent without a room
  expect(sent).toHaveLength(0);
  await room.selectOption('area-new');
  await saveAll.click();
  await expect(page.getByText('2 saved.')).toBeVisible();
  expect(sent.map((b) => b.table)).toEqual(['sensor_reading', 'sensor_reading']);
  expect(sent[0].fields).toMatchObject({ area_id: 'area-new', day: '2026-11-10', min_c: '12.0', max_c: '18.5', source: 'govee' });
  await page.getByRole('button', { name: '← Rooms' }).click();
  await expect(page.getByRole('heading', { name: 'Room temperatures' })).toBeVisible();
  expect(errors, errors.join('\n')).toEqual([]);
});

test('an unusual temperature is the script\'s warning: the screen shows it with "Save anyway", which resends with confirm_unusual yes', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  await page.locator('.cards .card').first().click();
  await page.getByRole('button', { name: 'Type it' }).click();
  await page.getByLabel('MAX').fill('65.0');
  await page.getByLabel('MIN').fill('12.0');
  await page.getByLabel('What was done').fill('Thermometer checked');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('That is very high for a room. Save anyway?')).toBeVisible();
  expect(sent[0].fields.confirm_unusual).toBeUndefined();
  await page.getByRole('button', { name: 'Save anyway' }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].fields).toMatchObject({ max_c: '65.0', min_c: '12.0', confirm_unusual: 'yes' });
  await expect(page.getByText('Now press CLR')).toBeVisible();
});

const SHOTS = process.env.MINMAX_SHOTS_DIR || require('path').join(process.cwd(), 'test-results', 'minmax');
function staffShot(name) {
  const fs = require('fs');
  const path = require('path');
  fs.mkdirSync(SHOTS, { recursive: true });
  return path.join(SHOTS, name);
}

const PAIR_MSG = 'The lowest reading cannot be higher than the highest reading.';

test('min 22.0 and max 18.0 (min first) is flagged as the wrong way round and nothing is posted', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  await page.locator('.cards .card').first().click();
  await page.getByRole('button', { name: 'Type it' }).click();
  await page.getByLabel('MIN').fill('22.0');
  await page.getByLabel('MAX').fill('18.0');
  const bad = page.locator('.msg.bad', { hasText: PAIR_MSG });
  await expect(bad).toHaveCount(1);
  await expect(page.getByLabel('MIN')).toHaveClass(/\bswap\b/);
  await expect(page.getByLabel('MAX')).toHaveClass(/\bswap\b/);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(bad).toHaveCount(2);
  expect(sent, 'staff must not POST a swapped min/max').toHaveLength(0);
  await bad.last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: staffShot('staff-min-first.png'), fullPage: false });
  require('fs').writeFileSync(staffShot('staff-min-first-posts.json'), JSON.stringify(sent, null, 2));
});

test('min 22.0 and max 18.0 (max first) is flagged as the wrong way round and nothing is posted', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#m/temperature');
  await page.locator('.cards .card').first().click();
  await page.getByRole('button', { name: 'Type it' }).click();
  await page.getByLabel('MAX').fill('18.0');
  await page.getByLabel('MIN').fill('22.0');
  const bad = page.locator('.msg.bad', { hasText: PAIR_MSG });
  await expect(bad).toHaveCount(1);
  await expect(page.getByLabel('MIN')).toHaveClass(/\bswap\b/);
  await expect(page.getByLabel('MAX')).toHaveClass(/\bswap\b/);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(bad).toHaveCount(2);
  expect(sent, 'staff must not POST a swapped min/max (max typed first)').toHaveLength(0);
  await page.screenshot({ path: staffShot('staff-max-first.png'), fullPage: false });
  require('fs').writeFileSync(staffShot('staff-max-first-posts.json'), JSON.stringify(sent, null, 2));
});

test('year report: a saved reading with max lower than min is flagged, not counted as outside the limit', async ({ page }) => {
  TABLES.area_reading = [
    { id: 'r1', area_id: 'area-new', period_start: '2026-11-12T00:00:00+00:00', min_c: '22.0', max_c: '18.0' }
  ];
  try {
    await setup(page);
    await page.goto('cdhub/staff/#m/temperature');
    await page.getByRole('button', { name: 'Year report' }).click();
    await page.getByLabel('Room').selectOption('area-new');
    await page.getByRole('button', { name: 'Open report' }).click();
    const month = page.locator('.tg-tab').first().locator('tbody tr').first();
    await expect(month.locator('td')).toHaveText(['11/26', '1', '22.0', '18.0', '0']);
    const row = page.locator('.tg-tab').nth(1).locator('tbody tr').first();
    await expect(row).toHaveClass(/tg-br/);
    await expect(row).toContainText('max lower than min');
    await expect(row).toContainText('22.0');
    await expect(row).toContainText('18.0');
    await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: staffShot('staff-year-report-swapped.png'), fullPage: false });
  } finally { TABLES.area_reading = []; }
});
