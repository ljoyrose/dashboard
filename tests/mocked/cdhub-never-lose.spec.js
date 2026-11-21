// Never lose an entry (OV12 20 Nov 2026): a save that gets no answer (the phone slept, the signal blinked) is kept on the
// phone and sent again with the SAME request id. Pretend script, invented dogs and rooms; the codes are made up.
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


test('a save with no answer is kept on the phone, says "Not sent yet", and Send now delivers it with the same request id', async ({ page, guard, allowedConsole }) => {
  allowedConsole.push(/ERR_FAILED/, /Failed to load resource/);
  rooms(guard.world);
  const sent = [];
  let reachable = false;
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.code) sent.push(body);
    if (body.code && !reachable) return route.abort('failed');   // the phone dropped it
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body)) });
  });
  await page.goto('cdhub/');
  await page.evaluate((url) => { DASH_CONFIG.cdhub.saveScriptUrl = url; }, SINK);
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  const dlg = page.getByRole('dialog', { name: 'Staff code' });
  await dlg.getByLabel('Your staff code').fill('river-staff-441');
  await dlg.getByRole('button', { name: 'Use this code' }).click();

  const bar = page.locator('#hub-outbox');
  await expect(bar.locator('[data-outbox-waiting="1"]')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('check your connection');
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('cdhub.outbox') || '[]'));
  expect(kept).toHaveLength(1);
  expect(JSON.stringify(kept)).not.toContain('river-staff-441');   // the code is never kept with an entry
  expect(kept[0].body).toMatchObject({ table: 'occupancy', action: 'add', fields: { subject_id: 'sub-test-pup-1', area_id: 'area-1' } });

  reachable = true;
  await bar.locator('[data-outbox-send]').click();
  await expect(bar).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox'))).toBeNull();
  const ids = sent.map((b) => b.request_id);
  expect(ids.length).toBeGreaterThanOrEqual(2);
  expect(new Set(ids).size).toBe(1);   // every try is the same entry: the script can never save it twice
  expect(sent[sent.length - 1].code).toBe('river-staff-441');
});

test('a refusal (a check failed) is not kept: it is listed as Not saved with the reason, and OK clears it', async ({ page, guard }) => {
  rooms(guard.world);
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const ans = body.code ? { ok: false, code: 'INVALID', message: 'Some details need fixing before this can be saved.', fields: { area_id: 'That room is full.' } } : answer(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ans) });
  });
  await page.goto('cdhub/');
  await page.evaluate((url) => { DASH_CONFIG.cdhub.saveScriptUrl = url; }, SINK);
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  const dlg = page.getByRole('dialog', { name: 'Staff code' });
  await dlg.getByLabel('Your staff code').fill('river-staff-441');
  await dlg.getByRole('button', { name: 'Use this code' }).click();
  const bar = page.locator('#hub-outbox');
  await expect(bar.locator('[data-outbox-refused]')).toContainText('Not saved');
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox'))).toBeNull();
  await bar.locator('[data-outbox-ok]').click();
  await expect(bar).toBeHidden();
});
