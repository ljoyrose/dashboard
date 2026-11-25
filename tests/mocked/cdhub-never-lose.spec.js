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

test('a validation failure with no code is not retried; one job is one notice, with Clear all and Show what is wrong @regression', async ({ page }) => {
  let calls = 0;
  await page.route(SINK, async (route) => {
    calls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Some details need fixing', fields: { happened_at: 'That is more than 7 days ago.' } }) });
  });
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await page.evaluate((url) => { window.sinkGate = async () => ({ ok: true, url, code: 'river-staff-441' }); }, SINK);
  await page.evaluate(() => Promise.all([
    sinkSend({ table: 'check_log', action: 'add_site', fields: { check_type_id: 'exercise_all-1', outcome: 'ok' } }),
    sinkSend({ table: 'check_log', action: 'add_site', fields: { check_type_id: 'exercise_all-1', outcome: 'ok' } })
  ]));
  const bar = page.locator('#hub-outbox');
  await expect(bar.locator('[data-outbox-refused]')).toHaveCount(1);
  await expect(bar.locator('[data-outbox-refused]')).toContainText('exercise_all-1');
  await expect(bar.locator('[data-outbox-refused]')).toContainText('2 times');
  await expect(bar.locator('[data-outbox-refused]')).toContainText('happened at');
  await expect(bar.locator('[data-outbox-refused]')).not.toContainText('Enter it again');
  await expect(bar.getByRole('button', { name: 'Clear all' })).toBeVisible();
  await expect(bar.getByRole('button', { name: /Show what.s wrong/ })).toBeVisible();
  await bar.getByRole('button', { name: /Show what.s wrong/ }).click();
  await expect(bar.locator('[data-outbox-detail]')).toContainText('more than 7 days ago');
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox'))).toBeNull();
  const seen = calls;
  await page.waitForTimeout(1500);
  expect(calls).toBe(seen);
  await bar.getByRole('button', { name: 'Clear all' }).click();
  await expect(bar).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox.refused'))).toBeNull();
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

// ITEMS2 / OV12 22 Nov 2026: saves typed faster than they send go as one list save. A script with no list save yet
// answers "Unknown action": nothing is refused or lost, the same entries go one by one. Form answers go with their item.
async function listPage(page, oldScript) {
  const sent = [];
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    sent.push(body);
    let out;
    if (body.action === 'add_many') {
      out = oldScript ? { ok: false, code: 'BAD_REQUEST', message: 'Unknown action.' }
        : { ok: true, result: { status: 'many', items: body.items.map((it, i) => ({ request_id: it.request_id, ok: true, result: { status: 'saved', id: 'clg-' + i } })) } };
    } else out = { ok: true, result: { status: 'saved', id: 'clg-one' } };
    await new Promise((r) => setTimeout(r, 150));   // a slow script, so the later saves wait in line together
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.goto('cdhub/');
  await page.evaluate((url) => { window.sinkGate = async () => ({ ok: true, url, code: 'river-staff-441' }); }, SINK);
  const answers = await page.evaluate(() => Promise.all([
    sinkSend({ table: 'check_log', action: 'add', fields: { check_type_id: 'cty-a', outcome: 'ok' } }),
    sinkSend({ table: 'check_log', action: 'add', fields: { check_type_id: 'cty-b', outcome: 'ok' }, values: { weight: '12.5' } }),
    sinkSend({ table: 'check_log', action: 'add', fields: { check_type_id: 'cty-c', outcome: 'ok' } })
  ]));
  return { sent, answers };
}

test('a script with no list save yet: the list is answered "Unknown action", nothing is refused or lost, each goes one by one', async ({ page }) => {
  const { sent, answers } = await listPage(page, true);
  expect(answers.map((a) => a.ok)).toEqual([true, true, true]);
  expect(sent.filter((b) => b.action === 'add_many')).toHaveLength(1);
  const adds = sent.filter((b) => b.action === 'add').map((b) => b.fields.check_type_id).sort();
  expect(adds).toEqual(['cty-a', 'cty-b', 'cty-c']);
  expect(sent.find((b) => b.action === 'add' && b.fields.check_type_id === 'cty-b').values).toEqual({ weight: '12.5' });
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox.refused'))).toBeNull();
  await expect(page.locator('#hub-outbox')).toBeHidden();
});

test('Send now sends the kept round taps as one list, not one at a time @regression', async ({ page }) => {
  const sent = [];
  const urls = [];
  page.on('request', (r) => { if (r.method() === 'POST') urls.push(r.url()); });
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    sent.push(body);
    const out = body.action === 'add_many'
      ? { ok: true, result: { status: 'many', items: (body.items || []).map((it) => ({ request_id: it.request_id, ok: true, result: { status: 'saved', id: 'clg-x' } })) } }
      : { ok: true, result: { status: 'saved', id: 'clg-one' } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await page.evaluate((url) => {
    window.sinkGate = async () => ({ ok: true, url, code: 'river-staff-441' });
    const items = ['a', 'b', 'c'].map((k) => ({
      id: 'cd-kept-' + k + '00001',
      at: new Date().toISOString(),
      body: { v: 1, request_id: 'cd-kept-' + k + '00001', table: 'check_log', action: 'add', fields: { check_type_id: 'cty-' + k, subject_id: 'sub-' + k, outcome: 'recorded' } }
    }));
    localStorage.setItem('cdhub.outbox', JSON.stringify(items));
    hubStopSending();
    hubBoxDraw();
  }, SINK);
  const bar = page.locator('#hub-outbox');
  await expect(bar.locator('[data-outbox-waiting="3"]')).toContainText('not sent yet');
  await bar.locator('[data-outbox-send]').click();
  await expect(bar).toBeHidden();
  expect(sent.map((b) => b.action), urls.join('\n')).toEqual(['add_many']);
  expect(sent[0].items.map((it) => it.fields.check_type_id).sort()).toEqual(['cty-a', 'cty-b', 'cty-c']);
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox'))).toBeNull();
});

test('a list save keeps each item\'s form answers', async ({ page }) => {
  const { sent, answers } = await listPage(page, false);
  expect(answers.map((a) => a.ok)).toEqual([true, true, true]);
  const many = sent.find((b) => b.action === 'add_many');
  expect(many).toBeTruthy();
  const b = many.items.find((it) => it.fields.check_type_id === 'cty-b');
  expect(b.values).toEqual({ weight: '12.5' });
  expect(many.items.filter((it) => it.values)).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox'))).toBeNull();
});

// SIGN IN AGAIN (Lisa 22 Nov 2026): the owner saves with her Google sign-in, which lasts about an hour. When it has
// ended, a save is kept on the phone (never lost, never "Not saved"), the line asks her to sign in again, and once she
// has, it goes by itself, saved once.
test('owner sign-in ends: the save is kept, the line says sign in again, and it is saved once after signing in again', async ({ page, guard }) => {
  rooms(guard.world);
  const saved = [];
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    let ans;
    if (body.google_token) { saved.push(body.request_id); ans = { ok: true, result: { status: 'saved', id: 'occ-new', who: 'Lisa', at: '2026-11-13T10:00:00+00:00' } }; }
    else ans = answer(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ans) });
  });
  await page.goto('cdhub/');
  await page.evaluate((url) => { DASH_CONFIG.cdhub.saveScriptUrl = url; }, SINK);
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  const card = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await expect(card).toBeVisible();
  // the hour is up: the sign-in has ended on this phone
  const hold = await page.evaluate(() => { const e = TOKEN_EXP; TOKEN_EXP = 0; return e; });
  await card.getByRole('button', { name: 'Place' }).click();
  await page.locator('[data-move-panel] [data-move-to="area-1"]').click();
  // no code to hand (Lisa signs in with Google): Cancel
  await page.getByRole('dialog', { name: 'Staff code' }).getByRole('button', { name: 'Cancel' }).click();
  const bar = page.locator('#hub-outbox');
  await expect(bar.locator('[data-outbox-waiting="1"][data-outbox-sign-in]')).toContainText('sign in again');
  await expect(bar.locator('[data-outbox-refused]')).toHaveCount(0);
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('cdhub.outbox') || '[]'));
  expect(kept).toHaveLength(1);
  expect(JSON.stringify(kept)).not.toContain('pretend-token');
  // waiting by itself never asks for a code
  await page.evaluate(() => hubFlush());
  await expect(page.getByRole('dialog', { name: 'Staff code' })).toHaveCount(0);
  expect(saved).toHaveLength(0);
  // signed in again: it goes by itself, once
  await page.evaluate((e) => { TOKEN_EXP = e; return hubFlush(); }, hold);
  await expect(bar).toBeHidden();
  expect(saved).toEqual([kept[0].id]);
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox'))).toBeNull();
});

// OV13 22 Nov 2026: saves took 19-60 s; the first try saved but its answer never came; the resend was answered
// DUPLICATE and the page said "Not saved". A DUPLICATE after a try with no answer means that try saved it.
test('first try saved but its answer was lost: the resend answered DUPLICATE shows as saved, never Not saved', async ({ page, guard, allowedConsole }) => {
  allowedConsole.push(/ERR_FAILED/, /Failed to load resource/);
  rooms(guard.world);
  let tries = 0;
  await page.route(SINK, async (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (!body.code) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(body)) });
    tries++;
    if (tries === 1) return route.abort('failed');   // the script saved it; the answer never reached the phone
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'DUPLICATE', message: 'This looks like the same entry as one already saved. If that one is wrong, tell the owner.' }) });
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
  await expect(bar.locator('[data-outbox-waiting="1"]')).toBeVisible();
  // watch what the page does with the answer: delivered as saved (a round reading would tick), not dropped unshown
  await page.evaluate(() => { window.__delivered = []; const real = hubDelivered; hubDelivered = function (it, j) { window.__delivered.push({ id: it.id, ok: !!(j && j.ok) }); return real(it, j); }; });
  await bar.locator('[data-outbox-send]').click();
  await expect(bar).toBeHidden();
  const kept = await page.evaluate(() => window.__delivered);
  expect(kept).toHaveLength(1);
  expect(kept[0].ok).toBe(true);
  await expect(page.locator('body')).not.toContainText('Not saved');
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('cdhub.outbox.refused'))).toBeNull();
  expect(tries).toBe(2);
});
