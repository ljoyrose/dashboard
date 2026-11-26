// Where: find a dog (the owner 22 Nov 2026: "otherwise can't find them easily"). Typing shows only the dogs whose name holds
// the text (any case, anywhere), each with its room; Clear shows them all; no match says so. Nothing is saved.
// Pretend dogs, rooms and code only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const TABLES = {
  area: [{ id: 'ar-p1', code: 'P1', grouping: 'P - Place', group_sort: '1' }, { id: 'ar-p2', code: 'P2', grouping: 'P - Place', group_sort: '1' }],
  subject: [{ id: 'dog-1', name: 'Pretend Bramble' }, { id: 'dog-2', name: 'Pretend Pepper' }, { id: 'dog-3', name: 'Fake Ramsey' }],
  occupancy: [
    { id: 'occ-1', subject_id: 'dog-1', area_id: 'ar-p1', moved_in: '2026-11-01T09:00:00+00:00' },
    { id: 'occ-2', subject_id: 'dog-2', area_id: 'ar-p2', moved_in: '2026-11-01T09:00:00+00:00' },
    { id: 'occ-3', subject_id: 'dog-3', area_id: 'ar-p2', moved_in: '2026-11-01T09:00:00+00:00' }
  ],
  subject_status: [], requirement: [], area_capacity: []
};

async function open(page, posts) {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'occupancy', on: true, mode: 'direct' }, { key: 'occupancy_check', on: true, mode: 'direct' }] } });
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
  await page.goto('cdhub/staff/#m/where');
  await expect(page.locator('[data-dog]')).toHaveCount(3);
}
const visible = (page) => page.locator('[data-dog]:visible .bs-dog-name');

test('find: any case, anywhere in the name, each dog keeps its room; nothing is saved', async ({ page }) => {
  const posts = [];
  await open(page, posts);
  const find = page.getByRole('searchbox', { name: 'Find a dog' });
  expect(await find.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);   // no zoom on iPhone
  await find.fill('RAM');
  await expect(visible(page)).toHaveText(['Pretend Bramble', 'Fake Ramsey']);
  await expect(page.locator('[data-dog="dog-1"] .bs-dog-was')).toHaveText('Last recorded: P1');
  await expect(page.locator('[data-dog="dog-3"] .bs-dog-was')).toHaveText('Last recorded: P2');
  await expect(page.locator('.bs-sticky')).toBeHidden();
  await find.fill('pepper');
  await expect(visible(page)).toHaveText(['Pretend Pepper']);
  expect(posts).toEqual([]);
});

test('find: Clear brings back every dog and the confirm button', async ({ page }) => {
  await open(page, []);
  const find = page.getByRole('searchbox', { name: 'Find a dog' });
  const clear = page.getByRole('button', { name: 'Clear' });
  await expect(clear).toBeHidden();
  await find.fill('bramble');
  await expect(visible(page)).toHaveCount(1);
  await clear.click();
  await expect(find).toHaveValue('');
  await expect(find).toBeFocused();
  await expect(visible(page)).toHaveCount(3);
  await expect(clear).toBeHidden();
  await expect(page.getByRole('button', { name: /All the rest unmoved/ })).toBeVisible();
});

test('find: no match says so; deleting the text shows every dog again', async ({ page }) => {
  await open(page, []);
  const find = page.getByRole('searchbox', { name: 'Find a dog' });
  await find.fill('Zebra');
  await expect(visible(page)).toHaveCount(0);
  await expect(page.locator('#where-none')).toHaveText("No dog called 'Zebra'");
  await find.fill('');
  await expect(visible(page)).toHaveCount(3);
  await expect(page.locator('#where-none')).toBeHidden();
});

