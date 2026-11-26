// Dog gallery × must stick (Lisa 22 Nov 2026, phone, Records > Dogs, two dogs side by side: "Pressing cross on image
// doesn't remove it; closes Photos and then photo still there"). The page shows this phone's copy, then reads the live
// tables behind it; a read that lands after the save used to put the old link row back and redraw with Photos shut.
// Here the pretend Drive never learns of the save (the worst case), the save is slow, and a live read runs during it.
// Invented rows only; pretend save script; nothing real is written.
const { test, expect } = require('../support/test');
const { HUBS } = require('../support/hubs');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
const URL_ = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';

async function setUp(page, guard, { reply } = {}) {
  await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
  const sent = [];
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route(/^https:\/\/script\.google\.com\/macros\//, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
    await held;   // a slow save: the test lets it answer
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply || { ok: true, result: { status: 'saved', id: 'x' } }) });
  });
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
    'sub-g1,t,Pretend Gallery,Female,2021-03-02,Breeding,entire,', 'sub-g2,t,Pretend Second,Male,2022-01-01,Stud,entire,']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-g1,Active', 's2,t,sub-g2,Active']));
  put(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', [
    'fil-1,t,photo,DRIVEmainPhoto01,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z',
    'fil-2,t,photo,DRIVEbadPhoto002,,image/jpeg,,,2025-01-01,,camera,owner,2025-01-01T10:00:00Z',
    'fil-4,t,photo,DRIVEsecondDog04,,image/jpeg,,,2025-02-01,,camera,owner,2025-02-01T10:00:00Z']));
  put(w, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on,end_reason', [
    'l1,t,subjects,sub-g1,files,fil-1,gallery,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z,',
    'l2,t,subjects,sub-g1,files,fil-2,gallery,,,2025-01-01,,dog card,owner,2025-01-01T10:00:00Z,',
    'l4,t,subjects,sub-g2,files,fil-4,gallery,,,2025-02-01,,dog card,owner,2025-02-01T10:00:00Z,']));
  put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
    'k1,t,link_kind.gallery,Photos,2026-01-01,Pretend,,,,']));
  for (const id of ['DRIVEmainPhoto01', 'DRIVEbadPhoto002', 'DRIVEsecondDog04']) { w.file(id, id + '.png', '', { mimeType: 'image/png' }); w.byId(id).thumbnailLink = 'https://example.com/pretend-' + id + '.png'; }
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs'));
  const gal = (dog) => page.locator('.dc[data-dog="' + dog + '"] details[data-k="gallery"]');
  await gal('sub-g1').locator('> summary').click();   // two dogs' Photos open side by side
  await gal('sub-g2').locator('> summary').click();
  await expect(gal('sub-g1')).toHaveAttribute('open', '');
  await expect(gal('sub-g2')).toHaveAttribute('open', '');
  return { sent, release, gal };
}

test('× removes the photo at once even when a live read lands during a slow save; both Photos stay open; it survives a reload', async ({ page, guard }) => {
  const { sent, release, gal } = await setUp(page, guard);
  await gal('sub-g1').locator('.gi[data-file="fil-2"] [data-gal-end]').click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ action: 'link_end', fields: { id: 'l2', reason: 'Removed from gallery' } });
  // the live read behind the copy lands while the save is still out (it has the old row: l2 still in the gallery)
  await page.evaluate(() => load());
  await expect(gal('sub-g1')).toHaveAttribute('open', '');   // a redraw no longer shuts Photos
  await expect(gal('sub-g2')).toHaveAttribute('open', '');
  release();
  await expect(gal('sub-g1').locator('[data-gal-msg]')).toHaveText('✓ Saved');
  await expect(gal('sub-g1').locator('> summary')).toHaveText('Photos (1)');
  await expect(gal('sub-g1').locator('> .dcs-bd > .glist > .gi[data-file="fil-2"]')).toHaveCount(0);
  await expect(gal('sub-g2').locator('> summary')).toHaveText('Photos (1)');   // the other dog is untouched
  // another live read after the save (Drive still has the old row) does not bring it back
  await page.evaluate(() => load());
  await expect(gal('sub-g1').locator('> summary')).toHaveText('Photos (1)');
  await expect(gal('sub-g1')).toHaveAttribute('open', '');
  // and a reload of the page keeps it removed
  await page.reload();
  await page.evaluate(() => go('dogs'));
  await expect(gal('sub-g1').locator('> summary')).toHaveText('Photos (1)');
  await expect(gal('sub-g1').locator('details[data-k="ended"]')).toHaveCount(0);
  await expect(gal('sub-g1').locator('.gi[data-file="fil-2"]')).toHaveCount(0);
});

test('the kept removal is forgotten once the live rows show the photo ended', async ({ page, guard }) => {
  const { release, gal } = await setUp(page, guard);
  await gal('sub-g1').locator('.gi[data-file="fil-2"] [data-gal-end]').click();
  release();
  await expect(gal('sub-g1').locator('[data-gal-msg]')).toHaveText('✓ Saved');
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cdhub.link.ends') || '{}')))).toEqual(['l2']);
  const f = guard.world.files.find((x) => x.name === 'BLD-links.csv' && !x.trashed);
  f.content = f.content.replace('2025-01-01,,dog card,owner,2025-01-01T10:00:00Z,', '2025-01-01,2026-01-01,dog card,owner,2025-01-01T10:00:00Z,Removed from gallery');
  f.size = String(f.content.length);
  await page.evaluate(() => load());
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cdhub.link.ends'))).toBeNull();
  await expect(gal('sub-g1').locator('> summary')).toHaveText('Photos (1)');
});

test('a refused save keeps Photos open, says Not saved, and the photo stays', async ({ page, guard }) => {
  const { release, gal } = await setUp(page, guard, { reply: { ok: false, code: 'NOT_ALLOWED', message: 'Pretend failure' } });
  await gal('sub-g1').locator('.gi[data-file="fil-2"] [data-gal-end]').click();
  await page.evaluate(() => load());   // a redraw during the save must not lose the message
  release();
  await expect(gal('sub-g1').locator('[data-gal-msg]')).toHaveText('Not saved: Pretend failure');
  await expect(gal('sub-g1')).toHaveAttribute('open', '');
  await expect(gal('sub-g1').locator('> summary')).toHaveText('Photos (2)');
  expect(await page.evaluate(() => localStorage.getItem('cdhub.link.ends'))).toBeNull();
});

// Lisa 22 Nov 2026, after a reload: the phone showed its old copy (from before the removal), so the photo was back; a
// second × was refused by the save script ("That link has already ended") and looked like a failure. It is gone.
test('× on a photo the save script says is already removed takes it away and says Saved', async ({ page, guard }) => {
  const { sent, release, gal } = await setUp(page, guard, { reply: { ok: false, code: 'NOT_ALLOWED', message: 'That link has already ended.' } });
  await gal('sub-g1').locator('.gi[data-file="fil-2"] [data-gal-end]').click();
  release();
  await expect(gal('sub-g1').locator('[data-gal-msg]')).toHaveText('✓ Saved');
  await expect(gal('sub-g1').locator('> summary')).toHaveText('Photos (1)');
  await expect(gal('sub-g1')).toHaveAttribute('open', '');
  expect(sent).toHaveLength(1);
  await page.reload();
  await page.evaluate(() => go('dogs'));
  await expect(gal('sub-g1').locator('> summary')).toHaveText('Photos (1)');
});
