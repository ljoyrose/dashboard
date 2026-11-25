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
  asOwner('Admin is in More; set-up QR is one tap away and names the public staff address (Lisa 18 Nov 2026)', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('#main h2')).toContainText('Settings');
    await expect(page.locator('[data-adm-open]')).toHaveCount(13);   // Check settings added (photo dates setting was 12)
    await expect(page.locator('[data-adm-open]').first()).toHaveAttribute('data-adm-open', 'codes');
    await page.evaluate(() => { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/SAMPLE-fake-address/exec'); go('admin', false); });
    await page.locator('[data-adm-open="phone"]').click();
    const staff = await page.evaluate(() => location.origin + location.pathname.replace(/[^/]*$/, '') + 'staff/');
    await expect(page.locator('#adm-phone')).toContainText(new URL(page.url()).host);
    await expect(page.locator('#adm-phone')).not.toContainText('github.io');
    await page.locator('[data-adm-qr]').click();
    await expect(page.locator('.adm-qr svg')).toBeVisible();
    const held = await page.evaluate(() => { const b = BLDQr.svg; let t = ''; BLDQr.svg = (x, l) => { t = x; return b(x, l); }; go('admin', false); return new Promise((r) => setTimeout(() => r(t), 300)); });
    expect(held.indexOf(staff + '#setup=')).toBe(0);
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
    await expect(why).toContainText('16 Oct 2026');
    await expect(why).not.toContainText('fv-t6');   // a row from a later date is not in force today
    await expect(page.locator('#admMap .adm-later')).toContainText('Website people');
  });

  asOwner('inspector links read from rows: open and ended', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('[data-adm-open="inspect"] small')).toHaveText('1 open');
    await page.locator('[data-adm-open="inspect"]').click();
    await expect(page.locator('#adm-inspect')).toContainText('Test visit');
    await expect(page.locator('#adm-inspect')).toContainText('31 Dec 2099');
    await expect(page.locator('#adm-inspect')).toContainText('ended');
  });

  asOwner('the 3-year list shows, most frequent first', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('#admFuture .adm-future tbody tr').first()).toContainText('Approve pending saves');
    await page.locator('[data-adm-future]').click();
    await expect(page.locator('#admFuture .adm-future tbody tr')).toHaveCount(62);
  });

  asOwner('Codes is first: every code by name, role and dates, ended ones kept; remind means reset', async ({ page }) => {
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('[data-adm-open="codes"] small')).toHaveText('1 live');
    await page.locator('[data-adm-open="codes"]').click();
    const c = page.locator('#adm-codes');
    await expect(c).toContainText('Test Person');
    await expect(c).toContainText('1 Oct 2026');
    await expect(c).toContainText('Old Helper');
    await expect(c).toContainText('30 Jun 2026');
    await expect(c).toContainText('ended');
    await expect(c).toContainText('Remind');
  });

  asOwner('Admin tables keep their column widths as rows load, show all and redraw (house-table)', async ({ page }) => {
    await open(page);
    await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok' && !LOAD.copy);
    await tabClick(page, '#nav button[data-go="admin"]');
    await expect(page.locator('#admFuture .adm-future tbody tr').first()).toBeVisible();
    const widths = () => page.locator('#admFuture table.house-table thead th').evaluateAll((hs) => hs.map((h) => Math.round(h.getBoundingClientRect().width)));
    const before = await widths();
    expect(before.length).toBe(3);
    await page.locator('[data-adm-future]').click();   // 8 rows to 62
    await expect(page.locator('#admFuture .adm-future tbody tr')).toHaveCount(62);
    expect(await widths()).toEqual(before);
    await page.evaluate(() => { redrawAfterRead(); });   // the redraw after the later tables land
    await expect(page.locator('#admFuture .adm-future tbody tr').first()).toBeVisible();
    expect(await widths()).toEqual(before);
    // a long row cannot push the columns about
    await page.evaluate(() => { const tb = document.querySelector('#admFuture tbody'); const tr = tb.rows[0].cloneNode(true); tr.cells[0].textContent = 'x'.repeat(300); tb.appendChild(tr); });
    expect(await widths()).toEqual(before);
    await page.locator('[data-adm-open="codes"]').click();
    await expect(page.locator('#adm-codes table.house-table td[data-label="Who"]').first()).toContainText('Test Person');
  });

  asOwner('on a phone, Admin table rows read as label / value lines', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page);
    await tabClick(page, '#nav button[data-go="admin"]');
    const row = page.locator('#admFuture .adm-future tbody tr').first();
    await expect(row).toBeVisible();
    expect(await page.locator('#admFuture thead').evaluate((e) => getComputedStyle(e).display)).toBe('none');
    expect(await row.locator('td').first().evaluate((e) => [getComputedStyle(e).display, getComputedStyle(e, '::before').content])).toEqual(['grid', '"Job"']);
    const fit = await page.locator('#admFuture .adm-future').evaluate((e) => e.scrollWidth <= e.clientWidth);
    expect(fit).toBe(true);
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

// 15 Nov 2026: Set up a phone → Show QR stuck on "Drawing…". The QR now fills its own box when the drawer loads (no
// page redraw needed), and a drawer that does not load says so instead of waiting for ever.
asOwner('Show QR draws even when the page is not redrawn', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route(/staff\/lib\/qr\.js$/, async (route) => { await gate; route.continue(); });
  await open(page);
  await tabClick(page, '#nav button[data-go="admin"]');
  await page.evaluate(() => { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/SAMPLE-fake-address/exec'); go('admin', false); });
  await page.locator('[data-adm-open="phone"]').click();
  await page.locator('[data-adm-qr]').click();
  await expect(page.locator('#adm-qr-box')).toContainText('Drawing');
  await page.evaluate(() => { const f = document.getElementById('admFuture'); if (f) f.remove(); });   // the old redraw needed this
  release();
  await expect(page.locator('#adm-qr-box .adm-qr svg')).toBeVisible();
});

asOwner('Show QR: a QR drawer that cannot load says so, and Show QR tries again', async ({ page, allowedConsole }) => {
  allowedConsole.push(/Failed to load resource|ERR_FAILED|qr\.js/);   // the drawer is made to fail on purpose
  await page.route(/staff\/lib\/qr\.js$/, (route) => route.abort());
  await open(page);
  await tabClick(page, '#nav button[data-go="admin"]');
  await page.evaluate(() => { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/SAMPLE-fake-address/exec'); go('admin', false); });
  await page.locator('[data-adm-open="phone"]').click();
  await page.locator('[data-adm-qr]').click();
  await expect(page.locator('#adm-phone')).toContainText('did not load');
  await page.unroute(/staff\/lib\/qr\.js$/);
  await page.locator('[data-adm-qr]').click();   // Hide
  await page.locator('[data-adm-qr]').click();   // Show again
  await expect(page.locator('#adm-phone .adm-qr svg')).toBeVisible();
});

// Lisa 15 Nov 2026: an always-visible link labelled exactly "Script page" opens the owner page.
asOwner('Admin always shows a "Script page" link to the owner page', async ({ page }) => {
  await open(page);
  await tabClick(page, '#nav button[data-go="admin"]');
  await page.evaluate(() => { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/SAMPLE-fake-address/exec'); go('admin', false); });
  const link = page.locator('.adm-script a', { hasText: 'Script page' });
  await expect(link).toHaveText('Script page');
  await expect(link).toHaveAttribute('href', /SAMPLE-fake-address\/exec\?page=approve$/);
});

// 15 Nov 2026: a code made on the owner page was refused by the hub's save. The owner page link now takes the save
// address in the same order as the hub's save, so both go to the same script. Invented addresses only.
asOwner('the owner page link uses the same save address as the hub save', async ({ page }) => {
  await open(page);
  await tabClick(page, '#nav button[data-go="admin"]');
  await page.evaluate(() => {
    localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/SAMPLE-hub-save/exec');
    localStorage.setItem('bld.scriptUrl', 'https://script.google.com/macros/s/SAMPLE-other/exec');
    go('admin', false);
  });
  await page.locator('[data-adm-open="codes"]').click();
  const link = page.locator('#adm-codes a.btn[href*="page=approve"]').first();
  await expect(link).toHaveAttribute('href', /SAMPLE-hub-save\/exec\?page=approve/);
  await page.evaluate(() => { localStorage.removeItem('cdhub.sink.url'); localStorage.removeItem('bld.scriptUrl'); localStorage.setItem('cdhub.save.url', 'https://script.google.com/macros/s/SAMPLE-from-drive/exec'); go('admin', false); });
  if (!(await page.locator('#adm-codes').isVisible())) await page.locator('[data-adm-open="codes"]').click();   // the card may still be open
  await expect(page.locator('#adm-codes a.btn[href*="page=approve"]').first()).toHaveAttribute('href', /SAMPLE-from-drive\/exec/);
});

// Lisa 16 Nov 2026: "it says what to do but no link". Add staff opens the owner page with a real button.
asOwner('Add staff has a Make a code button to the owner page codes section', async ({ page }) => {
  await open(page);
  await tabClick(page, '#nav button[data-go="admin"]');
  await page.evaluate(() => { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/SAMPLE-fake-address/exec'); go('admin', false); });
  await page.locator('[data-adm-open="staff"]').click();
  const link = page.locator('.adm-make a', { hasText: 'Make a code' });
  await expect(link).toHaveAttribute('href', /SAMPLE-fake-address\/exec\?page=approve&section=codes$/);
  await expect(page.locator('#adm-staff')).toContainText('name tag');
});

asOwner('Check settings shows the legal minimum and refuses a shorter keep period', async ({ page }) => {
  await open(page);
  await tabClick(page, '#nav button[data-go="admin"]');
  await page.locator('[data-adm-open="checks"]').click();
  await expect(page.locator('#adm-checks')).toContainText('How long check records are kept');
  await expect(page.locator('#adm-checks')).toContainText('Legal minimum: 6 years');
  await page.locator('#adm-checks [data-ck-years]').fill('4');
  await page.locator('#adm-checks [data-ck-keep]').click();
  await expect(page.locator('#adm-checks [data-ck-msg]')).toContainText('at least 6 years');
});
