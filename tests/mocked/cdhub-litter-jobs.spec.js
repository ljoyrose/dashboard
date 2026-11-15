// Litter jobs count on Compliance only for current litters: a litter counts while any of its puppies is still on site
// (SOP Puppy Handover; OV11 for Lisa 15 Nov 2026). No day count. Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const addTable = (world, name, content) => world.file('bld-lj-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const TYPES = csv('id,tenant_id,type_key,label,target,active,effective_from,source,every_days,group,includes,sop',
  ['t9,t,socialise,Pretend socialising,litter,true,2026-01-01,,1,,,Litters']);

test.describe('CD Hub: litter jobs', () => {
  test('a litter counts while any of its puppies is on site; collected, off-site and adult puppies do not keep it current', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-check_type.csv', TYPES);
    await HUBS.cdhub.open(page, guard);
    await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
    const r = await page.evaluate(() => {
      const today = todayISO(), m = (n) => addDays(today, -n);
      CD.litters = [{ id: 'lit-here', dob: m(20) }, { id: 'lit-gone', dob: m(90) }, { id: 'lit-away', dob: m(30) }, { id: 'lit-grown', dob: m(400) }, { id: 'lit-none' }];
      CD.dogs = (CD.dogs || []).concat([
        { id: 'p1', birthLitter: 'lit-here', dob: m(20), state: 'active' },
        { id: 'p2', birthLitter: 'lit-here', dob: m(20), classification: 'Collected' },
        { id: 'p3', birthLitter: 'lit-gone', dob: m(90), classification: 'Collected' },
        { id: 'p4', birthLitter: 'lit-away', dob: m(30), state: 'active', off: 'temporary' },
        { id: 'p5', birthLitter: 'lit-grown', dob: m(400), state: 'active' }]);
      T['BLD-breeding_rule.csv'] = (T['BLD-breeding_rule.csv'] || []).concat([{ rule_key: 'dog.adult_from_months', value: '6', effective_from: '2010-01-01', source: 'Pretend' }]);
      return { now: currentLitters().map((l) => l.id), passed: jobsV().litters.map((l) => l.id) };
    });
    expect(r.now).toEqual(['lit-here']);
    expect(r.passed).toEqual(['lit-here']);
    await tabClick(page, '#nav button[data-go="compliance"]');
    const row = page.locator('#compJobs tr[data-job="socialise"]');
    await expect(row).toContainText('Pretend socialising');
    await expect(row.locator('td[data-n="due"]')).toHaveText('1');
    await expect(page.locator('#compRules tr[data-rule="litters.jobs_days"]')).toHaveCount(0);
  });
});
