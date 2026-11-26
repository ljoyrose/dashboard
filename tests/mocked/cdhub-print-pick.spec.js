// Pick which cards print (the owner 22 Nov 2026: "can I print one specific area, item, thermometer, dog etc, or select all (with
// unselect) for them all?"). After Room, Dog, Litter or Thermometer cards: one tick box per card, all ticked to start, with
// Select all and Unselect all. Only ticked cards draw and print, only ticked cards can get a new code saved, nothing ticked
// prints nothing, and the list itself never prints. Fake save address and invented rows only.
const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };

async function open(page, tables, path) {
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'USER' } } });
    sent.push(b);
    if (b.table === 'qr_tag') tables.qr_tag.push({ ...b.fields, active: 'true' });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'qrt-' + sent.length } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-USER', SCRIPT]);
  await page.goto(path);
  return sent;
}
const picks = (page) => page.locator('.pick input[type="checkbox"]');
const ready = (page, n) => expect(page.locator('.msg')).toHaveText(n + ' cards ready. Use your browser’s Print.');

test('dog cards: all ticked to start; untick one dog prints only the other; Unselect all prints nothing; Select all brings both back, no code saved twice', async ({ page }) => {
  const tables = {
    area: [{ id: 'ar-a', code: 'Room A' }], requirement: [], area_capacity: [], litter: [], breeding_rule: [], microchip: [], weight: [], check_type: [],
    subject: [{ id: 'd1', name: 'Pretend Bramble', sex: 'Female' }, { id: 'd2', name: 'Pretend Pip', sex: 'Male' }],
    occupancy: [{ subject_id: 'd1', area_id: 'ar-a', moved_in: '2026-01-01' }, { subject_id: 'd2', area_id: 'ar-a', moved_in: '2026-01-01' }],
    qr_tag: [{ tag: 'AAAA2222', kind: 'subject', ref_id: 'd1', active: 'true' }]
  };
  const sent = await open(page, tables, 'cdhub/staff/print/');
  await page.getByRole('button', { name: 'Dog cards' }).click();
  await expect(picks(page)).toHaveCount(2);
  for (const box of await picks(page).all()) await expect(box).toBeChecked();
  await expect(page.locator('.pick-n')).toHaveText('2 of 2 cards ticked');
  await expect(page.locator('.dcard')).toHaveCount(2);
  await ready(page, 2);
  expect(sent.map((b) => b.fields.ref_id), 'one new code, for the ticked dog that had none').toEqual(['d2']);

  // one specific dog
  await page.getByRole('checkbox', { name: 'Pretend Bramble' }).uncheck();
  await expect(page.locator('.dcard')).toHaveCount(1);
  await expect(page.locator('.dcard')).toHaveAttribute('data-dog', 'd2');
  await expect(page.locator('.pick-n')).toHaveText('1 of 2 cards ticked');
  await ready(page, 1);

  await page.getByRole('button', { name: 'Unselect all', exact: true }).click();
  await expect(page.locator('.sheet > *')).toHaveCount(0);
  await expect(page.locator('.msg')).toHaveText('Nothing ticked, so nothing will print. Tick a card, or press Select all.');
  for (const box of await picks(page).all()) await expect(box).not.toBeChecked();

  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.locator('.dcard')).toHaveCount(2);
  await ready(page, 2);
  expect(sent.length, 'Select all reuses the saved codes').toBe(1);

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.pick')).toBeHidden();
  await expect(page.locator('.dcard').first()).toBeVisible();
});

test('room cards: ?sign= ticks only that room; ticking a second room makes its code then, and only for it', async ({ page }) => {
  const tables = {
    area: [{ id: 'ar-a', code: 'Room A' }, { id: 'ar-b', code: 'Room B' }, { id: 'ar-c', code: 'Room C' }],
    requirement: [], area_capacity: [], subject: [], occupancy: [], litter: [], breeding_rule: [],
    qr_tag: [{ tag: 'AAAA2222', kind: 'area', ref_id: 'ar-a', active: 'true' }]
  };
  const sent = await open(page, tables, 'cdhub/staff/print/?sign=ar-a');
  await expect(picks(page)).toHaveCount(3);
  await expect(page.getByRole('checkbox', { name: 'Room A' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Room B' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Room C' })).not.toBeChecked();
  await expect(page.locator('.rcard')).toHaveCount(1);
  await expect(page.locator('.rcard')).toHaveAttribute('data-room', 'ar-a');
  expect(sent, 'Room A has its code; the unticked rooms get none').toEqual([]);

  await page.getByRole('checkbox', { name: 'Room B' }).check();
  await expect(page.locator('.rcard')).toHaveCount(2);
  await ready(page, 2);
  expect(sent.map((b) => [b.fields.kind, b.fields.ref_id]), 'a code only for the room just ticked').toEqual([['area', 'ar-b']]);
  await expect(page.locator('.rcard[data-room="ar-c"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Whole-site code' }).click();
  await expect(picks(page)).toHaveCount(0);
});

