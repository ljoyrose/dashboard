// Gallery pictures : grey tiles, and every tap downloaded them again.
// The grid uses a small thumbnail. A remove updates that one tile and does not fetch the others again.
const { test, expect } = require('../support/test');
const { HUBS } = require('../support/hubs');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAACYABTxrpVkAAAAASUVORK5CYII=', 'base64');

test('gallery thumbs are about 200px and a remove does not download the other pictures again @regression', async ({ page, guard }) => {
  const hits = [];
  await page.route(/googleapis\.com\/drive\/v3\/files\//, async (route) => {
    const url = route.request().url();
    if (!/DRIVE/.test(url)) return route.fallback();
    hits.push(url);
    if (/alt=media/.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    const id = decodeURIComponent((url.split('/files/')[1] || '').split('?')[0]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ thumbnailLink: 'https://example.com/pretend-' + id + '.png=s220' }) });
  });
  await page.route(/^https:\/\/example\.com\//, (route) => {
    hits.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  });
  await page.addInitScript(() => { try { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/FAKE-TEST-ID/exec'); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} });
  await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'lnk-x' } }) }));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', ['sub-g1,t,Pretend Gallery,Female,2021-03-02,Breeding,entire,']));
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
    'k1,t,link_kind.gallery,Photos,2026-01-01,Pretend,,,,']));
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs'));
  const gal = page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"]');
  await gal.locator('> summary').click();
  await expect(gal.locator('img.galph').first()).toHaveAttribute('loading', 'lazy');
  await expect.poll(() => hits.filter((u) => u.indexOf('example.com') >= 0).length).toBe(3);
  expect(hits.filter((u) => /alt=media/.test(u))).toEqual([]);
  expect(hits.filter((u) => u.indexOf('example.com') >= 0).every((u) => u.indexOf('=s200') >= 0)).toBe(true);
  const kept = gal.locator('.gi[data-file="fil-1"] img.galph');
  await expect(kept).not.toHaveClass(/off/);
  const src = await kept.getAttribute('src');
  const n = hits.length;
  await gal.locator('.gi[data-file="fil-2"] [data-gal-end]').click();
  await expect(gal.locator('> summary')).toHaveText('Photos (2)');
  await expect(gal.locator('[data-gal-msg]')).toHaveText('✓ Saved');
  expect(hits.length).toBe(n);
  await expect(kept).toHaveAttribute('src', src);
  const stored = await page.evaluate(() => localStorage.getItem('cdhub.photo.urls'));
  expect(stored).toContain('DRIVEbadPhoto002');
  expect(stored).toContain('=s200');
});
