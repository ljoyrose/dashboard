// Litter jobs count on Compliance only for current litters, and the owner's row decides which are current
// (litters.jobs_days, days from birth; SOP JOBS 12 Nov 2026). No row: no litter jobs counted. Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const addTable = (world, name, content) => world.file('bld-lj-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const TYPES = csv('id,tenant_id,type_key,label,target,active,effective_from,source,every_days,group,includes,sop',
  ['t9,t,socialise,Pretend socialising,litter,true,2026-01-01,,1,,,Litters']);

test.describe('CD Hub: litter jobs', () => {
  test('no jobs_days row: litter jobs are not counted; with a row, a litter born within it counts and an older one does not', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-check_type.csv', TYPES);
    await HUBS.cdhub.open(page, guard);
    await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
    const r = await page.evaluate(() => {
      const today = todayISO(), before = currentLitters(today).length;
      CD.litters = [{ id: 'lit-new', dob: addDays(today, -10) }, { id: 'lit-old', dob: addDays(today, -200) }, { id: 'lit-none' }];
      T['BLD-breeding_rule.csv'] = (T['BLD-breeding_rule.csv'] || []).concat([{ rule_key: 'litters.jobs_days', value: '84', effective_from: '2020-01-01', source: 'Pretend' }]);
      return { before, now: currentLitters(today).map((l) => l.id), passed: jobsV().litters.map((l) => l.id) };
    });
    expect(r.before).toBe(0);
    expect(r.now).toEqual(['lit-new']);
    expect(r.passed).toEqual(['lit-new']);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const row = page.locator('#compJobs tr[data-job="socialise"]');
    await expect(row).toContainText('Pretend socialising');
    await expect(row.locator('td[data-n="due"]')).toHaveText('1');
    await expect(page.locator('#compRules tr[data-rule="litters.jobs_days"]')).toContainText('84');
  });
});
