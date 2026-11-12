// Compliance mock-up gaps (7 Nov 2026): findings with recurrence. Invented rows only.
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
const FIND_H = 'id,tenant_id,inspection_id,declaration_id,outcome_id,authority,raised_on,wording_as_given,finding_kind,tenant_response,action_agreed,due_on,closed_on,evidence_document_id,notes';
const OUT_H = 'id,tenant_id,species_id,code,text,domain,origin,is_law,source_hint,active,notes';
const INSP_H = 'id,tenant_id,kind,authority,inspection_date,outcome_summary,visibility,source';

test.describe('CD Hub: Compliance findings', () => {
  test('open findings show who, when, level and recurrence; closed and private ones do not', async ({ page, guard }) => {
    put(guard.world, 'BLD-outcome.csv', csv(OUT_H, ['out-a,t,,A,Pretend requirement A,,,,,yes,', 'out-b,t,,B,Pretend requirement B,,,,,yes,']));
    put(guard.world, 'BLD-inspection.csv', csv(INSP_H, ['in-ext,t,external,Pretend council,2026-03-01,,disclosable,', 'in-int,t,internal,,2026-04-01,,private,']));
    put(guard.world, 'BLD-finding.csv', csv(FIND_H, [
      'f1,t,in-ext,,out-a,Pretend council,2026-01-10,Pretend wording one,Pretend major,,,2026-02-01,2026-02-01,,',
      'f2,t,in-ext,,out-a,Pretend council,2026-03-01,Pretend wording two,Pretend major,,Pretend second thermometer,2099-01-01,,,',
      'f3,t,in-ext,,out-b,Pretend council,2026-03-01,Pretend wording three,Pretend minor,,,2026-03-15,,,',
      'f4,t,in-int,,out-b,,2026-04-01,Pretend private note,,,,,,,'
    ]));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const li = page.locator('#findList > li');
    await expect(li).toHaveCount(2);
    await expect(page.locator('#compFindings summary .cnt')).toHaveText('2');
    // best to worst: the one not late first, the late one last
    await expect(li.nth(0)).toHaveAttribute('data-finding', 'f2');
    await expect(li.nth(0)).toContainText('Pretend requirement A');
    await expect(li.nth(0)).toContainText('Pretend major');
    await expect(li.nth(0)).toContainText('Pretend second thermometer');
    await expect(li.nth(0).locator('[data-k="recur"]')).toContainText('Found 2 times: 10/01/26, 01/03/26');
    await expect(li.nth(1)).toHaveAttribute('data-finding', 'f3');
    await expect(li.nth(1).locator('.dpill.late')).toContainText('15/03/26');
    await expect(li.nth(1).locator('[data-k="recur"]')).toHaveText('First time');
    await expect(page.locator('#compFindings')).not.toContainText('Pretend private note');
    await expect(page.locator('#compFindings')).toContainText('1 closed.');
  });

  test('no finding rows: says so', async ({ page, guard }) => {
    put(guard.world, 'BLD-finding.csv', FIND_H + '\r\n');
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#compFindings')).toContainText('No open findings');
  });
});
