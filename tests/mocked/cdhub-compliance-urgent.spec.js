// Compliance mock-up gaps (7 Nov 2026): urgent warnings. Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const tab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
const rooms = (world, occ) => {
  put(world, 'BLD-area.csv', csv('id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', ['ar-a,t,Room A,A,1,10,u-m2,yes,,,', 'ar-iso,t,Room Iso,A,1,8,u-m2,yes,,,']));
  put(world, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status,size_band', ['sub-x1,t,Pretend One,Female,2021-01-01,Breeding Female,entire,', 'sub-x2,t,Pretend Two,Female,2022-01-01,Breeding Female,entire,']));
  put(world, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-x1,Active', 's2,t,sub-x2,Active']));
  put(world, 'BLD-occupancy.csv', csv('id,tenant_id,subject_id,area_id,off_site_kind,moved_in,moved_out,classification,classification_note', occ));
  put(world, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by', ['r1,t,room.closed_when_in_use.ar-a,ar-iso,2026-01-01,Pretend list,,,']));
};

test.describe('CD Hub: Compliance urgent warnings', () => {
  // H-06: text AND icon AND red ring AND colour, never colour alone; never a work block.
  test('a closed room with a dog in it is Urgent, with word, icon and ring', async ({ page, guard }) => {
    rooms(guard.world, ['o1,t,sub-x1,ar-iso,,2026-01-01,,Breeding Bitch,', 'o2,t,sub-x2,ar-a,,2026-01-01,,Breeding Bitch,']);
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const li = page.locator('#urgList > li[data-k="closed"]');
    await expect(li).toHaveCount(1);
    await expect(li.locator('.urg')).toContainText('Urgent');
    await expect(li.locator('.urg > svg use')).toHaveAttribute('href', '#i-building-cottage');
    await expect(li.locator('.urg-ring > i')).toHaveCount(1);
    await expect(li).toContainText('Room A is closed but has a dog in it');
    await expect(page.locator('#compUrgent summary .cnt')).toHaveText('1');
    await expect(page.locator('#compUrgent')).toContainText('never stops anyone working');
  });

  // A dog's room is its row with the latest moved_in, not the last row in the file (Specs.gs occupancy rule, 12 Nov 2026).
  test('a dog is in the room of its latest move, even when an older row comes later in the file', async ({ page, guard }) => {
    rooms(guard.world, ['o1,t,sub-x1,ar-iso,,2026-02-01,,Breeding Bitch,', 'o2,t,sub-x2,ar-a,,2026-01-01,,Breeding Bitch,', 'o0,t,sub-x1,ar-a,,2026-01-01,,Breeding Bitch,']);
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#urgList > li[data-k="closed"]')).toContainText('Room A is closed but has a dog in it');
  });

  // A move row leaves classification blank (it is the licence label, not a location): the dog keeps its label and stays on site.
  test('a move row with no classification keeps the dog on site, in its new room', async ({ page, guard }) => {
    rooms(guard.world, ['o1,t,sub-x1,ar-a,,2026-01-01,,Breeding Bitch,', 'o2,t,sub-x2,ar-a,,2026-01-01,,Breeding Bitch,', 'o3,t,sub-x1,ar-iso,,2026-02-01,,,']);
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => { location.hash = '#/today'; });
    await expect(page.locator('#onSiteCard a.big')).toHaveText('2');
    await tab(page, 'compliance');
    await expect(page.locator('#urgList > li[data-k="closed"]')).toContainText('Room A is closed but has a dog in it');
  });

  test('nothing urgent: says so', async ({ page, guard }) => {
    rooms(guard.world, ['o2,t,sub-x2,ar-a,,2026-01-01,,Breeding Bitch,']);
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#compUrgent')).toContainText('Nothing urgent.');
  });
});
