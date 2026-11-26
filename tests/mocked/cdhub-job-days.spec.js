const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const addTable = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-jdays-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const london = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const shift = (n) => london(new Date(Date.now() - n * 86400000));
const UKMON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const uk = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); return m ? ((+m[3]) + ' ' + UKMON[+m[2] - 1] + ' ' + m[1]) : ''; };

test('t-cdhub-job-days-spec-1', async ({ page, guard }) => {
  const today = shift(0), back1 = shift(1), back2 = shift(2), back4 = shift(4), back10 = shift(10);
  const TYPE_H = 'id,tenant_id,type_key,label,target,active,effective_from,source,every_days,group,includes,sop,site_scope';
  const LOG_H = 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded';
  addTable(guard.world, 'BLD-subject.csv', csv('id,name,sex,dob,kind', [
    'sub-test-a,sub-test-a,F,2020-01-01,adult',
    'sub-test-b,sub-test-b,F,2020-01-01,adult'
  ]));
  addTable(guard.world, 'BLD-subject_status.csv', csv('subject_id,state,from_date', [
    'sub-test-a,active,2020-01-01',
    'sub-test-b,active,2020-01-01'
  ]));
  addTable(guard.world, 'BLD-occupancy.csv', csv('subject_id,area_id,moved_in,moved_out,classification,off_site_kind', [
    'sub-test-a,area-1,2020-01-01,,,',
    `sub-test-b,area-1,${back2},,,`
  ]));
  addTable(guard.world, 'BLD-area.csv', csv('id,code,grouping,group_sort,use', [
    'area-1,A1,rooms,1,room',
    'area-2,A2,rooms,2,room',
    'area-3,F1,fields,9,fields'
  ]));
  addTable(guard.world, 'BLD-weight.csv', csv('subject_id,performed_on,weight_kg,unit', [
    `sub-test-a,${back10},4,kg`
  ]));
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, [
    'j-h,t,health_check_all,Health check,none,true,2020-01-01,,1,,,Health,per_dog',
    'j-d,t,daily_clean,Daily clean,area,true,2020-01-01,,1,,,Cleaning,',
    'j-p,t,deep_clean,Deep clean,area,true,2020-01-01,,7,,,Cleaning,',
    'j-w,t,weight,Weight,dog,true,2020-01-01,,7,,,Health,'
  ]));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, [
    `l1,t,j-h,,sub-test-a,,,ok,,,${back4}T09:00:00Z,staff-a,,,tapped`,
    `l2,t,j-h,,sub-test-a,,,ok,,,${back2}T09:00:00Z,staff-a,,,tapped`
  ]));
  addTable(guard.world, 'BLD-visit.csv', csv('subject_id,performed_on,start_time,kind,status,reason', [
    `sub-test-a,${back4},,appointment,done,sample`,
    `sub-test-a,${back2},,appointment,done,sample`,
    `sub-test-a,${back1},,appointment,done,sample`
  ]));

  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');

  const rows = await page.evaluate(() => BLDJobsView.summary(jobsV()).map((r) => ({ key: r.key, due: r.due, ok: r.ok, last: r.last_done })));
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  expect(by.daily_clean.due).toBe(1);
  expect(by.deep_clean.due).toBe(2);
  expect(by.weight.last).toBe(back10);
  await expect(page.locator('#compJobs tr[data-job="weight"]')).toContainText(uk(back10));

  async function show(iso) {
    for (let i = 0; i < 3; i++) {
      if (await page.locator(`#jobCals [data-day="${iso}"]`).count()) return;
      await page.locator('#jobCals [data-jcal-month]').first().click();
    }
  }
  await show(back4);
  await show(back2);
  await show(back1);
  const day = (iso) => page.locator(`#jobCals [data-jcal="health_check_all"] [data-day="${iso}"]`);
  await expect(day(back4)).toHaveClass(/\bdone\b/);
  await expect(day(back4)).toHaveClass(/\bvet\b/);
  await expect(day(back2)).toHaveClass(/\bpart\b/);
  await expect(day(back1)).toHaveClass(/\bmissed\b/);

  const paint = (sel) => page.locator(sel).evaluate((el) => {
    const s = getComputedStyle(el);
    return { font: s.fontSize, appearance: s.appearance, bg: s.backgroundColor, shadow: s.boxShadow };
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width > 400 ? 900 : 844 });
    const done = await paint('#jobCals button.jd.done.vet');
    const part = await paint('#jobCals button.jd.part.vet');
    const missed = await paint('#jobCals button.jd.missed.vet');
    const keyDone = await paint('#jobCals [data-jcal-legend="done"]');
    const keyPart = await paint('#jobCals [data-jcal-legend="part"]');
    const keyMiss = await paint('#jobCals [data-jcal-legend="missed"]');
    expect(done.font).toBe('10px');
    expect(part.font).toBe('10px');
    expect(missed.font).toBe('10px');
    expect(done.appearance).toBe('none');
    expect(part.appearance).toBe('none');
    expect(missed.appearance).toBe('none');
    expect(done.bg).toBe(keyDone.bg);
    expect(part.bg).toBe(keyPart.bg);
    expect(part.shadow).toBe(keyPart.shadow);
    expect(missed.shadow).toBe(keyMiss.shadow);
  }
  expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

