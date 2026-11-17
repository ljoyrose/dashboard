// Daily records calendars on Compliance (Lisa 17 Nov 2026: "make a calendar view which will help the user, simple to use
// and log all done so staff or user say done then it shows as green"). Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const addTable = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-jcal-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const TYPE_H = 'id,tenant_id,type_key,label,target,active,effective_from,source,every_days,group,includes,sop,site_scope';
const LOG_H = 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded';
const london = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

test('Compliance opens with a calendar per daily job; yesterday done is green; Done today saves one whole-site record and turns today green', async ({ page, guard }) => {
  const today = london(new Date()), yest = london(new Date(Date.now() - 86400000));
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, [
    'j1,t,food_bowls,Pretend bowls washed,none,true,2020-01-01,,1,,,Cleaning,one_line',
    'j2,t,whole_site_clean,Pretend site cleaned,none,true,2020-01-01,,1,,daily_clean,Cleaning,one_line'
  ]));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, [
    `l1,t,j1,,,,,ok,,,${yest}T09:00:00Z,Pretend Staff,,,site_tap`
  ]));
  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  const cal = page.locator('#jobCals');
  await expect(cal).toBeVisible();
  await expect(cal.locator('.jcal')).toHaveCount(2);
  const bowls = cal.locator('[data-jcal="food_bowls"]');
  if (yest.slice(0, 7) === today.slice(0, 7)) await expect(bowls.locator(`[data-day="${yest}"]`)).toHaveClass(/\bdone\b/);
  await expect(bowls.locator(`[data-day="${today}"]`)).toHaveClass(/\bdue\b/);
  await expect(cal.locator('[data-jcal="whole_site_clean"] .jd.missed')).toHaveCount(0);   // never recorded: not tracked, not "missed"

  await page.evaluate(() => { window.__sent = []; window.sinkSend = async (b) => { window.__sent.push(b); return { ok: true, result: { status: 'saved', id: 'chk-1', ids: ['chk-1'], at: new Date().toISOString(), who: 'Pretend Owner' } }; }; });
  await bowls.locator('[data-jcal-done="food_bowls"]').click();
  await expect(page.locator('[data-jcal="food_bowls"]').locator(`[data-day="${today}"]`)).toHaveClass(/\bdone\b/);
  await expect(page.locator('[data-jcal="food_bowls"] [data-jcal-done]')).toHaveCount(0);
  await expect(page.locator('[data-jcal="food_bowls"]')).toContainText('Done today');
  const sent = await page.evaluate(() => window.__sent);
  expect(sent).toEqual([{ table: 'check_log', action: 'add_site', fields: { check_type_id: 'j1', outcome: 'ok', how_recorded: 'site_tap' } }]);
});
