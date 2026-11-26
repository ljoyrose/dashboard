// Breed Better grading stays in Breed Better (Lisa 22 Nov 2026: "anything from breed better grading is BB only not
// compliance"). A check type whose row says it is Breed Better's (group "Breed Better", or a note starting "Breed Better:")
// never shows on Compliance, nor do its records; other jobs still do, and the rows themselves stay. Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const addTable = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-bb-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const TYPE_H = 'id,tenant_id,type_key,label,target,active,effective_from,source,note,every_days,group,includes,sop,site_scope';
const LOG_H = 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded';
const london = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

test('a Breed Better grading check never appears on Compliance; an ordinary job still does; the rows are kept', async ({ page, guard }) => {
  const yest = london(new Date(Date.now() - 86400000));
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, [
    'j1,t,food_bowls,Pretend bowls washed,none,true,2020-01-01,,,1,,,Cleaning,one_line',
    'bb1,t,pretend_programme,Pretend fits the programme,none,true,2020-01-01,,Breed Better: your judgement,1,,,,one_line',
    'bb2,t,pretend_programme,Pretend fits the programme,none,true,2021-01-01,,later version,1,,,,one_line',   // same type_key: off too
    'bb3,t,pretend_grade,Pretend grading,none,true,2020-01-01,,,1,Breed Better,,,one_line'
  ]));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, [
    `l1,t,j1,,,,,ok,,,${yest}T09:00:00Z,Pretend Staff,,,site_tap`,
    `l2,t,bb1,,,,,ok,,,${yest}T09:00:00Z,Pretend Staff,,,site_tap`,
    `l3,t,bb3,,,,,ok,,,${yest}T09:00:00Z,Pretend Staff,,,site_tap`
  ]));
  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  const cal = page.locator('#jobCals');
  await expect(cal.locator('[data-jcal="food_bowls"]')).toHaveCount(1);
  await expect(cal.locator('.jcal')).toHaveCount(1);
  const main = page.locator('#main');
  await expect(main).not.toContainText('Pretend fits the programme');
  await expect(main).not.toContainText('Pretend grading');
  await expect(main.locator('[data-jcal="pretend_programme"], [data-jcal="pretend_grade"]')).toHaveCount(0);
  // the rows themselves stay: everything outside Compliance still reads them
  const kept = await page.evaluate(() => ({ types: jobsV().types.map((t) => t.id), logs: jobsV().logs.map((l) => l.id) }));
  expect(kept.types).toEqual(['j1', 'bb1', 'bb2', 'bb3']);
  expect(kept.logs).toEqual(['l1', 'l2', 'l3']);
});

test('the outside viewer list says "Programme answers", no "looks"', async () => {
  const L = require('../../cdhub/staff/lib/viewer-levels.js');
  const src = require('fs').readFileSync(require.resolve('../../cdhub/staff/lib/viewer-levels.js'), 'utf8');
  expect(src).toContain("programme: 'Programme answers'");
  expect(src.toLowerCase()).not.toMatch(/programme and looks/);
  expect(L).toBeTruthy();
});
