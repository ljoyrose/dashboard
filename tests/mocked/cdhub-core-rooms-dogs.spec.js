// CD Hub core: rooms and dogs agree on the hub, the staff list and the print page. Invented rows only.
// Fails on a wrong count, a retired room showing, a fields line counted as a cabin, or a dog in the wrong room.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const AREA = csv('id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', [
  'ar-a,t,Room A,A,1,10,u-m2,yes,,Housing with free access,Pretend list 2026',
  'ar-b,t,Room B,A,1,8,u-m2,yes,,,',
  'ar-c,t,ZZ_Room C,A,1,6,u-m2,yes,retired,,',
  'ar-f,t,Level 1 and level 5,Fields,9,0,u-m2,yes,,Fields,Pretend list 2026'
]);
const ACCESS = csv('id,area_id,access_type,reason', [
  'aa-a,ar-a,free,invented',
  'aa-b,ar-b,limited,invented'
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
    w.file('bld-access-invented', 'BLD-area_access.csv', ACCESS, { parents: [IDS.bld], driveId: 'drv-alpha1' });
    await HUBS.cdhub.open(page, guard);
    const n = await page.evaluate(() => ({ here: counts().here.length, pups: counts().pups.length, areas: CD.areas.map((a) => a.code) }));
    expect(n.here).toBe(5);
    expect(n.pups).toBe(2);
    expect(n.areas).toEqual(['Room A', 'Room B', 'Level 1 and level 5']);
    const who = await page.evaluate(() => ({
      group: isLiveCabin({ code: 'Room Z', grouping: 'Fields', use: 'Housing' }),
      code: isLiveCabin({ code: 'Level 1 and level 5', grouping: 'A', use: '' }),
      use: isLiveCabin({ code: 'Room Y', grouping: 'A', use: 'Fields' }),
      cabin: isLiveCabin({ code: 'Room A', grouping: 'A', use: 'Housing with free access' }),
      zz: isLiveCabin({ code: 'ZZ_Room C', grouping: 'A', use: '' }),
      free: flapChosen('free'),
      padded: flapChosen(' Limited '),
      yes: flapChosen('yes'),
      dash: flapChosen('-')
    }));
    expect(who).toEqual({ group: false, code: false, use: false, cabin: true, zz: false, free: true, padded: true, yes: false, dash: false });
    await tabClick(page, '#nav button[data-go="areas"]');
    await expect(page.locator('#main')).toContainText('Level 1 and level 5');
    await expect(page.locator('#main')).not.toContainText('ZZ_');
    await expect(page.locator('[data-use="ar-a"]')).toContainText('Housing with free access');
    await expect(page.locator('[data-use="ar-a"]')).toContainText('Pretend list 2026');
    await expect(page.locator('[data-use="ar-f"]')).toContainText('Fields');
    await tabClick(page, '#nav button[data-go="today"]');
    const card = page.locator('#todayChecklist');
    const flap = card.locator('.mrow', { hasText: 'Every cabin has its flap mode' });
    const morning = card.locator('.mrow', { hasText: 'Morning temperature in every cabin' });
    const evening = card.locator('.mrow', { hasText: 'Evening temperature in every cabin' });
    await expect(flap.locator('.mk')).toHaveText('✓');
    await expect(flap).toContainText('2 of 2 chosen');
    await expect(morning.locator('.mk')).toHaveText('✗');
    await expect(morning).toContainText('0 of 2 cabins');
    await expect(evening).toContainText('0 of 2 cabins');
    await tabClick(page, '#nav button[data-go="round"]');
    await expect(page.locator('.card[data-area]')).toHaveCount(2);
    await expect(page.locator('#main')).not.toContainText('Level 1 and level 5');
    await page.evaluate(() => {
      var date = CD._roundDate || todayISO();
      ['ar-a', 'ar-b'].forEach(function (id) {
        var k = roundKey(date, id);
        var cur = ROUND[k] || (ROUND[k] = { areaId: id, date: date, access: '' });
        cur.t_am = { min: '18.0', max: '20.0', at: date + 'T08:00:00Z' };
        cur.t_pm = { min: '18.0', max: '20.0', at: date + 'T16:00:00Z' };
      });
      go('today', false);
    });
    await expect(morning.locator('.mk')).toHaveText('✓');
    await expect(morning).toContainText('2 of 2 cabins');
    await expect(evening.locator('.mk')).toHaveText('✓');
    await expect(evening).toContainText('2 of 2 cabins');
    await expect(flap.locator('.mk')).toHaveText('✓');
    await page.evaluate(() => {
      var date = CD._roundDate || todayISO();
      var k = roundKey(date, 'ar-b');
      var cur = ROUND[k] || (ROUND[k] = { areaId: 'ar-b', date: date, access: '' });
      cur.access = 'yes';
      go('today', false);
    });
    await expect(flap.locator('.mk')).toHaveText('✗');
    await expect(flap).toContainText('1 of 2 chosen');
    await page.evaluate(() => {
      var date = CD._roundDate || todayISO();
      ROUND[roundKey(date, 'ar-b')].access = 'limited';
      go('today', false);
    });
    await expect(flap.locator('.mk')).toHaveText('✓');
    await expect(flap).toContainText('2 of 2 chosen');
  });
});
