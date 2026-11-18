// Where is everyone? room picker (Lisa 12 Nov 2026): the room code only ("just 4A"), only sleeping rooms, meaning rooms
// with room-limit rows in force today (no list in code), in place order, and Off-site as its own button. Pretend data only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const cap = (id, area, extra) => Object.assign({ id, area_id: area, access_type: 'free', size_band: 'small', max_dogs: '2' }, extra || {});
const TABLES = {
  area: [
    { id: 'ar-q9', code: 'Q.9/10', grouping: 'Q', group_sort: '3' }, { id: 'ar-p1', code: 'P1', grouping: 'P - Place', group_sort: '1' },
    { id: 'ar-field', code: 'Pretend Field', grouping: 'Fields', group_sort: '9' }, { id: 'ar-q4', code: 'Q.4/5', grouping: 'Q', group_sort: '3' },
    { id: 'ar-p2', code: 'P2', grouping: 'P - Place', group_sort: '1' }, { id: 'ar-old', code: 'Old room', grouping: 'Q', group_sort: '3' }
  ],
  subject: [{ id: 'dog-1', name: 'Pretend Dog' }],
  occupancy: [{ id: 'occ-1', subject_id: 'dog-1', area_id: 'ar-p1', moved_in: '2026-11-01T09:00:00+00:00' }],
  subject_status: [], requirement: [],
  area_capacity: [cap('c1', 'ar-p1'), cap('c2', 'ar-p2'), cap('c3', 'ar-q4'), cap('c4', 'ar-q9'), cap('c5', 'ar-old', { to_date: '2026-11-10' })]
};

async function setup(page, posts) {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'occupancy', on: true, mode: 'direct' }, { key: 'occupancy_out', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) {
      if (b.table && !TABLES[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: TABLES[b.table] || [], tables: TABLES } } });
    }
    posts.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'x-1' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  await page.clock.setFixedTime(new Date('2026-11-12T09:00:00Z'));
}

test('Where: only rooms with limit rows in force, code only, in place order; Off-site is a button', async ({ page }) => {
  const posts = [];
  await setup(page, posts);
  await page.goto('cdhub/staff/#m/where');
  await page.getByRole('button', { name: 'Moved' }).first().click();
  const sel = page.getByLabel('Pretend Dog new room');
  await expect(sel.locator('option')).toHaveText(['Pick the new room', 'P2', 'Q.4/5', 'Q.9/10']);
  await expect(sel.locator('option', { hasText: 'Off-site' })).toHaveCount(0);
  const off = page.locator('[data-dog="dog-1"] button[data-off-site]');
  await expect(off).toHaveText('Off-site');
  await off.click();
  await expect(page.locator('[data-dog="dog-1"] .bs-result')).toHaveText('Off-site.');
  expect(posts.some((b) => JSON.stringify(b).includes('occupancy_out'))).toBe(true);
});
