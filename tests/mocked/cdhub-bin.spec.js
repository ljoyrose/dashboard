// CD Hub Bin (Settings -> Bin), owner only, read only. OV11 for Lisa, 15 Nov 2026. Invented rows only.
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const FV = 'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason\nfv-1,ten-x,area,*,aud-staff,yes,,,test,2026-10-16,every row\n';
const RULES = [
  'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date,end_reason',
  'r-1,ten-x,pretend.old_rule,5,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,2021-03-02,Replaced by r-2',
  'r-2,ten-x,pretend.old_rule,6,2021-03-03,Pretend,,2021-03-03T00:00:00Z,sc-aaaaaa,2024-05-06,',
  'r-3,ten-x,pretend.live_rule,7,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,,',
  'r-4,ten-x,pretend.future_end,8,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,2099-01-01,',
].join('\n') + '\n';
const CODES = 'id,tenant_id,code_id,who,role,from_date,to_date,ended_by\ncr-1,ten-x,sc-aaaaaa,Test Person,STAFF,2026-10-01,,\ncr-2,ten-x,sc-bbbbbb,Old Helper,STAFF,2026-01-01,2026-06-30,Test Owner\n';

function world({ owner = true } = {}) {
  const d = buildWorld();
  d.file('bin-rules', 'BLD-breeding_rule.csv', RULES, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  if (!owner) return d;
  d.file('bin-fv', 'BLD-field_visibility.csv', FV, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  d.file('bin-codes', 'BLD-code_register.csv', CODES, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  return d;
}
const asOwner = base.extend({ world: async ({}, use) => use(world()) });
const asOther = base.extend({ world: async ({}, use) => use(world({ owner: false })) });

const open = async (page) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

asOther.describe('CD Hub Bin: not the owner', () => {
  asOther('no Bin without the owner rows', async ({ page }) => {
    await open(page);
    await expect(page.locator('#nav button[data-go="bin"]')).toHaveCount(0);
  });
});

asOwner.describe('CD Hub Bin: owner', () => {
  asOwner('ended rows grouped by kind, newest first, with when, who and why; live and future-ended rows stay out', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="bin"]');
    const bin = page.locator('#binPage');
    await expect(bin.locator('h2')).toHaveText('Bin');
    const kinds = bin.locator('[data-bin-kind]');
    await expect(kinds).toHaveCount(2);
    await expect(kinds.nth(0)).toHaveAttribute('data-bin-kind', 'Code register');   // ended 2026, newer than the rules
    await expect(kinds.nth(0)).toContainText('Old Helper');
    await expect(kinds.nth(0)).toContainText('Ended 30 Jun 2026 · by Test Owner');
    const rules = bin.locator('[data-bin-kind="Breeding rule"] [data-bin-row]');
    await expect(rules).toHaveCount(2);
    await expect(rules.nth(0)).toContainText('pretend.old_rule = 6');
    await expect(rules.nth(0)).toContainText('Ended 6 May 2024');
    await expect(rules.nth(1)).toContainText('Ended 2 Mar 2021 · by sc-aaaaaa · Replaced by r-2');
    await expect(bin).not.toContainText('pretend.live_rule');
    await expect(bin).not.toContainText('pretend.future_end');
    await expect(bin).not.toContainText('Test Person');
    await expect(page.locator('#binDrive')).toHaveAttribute('href', '../index.html#/bin');
  });

  asOwner('find narrows the list and keeps focus', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="bin"]');
    const q = page.locator('#binQ');
    await q.fill('helper');
    await expect(q).toBeFocused();
    await expect(page.locator('#binCount')).toHaveText('1');
    await expect(page.locator('[data-bin-kind="Breeding rule"]')).toBeHidden();
    await q.fill('nothing like this');
    await expect(page.locator('#binNoMatch')).toBeVisible();
    await q.fill('');
    await expect(page.locator('#binCount')).toHaveText('3');
  });
});
