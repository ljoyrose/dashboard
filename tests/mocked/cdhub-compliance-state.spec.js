// Compliance mock-up gaps (7 Nov 2026): requirements state, inspections, "What was true on". Invented rows only.
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
const CRED_H = 'id,tenant_id,label,area_id,sop,crucial,issuer,source';
const VER_H = 'id,tenant_id,credential_id,from_date,to_date,source,set_by,set_on';
const INSP_H = 'id,tenant_id,kind,authority,inspection_date,outcome_summary,visibility,source';

test.describe('CD Hub: Compliance requirements, inspections, as at', () => {
  test('no tables yet: each part says it is not set up', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#stateOff')).toBeVisible();
    await expect(page.locator('#inspOff')).toBeVisible();
  });

  test('requirements: in date, due soon, not stated, overdue; blank expiry never shows a date (H-07)', async ({ page, guard }) => {
    put(guard.world, 'BLD-credential.csv', csv(CRED_H, [
      'c-ok,t,Pretend licence,,,no,Pretend council,Pretend source',
      'c-soon,t,Pretend service,,,no,,',
      'c-none,t,Pretend lamp test,,,no,,',
      'c-late,t,Pretend extinguisher,,Pretend SOP,yes,,',
      'c-miss,t,Pretend never done,,,no,,'
    ]));
    put(guard.world, 'BLD-credential_version.csv', csv(VER_H, [
      `v1,t,c-ok,2020-01-01,${day(400)},Pretend cert,,`,
      `v2,t,c-soon,2020-01-01,${day(5)},,,`,
      'v3,t,c-none,2020-01-01,,,,',
      'v4,t,c-late,2020-01-01,2020-12-31,,,'
    ]));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const st = (id) => page.locator(`#compState li[data-cred="${id}"]`);
    await expect(st('c-ok')).toHaveAttribute('data-state', 'ok');
    await expect(st('c-soon')).toHaveAttribute('data-state', 'soon');
    await expect(st('c-none')).toHaveAttribute('data-state', 'none');
    await expect(st('c-none')).toContainText('Expiry not stated');
    await expect(st('c-none').locator('.dpill')).toHaveCount(0);
    await expect(st('c-late')).toHaveAttribute('data-state', 'late');
    await expect(st('c-miss')).toContainText('No record');
    await expect(page.locator('#stateSum li[data-k="late"] .pill')).toHaveText('2');
    await expect(page.locator('#compState')).toContainText('1 of 5 in date (20%)');
    await expect(page.locator('#compState')).toContainText('not set yet, so 30');
    // best to worst inside a place
    const order = await page.locator('#compState li[data-cred]').evaluateAll((ls) => ls.map((l) => l.dataset.state));
    expect(order).toEqual(['ok', 'soon', 'none', 'late', 'late']);
    // a crucial overdue requirement is Urgent
    await expect(page.locator('#urgList li[data-k="cred"]')).toContainText('Pretend extinguisher is overdue');
  });

  test('inspections: external and internal apart, internal Private, never in the figure (H-03)', async ({ page, guard }) => {
    put(guard.world, 'BLD-credential.csv', csv(CRED_H, ['c-ok,t,Pretend licence,,,no,,']));
    put(guard.world, 'BLD-credential_version.csv', csv(VER_H, [`v1,t,c-ok,2020-01-01,${day(400)},,,`]));
    put(guard.world, 'BLD-inspection.csv', csv(INSP_H, ['i1,t,external,Pretend council,2026-03-01,Pretend passed,disclosable,', 'i2,t,internal,,2026-04-01,,private,']));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#inspExt li')).toHaveCount(1);
    await expect(page.locator('#inspExt li')).toContainText('Pretend council');
    await expect(page.locator('#inspInt li .pill')).toHaveText('Private');
    await expect(page.locator('#compState')).toContainText('1 of 1 in date (100%)');
  });

  test('What was true on: an earlier date shows the version in force then', async ({ page, guard }) => {
    put(guard.world, 'BLD-credential.csv', csv(CRED_H, ['c1,t,Pretend service,,,no,,']));
    put(guard.world, 'BLD-credential_version.csv', csv(VER_H, ['v1,t,c1,2020-01-01,2020-12-31,Pretend old,,', `v2,t,c1,2021-01-01,${day(400)},Pretend new,,`]));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#compState li[data-cred="c1"]')).toHaveAttribute('data-state', 'ok');
    await page.locator('#compAsAt').fill('2020-06-30');
    await page.locator('#compAsAt').dispatchEvent('change');
    await expect(page.locator('#asAtNote')).toContainText('30/06/20');
    await expect(page.locator('#compState li[data-cred="c1"]')).toHaveAttribute('data-state', 'ok');
    await expect(page.locator('#compState li[data-cred="c1"]')).toContainText('31/12/20');
    await page.locator('#compAsAt').fill('2020-12-31');
    await page.locator('#compAsAt').dispatchEvent('change');
    await expect(page.locator('#compState li[data-cred="c1"]')).toHaveAttribute('data-state', 'soon');
    await page.locator('#compAsAtToday').click();
    await expect(page.locator('#asAtNote')).toHaveCount(0);
  });
});
