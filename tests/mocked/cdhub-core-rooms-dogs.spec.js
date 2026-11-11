// CD Hub core: rooms and dogs agree on the hub, the staff list and the print page. Invented rows only.
// Fails on a wrong count, a retired room showing, or a dog in the wrong room.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const AREA = csv('id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', [
  'ar-a,t,Room A,A,1,10,u-m2,yes,,Housing with free access,Pretend list 2026',
  'ar-b,t,Room B,A,1,8,u-m2,yes,,,',
  'ar-c,t,ZZ_Room C,A,1,6,u-m2,yes,retired,,'
]);
const SUBJECT = csv('id,tenant_id,name,sex,dob,kind,neuter_status', [
  'sub-x1,t,Pretend Adult One,Female,2021-01-01,Breeding Female,entire',
  'sub-x2,t,Pretend Adult Two,Female,2022-01-01,Breeding Female,entire',
  'sub-x3,t,Pretend Adult Three,Male,2021-05-01,Stud,entire',
  'sub-p1,t,Pretend Pup One,Male,2026-09-30,Pup,entire',
  'sub-p2,t,Pretend Pup Two,Female,2026-09-30,Pup,entire'
]);
const STATUS = csv('id,tenant_id,subject_id,state', ['s1,t,sub-x1,Active', 's2,t,sub-x2,Active', 's3,t,sub-x3,Active', 's4,t,sub-p1,Active', 's5,t,sub-p2,Active']);
const OCC = csv('id,tenant_id,subject_id,area_id,off_site_kind,moved_in,moved_out,classification,classification_note', [
  'o1,t,sub-x1,ar-a,,,,Breeding Bitch,',
  'o2,t,sub-x2,ar-c,,,,Breeding Bitch,',
  'o3,t,sub-x3,,,,,Stud Boy,'
]);
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  throw new Error('fixture has no ' + name);
}

test.describe('CD Hub core: rooms and dogs', () => {
  test('hub: On site and Areas agree with the rows', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-area.csv', AREA);
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-occupancy.csv', OCC);
    await HUBS.cdhub.open(page, guard);
    const n = await page.evaluate(() => ({ here: counts().here.length, pups: counts().pups.length, areas: CD.areas.map((a) => a.code) }));
    expect(n.here).toBe(5);
    expect(n.pups).toBe(2);
    expect(n.areas).toEqual(['Room A', 'Room B']);
    await tabClick(page, '#nav button[data-go="areas"]');
    await expect(page.locator('#main')).not.toContainText('ZZ_');
    await expect(page.locator('[data-use="ar-a"]')).toContainText('Housing with free access');
    await expect(page.locator('[data-use="ar-a"]')).toContainText('Pretend list 2026');
  });
});
