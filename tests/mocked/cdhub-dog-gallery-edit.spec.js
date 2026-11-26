// Dog gallery: Remove and Make main .
// Nothing is deleted: Remove ends the photo's gallery link. The card does not list ended photos .
// Make main adds a main link. Invented rows only; pretend save script.
const { test, expect } = require('../support/test');
const { HUBS } = require('../support/hubs');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
const URL_ = 'https://script.google.com/macros/s/AKfyTEST_only_123/exec';

async function setUp(page, guard, today) {
  await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
  const sent = [];
  await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
    const id = b.action === 'file_add' ? 'fil-new' : 'lnk-new-' + sent.length;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id, drive_file_id: b.action === 'file_add' ? 'DRIVEeditedNew9' : undefined } }) });
  });
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
    'sub-g1,t,Pretend Gallery,Female,2021-03-02,Breeding,entire,', 'sub-g2,t,Pretend Plain,Male,2022-01-01,Stud,entire,']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-g1,Active', 's2,t,sub-g2,Active']));
  put(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', [
    'fil-1,t,photo,DRIVEmainPhoto01,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z',
    'fil-2,t,photo,DRIVEbadPhoto002,,image/jpeg,,,2025-01-01,,camera,owner,2025-01-01T10:00:00Z',
    `fil-3,t,photo,DRIVEnewPhoto003,,image/jpeg,,,${today},,camera,owner,${today}T10:00:00Z`]));
  put(w, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on,end_reason', [
    'l1,t,subjects,sub-g1,files,fil-1,gallery,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z,',
    'l2,t,subjects,sub-g1,files,fil-2,gallery,,,2025-01-01,,dog card,owner,2025-01-01T10:00:00Z,',
    `l3,t,subjects,sub-g1,files,fil-3,gallery,,,${today},,dog card,owner,${today}T10:00:00Z,`,
    'm1,t,subjects,sub-g1,files,fil-1,main,,,2026-06-01,,dog card,owner,2026-06-01T11:00:00Z,']));
  put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
    'k1,t,link_kind.gallery,Photos,2026-01-01,Pretend,,,,', 'k2,t,link_kind.main,Main photo,2026-01-01,Pretend,,,,']));
  for (const id of ['DRIVEmainPhoto01', 'DRIVEbadPhoto002', 'DRIVEnewPhoto003', 'DRIVEeditedNew9']) { w.file(id, id + '.png', '', { mimeType: 'image/png' }); w.byId(id).thumbnailLink = 'https://example.com/pretend-' + id + '.png'; }
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs'));
  const gal = page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"]');
  await gal.locator('> summary').click();
  return { sent, gal };
}

test('Remove takes a bad photo out of the gallery at once; the card does not list it and nothing is deleted', async ({ page, guard }) => {
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())).catch(() => null) || new Date().toISOString().slice(0, 10);
  const { sent, gal } = await setUp(page, guard, today);
  await expect(gal.locator('> summary')).toHaveText('Photos (3)');
  await gal.locator('.gi[data-file="fil-2"] [data-gal-end]').click();
  await expect(gal.locator('[data-gal-msg]')).toHaveText('✓ Saved');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ action: 'link_end', fields: { id: 'l2', reason: 'Removed from gallery' } });
  expect(sent[0].fields.to_date < today).toBe(true);   // an older photo ends yesterday, so it is gone from today
  const g2 = page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"]');
  await expect(g2.locator('> summary')).toHaveText('Photos (2)');
  await expect(g2.locator('details[data-k="ended"]')).toHaveCount(0);
  await expect(g2.locator('.gi[data-file="fil-2"]')).toHaveCount(0);
});

test('a photo added today is removed at once too (end date today, marked removed)', async ({ page, guard }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const { sent, gal } = await setUp(page, guard, today);
  await gal.locator('.gi[data-file="fil-3"] [data-gal-end]').click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].fields).toMatchObject({ id: 'l3', to_date: today, reason: 'Removed from gallery' });
  await expect(page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"] > summary')).toHaveText('Photos (2)');
});

test('Make main sets another photo as the card photo; the main photo has no Make main button', async ({ page, guard }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const { sent, gal } = await setUp(page, guard, today);
  await expect(gal.locator('.gi[data-file="fil-1"] [data-gal-main]')).toHaveCount(0);
  await gal.locator('.gi[data-file="fil-2"] [data-gal-main]').click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'link_add', fields: { role: 'main', to_id: 'fil-2', from_id: 'sub-g1', from_date: today } });
  await expect(page.locator('.dc[data-dog="sub-g1"] img.dogphoto')).toHaveAttribute('data-photo-id', 'DRIVEbadPhoto002');
  await expect(page.locator('.dc[data-dog="sub-g1"] .gi[data-file="fil-2"] [data-k="main"]')).toHaveText('Main');
});

// ✎ Crop or adjust (Lisa 17 Nov 2026): the saved picture opens in the same crop tool; the edited picture is saved as a
// new file and takes the old one's place; the original is kept (its link ends, so it is in Ended).
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAACYABTxrpVkAAAAASUVORK5CYII=';
async function driveBytes(page) {
  await page.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/DRIVE[A-Za-z0-9]+\?alt=media/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG, 'base64') }));
}

test('gallery: × and ✎ sit on each photo; ✎ saves an edited copy in the old photo\'s place, the original kept', async ({ page, guard }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const { sent, gal } = await setUp(page, guard, today);
  await driveBytes(page);
  await expect(gal.locator('.gi[data-file="fil-2"] .gph .gx')).toHaveAttribute('aria-label', 'Remove this photo from the gallery');
  await expect(gal.locator('.gi[data-file="fil-2"] .gph .ged')).toBeVisible();
  await gal.locator('.gi[data-file="fil-2"] .ged').click();
  await expect(page.getByRole('dialog', { name: 'Crop and edit the photo' })).toBeVisible();
  await page.locator('[data-crop-rotate]').click();
  await page.locator('[data-crop-use]').click();
  await expect.poll(() => sent.length).toBe(3);
  expect(sent[0]).toMatchObject({ action: 'file_add', fields: { kind: 'photo', mime: 'image/jpeg', taken_on: '2025-01-01' } });
  expect(sent[0].fields.data_base64.length).toBeGreaterThan(50);
  // the copy joins the gallery before the old photo is ended, so a refused add never loses a photo (17 Nov 2026)
  expect(sent[1]).toMatchObject({ action: 'link_add', fields: { role: 'gallery', to_id: 'fil-new', from_id: 'sub-g1', from_date: today } });
  expect(sent[2]).toMatchObject({ action: 'link_end', fields: { id: 'l2', reason: 'Replaced by edited copy' } });
  const g2 = page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"]');
  await expect(g2.locator('[data-gal-msg]')).toHaveText('✓ Edited copy saved');
  await expect(g2.locator('> summary')).toHaveText('Photos (3)');
  await expect(g2.locator('.gi[data-file="fil-new"]')).toHaveCount(1);
  await expect(g2.locator('details[data-k="ended"]')).toHaveCount(0);
  await expect(g2.locator('.gi[data-file="fil-2"]')).toHaveCount(0);
});

test('card: the photo menu has no Edit; the one Edit is by the name', async ({ page, guard }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  await setUp(page, guard, today);
  const card = page.locator('.dc[data-dog="sub-g1"]');
  await expect(card.locator('[data-photo-edit]')).toHaveCount(0);
  await expect(card.locator('[data-dog-edit]')).toHaveCount(1);
  await card.locator('[data-photo-open]').click();
  await expect(card.locator('[data-photo-menu] label')).toHaveText(['Take', 'Upload']);
  expect(await card.locator('[data-photo-menu]').innerText()).not.toMatch(/Edit/);
});

test('a refused gallery add leaves the old photo in the gallery (17 Nov 2026: 5 photos were lost this way)', async ({ page, guard }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const { gal } = await setUp(page, guard, today);
  await driveBytes(page);
  const sent = [];
  await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
    if (b.action === 'link_add') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'INVALID', message: 'Choose a kind of link on the list.' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'fil-new', drive_file_id: 'DRIVEeditedNew9' } }) });
  });
  await gal.locator('.gi[data-file="fil-2"] .ged').click();
  await page.locator('[data-crop-use]').click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent.map((b) => b.action)).toEqual(['file_add', 'link_add']);   // no link_end: the old photo stays
  await expect(gal.locator('[data-gal-msg]')).toContainText('not shown yet');
  await expect(page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"] .gi[data-file="fil-2"]')).toHaveCount(1);
});
