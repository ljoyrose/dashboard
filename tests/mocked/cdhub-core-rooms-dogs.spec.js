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
const SUBJECT = csv('id,tenant_id,name,sex,dob,kind,neuter_status,size_band', [
  'sub-x1,t,Pretend Adult One,Female,2021-01-01,Breeding Female,entire,10-25kg (medium)',
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
const RULES = csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by', [
  'r1,t,size_colour.small,orange,2026-11-11,Pretend poster,,,',
  'r2,t,size_colour.medium,green,2026-11-11,Pretend poster,,,',
  'r3,t,size_colour.large,blue,2026-11-11,Pretend poster,,,'
]);

function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  if (!like) throw new Error('fixture has no ' + name);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
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

  test('cards link both ways: dog card opens its room, room card opens its dogs, retired rooms never linked', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-area.csv', AREA);
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-occupancy.csv', OCC);
    put(w, 'BLD-breeding_rule.csv', RULES);
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => go('dogs/sub-x1'));
    await expect(page.locator('#rows article.dc')).toHaveCount(1);
    await expect(page.locator('#rows .nm')).toHaveText('Pretend Adult One');
    const room = page.locator('#rows [data-room-link]');
    await expect(room).toHaveText('Room A');
    await room.click();
    await expect(page).toHaveURL(/#\/areas\/ar-a$/);
    await expect(page.locator('#main [data-room]')).toHaveCount(1);
    await expect(page.locator('#main [data-room]')).toHaveAttribute('data-room', 'ar-a');
    const dog = page.locator('#main [data-dog-link]');
    await expect(dog).toHaveCount(1);
    await expect(dog).toHaveText('Pretend Adult One');
    await expect(dog.locator('.szd')).toHaveAttribute('data-size', 'medium');
    await dog.click();
    await expect(page).toHaveURL(/#\/dogs\/sub-x1$/);
    await expect(page.locator('#rows article.dc')).toHaveCount(1);
    // a dog whose room row is retired (ZZ_) gets no room link and never shows ZZ_
    await page.evaluate(() => go('dogs/sub-x2'));
    await expect(page.locator('#rows [data-room-link]')).toHaveCount(0);
    await expect(page.locator('#rows')).not.toContainText('ZZ_');
  });

  test('print: each kennel card names its room; none for a dog off site or in a retired room', async ({ page }) => {
    const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
    const CORS = { 'access-control-allow-origin': '*' };
    const tag = (ref, t, kind) => ({ tag: t, kind: kind || 'subject', ref_id: ref, active: 'true' });
    const tables = {
      area: [{ id: 'ar-a', code: 'Room A' }, { id: 'ar-c', code: 'ZZ_Room C' }],
      subject: [{ id: 'd1', name: 'Pretend One', sex: 'Female', dob: '2022-01-05', size_band: '10-25kg (medium)' }, { id: 'd2', name: 'Pretend Two' }, { id: 'd3', name: 'Pretend Three' }],
      subject_status: [], litter: [],
      breeding_rule: [{ rule_key: 'size_colour.small', value: 'orange' }, { rule_key: 'size_colour.medium', value: 'green' }, { rule_key: 'size_colour.large', value: 'blue' }],
      area_access: [{ area_id: 'ar-a', access_type: 'free', effective_from: '2026-01-01' }, { area_id: 'ar-a', access_type: 'limited', effective_from: '2026-11-11' }],
      area_capacity: [
        { area_id: 'ar-a', access_type: 'free', size_band: '<10kg (small)', max_dogs: '9' },
        { area_id: 'ar-a', access_type: 'limited', size_band: '25kg+ (large)', max_dogs: '0' },
        { area_id: 'ar-a', access_type: 'limited', size_band: '10-25kg (medium)', max_dogs: '2' },
        { area_id: 'ar-a', access_type: 'limited', size_band: '<10kg (small)', max_dogs: '3' },
        { area_id: 'ar-a', access_type: 'limited', size_band: 'small + pups', max_dogs: '1' }
      ],
      occupancy: [
        { subject_id: 'd1', area_id: 'ar-a', moved_in: '2026-10-01' },
        { subject_id: 'd2', area_id: 'ar-a', moved_in: '2026-10-01' }, { subject_id: 'd2', off_site_kind: 'temporary', moved_in: '2026-10-09' },
        { subject_id: 'd3', area_id: 'ar-c', moved_in: '2026-10-01' }
      ],
      qr_tag: [tag('d1', 'AAAAAAAA'), tag('d2', 'BBBBBBBB'), tag('d3', 'CCCCCCCC'), tag('ar-a', 'EEEEEEEE', 'area')]
    };
    await page.route(SCRIPT, (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
    });
    await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
    await page.goto('cdhub/staff/print/');
    await page.getByRole('button', { name: 'Dog kennel cards' }).click();
    await expect(page.locator('.dcard .who b')).toHaveText(['Pretend One', 'Pretend Two', 'Pretend Three']);
    const one = page.locator('.dcard[data-dog="d1"]');
    await expect(one.locator('[data-k="Room"] dd')).toHaveText('Room A');
    await expect(one.locator('[data-k="DOB"] dd')).toHaveText('05/01/22');
    await expect(one).toHaveAttribute('style', /--c:var\(--sz-green, green\)/);
    await expect(one.locator('.sex')).toHaveAttribute('aria-label', 'Female');
    await expect(one.locator('.band small')).toHaveText('Medium10–25 kg');
    await expect(page.locator('[data-k="Room"]')).toHaveCount(1);   // off-site and retired-room dogs: no room line
    await expect(page.locator('.sheet')).not.toContainText('ZZ_');
    await page.getByRole('button', { name: 'Room signs' }).click();
    await expect(page.locator('.rcard > b')).toHaveText(['Room A']);
    // limits for the room's current access (limited, the later row), small first, none at 0, no pups line
    await expect(page.locator('.rcard .sz')).toHaveText(['3 small', 'or 2 medium']);
  });
});
