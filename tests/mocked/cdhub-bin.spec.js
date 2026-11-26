const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');

const RULES = [
  'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date,end_reason',
  'r-1,ten-x,pretend.old_rule,5,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,2021-03-02,Replaced by r-2',
  'r-2,ten-x,pretend.old_rule,6,2021-03-03,Pretend,,2021-03-03T00:00:00Z,sc-aaaaaa,2024-05-06,',
  'r-3,ten-x,pretend.live_rule,7,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,,',
  'r-4,ten-x,pretend.future_end,8,2020-01-01,Pretend,,2020-01-01T00:00:00Z,sc-aaaaaa,2099-01-01,',
].join('\n') + '\n';
const FV = 'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason\nfv-1,ten-x,area,*,aud-staff,yes,,,test,2026-10-16,every row\n';
const CODES = 'id,tenant_id,code_id,who,role,from_date,to_date,ended_by\ncr-1,ten-x,sc-aaaaaa,Test Person,STAFF,2026-10-01,,\ncr-2,ten-x,sc-bbbbbb,Old Helper,STAFF,2026-01-01,2026-06-30,Test User\n';
const LINKS = 'id,tenant_id,from_table,from_id,role,to_table,to_id,from_date,to_date,end_reason\n'
  + 'lk-live,ten-x,subject,dog-1,gallery,files,fil-live,2026-01-01,,\n'
  + 'lk-end,ten-x,subject,dog-1,gallery,files,fil-end,2026-01-01,2026-02-01,Removed from gallery\n';

const setTable = (d, id, name, content) => {
  const f = d.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else d.file(id, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};

function world({ user = true } = {}) {
  const d = buildWorld();
  setTable(d, 'bin-rules', 'BLD-breeding_rule.csv', RULES);
  setTable(d, 'bin-links', 'BLD-links.csv', LINKS);
  if (!user) return d;
  setTable(d, 'bin-fv', 'BLD-field_visibility.csv', FV);
  setTable(d, 'bin-codes', 'BLD-code_register.csv', CODES);
  return d;
}
const asUser = base.extend({ world: async ({}, use) => use(world()) });
const asOther = base.extend({ world: async ({}, use) => use(world({ user: false })) });

const open = async (page) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

const noBin = async (page) => {
  await expect(page.locator('[data-go="bin"], #binPage, [data-bin-kind], [data-bin-row], #binDrive')).toHaveCount(0);
  const menus = await page.locator('#nav, #chips').evaluateAll((els) => els.map((el) => el.textContent || '').join('\n'));
  expect(menus).not.toMatch(/\bBin\b/);
  const names = await page.locator('a, button').evaluateAll((els) => els.map((el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim()));
  expect(names.filter((n) => n === 'Bin' || n === 'Drive Bin (files)')).toEqual([]);
};

base('the hub no longer ships a Bin page', () => {
  const root = path.resolve(__dirname, '..', '..');
  expect(fs.existsSync(path.join(root, 'cdhub', 'bin-view.js'))).toBe(false);
  const index = fs.readFileSync(path.join(root, 'cdhub', 'index.html'), 'utf8');
  const nav = fs.readFileSync(path.join(root, 'cdhub', 'hub-nav.js'), 'utf8');
  expect(index).not.toContain('bin-view.js');
  expect(index).not.toContain('data-go="bin"');
  expect(nav).not.toContain("label: 'Bin'");
  expect(nav).not.toMatch(/views:\s*\[[^\]]*'bin'/);
});

asOther('not the user: #/bin opens Main, and there is no Bin button', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { location.hash = '#/bin'; });
  await expect(page).toHaveURL(/#\/map$/);
  await expect(page.locator('#main')).toHaveAttribute('data-view', 'map');
  await noBin(page);
});

asUser.describe('user: Bin is gone', () => {
  asUser('#/bin opens Settings, with no Bin chip, button or empty tab', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { location.hash = '#/dogs'; });
    await expect(page).toHaveURL(/#\/dogs$/);
    await page.evaluate(() => { location.hash = '#/bin'; });
    await expect(page).toHaveURL(/#\/admin$/);
    await expect(page.locator('#main')).toHaveAttribute('data-view', 'admin');
    await expect(page.locator('#main h2')).toContainText('Settings');
    await expect(page.locator('#chips').getByText('Bin')).toHaveCount(0);
    await expect(page.locator('#nav [data-go="admin"]')).toHaveAttribute('aria-current', 'page');
    await noBin(page);
    await page.goBack();
    await expect(page).toHaveURL(/#\/dogs$/);
    await expect(page.locator('#main')).toHaveAttribute('data-view', 'dogs');
    await noBin(page);
  });

  asUser('#/bin/extra opens Settings too', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { location.hash = '#/bin/extra'; });
    await expect(page).toHaveURL(/#\/admin$/);
    await expect(page.locator('#main h2')).toContainText('Settings');
    await noBin(page);
  });

  asUser('ended rows from the old Bin do not show on the working pages', async ({ page }) => {
    await open(page);
    for (const id of ['map', 'today', 'dogs', 'areas', 'round', 'work', 'admin', 'compliance']) {
      await page.evaluate((h) => { location.hash = h; }, '#/' + id);
      await expect(page.locator('#main')).toHaveAttribute('data-view', id);
      const main = page.locator('#main');
      await expect(main).not.toContainText('Old Helper');
      await expect(main).not.toContainText('pretend.old_rule');
      await expect(main).not.toContainText('Replaced by r-2');
      await expect(main).not.toContainText('fil-end');
      await expect(main).not.toContainText('Removed from gallery');
      await noBin(page);
    }
  });
});

