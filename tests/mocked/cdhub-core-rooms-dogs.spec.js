// CD Hub core: rooms and dogs agree on the hub, the staff list and the print page. Invented rows only.
// Fails on a wrong count, a retired room showing, a fields line counted as a cabin, or a dog in the wrong room.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const AREA = csv('id,tenant_id,code,grouping,group_sort,area_value,area_unit_id,m2_confirmed,m2_note,use,source', [
  'ar-a,t,Room A,A,1,10,u-m2,yes,,Housing with free access,Pretend list 2026',
  'ar-b,t,Room B,A,1,8,u-m2,yes,,,',
  'ar-c,t,Room C,A,1,6,u-m2,yes,,,',
  'ar-f,t,Level 1 and level 5,Fields,9,0,u-m2,yes,,Fields,Pretend list 2026'
]);
const ACCESS = csv('id,area_id,access_type,reason', [
  'aa-a,ar-a,free,invented',
  'aa-b,ar-b,limited,invented'
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
// Need rows (Lisa 11 Nov 2026, A standard): Room C ended long ago; Room B has a row still running; Room A has none (always in use).
const REQ = csv('id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on', [
  'req-1,t,room.in_use,area,ar-c,2020-01-01,2020-12-31,Pretend retirement,,',
  'req-2,t,room.in_use,area,ar-b,2020-01-01,,Pretend,,'
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
    put(w, 'BLD-requirement.csv', REQ);
    // Adult age is a dated row now (Lisa 12 Nov 2026); without it nobody is counted a puppy or an adult.
    put(w, 'BLD-breeding_rule.csv', csv('id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by', ['a1,t,dog.adult_from_months,6,2010-01-01,Pretend law,,,']));
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
      free: flapChosen('free'),
      padded: flapChosen(' Limited '),
      yes: flapChosen('yes'),
      dash: flapChosen('-')
    }));
    expect(who).toEqual({ group: false, code: false, use: false, cabin: true, free: true, padded: true, yes: false, dash: false });
    await tabClick(page, '#nav button[data-go="areas"]');
    await expect(page.locator('#main')).not.toContainText('Level 1 and level 5');
    await expect(page.locator('#main')).not.toContainText('Room C');
    await expect(page.locator('[data-use="ar-a"]')).toContainText('Housing with free access');
    await expect(page.locator('[data-use="ar-a"]')).not.toContainText('Pretend list 2026');
    await expect(page.locator('#main')).not.toContainText('Fields');
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

  test('The round on a past date lists the rooms in use THAT day: one retired since still shows, one added since does not', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-area.csv', AREA.replace(/\r\n$/, '') + '\r\nar-d,t,Room D,A,1,7,u-m2,yes,,,\r\n');
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-occupancy.csv', OCC);
    put(w, 'BLD-requirement.csv', REQ.replace(/\r\n$/, '') + '\r\nreq-3,t,room.in_use,area,ar-d,2026-11-01,,Pretend new room,,\r\n');
    await HUBS.cdhub.open(page, guard);
    const on = (day) => page.evaluate((d) => { CD._roundDate = d; return liveCabins().map((a) => a.code); }, day);
    expect(await on('2020-06-01')).toEqual(['Room A', 'Room B', 'Room C']);
    expect(await on(await page.evaluate(() => todayISO()))).toEqual(['Room A', 'Room B', 'Room D']);
    await page.evaluate(() => { CD._roundDate = '2020-06-01'; go('round', false); });
    await expect(page.locator('#main')).toContainText('Room C');
    await expect(page.locator('#main')).not.toContainText('Room D');
  });

  test('Compliance temperatures: Room empty is flagged but not counted; missing only on days a thermometer is needed', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-area.csv', AREA);
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-occupancy.csv', OCC);
    put(w, 'BLD-requirement.csv', REQ);
    await HUBS.cdhub.open(page, guard);
    const c = await page.evaluate(() => {
      const t = todayISO(), y = dayMinus(t, 1);
      T['BLD-area_reading.csv'] = [
        { id: 'r1', area_id: 'ar-a', min_c: '2.0', max_c: '3.0', period_start: t + 'T08:00:00Z', taken_at: t + 'T08:00:00Z', room_empty: 'yes' },   // out of range, empty: flagged, not counted
        { id: 'r2', area_id: 'ar-b', min_c: '2.0', max_c: '3.0', period_start: t + 'T08:00:00Z', taken_at: t + 'T08:00:00Z', room_empty: '' },      // out of range: counted
        { id: 'r3', area_id: 'ar-a', min_c: '', max_c: '', period_start: t + 'T13:00:00Z', taken_at: t + 'T13:00:00Z', room_empty: 'yes' },         // empty, no reading: covered
        { id: 'r4', area_id: 'ar-b', min_c: '18.0', max_c: '20.0', period_start: y + 'T08:00:00Z', taken_at: y + 'T08:00:00Z', room_empty: '' }
      ];
      T['BLD-thermometer.csv'] = [{ id: 'th-a', name: 'Pretend A', area_id: 'ar-a' }, { id: 'th-b', name: 'Pretend B', area_id: 'ar-b' }, { id: 'th-c', name: 'Pretend C', area_id: 'ar-c' }];
      CD.req = CD.req.concat([{ need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'th-a', from_date: t, to_date: '' }]);
      T['BLD-breeding_rule.csv'] = [{ id: 'b0', rule_key: 'compliance.look_back_days', value: '7', effective_from: '2020-01-01', source: 'Pretend week' }];   // the look-back is a row; no row = not set
      go('compliance', false);
      const x = compTemps();
      return { t, y, ok: x.ok, empty: x.empty.map((r) => r.area), bad: x.bad.map((r) => r.area), miss: x.miss.map((m) => m.name + '@' + (m.day === t ? 'today' : m.day === y ? 'yesterday' : 'earlier')) };
    });
    expect(c.empty).toEqual(['ar-a']);
    expect(c.bad).toEqual(['ar-b']);
    // A needed from today only: never flagged for earlier days. B: always needed, read yesterday and today, so missing only on the other 5 days.
    // C: always needed, never read. Room empty with no reading counts as a reading.
    expect(c.miss.filter((m) => m.startsWith('Pretend A'))).toEqual([]);
    expect(c.miss.filter((m) => m.startsWith('Pretend B'))).toHaveLength(5);
    expect(c.miss.filter((m) => m.startsWith('Pretend C'))).toHaveLength(7);
    await expect(page.locator('#compTemps h3 .cnt')).toHaveText(String(1 + 5 + 7));
    await expect(page.locator('#compTemps [data-k="empty"]')).toContainText('in an empty room, not counted');
    await expect(page.locator('#compTemps [data-k="empty"] a[data-room-link]')).toHaveAttribute('href', '#/areas/ar-a');
    const order = await page.locator('#compTemps > details > ul > li').evaluateAll((ls) => ls.map((l) => l.dataset.k));
    expect(order).toEqual(['ok', 'empty', 'bad', 'miss']);
    await expect(page.locator('#compTemps [data-window]')).toHaveAttribute('data-window', '7');
    await expect(page.locator('#compTemps [data-window]')).toContainText('change');
    // the window is a user row; a reading with a thermometer_id is its own line, by name
    const d = await page.evaluate(() => {
      const t = todayISO();
      T['BLD-breeding_rule.csv'] = [{ id: 'b1', rule_key: 'compliance.look_back_days', value: '3', effective_from: '2020-01-01', source: 'Pretend setting' }];
      T['BLD-area_reading.csv'].push({ id: 'r5', area_id: 'ar-b', thermometer_id: 'th-b', min_c: '40.0', max_c: '41.0', period_start: t + 'T08:00:00Z', taken_at: t + 'T08:00:00Z', room_empty: '' });
      go('compliance', false);
      const x = compTemps();
      return { n: x.win.n, c: x.miss.filter((m) => m.name === 'Pretend C').length, bad: x.bad.map((b) => b.th) };
    });
    expect(d.n).toBe(3);
    expect(d.c).toBe(3);
    expect(d.bad.sort()).toEqual(['', 'Pretend B']);
    await expect(page.locator('#compTemps [data-window]')).toContainText('Last 3 days (Pretend setting)');
    await expect(page.locator('#compTemps [data-k="bad"]')).toContainText('Pretend B');
  });

  test('keeper statuses come from BLD-status_label rows, never names in the page', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-area.csv', AREA);
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-occupancy.csv', OCC);
    put(w, 'BLD-requirement.csv', REQ);
    await HUBS.cdhub.open(page, guard);
    const r = await page.evaluate(() => {
      const dog = (off, cl) => ({ id: 'x', off, classification: cl, state: 'active', kind: '', dob: '2020-01-01', weights: [], findings: [] });
      const before = [statusOf(dog('owned_by_family', '')).code, statusOf(dog('', 'Owned by PK')).code, keeperStatus(dog('', 'Pretend keeper house'))];
      T['BLD-status_label.csv'] = [
        { code: 'pk', label: 'Pretend Keeper', match: 'pretend keeper|Owned by PK', source: 'Pretend row' },
        { code: 'FA', label: 'Family', match: 'owned_by_family', source: 'Pretend row' }
      ];
      const after = [statusOf(dog('', 'Pretend keeper house')), statusOf(dog('', 'Owned by PK')).code, statusOf(dog('owned_by_family', '')).code];
      return { before, after, list: statusList().map((x) => x[0]) };
    });
    expect(r.before).toEqual(['FA', 'FA', null]);
    expect(r.after[0]).toEqual({ code: 'PK', label: 'Pretend Keeper', cls: 'st-k1' });
    expect(r.after.slice(1)).toEqual(['PK', 'FA']);
    expect(r.list).toEqual(['BI', 'ST', 'TR', 'PK', 'FA', 'LN', 'PU', 'DE', 'CL']);
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../cdhub/index.html'), 'utf8');
    expect(src).not.toMatch(/'(CE|GR)'/);   // the old keeper codes carried first names
  });

  test('Today staffing tile shows only from the owner\'s ratio rows, with their source', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-area.csv', AREA);
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-occupancy.csv', OCC);
    put(w, 'BLD-requirement.csv', REQ);
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => { T['BLD-breeding_rule.csv'] = []; go('today', false); });
    await expect(page.locator('#main .tile', { hasText: 'staffing' })).toHaveCount(0);   // not set: no assumed ratio
    await page.evaluate(() => {
      T['BLD-breeding_rule.csv'] = [{ id: 's1', rule_key: 'staffing.adults_per_full_time', value: '7', effective_from: '2020-01-01', source: 'Pretend source' }];
      go('today', false);
    });
    await expect(page.locator('#main .tile', { hasText: 'staffing' })).toContainText('1 per 7 adults (Pretend source)');
    // dated rows: each day is judged by the row in force that day; a to_date ends a row
    const r = await page.evaluate(() => {
      T['BLD-breeding_rule.csv'] = [
        { id: 's1', rule_key: 'staffing.adults_per_full_time', value: '7', effective_from: '2020-01-01', to_date: '2020-12-31', source: 'Pretend old' },
        { id: 's2', rule_key: 'staffing.adults_per_full_time', value: '9', effective_from: '2021-01-01', to_date: '2021-12-31', source: 'Pretend new' }];
      const a = [staffRule('2020-06-01').ft, staffRule('2021-06-01').ft, staffRule('2022-06-01')];
      // an open older row takes over again when a newer, closed row has ended
      T['BLD-breeding_rule.csv'][0].to_date = '';
      return a.concat([staffRule('2021-06-01').ft, staffRule('2021-12-31').ft, staffRule('2022-06-01').ft]);
    });
    expect(r).toEqual([7, 9, null, 9, 9, 7]);
  });

  test('Compliance temperatures: a reading in a linked old room counts for the new room; widest kept, own reading wins', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-area.csv', AREA);
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-occupancy.csv', OCC);
    put(w, 'BLD-requirement.csv', REQ);
    await HUBS.cdhub.open(page, guard);
    const c = await page.evaluate(() => {
      const t = todayISO(), y = dayMinus(t, 1);
      T['BLD-breeding_rule.csv'] = [{ id: 'b1', rule_key: 'compliance.look_back_days', value: '7', effective_from: '2020-01-01', source: 'Pretend setting' }];
      T['BLD-thermometer.csv'] = [{ id: 'th-c', name: 'Pretend C', area_id: 'ar-c' }];
      T['BLD-area_reading.csv'] = [
        { id: 'r1', area_id: 'ar-a', min_c: '2.0', max_c: '3.0', period_start: t + 'T08:00:00Z', taken_at: t + 'T08:00:00Z', room_empty: '' },
        { id: 'r2', area_id: 'ar-b', min_c: '30.0', max_c: '31.0', period_start: t + 'T08:00:00Z', taken_at: t + 'T08:00:00Z', room_empty: '' }
      ];
      // A and B both became C (a merge), links open-ended from yesterday
      T['BLD-area_link.csv'] = [
        { id: 'l1', from_area_id: 'ar-a', to_area_id: 'ar-c', from_date: y, to_date: '' },
        { id: 'l2', from_area_id: 'ar-b', to_area_id: 'ar-c', from_date: y, to_date: '' }
      ];
      const code = {}; (CD.allAreas || CD.areas).forEach((a) => { code[a.id] = a.code || a.id; });
      const x = compTemps();
      const linked = x.bad.filter((b) => b.area === 'ar-c');
      const missToday = x.miss.filter((m) => m.day === t).length;
      // the room's own reading wins over the linked ones
      T['BLD-area_reading.csv'].push({ id: 'r3', area_id: 'ar-c', min_c: '18.0', max_c: '20.0', period_start: t + 'T09:00:00Z', taken_at: t + 'T09:00:00Z', room_empty: '' });
      const own = compTemps().bad.filter((b) => b.area === 'ar-c').length;
      T['BLD-area_reading.csv'].pop();
      go('compliance', false);
      return { linked: linked.map((b) => ({ min: b.min, max: b.max, from: b.from })), want: [code['ar-a'], code['ar-b']], missToday, own };
    });
    expect(c.linked).toEqual([{ min: '2', max: '31', from: c.want }]);   // never averaged: lowest MIN, highest MAX
    expect(c.missToday).toBe(0);   // the linked readings cover C's thermometer today
    expect(c.own).toBe(0);
    await expect(page.locator('#compTemps [data-k="bad"] [data-from]').first()).toContainText('from ' + c.want.join(', '));
  });

  test('cards link both ways: dog card opens its room, room card opens its dogs, retired rooms never linked', async ({ page, guard }) => {
    const w = guard.world;
    put(w, 'BLD-area.csv', AREA);
    put(w, 'BLD-subject.csv', SUBJECT);
    put(w, 'BLD-subject_status.csv', STATUS);
    put(w, 'BLD-occupancy.csv', OCC);
    put(w, 'BLD-requirement.csv', REQ);
    put(w, 'BLD-breeding_rule.csv', RULES);
    await HUBS.cdhub.open(page, guard);
    await page.evaluate(() => go('dogs/sub-x1'));
    await expect(page.locator('#rows article.dc')).toHaveCount(1);
    await expect(page.locator('#rows .nm')).toHaveText('Pretend Adult One');
    const room = page.locator('#rows [data-cabin-move]');
    await expect(room).toHaveText('Room A');
    // The cabin chip opens the move picker (Lisa 12 Nov); the room card still lists the dog.
    await page.evaluate(() => go('areas/ar-a'));
    await expect(page.locator('#main [data-room]')).toHaveCount(1);
    await expect(page.locator('#main [data-room]')).toHaveAttribute('data-room', 'ar-a');
    const dog = page.locator('#main [data-move-dog="sub-x1"]');
    await expect(dog).toContainText('Pretend Adult One');
    await page.evaluate(() => go('dogs/sub-x1'));
    await expect(page.locator('#rows article.dc')).toHaveCount(1);
    // a dog whose room has ended (room.in_use to_date passed) gets no room link and never shows that room
    await page.evaluate(() => go('dogs/sub-x2'));
    await expect(page.locator('#rows [data-room-link]')).toHaveCount(0);
    await expect(page.locator('#rows')).not.toContainText('Room C');
  });

  test('print: each kennel card names its room; none for a dog off site or in a retired room', async ({ page }) => {
    const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
    const CORS = { 'access-control-allow-origin': '*' };
    const tag = (ref, t, kind) => ({ tag: t, kind: kind || 'subject', ref_id: ref, active: 'true' });
    const tables = {
      area: [{ id: 'ar-a', code: 'Room A' }, { id: 'ar-c', code: 'Room C' }],
      requirement: [{ need_type: 'room.in_use', target_table: 'area', target_id: 'ar-c', from_date: '2020-01-01', to_date: '2020-12-31' }],
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
    await expect(one.locator('[data-k="DOB"] dd')).toHaveText('5 Jan 2022');
    await expect(one).toHaveAttribute('style', /--c:var\(--sz-green, green\)/);
    await expect(one.locator('.sex')).toHaveAttribute('aria-label', 'Female');
    await expect(one.locator('.band small')).toHaveText('Medium10–25 kg');
    await expect(page.locator('[data-k="Room"]')).toHaveCount(1);   // off-site and retired-room dogs: no room line
    await expect(page.locator('.sheet')).not.toContainText('Room C');
    await page.getByRole('button', { name: 'Room signs' }).click();
    await expect(page.locator('.rcard > b')).toHaveText(['Room A']);
    // limits for the room's current access (limited, the later row), small first, none at 0, no pups line
    await expect(page.locator('.rcard .sz')).toHaveText(['3 small', 'or 2 medium']);
  });
});
