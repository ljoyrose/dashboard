// A valid staff code saves a room move and a photo from a browser with empty storage.
// The save script (mocked) checks the code. Nothing here is a device flag, and nothing is a real animal.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const SINK = 'https://script.google.com/macros/s/PRETENDSCRIPT/exec';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAmElEQVR4nO3QMREAIBDAsJeDJnTiD2RkoEP2XufsdX82OkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAK0BOkBrgA7QGqADtAboAO0BRAlSDuvH3FYAAAAASUVORK5CYII=', 'base64');
const WHO = { 'river-staff-441': 'River', 'moss-staff-882': 'Moss' };

const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};

function rooms(world) {
  setFile(world, 'BLD-area_access.csv', 'id,area_id,access_type\nax-1,area-1,free\nax-2,area-2,free\n');
  setFile(world, 'BLD-area_capacity.csv', 'id,area_id,access_type,size_band,max_dogs,from_date,to_date,basis\n'
    + 'cap-1,area-1,free,small,4,2026-01-01,,invented\ncap-2,area-1,free,medium,3,2026-01-01,,invented\n'
    + 'cap-3,area-1,free,medium + pups,1,2026-01-01,,invented\ncap-4,area-2,free,medium,3,2026-01-01,,invented\n');
  setFile(world, 'BLD-breeding_rule.csv', 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by\n'
    + 'r3,t,size_from_kg.medium,10,2026-01-01,Pretend vet,,,\nr4,t,size_from_kg.large,25,2026-01-01,Pretend vet,,,\n');
  world.file('drv-photo-new', 'new.png', '', { mimeType: 'image/png' });
  world.byId('drv-photo-new').thumbnailLink = 'https://example.com/pretend-dog-new.png';
}

function answer(body) {
  const who = WHO[body.code];
  if (!who) return { ok: false, code: 'BAD_CODE', message: 'That staff code was not recognised.' };
  if (body.action === 'dog_photo') return { ok: true, result: { status: 'saved', subject_id: body.fields.subject_id, file_id: 'drv-photo-new', who, at: '2026-11-13T10:00:00+00:00' } };
  return { ok: true, result: { status: 'saved', id: 'occ-new', who, at: '2026-11-13T10:00:00+00:00' } };
}

async function openDogs(page, guard) {
  rooms(guard.world);
  const sent = [];
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    sent.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body)) });
  });
  await page.route('https://example.com/pretend-dog-new.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.goto('cdhub/');
  await page.evaluate((url) => { DASH_CONFIG.cdhub.saveScriptUrl = url; }, SINK);
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  await expect(page.locator('.dc[data-dog="sub-test-pup-1"]')).toBeVisible();
  expect(await page.evaluate(() => [
    localStorage.getItem('cdhub.sink.code'),
    localStorage.getItem('cdhub.sink.url'),
    localStorage.getItem('cdhub.sink.off'),
    localStorage.getItem('bld.device.code'),
    localStorage.getItem('bld.staffCode'),
    sessionStorage.getItem('cdhub.staff.session')
  ])).toEqual([null, null, null, null, null, null]);
  return sent;
}

async function enterCode(page, code) {
  const dlg = page.getByRole('dialog', { name: 'Staff code' });
  await expect(dlg).toBeVisible();
  await dlg.getByLabel('Your staff code').fill(code);
  await dlg.getByRole('button', { name: 'Use this code' }).click();
  await expect(dlg).toHaveCount(0);
}

function stamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return `AA_CDHUB_${g('year')}-${g('month')}-${g('day')}-${g('hour')}${g('minute')}`;
}

async function shot(page, card, nn) {
  const dir = process.env.SAVE_SHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await card.screenshot({ path: path.join(dir, `${stamp()}_${nn}__CURSOR-AGENT.png`) });
}

async function roomAndPhoto(page, guard, code, shots) {
  const sent = await openDogs(page, guard);
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await enterCode(page, code);
  await expect(card.locator('[data-k="moved"]')).toHaveText(/^Moved \d\d:\d\d$/);
  await expect(card.locator('[data-k="moved"] .sv-line.good svg')).toHaveCount(1);   // the tick on the item (tick on every save)
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ table: 'occupancy', action: 'add', code, fields: { subject_id: 'sub-test-pup-1', area_id: 'area-1' } });
  expect(sent[0].code).toBe(code);
  if (shots) await shot(page, card, '01');

  await expect(page.getByRole('dialog', { name: 'Staff code' })).toHaveCount(0);
  const png = path.join(os.tmpdir(), 'pretend-pup-' + code + '.png');
  fs.writeFileSync(png, PNG);
  await card.locator('input[data-photo-src="upload"]').setInputFiles(png);
  await page.locator('[data-crop-use]').click();
  await expect(card.locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'drv-photo-new');
  await expect(card.locator('img.dogphoto')).toBeVisible();
  expect(sent).toHaveLength(2);
  expect(sent[1].action).toBe('dog_photo');
  expect(sent[1].code).toBe(code);
  expect(sent[1].fields.subject_id).toBe('sub-test-pup-1');
  expect(sent[1].fields.mime).toBe('image/jpeg');
  expect(await page.evaluate(() => [
    localStorage.getItem('cdhub.sink.code'),
    localStorage.getItem('bld.device.code'),
    localStorage.getItem('cdhub.sink.off')
  ])).toEqual([null, null, null]);
  if (shots) await shot(page, card, '02');
}

test('staff code River saves a room and a photo from empty storage @regression', async ({ page, guard }) => {
  await roomAndPhoto(page, guard, 'river-staff-441', true);
});

test('staff code Moss saves a room and a photo from a second empty browser', async ({ page, guard }) => {
  await roomAndPhoto(page, guard, 'moss-staff-882', false);
});

test('an invalid staff code is refused and nothing is saved @regression', async ({ page, guard }) => {
  const sent = await openDogs(page, guard);
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await enterCode(page, 'not-a-real-code');
  await expect(page.locator('[data-move-msg]')).toHaveText('Not saved: That staff code was not recognised.');
  await expect(card.locator('[data-k="moved"]')).toHaveCount(0);
  expect(sent).toHaveLength(1);
  expect(sent[0].code).toBe('not-a-real-code');
  expect(sent[0].table).toBe('occupancy');
});

// Phone repro (13 Nov 2026): the code was kept for the tab only, so a phone asked again after the tab or Home Screen
// app closed. A code the script accepts is now kept on the device; a refused code is not.
test('an accepted staff code is kept on this device and not asked again in a new tab @regression', async ({ page, guard }) => {
  const sent = await openDogs(page, guard);
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await enterCode(page, 'river-staff-441');
  await expect(card.locator('[data-k="moved"]')).toHaveText(/^Moved \d\d:\d\d$/);
  expect(await page.evaluate(() => localStorage.getItem('cdhub.staff.code'))).toBe('river-staff-441');

  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.evaluate((url) => { DASH_CONFIG.cdhub.saveScriptUrl = url; }, SINK);
  if (await page.locator('#signinbtn').isVisible()) await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  const again = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await again.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await expect(again.locator('[data-k="moved"]')).toHaveText(/^Moved \d\d:\d\d$/);
  await expect(page.getByRole('dialog', { name: 'Staff code' })).toHaveCount(0);
  expect(sent).toHaveLength(2);
  expect(sent[1].code).toBe('river-staff-441');
});

test('a refused staff code is not kept on this device', async ({ page, guard }) => {
  await openDogs(page, guard);
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await enterCode(page, 'not-a-real-code');
  await expect(page.locator('[data-move-msg]')).toHaveText('Not saved: That staff code was not recognised.');
  expect(await page.evaluate(() => localStorage.getItem('cdhub.staff.code'))).toBeNull();
});
