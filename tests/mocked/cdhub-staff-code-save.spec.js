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
  // 16 Nov 2026: a signed-in hub first sends its Google sign-in; these pretend staff are not owners, so the script says
  // so and the hub asks for the staff code (as the real script does when the account is not on the owner list).
  if (!body.code) return body.google_token
    ? { ok: false, code: 'GOOGLE_NOT_OWNER', message: 'This Google account is not on the owner list. Enter your staff code. Nothing was saved.' }
    : { ok: false, code: 'NO_CODE', message: 'Enter your staff code.' };
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
    if (body.code) sent.push(body);   // the Google-only first try (refused in answer) is not a save
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
    localStorage.getItem('cdhub.save.off'),
    localStorage.getItem('bld.device.code'),
    localStorage.getItem('bld.staffCode'),
    sessionStorage.getItem('cdhub.staff.session')
  ])).toEqual([null, null, null, null, null, null, null]);
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

// 15 Nov 2026 ("could not reach the save script" on the dog card): a Drive read of the save address that found
// nothing was kept as the answer for the whole visit, and a found address lived in memory only. Now an empty read is
// tried again, and the address is kept on this device for the next visit.
test('save address: an empty first read is tried again, and the found address is kept for the next visit @regression', async ({ page, guard }) => {
  rooms(guard.world);
  const sent = [];
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.code) sent.push(body);   // the Google-only first try (refused in answer) is not a save
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body)) });
  });
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await expect(page.locator('[data-move-msg]')).toContainText('Could not reach the save script');
  expect(sent).toHaveLength(0);

  setFile(guard.world, 'BLD-save-webapp.json', JSON.stringify({ url: SINK }));
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await enterCode(page, 'river-staff-441');
  await expect(card.locator('[data-k="moved"]')).toHaveText(/^Moved \d\d:\d\d$/);
  expect(sent).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('cdhub.save.url'))).toBe(SINK);

  setFile(guard.world, 'BLD-save-webapp.json', '{}');
  await page.reload();
  if (await page.locator('#signinbtn').isVisible()) await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  const again = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await again.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await expect(again.locator('[data-k="moved"]')).toHaveText(/^Moved \d\d:\d\d$/);
  expect(sent).toHaveLength(2);
});


// Live test (13 Nov 2026 09:07): saving worked, but The round said "Saving on this device: off" with an empty code box
// on every open, because the panel read only the old round-card keys and never the kept code. One source now.
const CODE = 'river-staff-441';

async function saveOnce(page, guard) {
  const sent = await openDogs(page, guard);
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  await enterCode(page, CODE);
  await expect(card.locator('[data-k="moved"]')).toHaveText(/^Moved \d\d:\d\d$/);
  return sent;
}

async function panelIsOn(page) {
  const box = page.locator('#sinkcard');
  await expect(box).toContainText('Saving on this device: on');
  await expect(page.locator('#sinkcode')).toHaveValue('••••••');
  await expect(box.locator('[data-device-line]')).toHaveText('On this device: opened in the browser · your code is remembered · saving is set up');
  expect(await box.evaluate((e) => e.outerHTML)).not.toContain(CODE);
}

test('after a code is accepted, The round panel says on and masks the code @regression', async ({ page, guard }) => {
  await saveOnce(page, guard);
  await tabClick(page, '#nav button[data-go="round"]');
  await panelIsOn(page);
});

test('Switch off here forgets the code and the address on this device, and the next save asks again', async ({ page, guard }) => {
  const sent = await saveOnce(page, guard);
  await page.evaluate(() => { DASH_CONFIG.cdhub.saveScriptUrl = ''; CD.saveUrl = ''; });
  await tabClick(page, '#nav button[data-go="round"]');
  await panelIsOn(page);
  await page.locator('#sinkoff').click();
  await expect(page.locator('#sinkcard')).toContainText('Saving on this device: off');
  await expect(page.locator('#sinkcard [data-device-line]')).toHaveText('On this device: opened in the browser · no code remembered · saving is not set up yet');
  await expect(page.locator('#sinkcode')).toHaveValue('');
  expect(await page.evaluate(() => ['cdhub.staff.code', 'cdhub.save.url', 'cdhub.sink.code', 'cdhub.sink.url'].map((k) => localStorage.getItem(k)))).toEqual([null, null, null, null]);
  expect(await page.evaluate(() => staffCodeNow())).toBe('');
  expect(sent).toHaveLength(1);
});

// Persistent profile: set it, close the whole browser, open it again on the same profile. Nothing typed the second time.
test('closing and reopening the browser keeps saving on: the panel says on and a save asks for no code @regression', async ({ browserName }, testInfo) => {
  test.setTimeout(120_000);   // two persistent browsers; 30s is the whole test and the first launch can use it up
  test.skip(browserName !== 'chromium', 'persistent profile check runs in Chromium');
  const { chromium } = require('@playwright/test');
  const gisStub = require('../support/gis-stub');
  const { buildWorld } = require('../support/test');
  const dir = testInfo.outputPath('profile');
  const sent = [];

  async function launch(withDriveAddress) {
    const ctx = await chromium.launchPersistentContext(dir, { baseURL: testInfo.project.use.baseURL, serviceWorkers: 'block', locale: 'en-GB', timezoneId: 'Europe/London' });
    const world = buildWorld();
    rooms(world);
    if (withDriveAddress) setFile(world, 'BLD-save-webapp.json', JSON.stringify({ url: SINK }));
    await ctx.addInitScript(() => { window.__GIS_MODE = 'ok'; window.__MONEY_TODAY = '2026-03-10'; });
    await ctx.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: gisStub }));
    await world.install(ctx);
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost).*/, (r) => {
      if (/^https:\/\/(accounts\.google\.com\/gsi\/client|www\.googleapis\.com\/drive\/v3\/)/.test(r.request().url())) return r.fallback();
      return r.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    });
    await ctx.route(SINK, async (r) => {
      const body = JSON.parse(r.request().postData() || '{}');
      if (body.code) sent.push(body);   // the Google-only first try (refused in answer) is not a save
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body)) });
    });
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto('cdhub/');
    await page.waitForFunction(() => document.getElementById('signinbtn') || document.querySelector('#nav button[data-go="round"]'));
    const signIn = page.locator('#signinbtn');
    if (await signIn.count()) { await expect(signIn).toBeEnabled(); await signIn.click(); }
    return { ctx, page };
  }

  // First open: the address comes from Drive, the code is typed once and accepted.
  let { ctx, page } = await launch(true);
  await tabClick(page, '#nav button[data-go="round"]');
  await page.locator('.racc').first().selectOption('limited');
  await enterCode(page, CODE);
  await expect(page.locator('.rsave').first()).toHaveText(/^Saved \d\d:\d\d$/);
  await ctx.close();

  // Reopen: no Drive address this time, so only what this device kept can turn saving on.
  ({ ctx, page } = await launch(false));
  await tabClick(page, '#nav button[data-go="round"]');
  await panelIsOn(page);
  await page.locator('.racc').first().selectOption('limited');
  await expect(page.locator('.rsave').first()).toHaveText(/^Saved \d\d:\d\d$/);
  await expect(page.getByRole('dialog', { name: 'Staff code' })).toHaveCount(0);
  expect(sent.map((b) => b.code)).toEqual([CODE, CODE]);
  await ctx.close();
});

// Storage tidy, stage 2: new keys are written, every old key is still read,
// and nothing old is deleted yet. A phone set up last week (old keys only) must carry on exactly as before.
const OLD_SETUPS = {
  'the staff page (bld.device.code, bld.scriptUrl)': { 'bld.device.code': CODE, 'bld.scriptUrl': SINK },
  'the old round card (cdhub.sink.code, cdhub.sink.url)': { 'cdhub.sink.code': CODE, 'cdhub.sink.url': SINK }
};

async function openWithKeys(page, guard, keys) {
  rooms(guard.world);   // no BLD-save-webapp.json and no address in the config: only what the phone kept can turn saving on
  const sent = [];
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.code) sent.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body)) });
  });
  await page.goto('cdhub/');
  await page.evaluate((kv) => { localStorage.clear(); sessionStorage.clear(); Object.keys(kv).forEach((k) => localStorage.setItem(k, kv[k])); }, keys);
  await page.reload();
  if (await page.locator('#signinbtn').isVisible()) await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="round"]');
  return sent;
}

for (const [from, keys] of Object.entries(OLD_SETUPS)) {
  test(`a phone set up last week with only the old keys from ${from} still says on and saves with no code prompt`, async ({ page, guard }) => {
    const sent = await openWithKeys(page, guard, keys);
    await panelIsOn(page);
    await page.locator('.racc').first().selectOption('limited');
    await expect(page.locator('.rsave').first()).toHaveText(/^Saved \d\d:\d\d$/);
    await expect(page.getByRole('dialog', { name: 'Staff code' })).toHaveCount(0);
    expect(sent.map((b) => b.code)).toEqual([CODE]);
    // the old keys are still there (removed only in the last stage)
    const kept = await page.evaluate((ks) => ks.map((k) => localStorage.getItem(k)), Object.keys(keys));
    expect(kept).toEqual(Object.values(keys));
  });
}

test('an old "Switch off here" (cdhub.sink.off) is still honoured: saving stays off and the staff page copy is not reused', async ({ page, guard }) => {
  const sent = await openWithKeys(page, guard, { 'bld.device.code': CODE, 'bld.scriptUrl': SINK, 'cdhub.sink.off': '1' });
  await expect(page.locator('#sinkcard')).toContainText('Saving on this device: off');
  await expect(page.locator('#sinkcard [data-device-line]')).toHaveText('On this device: opened in the browser · no code remembered · saving is set up');
  await expect(page.locator('#sinkcode')).toHaveValue('');
  expect(await page.evaluate(() => staffCodeNow())).toBe('');
  expect(sent).toHaveLength(0);
});

test('Switch off here writes only the new key cdhub.save.off; Use these clears it and the old one', async ({ page, guard }) => {
  await openWithKeys(page, guard, { 'cdhub.sink.code': CODE, 'cdhub.sink.url': SINK });
  await panelIsOn(page);
  await page.locator('#sinkoff').click();
  await expect(page.locator('#sinkcard')).toContainText('Saving on this device: off');
  expect(await page.evaluate(() => [localStorage.getItem('cdhub.save.off'), localStorage.getItem('cdhub.sink.off')])).toEqual(['1', null]);

  // An old phone may hold both flags. Turning saving back on must clear both, or the old one keeps the phone off.
  await page.evaluate(() => localStorage.setItem('cdhub.sink.off', '1'));
  await page.locator('#sinkurl').fill(SINK);
  await page.locator('#sinkcode').fill(CODE);
  await page.locator('#sinkon').click();
  await expect(page.locator('#sinkcard')).toContainText('Saving on this device: on');
  expect(await page.evaluate(() => [localStorage.getItem('cdhub.save.off'), localStorage.getItem('cdhub.sink.off')])).toEqual([null, null]);
  expect(await page.locator('#sinkcard').evaluate((e) => e.outerHTML)).not.toContain(CODE);
});

test('BLD-save-webapp.json with optional set_at and set_by still gives the save address; nothing depends on them', async ({ page, guard }) => {
  rooms(guard.world);
  setFile(guard.world, 'BLD-save-webapp.json', JSON.stringify({ url: SINK, set_at: '2026-11-15', set_by: 'owner' }));
  const sent = [];
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.code) sent.push(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body)) });
  });
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="round"]');
  await page.locator('.racc').first().selectOption('limited');
  await enterCode(page, CODE);
  await expect(page.locator('.rsave').first()).toHaveText(/^Saved \d\d:\d\d$/);
  expect(sent.map((b) => b.code)).toEqual([CODE]);
  expect(await page.evaluate(() => localStorage.getItem('cdhub.save.url'))).toBe(SINK);
});

test.describe('one copy for both pages', () => {
  test.use({ allowedConsole: [/404/] });   // the staff page's optional module files may answer 404, as in its own specs
  test('a phone set up on the staff page saves in CD Hub with no code prompt, and the hub reads the shared copy', async ({ page, guard }) => {
    rooms(guard.world);
    const sent = [];
    const CORS = { 'access-control-allow-origin': '*' };
    await page.route(SINK, async (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.action === 'read') {   // the staff page's reads; only saves are counted
        return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: [], tables: { area: [], subject: [], occupancy: [], subject_status: [], requirement: [] } } } });
      }
      if (body.code) sent.push(body);
      return route.fulfill({ headers: CORS, json: answer(body) });
    });
    await page.goto('cdhub/staff/#join=' + encodeURIComponent(CODE) + '&url=' + SINK);
    await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
    expect(await page.evaluate(() => ['cdhub.staff.code', 'cdhub.save.url', 'bld.device.code', 'bld.scriptUrl'].map((k) => localStorage.getItem(k))))
      .toEqual([CODE, SINK, CODE, SINK]);

    // Take the staff page's own copy away: CD Hub must still be on from the shared copy alone.
    await page.evaluate(() => { localStorage.removeItem('bld.device.code'); localStorage.removeItem('bld.scriptUrl'); });
    await page.goto('cdhub/');
    if (await page.locator('#signinbtn').isVisible()) await page.locator('#signinbtn').click();
    await tabClick(page, '#nav button[data-go="round"]');
    await panelIsOn(page);
    await page.locator('.racc').first().selectOption('limited');
    await expect(page.locator('.rsave').first()).toHaveText(/^Saved \d\d:\d\d$/);
    await expect(page.getByRole('dialog', { name: 'Staff code' })).toHaveCount(0);
    expect(sent.map((b) => b.code)).toEqual([CODE]);
  });
});
