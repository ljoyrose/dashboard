// Compliance gaps (mock-up 7 Nov 2026): the parts built after PR 405. Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const AREA = csv('id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', [
  'ar-a,t,Room A,A,1,10,u-m2,yes,,,',
  'ar-iso,t,Room Iso,A,1,8,u-m2,yes,,,',
  'ar-c,t,Room C,A,1,6,u-m2,yes,,,'
]);
const SUBJECT = csv('id,tenant_id,name,sex,dob,kind,neuter_status,size_band', [
  'sub-x1,t,Pretend Adult One,Female,2021-01-01,Breeding Female,entire,10-25kg (medium)',
  'sub-x2,t,Pretend Adult Two,Female,2022-01-01,Breeding Female,entire,10-25kg (medium)'
]);
const STATUS = csv('id,tenant_id,subject_id,state', ['s1,t,sub-x1,Active', 's2,t,sub-x2,Active']);
const RULE_H = 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by';

function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  if (!like) throw new Error('fixture has no ' + name);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
const tab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};
function rooms(world, occ, rules) {
  put(world, 'BLD-area.csv', AREA);
  put(world, 'BLD-subject.csv', SUBJECT);
  put(world, 'BLD-subject_status.csv', STATUS);
  put(world, 'BLD-occupancy.csv', csv('id,tenant_id,subject_id,area_id,off_site_kind,moved_in,moved_out,classification,classification_note', occ));
  put(world, 'BLD-breeding_rule.csv', csv(RULE_H, rules));
}

test.describe('CD Hub: Compliance gaps', () => {
  // R4: "Room A is closed while Room Iso is in use" is a dated row, never code.
  test('room-to-room rule: closed room with a dog in it is flagged; ended rule is not', async ({ page, guard }) => {
    rooms(guard.world,
      ['o1,t,sub-x1,ar-iso,,2026-01-01,,Breeding Bitch,', 'o2,t,sub-x2,ar-a,,2026-01-01,,Breeding Bitch,'],
      ['r1,t,room.closed_when_in_use.ar-a,ar-iso,2026-01-01,Pretend list,,,',
       'r2,t,room.closed_when_in_use.ar-c,ar-iso,2026-01-01,Pretend list,,,',
       'r3,t,room.closed_when_in_use.ar-c,none,2026-02-01,Pretend change,,,']);
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const li = page.locator('#compRooms ul[data-k="closed"] li');
    await expect(li).toHaveCount(1);
    await expect(li.first()).toHaveAttribute('data-state', 'bad');
    await expect(li.first()).toContainText('Room A is closed while Room Iso is in use, but has 1 dog in it');
    await expect(li.first()).toContainText('Pretend list');
    await expect(page.locator('#compRooms summary .cnt')).toHaveText('1');
  });

  test('room-to-room rule: trigger room empty means the room is open, nothing flagged', async ({ page, guard }) => {
    rooms(guard.world,
      ['o2,t,sub-x2,ar-a,,2026-01-01,,Breeding Bitch,'],
      ['r1,t,room.closed_when_in_use.ar-a,ar-iso,2026-01-01,Pretend list,,,']);
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const li = page.locator('#compRooms ul[data-k="closed"] li');
    await expect(li).toHaveAttribute('data-state', 'open');
    await expect(li).toContainText('Room A is open: Room Iso is not in use');
    await expect(page.locator('#compRooms summary .cnt')).toHaveText('');
  });
});
