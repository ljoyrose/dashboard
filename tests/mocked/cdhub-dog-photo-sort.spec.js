// Sort photos (Lisa 25 Nov 2026): one photo at a time. Remove ends the gallery link and keeps the file.
// The card is not redrawn between photos; saves wait in the outbox. Invented rows only.
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

async function setUp(page, guard, today) {
  await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
  const sent = [];
  let wait = null;
  await page.route(/^https:\/\/script\.google\.com\/macros\//, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    sent.push(b);
    if (wait) await wait;
    const id = b.action === 'file_add' ? 'fil-new' : 'lnk-new-' + sent.length;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id, drive_file_id: b.action === 'file_add' ? 'DRIVEeditedNew9' : undefined } }) });
  });
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
    'sub-g1,t,Pretend Gallery,Female,2021-03-02,Breeding,entire,']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-g1,Active']));
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
  for (const id of ['DRIVEmainPhoto01', 'DRIVEbadPhoto002', 'DRIVEnewPhoto003', 'DRIVEeditedNew9']) {
    w.file(id, id + '.png', '', { mimeType: 'image/png' }); w.byId(id).thumbnailLink = 'https://example.com/pretend-' + id + '.png';
  }
  await page.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/DRIVE[A-Za-z0-9]+\?alt=media/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG, 'base64') }));
  await page.route(/^https:\/\/example\.com\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(PNG, 'base64') }));
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs'));
  const gal = page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"]');
  await gal.locator('> summary').click();
  return { sent, gal, hold() { let goHold; wait = new Promise((r) => { goHold = r; }); return () => { wait = null; goHold(); }; } };
}

test('Sort photos: one at a time, small corner buttons, and the card is not reloaded between photos @regression', async ({ page, guard }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const { sent, gal, hold } = await setUp(page, guard, today);
  const mark = gal.locator('.gi[data-file="fil-2"] .gx');
  const box = await mark.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(22);
  expect(box.width).toBeLessThanOrEqual(26);
  expect(box.height).toBeLessThanOrEqual(26);
  expect(Number(await mark.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1);

  await gal.locator('[data-photo-sort]').click();
  const sort = page.locator('[data-k="photo-sort"]');
  await expect(sort).toBeVisible();
  await expect(sort.locator('[data-k="sort-count"]')).toHaveText('1 of 3');
  await expect(sort).toHaveAttribute('data-file', 'fil-3');
  await expect(gal.locator('> summary')).toHaveText('Photos (3)');

  await page.keyboard.press('ArrowRight');
  await expect(sort.locator('[data-k="sort-count"]')).toHaveText('2 of 3');
  await expect(sort).toHaveAttribute('data-file', 'fil-1');
  expect(sent).toHaveLength(0);
  await page.keyboard.press('ArrowLeft');
  await expect(sort).toHaveAttribute('data-file', 'fil-3');

  const release = hold();
  await sort.locator('[data-sort="remove"]').click();
  await expect(sort).toHaveAttribute('data-file', 'fil-1');
  await expect(sort.locator('[data-k="sort-count"]')).toHaveText('1 of 2');
  await expect(sort.locator('[data-k="sort-saving"]')).toHaveText('1 saving');
  await expect(gal.locator('> summary')).toHaveText('Photos (3)');
  expect(sent[0]).toMatchObject({ action: 'link_end', fields: { id: 'l3', reason: 'Removed from gallery' } });
  expect(sent.some((b) => b.action === 'file_add' || (b.fields && b.fields.remove === 'yes'))).toBe(false);

  await sort.locator('[data-sort="undo"]').click();
  await expect(sort).toHaveAttribute('data-file', 'fil-3');
  await expect(sort.locator('[data-k="sort-count"]')).toHaveText('1 of 3');
  await expect(sort.locator('[data-k="sort-saving"]')).toHaveText('2 saving');
  release();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toMatchObject({ action: 'link_add', fields: { role: 'gallery', to_id: 'fil-3', from_id: 'sub-g1' } });

  await sort.locator('[data-sort="main"]').click();
  await expect(page.locator('.dc[data-dog="sub-g1"] img.dogphoto')).toHaveAttribute('data-photo-id', 'DRIVEmainPhoto01');
  await expect.poll(() => sent.some((b) => b.action === 'link_add' && b.fields && b.fields.role === 'main')).toBe(true);

  await sort.locator('[data-sort="edit"]').click();
  const crop = page.getByRole('dialog', { name: 'Crop and edit the photo' });
  await expect(crop).toBeVisible();
  await expect(crop.locator('[data-crop-remove]')).toHaveText('Remove');
  await expect(crop.locator('[data-crop-prev]')).toBeDisabled();
  await expect(crop.locator('[data-crop-next]')).toBeEnabled();
  const before = sent.length;
  await crop.locator('[data-crop-next]').click();
  await expect(sort).toHaveAttribute('data-file', 'fil-1');
  expect(sent).toHaveLength(before);
  const releaseEdit = hold();
  await crop.locator('[data-crop-use]').click();
  await expect(crop).toHaveCount(0);
  await expect(sort).toHaveAttribute('data-file', 'fil-2');
  await expect(sort.locator('[data-k="sort-count"]')).toHaveText('3 of 3');
  await expect(gal.locator('> summary')).toHaveText('Photos (3)');
  await expect(sort.locator('[data-k="sort-saving"]')).toHaveText('1 saving');
  releaseEdit();
  await expect.poll(() => sent.some((b) => b.action === 'file_add')).toBe(true);
  const edit = sent.filter((b) => b.action === 'file_add').pop();
  expect(edit.fields.taken_on).toBe('2026-06-01');
  expect(edit.fields.data_base64.length).toBeGreaterThan(20);
});
