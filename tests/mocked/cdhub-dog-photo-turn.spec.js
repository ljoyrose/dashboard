// Photo turn (Lisa 15 Nov 2026): the owner turns a dog's main photo left or right; Save keeps the turn as the owner setting
// row photo.rotate.<file> from today. The stored picture never changes; every place the photo is drawn shows the turn.
// Invented rows only.
const { test, expect } = require('../support/test');
const { HUBS } = require('../support/hubs');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
// a real 2 x 1 picture, so the photo loads and shows
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwQYGBgAMlwD/fN7KZQAAAAASUVORK5CYII=', 'base64');

for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'laptop', width: 1280, height: 800 }]) {
  test(`dog card (${size.name}): a saved turn shows on the main photo; the arrows turn it and Save keeps the new turn`, async ({ page, guard }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const URL_ = 'https://script.google.com/macros/s/AKfyTEST_only_123/exec';
    await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
    const sent = [];
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
      const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', table: b.table, id: 'brl-test-1', at: '2026-11-16T10:00:00Z' } }) });
    });
    await page.route(/^https:\/\/example\.com\/pretend-/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    const w = guard.world;
    put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
      'sub-t1,t,Pretend Turned,Male,2021-03-02,Stud,entire,', 'sub-t2,t,Pretend Old Cell,Female,2022-01-01,Breeding,entire,OLDphotoCell002']));
    put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-t1,Active', 's2,t,sub-t2,Active']));
    put(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', [
      'fil-1,t,photo,DRIVEturnPhoto01,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z']));
    put(w, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on', [
      'm1,t,subjects,sub-t1,files,fil-1,main,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z']));
    put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
      'k1,t,link_kind.main,Main photo,2026-01-01,Pretend,,,,', 'k2,t,photo.rotate.fil-1,90,2026-01-01,Pretend,,,,']));
    for (const id of ['DRIVEturnPhoto01', 'OLDphotoCell002']) { w.file(id, id + '.png', '', { mimeType: 'image/png' }); w.byId(id).thumbnailLink = 'https://example.com/pretend-' + id + '.png'; }
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => go('dogs'));
    await expect(page.locator('#rows article.dc')).toHaveCount(2);

    const card = page.locator('.dc[data-dog="sub-t1"]'), img = card.locator('img.dogphoto');
    await expect(img).toHaveAttribute('data-rot', '90');   // the saved turn, read from the rule row
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((e) => e.style.transform)).toContain('rotate(90deg)');
    const save = card.locator('[data-turn-save]');
    await expect(save).toBeHidden();
    for (const b of await card.locator('[data-turn]').all()) {
      const r = await b.boundingBox(); expect(r.x + r.width).toBeLessThanOrEqual(size.width);   // fits the screen
    }

    await card.locator('[data-turn="1"]').click();
    await expect(img).toHaveAttribute('data-rot', '180');
    await expect(save).toBeVisible();
    await card.locator('[data-turn="-1"]').click();   // back to the saved turn: nothing to save
    await expect(img).toHaveAttribute('data-rot', '90');
    await expect(save).toBeHidden();
    await card.locator('[data-turn="-1"]').click();
    await card.locator('[data-turn="-1"]').click();
    await expect(img).toHaveAttribute('data-rot', '270');
    await expect(save).toBeVisible();
    expect(sent).toHaveLength(0);   // turning alone saves nothing

    await save.click();
    await expect(card.locator('[data-photo-msg]')).toHaveText('✓ Saved');
    expect(sent).toHaveLength(1);
    expect(sent[0].table).toBe('breeding_rule');
    expect(sent[0].fields).toMatchObject({ rule_key: 'photo.rotate.fil-1', value: '270', source: 'Turned on the dog card' });
    await expect(save).toBeHidden();
    await expect(img).toHaveAttribute('data-rot', '270');

    // a photo with no files row (the old photo cell) has no turn buttons and is drawn as stored
    const old = page.locator('.dc[data-dog="sub-t2"]');
    await expect(old.locator('img.dogphoto')).toHaveAttribute('data-rot', '0');
    await expect(old.locator('[data-turn]')).toHaveCount(0);
  });
}

test('dog card: a second turn saved the same day is refused with a plain message', async ({ page, guard }) => {
  const URL_ = 'https://script.google.com/macros/s/AKfyTEST_only_123/exec';
  await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
  await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: false, code: 'INVALID', message: 'Please check the highlighted fields.', fields: { effective_from: 'This rule already has a version from 2026-11-16.' } }) }));
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', ['sub-t1,t,Pretend Turned,Male,2021-03-02,Stud,entire,', 'sub-t2,t,Pretend Two,Female,2022-01-01,Breeding,entire,']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-t1,Active', 's2,t,sub-t2,Active']));
  put(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', [
    'fil-1,t,photo,DRIVEturnPhoto01,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z']));
  put(w, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on', [
    'm1,t,subjects,sub-t1,files,fil-1,main,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z']));
  w.file('DRIVEturnPhoto01', 'DRIVEturnPhoto01.png', '', { mimeType: 'image/png' });
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs'));
  const card = page.locator('.dc[data-dog="sub-t1"]');
  await card.locator('[data-turn="1"]').click();
  await card.locator('[data-turn-save]').click();
  await expect(card.locator('[data-photo-msg]')).toHaveText('Already turned today. Try again tomorrow.');
});
