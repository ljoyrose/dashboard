// CD Hub Admin (More -> Admin), owner-only. Lisa 12 Nov 2026. Invented rows only.
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const FV = [
  'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason',
  'fv-t1,ten-x,area,*,aud-staff,yes,,,test,2026-10-16,every row',
  'fv-t2,ten-x,area,code,aud-staff,yes,,,test,2026-10-16,room list',
  'fv-t3,ten-x,area,*,aud-guest,yes,,,test,2026-11-08,guest room list',
  'fv-t4,ten-x,area,code,aud-guest,yes,,,test,2026-11-08,guest room list',
  'fv-t5,ten-x,subject,name,aud-public,yes,,,test,2026-09-24,shop window',
  'fv-t6,ten-x,area,code,aud-staff,yes,,,test,2099-01-01,not yet in force',
].join('\n') + '\n';
const AUD = 'id,code,name,description,is_signed_in,rank,notes\naud-staff,staff,Staff,works here,yes,60,\naud-public,public,Anyone on the internet,x,no,0,\n';
const CODES = 'id,tenant_id,code_id,who,role,from_date,to_date,ended_by\ncr-1,ten-x,sc-aaaaaa,Test Person,STAFF,2026-10-01,,\ncr-2,ten-x,sc-bbbbbb,Old Helper,STAFF,2026-01-01,2026-06-30,ended by owner\n';
const LINK = 'id,tenant_id,code_id,label,ends,made_at,made_by\nil-1,ten-x,ic-1,Test visit,2099-12-31,2026-11-01,test\nil-2,ten-x,ic-2,Old visit,2020-01-01,2019-12-25,test\n';

function world({ owner = true, codes = CODES } = {}) {
  const d = buildWorld();
  if (!owner) return d;
  d.file('adm-fv', 'BLD-field_visibility.csv', FV, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  d.file('adm-aud', 'BLD-audience.csv', AUD, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  d.file('adm-codes', 'BLD-code_register.csv', codes, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  d.file('adm-link', 'BLD-inspect_link.csv', LINK, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  return d;
}
const asOwner = base.extend({ world: async ({}, use) => use(world()) });
const asOther = base.extend({ world: async ({}, use) => use(world({ owner: false })) });
const asOwnerEmpty = base.extend({ world: async ({}, use) => use(world({ codes: 'id,tenant_id,code_id,who,role,from_date,to_date,ended_by\n' })) });

const open = async (page) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

asOther.describe('CD Hub Admin: not the owner', () => {
  asOther('no Admin in More without the permission rows; Staff shows without owner links', async ({ page }) => {
    await open(page);
    await expect(page.locator('#nav button[data-go="admin"]')).toHaveCount(0);
    await tabClick(page, '#nav button[data-go="staff"]');
    await expect(page.locator('#main a.adm-card', { hasText: 'Jobs' })).toHaveAttribute('href', /staff\/#m\/jobs$/);
    await expect(page.locator('#main a.adm-card', { hasText: 'Print' })).toHaveCount(0);
  });
});

asOwner.describe('CD Hub Admin: owner', () => {
  asOwner('Admin is in More; set-up QR is one tap away and names this address', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('#main h2')).toContainText('Admin');
    await expect(page.locator('[data-adm-open]')).toHaveCount(12);
    await expect(page.locator('[data-adm-open]').first()).toHaveAttribute('data-adm-open', 'codes');
    await page.evaluate(() => { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/SAMPLE-fake-address/exec'); go('admin', false); });
    await page.locator('[data-adm-open="phone"]').click();
    await expect(page.locator('#adm-phone')).toContainText(new URL(page.url()).host);
    await page.locator('[data-adm-qr]').click();
    await expect(page.locator('.adm-qr svg')).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /code/i.test(k)).map((k) => localStorage.getItem(k)).join(''))).toBe('');
  });

  asOwner('who sees what comes from the live rows on today\'s date, with the row behind each mark', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    const map = page.locator('#admMap');
    await expect(map.locator('[data-adm-aud="aud-staff"]').first()).toHaveText('Staff');
    await expect(map.locator('[data-adm-aud="aud-guest"]').first()).toBeVisible();
    await map.locator('[data-adm-cell="area|aud-staff"]').first().click();
    const why = page.locator('#admMap .adm-why');
    await expect(why).toContainText('fv-t2');
    await expect(why).toContainText('16/10/26');
    await expect(why).not.toContainText('fv-t6');   // a row from a later date is not in force today
    await expect(page.locator('#admMap .adm-later')).toContainText('Website people');
  });

  asOwner('inspector links read from rows: open and ended', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('[data-adm-open="inspect"] small')).toHaveText('1 open');
    await page.locator('[data-adm-open="inspect"]').click();
    await expect(page.locator('#adm-inspect')).toContainText('Test visit');
    await expect(page.locator('#adm-inspect')).toContainText('31/12/99');
    await expect(page.locator('#adm-inspect')).toContainText('ended');
  });

  asOwner('the 3-year list shows, most frequent first', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('#admFuture .adm-future li').first()).toContainText('Approve pending saves');
    await page.locator('[data-adm-future]').click();
    await expect(page.locator('#admFuture .adm-future li')).toHaveCount(62);
  });

  asOwner('Codes is first: every code by name, role and dates, ended ones kept; remind means reset', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('[data-adm-open="codes"] small')).toHaveText('1 live');
    await page.locator('[data-adm-open="codes"]').click();
    const c = page.locator('#adm-codes');
    await expect(c).toContainText('Test Person');
    await expect(c).toContainText('01/10/26');
    await expect(c).toContainText('Old Helper');
    await expect(c).toContainText('30/06/26');
    await expect(c).toContainText('ended');
    await expect(c).toContainText('Remind');
  });

  asOwner('Staff in More lists every staff page; owner links open Admin on the right card', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="staff"]');
    for (const t of ['Board', 'Jobs', 'Scan', 'Temps', 'Where', 'This phone', 'Checks', 'Guest', 'Inspector', 'Print', 'Phone set-up', 'Codes']) {
      await expect(page.locator('#main a.adm-card', { hasText: t }).first()).toBeVisible();
    }
    await page.locator('#main a.adm-card', { hasText: 'Phone set-up' }).click();
    await expect(page.locator('#adm-phone')).toBeVisible();
  });
});

asOwnerEmpty('Codes: an empty register (V8 live, not yet filled) says to press Fill the code register on the owner page', async ({ page }) => {
  await open(page);
  await tabClick(page, '#nav button[data-go="admin"]');
  await expect(page.locator('[data-adm-open="codes"] small')).toHaveText('0 live');
  await page.locator('[data-adm-open="codes"]').click();
  await expect(page.locator('#adm-codes')).toContainText('Fill the code register');
});
