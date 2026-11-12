// Places where dogs are not placed (overseer 12 Nov 2026): a corridor is marked by a dated room.no_dogs need row,
// never by its name. The Where screen and a room-sign scan never offer it; temperatures still list it. Pretend data only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const TABLES = {
  area: [{ id: 'area-r1', code: 'R1', group_sort: '1' }, { id: 'area-r2', code: 'R2', group_sort: '1' }, { id: 'area-c1', code: 'Hall C', group_sort: '1' }],
  subject: [{ id: 'dog-1', name: 'Pretend Dog' }],
  occupancy: [{ id: 'occ-1', subject_id: 'dog-1', area_id: 'area-r1', moved_in: '2026-11-01T09:00:00+00:00' }],
  subject_status: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [],
  qr_tag: [{ id: 'qr-1', tag: 'TAGCCC', kind: 'area', ref_id: 'area-c1', active: 'true' }],
  requirement: [{ id: 'req-1', need_type: 'room.no_dogs', target_table: 'area', target_id: 'area-c1', from_date: '2026-11-03', to_date: '' }]
};

async function setup(page) {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'occupancy', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) {
      if (b.table && !TABLES[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: TABLES[b.table] || [], tables: TABLES } } });
    }
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'x-1' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  await page.clock.setFixedTime(new Date('2026-11-12T09:00:00Z'));
}

test('Where: a place with a room.no_dogs row is not offered as a new room; other rooms are', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#m/where');
  await page.getByRole('button', { name: 'Moved' }).first().click();
  const opts = page.getByLabel('Pretend Dog new room').locator('option');
  await expect(opts).toContainText(['R2']);
  await expect(page.getByLabel('Pretend Dog new room').locator('option', { hasText: 'Hall C' })).toHaveCount(0);
});

test('Moves: scanning the sign of a room.no_dogs place says dogs are not placed there', async ({ page }) => {
  await setup(page);
  await page.goto('cdhub/staff/#mv/TAGCCC');
  await expect(page.getByText('Hall C: dogs are not placed here.')).toBeVisible();
});
