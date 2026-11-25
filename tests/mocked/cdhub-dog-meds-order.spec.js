// Dog card medications (Lisa 25 Nov 2026): the list had the oldest at the top.
// Newest date first. Two rows on the same date keep the order they were read in. Invented rows only.
const { test, expect, HUBS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';

function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}

test('dog card medications list the newest first, and the same date keeps its order @regression', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status', [
    'sub-med,t,Pretend Meds,Female,2020-01-01,Breeding,entire']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-med,Active']));
  // File order is oldest first, as the live sheet is. Two rows share 13 Aug 2026.
  put(w, 'BLD-dispense.csv', csv('id,subject_id,given_on,product,dose_volume,route,source', [
    'm1,sub-med,2020-08-31,Oldest wormer,1 tab,Oral,Pretend',
    'm2,sub-med,2026-01-02,January tablet,1 tab,Oral,Pretend',
    'm3,sub-med,2026-08-13,August first,1 pipette,Topical,Pretend',
    'm4,sub-med,2026-08-13,August second,1 tablet,Oral,Pretend'
  ]));
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs/sub-med'));
  const card = page.locator('#rows article.dc');
  await expect(card.locator('[data-k="meds"]')).toHaveText('4 medications · last 13 Aug 2026');
  await card.locator('details.meds > summary').click();
  const rows = card.locator('details.meds .dcs-bd > .dcs-row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('13 Aug 2026');
  await expect(rows.nth(0)).toContainText('August first');
  await expect(rows.nth(1)).toContainText('13 Aug 2026');
  await expect(rows.nth(1)).toContainText('August second');
  await expect(rows.nth(2)).toContainText('2 Jan 2026');
  await expect(rows.nth(2)).toContainText('January tablet');
  await expect(rows.nth(3)).toContainText('31 Aug 2020');
  await expect(rows.nth(3)).toContainText('Oldest wormer');
});
