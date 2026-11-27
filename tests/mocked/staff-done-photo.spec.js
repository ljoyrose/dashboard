// After a Done the record is saved first; then a photo is offered (Take, Choose, Skip). Pretend rooms, dogs and jobs; fake code, fake save address.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const J = (key, label, target, extra) => Object.assign({ id: 'cty-' + key, type_key: key, label, target, active: 'true', effective_from: '2026-01-01', asks_outcome: 'true', every_days: '' }, extra || {});
const TYPES = [
  J('groom', 'Groom', 'dog', { every_days: '7' }),
  J('ears', 'Ears', 'dog', { every_days: '28' }),
  J('health', 'Health check', 'none', { every_days: '1', site_scope: 'per_dog', not_in_areas: 'none' })
];
const TABLES = {
  area: [{ id: 'area-1', code: 'R1' }], subject: [{ id: 'dog-1', name: 'Pretend A' }, { id: 'dog-2', name: 'Pretend B' }],
  occupancy: [{ subject_id: 'dog-1', area_id: 'area-1', moved_in: '2026-10-01' }, { subject_id: 'dog-2', area_id: 'area-1', moved_in: '2026-10-01' }],
  subject_status: [], check_type: TYPES, check_log: [], area_capacity: [], area_access: [], litter: [], capacity_setting: [], breeding_rule: [],
  qr_tag: [{ tag: 'DOG2TAG2', kind: 'subject', ref_id: 'dog-1', active: 'true' }, { tag: 'SITETAG2', kind: 'site', ref_id: 'site', active: 'true' }]
};

async function setup(page, opts) {
  const o = opts || {}, data = Object.assign({}, TABLES, o.tables || {}), sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'check_log', on: true, mode: 'direct' }] } });
    const b = JSON.parse(route.request().postData());
    if (String(b.action).indexOf('read') === 0) {
      if (b.table && !data[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: data[b.table] || [], tables: data } } });
    }
    sent.push(b);
    if (b.action === 'file_add') return route.fulfill({ headers: CORS, json: o.fileFails ? { ok: false, code: 'INVALID', message: 'That file type is not allowed.' } : { ok: true, result: { status: 'saved', id: 'fil-1' } } });
    if (b.action === 'link_add') return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'lnk-' + sent.length } } });
    const site = b.action === 'add_site' && b.fields.dog_ids;
    return route.fulfill({ headers: CORS, json: { ok: true, result: Object.assign({ status: 'saved', id: 'clg-1', at: new Date().toISOString() }, site ? { ids: b.fields.dog_ids.split('|').map((x, i) => 'clg-' + (i + 1)), saved: 2 } : {}) } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  return sent;
}
const choose = (card) => card.locator('[data-ev-photo] input[type=file]').setInputFiles({ name: 'groomed.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });

test('a Done saves the record first, then a chosen photo is kept and linked to it as evidence @regression', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.getByRole('button', { name: 'Done: Groom' }).click();
  const card = page.locator('[data-job="groom"]');
  await expect(card.locator('.done-line')).toContainText(/Done \d\d:\d\d/);
  await expect(card.locator('[data-ev-photo]')).toContainText('Add photo');
  await expect(card.getByRole('button', { name: 'Take photo' })).toBeVisible();
  expect(sent.map((b) => b.action)).toEqual(['add']);   // the record is saved before any photo
  await choose(card);
  await expect(card.getByText('✓ Photo kept with the record.')).toBeVisible();
  expect(sent.map((b) => b.action)).toEqual(['add', 'file_add', 'link_add']);
  expect(sent[1].fields).toMatchObject({ kind: 'photo', mime: 'image/jpeg' });
  expect(sent[2].fields).toMatchObject({ from_table: 'check_log', from_id: 'clg-1', role: 'evidence', to_table: 'files', to_id: 'fil-1' });
});

test('Skip keeps the record and sends nothing more', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.getByRole('button', { name: 'Done: Groom' }).click();
  const card = page.locator('[data-job="groom"]');
  await card.getByRole('button', { name: 'Skip' }).click();
  await expect(card.locator('[data-ev-photo]')).toHaveCount(0);
  await expect(card.locator('.done-line')).toContainText(/Done \d\d:\d\d/);
  await page.waitForTimeout(200);
  expect(sent.map((b) => b.action)).toEqual(['add']);
});

test('a photo the save script refuses says Photo not kept with the reason; the record stays done', async ({ page }) => {
  const sent = await setup(page, { fileFails: true });
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.getByRole('button', { name: 'Done: Groom' }).click();
  const card = page.locator('[data-job="groom"]');
  await choose(card);
  await expect(card.locator('[data-ev-photo] .msg.bad')).toHaveText('Photo not kept: That file type is not allowed. The record is saved. Try again or skip.');
  await expect(card.locator('.done-line')).toContainText(/Done \d\d:\d\d/);
  expect(sent.map((b) => b.action)).toEqual(['add', 'file_add']);
});

test('the switch per job (job.done_photo.<job> = no) hides the offer for that job only', async ({ page }) => {
  await setup(page, { tables: { breeding_rule: [{ rule_key: 'job.done_photo.groom', value: 'no', effective_from: '2026-01-01', to_date: '' }] } });
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.getByRole('button', { name: 'Done: Groom' }).click();
  await expect(page.locator('[data-job="groom"] .done-line')).toContainText(/Done \d\d:\d\d/);
  await expect(page.locator('[data-job="groom"] [data-ev-photo]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Done: Ears' }).click();
  await expect(page.locator('[data-job="ears"] [data-ev-photo]')).toBeVisible();
});

test('the switch for every job (job.done_photo = no) hides the offer', async ({ page }) => {
  await setup(page, { tables: { breeding_rule: [{ rule_key: 'job.done_photo', value: 'no', effective_from: '2026-01-01', to_date: '' }] } });
  await page.goto('cdhub/staff/#s/DOG2TAG2');
  await page.getByRole('button', { name: 'Done: Groom' }).click();
  await expect(page.locator('[data-job="groom"] .done-line')).toContainText(/Done \d\d:\d\d/);
  await page.waitForTimeout(200);
  await expect(page.locator('[data-ev-photo]')).toHaveCount(0);
});

test('a whole-site dog job: one photo is linked to every dog saved', async ({ page }) => {
  const sent = await setup(page);
  await page.goto('cdhub/staff/#s/SITETAG2');
  const card = page.locator('[data-job="health"]');
  await card.getByRole('button', { name: 'Yes, done: Health check' }).click();
  await card.getByRole('button', { name: 'Select all' }).click();
  await card.getByRole('button', { name: 'Yes, done: Health check' }).click();
  await expect.poll(() => sent.length).toBe(1);
  const fresh = page.locator('[data-job="health"]');
  await choose(fresh);
  await expect(fresh.getByText('✓ Photo kept with the record.')).toBeVisible();
  expect(sent.map((b) => b.action)).toEqual(['add_site', 'file_add', 'link_add', 'link_add']);
  expect(sent.slice(2).map((b) => b.fields.from_id)).toEqual(['clg-1', 'clg-2']);
});
