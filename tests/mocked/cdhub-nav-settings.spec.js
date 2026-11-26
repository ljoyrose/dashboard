const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const FV = 'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason\nfv-t1,ten-x,area,*,aud-staff,yes,,,test,2026-10-16,every row\n';
const AUD = 'id,code,name,description,is_signed_in,rank,notes\naud-staff,staff,Staff,works here,yes,60,\n';
function world() {
  const d = buildWorld();
  d.file('adm-fv', 'BLD-field_visibility.csv', FV, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  d.file('adm-aud', 'BLD-audience.csv', AUD, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  return d;
}
const asUser = base.extend({ world: async ({}, use) => use(world()) });
const URL_ = 'https://script.google.com/macros/s/AKfyTEST_only_123/exec';

const open = async (page, sent) => {
  await page.addInitScript((u) => { try { localStorage.setItem('cdhub.sink.url', u); localStorage.setItem('cdhub.sink.code', 'test-code-1'); } catch (e) {} }, URL_);
  let n = 0;
  await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', table: b.table, id: 'brl-nav-' + (++n), at: '2026-11-15T10:00:00Z' } }) });
  });
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await tabClick(page, '#nav button[data-go="admin"]');
  await expect(page.locator('#navMenu')).toBeVisible();
};

asUser.describe('CD Hub Settings: Menu', () => {
  asUser('no rows: the starting layout, said so; Sales on the bar instead of People saves the whole bar and changes it', async ({ page }) => {
    const sent = [];
    await open(page, sent);
    await expect(page.locator('#navMenu')).toContainText('Starting layout, not set.');
    await expect(page.locator('#navTab-compliance')).toHaveValue('1');
    await expect(page.locator('#navTab-people')).toHaveValue('3');
    await page.locator('#navTab-people').selectOption('0');
    await page.locator('#navTab-sales').selectOption('3');
    await page.locator('#navSave').click();
    await expect(page.locator('#navMsg')).toContainText('Saved');
    const rows = sent.filter((b) => b.table === 'breeding_rule').map((b) => [b.fields.rule_key, b.fields.value]);
    expect(rows).toEqual(expect.arrayContaining([['nav.tab.USER.compliance', '1'], ['nav.tab.USER.ops', '2'], ['nav.tab.USER.sales', '3'], ['nav.tab.USER.people', '0']]));
    expect(rows.every(([k]) => /^nav\.(on|tab\.USER)\./.test(k))).toBe(true);
    await expect(page.locator('#nav > [data-section]')).toHaveCount(4);   // Main + 3
    await expect(page.locator('#nav > [data-section="sales"]')).toBeVisible();
    await expect(page.locator('#nav > [data-section="people"]')).toHaveCount(0);
    await expect(page.locator('#navMenu')).toContainText('Your menu');
  });

  asUser('a section on the bar but switched off, or two in one place, is refused and nothing is sent', async ({ page }) => {
    const sent = [];
    await open(page, sent);
    await page.locator('#navOn-ops').uncheck();
    await page.locator('#navSave').click();
    await expect(page.locator('#navMsg')).toHaveText('Records is on the bar but switched off.');
    await page.locator('#navOn-ops').check();
    await page.locator('#navTab-sales').selectOption('1');
    await page.locator('#navSave').click();
    await expect(page.locator('#navMsg')).toHaveText('Two sections share place 1.');
    expect(sent).toHaveLength(0);
  });
});

