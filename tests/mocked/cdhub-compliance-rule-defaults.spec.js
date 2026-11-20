// Compliance rule defaults (Lisa 12 Nov 2026: every limit is a dated row; no row = "not set", never a quiet default).
// Look-back and due-soon have no fallback, the adult age is in the rule list, and the rule box is not capped at 48.
// Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS } = require('../fixtures/job34/load');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const tab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); };
const RULE_H = 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by';

test.describe('CD Hub: Compliance rules with no row are not set', () => {
  test('no look-back row: temperatures are not checked and say not set', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#tempsUnset')).toContainText('not set');
    await expect(page.locator('#compTemps [data-window]')).toHaveAttribute('data-window', 'unset');
    expect(await page.evaluate(() => compTemps().win.n)).toBe(0);
  });

  test('no due-soon row: nothing is called due soon, and the page says not set', async ({ page, guard }) => {
    put(guard.world, 'BLD-credential.csv', csv('id,tenant_id,label,area_id,sop,crucial,issuer,source', ['c-1,t,Pretend service,,,no,,']));
    put(guard.world, 'BLD-credential_version.csv', csv('id,tenant_id,credential_id,from_date,to_date,source,set_by,set_on', [`v1,t,c-1,2020-01-01,${day(5)},,,`]));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#compState li[data-cred="c-1"]')).toHaveAttribute('data-state', 'ok');
    await expect(page.locator('#stateSum li[data-k="soon"]')).toContainText('not set');
    await expect(page.locator('#compState')).not.toContainText('so 30');
  });

  test('the adult age is a rule row shown with its source; the rule box takes more than 48', async ({ page, guard }) => {
    put(guard.world, 'BLD-breeding_rule.csv', csv(RULE_H, ['b1,t,dog.adult_from_months,6,2010-01-01,Pretend law,,,']));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const row = page.locator('#compRules tr[data-rule="dog.adult_from_months"]');
    await expect(row).toContainText('6');
    await expect(row).toContainText('Pretend law');
    await expect(page.locator('#brKey option[value="dog.adult_from_months"]')).toHaveCount(1);
    expect(Number(await page.locator('#brVal').getAttribute('max'))).toBeGreaterThanOrEqual(366);
  });
});

test.describe('CD Hub: estimated mating date uses the gestation row', () => {
  test('no due-days row: a litter with no mating row is not checked and says not set', async ({ page, guard }) => {
    put(guard.world, 'BLD-breeding_rule.csv', csv(RULE_H, ['b1,t,min_dam_age_months,12,2010-01-01,Pretend law,,,']));
    await HUBS.cdhub.open(page, guard);
    const r = await page.evaluate(() => {
      T['BLD-subject.csv'] = [{ id: 'd-1', dob: '2024-01-01' }];
      CD.litters = [{ id: 'l-1', dam_subject_id: 'd-1', dob: '2024-12-01' }];
      const da = damAgeBreaches(); return { n: da.length, unest: da.unest, est: estMated('2024-12-01') };
    });
    expect(r).toEqual({ n: 0, unest: 1, est: null });
  });

  test('due-days row: mating estimated as birth minus the row in force on the mating date', async ({ page, guard }) => {
    put(guard.world, 'BLD-breeding_rule.csv', csv(RULE_H, [
      'b1,t,min_dam_age_months,12,2010-01-01,Pretend law,,,',
      'g1,t,gestation.due_days,63,2010-01-01,Pretend vet,,,',
      'g2,t,gestation.due_days,60,2024-10-01,Pretend vet,,,']));
    await HUBS.cdhub.open(page, guard);
    const r = await page.evaluate(() => {
      T['BLD-subject.csv'] = [{ id: 'd-1', dob: '2024-01-01' }];
      CD.litters = [{ id: 'l-1', dam_subject_id: 'd-1', dob: '2024-12-01' }];
      const da = damAgeBreaches();
      return { n: da.length, on: da[0] && da[0].on, est: da[0] && da[0].est, unest: da.unest, old: estMated('2020-06-01') };
    });
    expect(r).toEqual({ n: 1, on: '2024-10-02', est: true, unest: 0, old: '2020-03-30' });
  });
});

test.describe('CD Hub: Compliance links and findings', () => {
  test('"set it" opens the rule box with that rule chosen and the cursor in the number', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await page.evaluate(() => { const d = document.querySelector('#compAdd details'); if (d) d.open = false; });
    await page.locator('#tempsUnset [data-change-window]').click();
    await expect(page.locator('#compAdd details')).toHaveAttribute('open', '');
    await expect(page.locator('#brKey')).toHaveValue('compliance.look_back_days');
    await expect(page.locator('#brVal')).toBeFocused();
  });

  test('a finding shows in full with its dog link, not folded into an (i)', async ({ page, guard }) => {
    put(guard.world, 'BLD-breeding_rule.csv', csv(RULE_H, [
      'b1,t,min_dam_age_months,12,2010-01-01,Pretend law,,,', 'g1,t,gestation.due_days,63,2010-01-01,Pretend vet,,,']));
    const lit = require('fs').readFileSync(require('path').join(__dirname, '../fixtures/bld/BLD-litter.csv'), 'utf8').replace(/\s*$/, '');
    put(guard.world, 'BLD-litter.csv', lit + '\r\nlit-x,sub-test-dog-1,sub-test-dog-2,2022-12-01,invented\r\n');
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const p = page.locator('#compProblems ul.notes li');
    await expect(p).toContainText('Mated too young');
    await expect(p).toContainText('estimated from the litter');
    await expect(p.locator('a[data-dog-link]')).toBeVisible();
  });
});
