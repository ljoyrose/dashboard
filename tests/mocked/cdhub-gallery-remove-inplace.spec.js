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
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAACYABTxrpVkAAAAASUVORK5CYII=';

function files(rows) {
  return csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', rows);
}
function links(rows) {
  return csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on,end_reason', rows);
}

async function setUp(page, guard, { fileRows, linkRows, reply, subjects } = {}) {
  await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
  const sent = [];
  await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
    const id = b.action === 'file_add' ? 'fil-new' : 'lnk-new-' + sent.length;
    const body = reply ? (typeof reply === 'function' ? reply(b) : reply) : { ok: true, result: { status: 'saved', id, drive_file_id: b.action === 'file_add' ? 'DRIVEeditedNew9' : undefined } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/DRIVE[A-Za-z0-9]+\?alt=media/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG, 'base64') }));
  const w = guard.world;
  const subs = subjects || ['sub-a,t,A,Female,2021-03-02,Breeding,entire,'];
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', subs));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', subs.map((s, i) => 's' + i + ',t,' + s.split(',')[0] + ',Active')));
  put(w, 'BLD-files.csv', files(fileRows));
  put(w, 'BLD-links.csv', links(linkRows));
  put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
    'k1,t,link_kind.gallery,Photos,2026-01-01,Sample,,,,', 'k2,t,link_kind.main,Main photo,2026-01-01,Sample,,,,']));
  const drives = fileRows.map((r) => r.split(',')[3]).filter((id) => id && id.indexOf('DRIVE') === 0);
  drives.push('DRIVEeditedNew9');
  for (const id of drives) { w.file(id, id + '.png', '', { mimeType: 'image/png' }); w.byId(id).thumbnailLink = 'https://example.com/pretend-' + id + '.png'; }
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs'));
  return sent;
}

function pair() {
  return {
    fileRows: [
      'fil-1,t,photo,DRIVEmain0001,,image/jpeg,,,2026-06-02,,camera,owner,2026-06-02T10:00:00Z',
      'fil-2,t,photo,DRIVEnext0002,,image/jpeg,,,2026-01-01,,camera,owner,2026-01-01T10:00:00Z',
      'fil-z,t,photo,DRIVEgone0009,,image/jpeg,,,2024-01-01,,camera,owner,2024-01-01T10:00:00Z',
      'fil-e,t,photo,,,,image/jpeg,,,2024-02-01,,camera,owner,2024-02-01T10:00:00Z'
    ],
    linkRows: [
      'l1,t,subjects,sub-a,files,fil-1,gallery,,,2026-06-02,,dog card,owner,2026-06-02T10:00:00Z,',
      'l2,t,subjects,sub-a,files,fil-2,gallery,,,2026-01-01,,dog card,owner,2026-01-01T10:00:00Z,',
      'lz,t,subjects,sub-a,files,fil-z,gallery,,,2024-01-01,2026-01-01,dog card,owner,2024-01-01T10:00:00Z,Removed from gallery',
      'le,t,subjects,sub-a,files,fil-e,gallery,,,2024-02-01,,dog card,owner,2024-02-01T10:00:00Z,',
      'm1,t,subjects,sub-a,files,fil-1,main,,,2026-06-02,,dog card,owner,2026-06-02T11:00:00Z,',
      'mz,t,subjects,sub-a,files,fil-z,main,,,2024-01-01,2026-01-01,dog card,owner,2024-01-01T11:00:00Z,Removed from gallery'
    ]
  };
}

const gal = (page) => page.locator('.dc[data-dog="sub-a"] details[data-k="gallery"]');

test('remove one photo in place, keep the card, and hide a removed photo', async ({ page, guard }) => {
  const sent = await setUp(page, guard, pair());
  const g = gal(page);
  await g.locator('> summary').click();
  await expect(g.locator('> summary')).toHaveText('Photos (2)');
  await expect(g.locator('.gi[data-file="fil-z"]')).toHaveCount(0);
  await expect(g.locator('.gi[data-file="fil-e"]')).toHaveCount(0);
  await expect(g.locator('[data-gal-main]')).toHaveCount(1);
  await expect(page.locator('.dc[data-dog="sub-a"]')).not.toContainText(/\bEnded\b/);
  const card = page.locator('.dc[data-dog="sub-a"]');
  await card.evaluate((el) => { el.dataset.stay = '1'; });
  const x = g.locator('.gi[data-file="fil-2"] .gx');
  await expect(x).toHaveAttribute('type', 'button');
  expect(await x.evaluate((el) => !!el.closest('form'))).toBe(false);
  await x.click();
  await expect(g.locator('.gi[data-file="fil-2"]')).toHaveCount(0);
  await expect(g.locator('[data-gal-msg]')).toHaveText('✓ Saved');
  await expect(g.locator('> summary')).toHaveText('Photos (1)');
  await expect(card).toHaveAttribute('data-stay', '1');
  expect(sent.filter((b) => b.action === 'link_end')).toHaveLength(1);
  expect(sent[0]).toMatchObject({ action: 'link_end', fields: { id: 'l2', reason: 'Removed from gallery' } });
  expect(sent.some((b) => b.action === 'file_add')).toBe(false);
});

test('remove five photos in a row without a reload', async ({ page, guard }) => {
  const fileRows = [];
  const linkRows = [];
  for (let i = 1; i <= 5; i++) {
    fileRows.push('fil-' + i + ',t,photo,DRIVE000000' + i + ',,image/jpeg,,,2026-0' + i + '-01,,camera,owner,2026-0' + i + '-01T10:00:00Z');
    linkRows.push('l' + i + ',t,subjects,sub-a,files,fil-' + i + ',gallery,,,2026-0' + i + '-01,,dog card,owner,2026-0' + i + '-01T10:00:00Z,');
  }
  const sent = await setUp(page, guard, { fileRows, linkRows });
  const g = gal(page);
  await g.locator('> summary').click();
  const card = page.locator('.dc[data-dog="sub-a"]');
  await card.evaluate((el) => { el.dataset.stay = '1'; });
  for (let i = 0; i < 5; i++) await g.locator('[data-gal-end]').first().click();
  await expect(g).toHaveCount(0);
  await expect.poll(() => sent.length).toBe(5);
  expect(sent.map((b) => b.action)).toEqual(['link_end', 'link_end', 'link_end', 'link_end', 'link_end']);
  await expect(card).toHaveAttribute('data-stay', '1');
  await expect(card.locator('.gi')).toHaveCount(0);
});

test('remove the main photo and the next photo becomes main', async ({ page, guard }) => {
  const sent = await setUp(page, guard, pair());
  const g = gal(page);
  await g.locator('> summary').click();
  const card = page.locator('.dc[data-dog="sub-a"]');
  await card.evaluate((el) => { el.dataset.stay = '1'; });
  await g.locator('.gi[data-file="fil-1"] .gx').click();
  await expect(g.locator('.gi[data-file="fil-1"]')).toHaveCount(0);
  await expect(card.locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'DRIVEnext0002');
  await expect(g.locator('.gi[data-file="fil-2"] [data-k="main"]')).toHaveText('Main');
  await expect(g.locator('.gi[data-file="fil-2"] [data-gal-main]')).toHaveCount(0);
  await expect.poll(() => sent.map((b) => b.action).join(',')).toBe('link_end,link_add');
  expect(sent[0]).toMatchObject({ action: 'link_end', fields: { id: 'l1', reason: 'Removed from gallery' } });
  expect(sent[1]).toMatchObject({ action: 'link_add', fields: { role: 'main', to_id: 'fil-2', from_id: 'sub-a' } });
  await expect(card).toHaveAttribute('data-stay', '1');
});

test('remove the only photo and the card shows none', async ({ page, guard }) => {
  const sent = await setUp(page, guard, {
    fileRows: ['fil-1,t,photo,DRIVEonly0001,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z'],
    linkRows: [
      'l1,t,subjects,sub-a,files,fil-1,gallery,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z,',
      'm1,t,subjects,sub-a,files,fil-1,main,,,2026-06-01,,dog card,owner,2026-06-01T11:00:00Z,'
    ]
  });
  const g = gal(page);
  await g.locator('> summary').click();
  await g.locator('.gx').click();
  await expect(g).toHaveCount(0);
  await expect(page.locator('.dc[data-dog="sub-a"] img.dogphoto')).toHaveCount(0);
  await expect.poll(() => sent.map((b) => b.action).join(',')).toBe('link_end,link_end');
  expect(sent[0].fields.id).toBe('l1');
  expect(sent[1].fields.id).toBe('m1');
  expect(sent.every((b) => b.action === 'link_end' && b.fields.reason === 'Removed from gallery')).toBe(true);
});

test('a refused remove puts the photo back and shows a short error', async ({ page, guard }) => {
  const sent = await setUp(page, guard, Object.assign(pair(), { reply: { ok: false, code: 'NOT_ALLOWED', message: 'Sample failure' } }));
  const g = gal(page);
  await g.locator('> summary').click();
  const card = page.locator('.dc[data-dog="sub-a"]');
  await card.evaluate((el) => { el.dataset.stay = '1'; });
  await g.locator('.gi[data-file="fil-2"] .gx').click();
  await expect(g.locator('[data-gal-msg]')).toHaveText('Not saved: Sample failure');
  await expect(g.locator('.gi[data-file="fil-2"]')).toHaveCount(1);
  await expect(g.locator('> summary')).toHaveText('Photos (2)');
  await expect(card).toHaveAttribute('data-stay', '1');
  expect(await page.evaluate(() => localStorage.getItem('cdhub.link.ends'))).toBeNull();
  expect(sent).toHaveLength(1);
});

test('removing a photo keeps the scroll position', async ({ page, guard }) => {
  const sent = await setUp(page, guard, pair());
  const g = gal(page);
  await g.locator('> summary').click();
  await page.evaluate(() => { document.body.style.minHeight = '4000px'; window.scrollTo(0, 640); });
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(400);
  await page.evaluate(() => document.querySelector('.gi[data-file="fil-2"] .gx').click());
  await expect(g.locator('.gi[data-file="fil-2"]')).toHaveCount(0);
  const y2 = await page.evaluate(() => window.scrollY);
  expect(Math.abs(y2 - y)).toBeLessThan(40);
  expect(sent[0].action).toBe('link_end');
});

test('make main still sets the card photo', async ({ page, guard }) => {
  const sent = await setUp(page, guard, pair());
  const g = gal(page);
  await g.locator('> summary').click();
  await g.locator('.gi[data-file="fil-2"] [data-gal-main]').click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'link_add', fields: { role: 'main', to_id: 'fil-2', from_id: 'sub-a' } });
  await expect(page.locator('.dc[data-dog="sub-a"] img.dogphoto')).toHaveAttribute('data-photo-id', 'DRIVEnext0002');
  await expect(g.locator('.gi[data-file="fil-2"] [data-k="main"]')).toHaveText('Main');
});

test('crop close does nothing and remove asks before it drops the photo', async ({ page, guard }) => {
  const sent = await setUp(page, guard, pair());
  const g = gal(page);
  await g.locator('> summary').click();
  const card = page.locator('.dc[data-dog="sub-a"]');
  await card.evaluate((el) => { el.dataset.stay = '1'; });
  await g.locator('.gi[data-file="fil-2"] .ged').click();
  const dlg = page.getByRole('dialog', { name: 'Crop and edit the photo' });
  const close = dlg.getByRole('button', { name: 'Close' });
  await expect(close).toHaveAttribute('type', 'button');
  expect(await close.evaluate((el) => !!el.closest('form'))).toBe(false);
  const box = await dlg.locator('.pcrop-in').boundingBox();
  const xb = await close.boundingBox();
  expect(xb.x).toBeGreaterThan(box.x + box.width - 64);
  expect(xb.y).toBeLessThan(box.y + 56);
  await close.click();
  await expect(dlg).toHaveCount(0);
  expect(sent).toHaveLength(0);
  await expect(g.locator('.gi[data-file="fil-2"]')).toHaveCount(1);

  await g.locator('.gi[data-file="fil-2"] .ged').click();
  const rem = dlg.getByRole('button', { name: 'Remove', exact: true });
  await expect(rem).toHaveAttribute('type', 'button');
  await expect(rem).toHaveClass(/danger/);
  await expect(dlg.locator('[data-crop-ask]')).toBeHidden();
  await rem.click();
  await expect(dlg.locator('[data-crop-ask]')).toHaveText('Remove this photo?');
  expect(sent).toHaveLength(0);
  await expect(g.locator('.gi[data-file="fil-2"]')).toHaveCount(1);
  await rem.click();
  await expect(dlg).toHaveCount(0);
  await expect(g.locator('.gi[data-file="fil-2"]')).toHaveCount(0);
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'link_end', fields: { id: 'l2', reason: 'Removed from gallery' } });
  await expect(card).toHaveAttribute('data-stay', '1');
});

test('crop save still stores an edited copy', async ({ page, guard }) => {
  const sent = await setUp(page, guard, pair());
  const g = gal(page);
  await g.locator('> summary').click();
  await g.locator('.gi[data-file="fil-2"] .ged').click();
  const dlg = page.getByRole('dialog', { name: 'Crop and edit the photo' });
  await dlg.locator('[data-crop-use]').click();
  await expect.poll(() => sent.length).toBe(3);
  expect(sent.map((b) => b.action)).toEqual(['file_add', 'link_add', 'link_end']);
  await expect(g.locator('[data-gal-msg]')).toHaveText('✓ Edited copy saved');
  await expect(g.locator('.gi[data-file="fil-new"]')).toHaveCount(1);
  await expect(g.locator('.gi[data-file="fil-2"]')).toHaveCount(0);
});
