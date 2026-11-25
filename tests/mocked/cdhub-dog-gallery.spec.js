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
  await expect(gal.locator('details[data-k="ended"]')).toHaveCount(0);   // an ended link stays in the sheet and is not on the card
  await expect(gal.locator('.gi[data-file="fil-5"]')).toHaveCount(0);

  // a dog with no link rows keeps its old photo cell and shows no gallery
  const p = page.locator('.dc[data-dog="sub-g2"]');
  await expect(p.locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'OLDphotoCell002');
  await expect(p.locator('details[data-k="gallery"]')).toHaveCount(0);
});

// Show photo dates (Lisa 15 Nov 2026, J5): a per-person display setting. The owner's own row beats the everyone default;
// no row shows dates as before. The button saves the owner's own row; sorting never changes. Invented rows only.
for (const size of [{ name: 'phone', width: 390, height: 844 }, { name: 'laptop', width: 1280, height: 800 }]) {
  test(`dog card gallery (${size.name}): photo dates follow the owner's own setting, then the everyone default; the button saves the owner's own row`, async ({ page, guard }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const URL_ = 'https://script.google.com/macros/s/AKfyTEST_only_123/exec';
    await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
    const sent = [];
    await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
      const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', table: b.table, id: 'brl-test-1', at: '2026-11-15T10:00:00Z' } }) });
    });
    const w = guard.world;
    put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
      'sub-g1,t,Pretend Gallery,Female,2021-03-02,Breeding,entire,', 'sub-g2,t,Pretend Plain,Male,2022-01-01,Stud,entire,']));
    put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-g1,Active', 's2,t,sub-g2,Active']));
    put(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', [
      'fil-1,t,photo,DRIVEmainPhoto01,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z',
      'fil-2,t,photo,DRIVEoldPhoto002,,image/jpeg,,,2025-01-01,,camera,owner,2025-01-01T10:00:00Z']));
    put(w, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on', [
      'l1,t,subjects,sub-g1,files,fil-1,gallery,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z',
      'l2,t,subjects,sub-g1,files,fil-2,gallery,,,2025-01-01,,dog card,owner,2025-01-01T10:00:00Z']));
    // everyone default: shown; the owner's own row: hidden
    put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
      'k1,t,link_kind.gallery,Photos,2026-01-01,Pretend,,,,', 'k2,t,photos.show_dates,1,2026-01-01,Pretend,,,,', 'k3,t,photos.show_dates.owner,0,2026-01-01,Pretend,,,,']));
    for (const id of ['DRIVEmainPhoto01', 'DRIVEoldPhoto002']) { w.file(id, id + '.png', '', { mimeType: 'image/png' }); w.byId(id).thumbnailLink = 'https://example.com/pretend-' + id + '.png'; }
    put(w, 'BLD-field_visibility.csv', csv('id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason', ['fv-1,t,area,*,aud-staff,yes,,,test,2026-10-16,owner sees Admin']));
    await openDogs(page, guard);

    const gal = page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"]');
    await gal.locator('> summary').click();
    const items = gal.locator('> .dcs-bd > .glist > .gi');
    await expect(items).toHaveCount(2);
    await expect(items.first()).toHaveAttribute('data-file', 'fil-1');   // order unchanged: newest first
    await expect(gal.locator('[data-k="photo-date"]')).toHaveCount(0);   // the owner's own row hides the dates
    // Lisa 17 Nov 2026: a setting, not a button on the dog card. The button is in Admin -> Display.
    await expect(gal.locator('[data-photo-dates]')).toHaveCount(0);
    await page.evaluate(() => go('admin'));
    await page.locator('[data-adm-open="display"]').click();
    const btn = page.locator('#adm-display [data-photo-dates]');
    await expect(page.locator('#adm-display')).toContainText('hidden');
    await expect(btn).toHaveText('Show dates');
    const box = await btn.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(size.width);   // fits the screen

    await btn.click();
    await expect(page.locator('#adm-display [data-photo-dates-msg]')).toHaveText('✓ Saved');
    expect(sent).toHaveLength(1);
    expect(sent[0].table).toBe('breeding_rule');
    expect(sent[0].fields).toMatchObject({ rule_key: 'photos.show_dates.owner', value: '1' });
    await expect(page.locator('#adm-display [data-photo-dates]')).toHaveText('Hide dates');
    await page.evaluate(() => go('dogs'));
    const gal2 = page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"]');
    await gal2.locator('> summary').click();
    await expect(gal2.locator('> .dcs-bd > .glist > .gi').first()).toHaveAttribute('data-file', 'fil-1');
    await expect(gal2.locator('> .dcs-bd > .glist [data-k="photo-date"]').first()).toHaveText('1 Jun 2026');
  });
}

test('a fresh load does not list ended photos on the card or in the gallery @regression', async ({ page, guard }) => {
  const w = guard.world;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const files = ['fil-open,t,photo,DRIVEopenPhoto01,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z'];
  const links = ['l-open,t,subjects,sub-g1,files,fil-open,gallery,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z,',
    'm-open,t,subjects,sub-g1,files,fil-open,main,,,2026-06-01,,dog card,owner,2026-06-01T11:00:00Z,',
    'l-today,t,subjects,sub-g1,files,fil-today,gallery,,,' + today + ',' + today + ',dog card,owner,' + today + 'T10:00:00Z,Removed from gallery'];
  files.push('fil-today,t,photo,DRIVEtodayEnded,,image/jpeg,,,' + today + ',,camera,owner,' + today + 'T10:00:00Z');
  for (let n = 1; n <= 23; n++) {
    const id = 'fil-e' + n;
    files.push(id + ',t,photo,DRIVEended' + String(n).padStart(2, '0') + ',,image/jpeg,,,2025-01-01,,camera,owner,2025-01-01T10:00:00Z');
    links.push('l-e' + n + ',t,subjects,sub-g1,files,' + id + ',gallery,,,2025-01-01,2026-03-01,dog card,owner,2025-01-01T10:00:00Z,');
  }
  files.push('fil-main-gone,t,photo,DRIVEmainGone01,,image/jpeg,,,' + today + ',,camera,owner,' + today + 'T12:00:00Z');
  links.push('m-gone,t,subjects,sub-g2,files,fil-main-gone,main,,,' + today + ',' + today + ',dog card,owner,' + today + 'T12:00:00Z,Removed from gallery');
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
    'sub-g1,t,Pretend Capri,Female,2021-03-02,Breeding,entire,DRIVEended01',
    'sub-g2,t,Pretend Plain,Male,2022-01-01,Stud,entire,DRIVEmainGone01']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-g1,Active', 's2,t,sub-g2,Active']));
  put(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', files));
  put(w, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on,end_reason', links));
  put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', [
    'k1,t,link_kind.gallery,Photos,2026-01-01,Pretend,,,,']));
  w.file('DRIVEopenPhoto01', 'open.png', '', { mimeType: 'image/png' });
  await openDogs(page, guard);
  const card = page.locator('.dc[data-dog="sub-g1"]');
  await expect(card).not.toContainText('Ended (');
  await expect(card.locator('details[data-k="ended"]')).toHaveCount(0);
  await expect(card.locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'DRIVEopenPhoto01');
  const gal = card.locator('details[data-k="gallery"]');
  await expect(gal.locator('> summary')).toHaveText('Photos (1)');
  await gal.locator('> summary').click();
  await expect(gal.locator('.gi')).toHaveCount(1);
  await expect(gal.locator('.gi[data-file="fil-e1"]')).toHaveCount(0);
  await expect(gal.locator('.gi[data-file="fil-today"]')).toHaveCount(0);
  const other = page.locator('.dc[data-dog="sub-g2"]');
  await expect(other).not.toContainText('Ended (');
  await expect(other.locator('img.dogphoto')).toHaveCount(0);
  await expect(other.locator('details[data-k="gallery"]')).toHaveCount(0);
});

test('dog card gallery: with no photo dates rows the dates show, as before', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
    'sub-g1,t,Pretend Gallery,Female,2021-03-02,Breeding,entire,', 'sub-g2,t,Pretend Plain,Male,2022-01-01,Stud,entire,']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-g1,Active', 's2,t,sub-g2,Active']));
  put(w, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on', [
    'fil-1,t,photo,DRIVEmainPhoto01,,image/jpeg,,,2026-06-01,,camera,owner,2026-06-01T10:00:00Z']));
  put(w, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,to_table,to_id,role,sort,note,from_date,to_date,source,set_by,set_on', [
    'l1,t,subjects,sub-g1,files,fil-1,gallery,,,2026-06-01,,dog card,owner,2026-06-01T10:00:00Z']));
  put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date', ['k1,t,link_kind.gallery,Photos,2026-01-01,Pretend,,,,']));
  w.file('DRIVEmainPhoto01', 'DRIVEmainPhoto01.png', '', { mimeType: 'image/png' });
  await openDogs(page, guard);
  const gal = page.locator('.dc[data-dog="sub-g1"] details[data-k="gallery"]');
  await gal.locator('> summary').click();
  await expect(gal.locator('[data-k="photo-date"]')).toHaveText('1 Jun 2026');
  await expect(gal.locator('[data-photo-dates]')).toHaveCount(0);   // no setting button on the dog card
});
