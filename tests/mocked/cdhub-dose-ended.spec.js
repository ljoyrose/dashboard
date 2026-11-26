// Ended dose rows stay off the dog card. A dose with a giver shows that name. Other cards stay.
const { test, expect, HUBS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';

function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}

test('ended doses are hidden, a giver is shown, and the weight card stays', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind', ['sub-a,t,Dog A,Female,2021-01-01,Dog']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-a,Active']));
  put(w, 'BLD-weight.csv', csv('id,subject_id,performed_on,weight_kg,unit', ['w1,sub-a,2026-01-01,8.1,kg']));
  put(w, 'BLD-dispense.csv', csv('id,subject_id,given_on,product,dose_volume,given_by,to_date,end_reason', [
    'd1,sub-a,2026-06-01,Item A,1,Person A,,',
    'd2,sub-a,2026-05-01,Item B,1,,,',
    'd3,sub-a,2026-04-01,Item C,1,,2099-01-01,ended',
    'd4,sub-a,2026-03-01,Item D,1,,2020-01-01,',
    'd5,sub-a,2026-02-01,Item E,1,,2099-01-01,'
  ]));
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs/sub-a'));
  const card = page.locator('#rows article.dc');
  await expect(card.locator('[data-k="meds"]')).toContainText('3 medications');
  await expect(card.locator('[data-k="weight"]')).toContainText('8.1');
  await card.locator('details.meds summary').click();
  const meds = card.locator('details.meds');
  await expect(meds).toContainText('Item A');
  await expect(meds).toContainText('Item B');
  await expect(meds).toContainText('Item E');
  await expect(meds).not.toContainText('Item C');
  await expect(meds).not.toContainText('Item D');
  await expect(meds.locator('[data-k="given"]')).toHaveCount(1);
  await expect(meds.locator('[data-k="given"]')).toHaveText('Person A');
  await page.emulateMedia({ media: 'print' });
  const printed = await meds.evaluate((el) => el.innerText);
  expect(printed).toContain('Item A');
  expect(printed).toContain('Person A');
  expect(printed).not.toContain('Item C');
  expect(printed).not.toContain('Item D');
});
