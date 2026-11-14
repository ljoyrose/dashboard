// Main photo + gallery on the dog card (Lisa 13 Nov 2026): files rows owned through dated link rows (decision C, column role).
// The main photo is the 'main' link in force; the old photo cell is only the fallback. Invented rows only.
const { test, expect } = require('../support/test');
const { HUBS } = require('../support/hubs');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
async function openDogs(page, guard) {
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs'));
  await expect(page.locator('#rows article.dc')).toHaveCount(2);
}

test('dog card: main photo from the main link, a gallery of photos, files and links, ended items apart', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
    'sub-g1,t,Pretend Gallery,Female,2021-03-02,Breeding,entire,OLDphotoCell001',
    'sub-g2,t,Pretend Plain,Male,2022-01-01,Stud,entire,OLDphotoCell002']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-g1,Active', 's2,t,sub-g2,Active']));
  put(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', [
    'fil-1,t,photo,DRIVEmainPhoto01,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z',
    'fil-2,t,photo,DRIVEoldPhoto002,,image/jpeg,,,2025-01-01,,camera,owner,2025-01-01T10:00:00Z',
    'fil-3,t,upload,DRIVEcertFile003,,application/pdf,Pretend cert.pdf,,2026-07-01,,upload,owner,2026-07-01T10:00:00Z',
    'fil-4,t,link,,https://example.org/pretend-video,,,,2026-08-01,,link,owner,2026-08-01T10:00:00Z',
    'fil-5,t,photo,DRIVEendedPho005,,image/jpeg,,,2025-02-01,,camera,owner,2025-02-01T10:00:00Z']));
  put(w, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on', [
    'l1,t,subjects,sub-g1,files,fil-1,gallery,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z',
    'l2,t,subjects,sub-g1,files,fil-2,gallery,,,2025-01-01,,dog card,owner,2025-01-01T10:00:00Z',
    'l3,t,subjects,sub-g1,files,fil-3,gallery,,,2026-07-01,,dog card,owner,2026-07-01T10:00:00Z',
    'l4,t,subjects,sub-g1,files,fil-4,gallery,,,2026-08-01,,dog card,owner,2026-08-01T10:00:00Z',
    'l5,t,subjects,sub-g1,files,fil-5,gallery,,,2025-02-01,2026-03-01,dog card,owner,2025-02-01T10:00:00Z',
    'm1,t,subjects,sub-g1,files,fil-2,main,,,2025-01-01,2026-06-01,dog card,owner,2025-01-01T10:00:00Z',
    'm2,t,subjects,sub-g1,files,fil-1,main,,,2026-06-01,,dog card,owner,2026-06-01T11:00:00Z']));
  put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
    'k1,t,link_kind.gallery,Photos,2026-01-01,Pretend,,,,', 'k2,t,link_kind.main,Main photo,2026-01-01,Pretend,,,,', 'k3,t,link_kind.main.max_per_from,1,2026-01-01,Pretend,,,,']));
  for (const id of ['DRIVEmainPhoto01', 'DRIVEoldPhoto002', 'OLDphotoCell002']) {
    w.file(id, id + '.png', '', { mimeType: 'image/png' });
    w.byId(id).thumbnailLink = 'https://example.com/pretend-' + id + '.png';
  }
  await openDogs(page, guard);

  const g = page.locator('.dc[data-dog="sub-g1"]');
  await expect(g.locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'DRIVEmainPhoto01');   // the main link wins over the old cell
  const gal = g.locator('details[data-k="gallery"]');
  await expect(gal.locator('> summary')).toHaveText('Photos (4)');
  await gal.locator('> summary').click();
  await expect(gal.locator('> .dcs-bd > .glist > .gi')).toHaveCount(4);
  await expect(gal.locator('> .dcs-bd > .glist > .gi').first()).toHaveAttribute('data-kind', 'link');   // newest first
  await expect(gal.locator('.gi[data-kind="link"] a')).toHaveAttribute('href', 'https://example.org/pretend-video');
  await expect(gal.locator('.gi[data-kind="upload"] a')).toHaveText('Pretend cert.pdf');
  await expect(gal.locator('.gi[data-file="fil-1"] [data-k="main"]')).toHaveText('Main');
  await expect(gal.locator('.gi[data-file="fil-2"] img.galph')).toHaveAttribute('data-photo-id', 'DRIVEoldPhoto002');   // loaded once opened
  await expect(gal.locator('details[data-k="ended"] summary')).toHaveText('Ended (1)');
  await expect(gal.locator('details[data-k="ended"] img.galph')).not.toHaveAttribute('data-photo-id', /./);   // not loaded until opened

  // a dog with no link rows keeps its old photo cell and shows no gallery
  const p = page.locator('.dc[data-dog="sub-g2"]');
  await expect(p.locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'OLDphotoCell002');
  await expect(p.locator('details[data-k="gallery"]')).toHaveCount(0);
});
