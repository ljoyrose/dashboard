// Inspector links in the hub More menu, and the inspector page's own files.
// Invented addresses only. No fixed host.
const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const ROOT = path.resolve(__dirname, '..', '..');
const SAVE = 'https://script.google.com/macros/s/SAMPLE-fake-address/exec';
const SECTION = SAVE + '?page=approve&section=inspect';
// Files the inspector page needs from this site, from the site root. A sign-in bypass can cover only these.
const PUBLIC = [
  '/cdhub/staff/inspect/',
  '/cdhub/staff/inspect/index.html',
  '/cdhub/staff/inspect/inspect.css',
  '/cdhub/staff/inspect/inspect.js',
  '/cdhub/staff/look.js',
  '/cdhub/staff/staff.css',
  '/cdhub/staff/lib/bld-save.css',
  '/cdhub/staff/lib/bld-save.js',
  '/cdhub/staff/lib/viewer-levels.js',
  '/house.css',
  '/tokens.css',
];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function refs(html) {
  return [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
}
function cssUrls(text) {
  return [...text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:') && !u.startsWith('#'));
}

function ownerWorld() {
  const d = buildWorld();
  d.file('adm-fv', 'BLD-field_visibility.csv',
    'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason\nfv-t1,ten-x,area,*,aud-staff,yes,,,test,2026-10-16,rows\n',
    { parents: [IDS.bld], driveId: 'drv-alpha1' });
  return d;
}
const asOwner = base.extend({ world: async ({}, use) => use(ownerWorld()) });

async function signIn(page) {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
}

base('More shows Inspector links, and Set it up when this browser has no save address', async ({ page }) => {
  await signIn(page);
  await page.locator('#nav [data-house-more]').click();
  const item = page.locator('#houseMore [data-inspect-links]');
  await expect(item).toBeVisible();
  await expect(item).toContainText('Inspector links');
  await expect(item).toContainText('No save address in this browser.');
  await expect(item.locator('a')).toHaveAttribute('href', '#/round');
  await item.getByRole('link', { name: 'Set it up' }).click();
  await expect(page).toHaveURL(/#\/round$/);
  await expect(page.locator('#main h2').first()).toHaveText('The round');
});

asOwner('More opens the same owner-page section as the Settings card', async ({ page }) => {
  await signIn(page);
  await page.evaluate((u) => { localStorage.setItem('cdhub.sink.url', u); go('map', false); }, SAVE);
  await page.locator('#nav [data-house-more]').click();
  const more = page.locator('#houseMore a[data-inspect-links]');
  await expect(more).toHaveText('Inspector links');
  await expect(more).toHaveAttribute('href', SECTION);
  await expect(more).toHaveAttribute('target', '_blank');
  await expect(more).not.toContainText('Set it up');
  await tabClick(page, '#nav button[data-go="admin"]');
  await expect(page.locator('[data-adm-open="inspect"] span').first()).toHaveText('Inspector links');
  await page.locator('[data-adm-open="inspect"]').click();
  await expect(page.locator('#adm-inspect a.btn', { hasText: 'Make or end a link' })).toHaveAttribute('href', SECTION);
});

base('the inspector page and every file it loads are relative to the page', () => {
  const html = read('cdhub/staff/inspect/index.html');
  const local = refs(html).filter((u) => !/^https?:/i.test(u));
  const external = refs(html).filter((u) => /^https?:/i.test(u));
  expect(external).toEqual(['https://fonts.googleapis.com/css2?family=Lexend:wght@400;600&display=swap']);
  const fromRoot = local.map((u) => new URL(u, 'http://host/cdhub/staff/inspect/').pathname);
  const fromPrefix = local.map((u) => new URL(u, 'http://host/dashboard/cdhub/staff/inspect/').pathname);
  expect(fromPrefix).toEqual(fromRoot.map((p) => '/dashboard' + p));
  for (const p of fromRoot) {
    const file = path.join(ROOT, p.slice(1));
    expect(fs.existsSync(file), p).toBe(true);
    expect(cssUrls(read(p.slice(1))), p).toEqual([]);
  }
  expect(['/cdhub/staff/inspect/', '/cdhub/staff/inspect/index.html'].concat(fromRoot).sort()).toEqual(PUBLIC.slice().sort());
  for (const rel of ['cdhub/admin.js', 'cdhub/staff/print/print.js', 'cdhub/hub-nav.js', 'cdhub/staff/inspect/index.html', 'cdhub/staff/inspect/inspect.js']) {
    expect(read(rel), rel).not.toMatch(/github\.io/);
  }
  const approve = read('cdhub-write/apps-script/ApprovePage.html');
  expect(approve).toContain('id="inspect"');
  expect(approve).toContain("section==='inspect'");
  expect(read('cdhub/index.html')).toContain("?page=approve&section=inspect");
});

base.describe('inspector page on this host', () => {
  base.use({ allowedConsole: [/favicon\.ico/] });
  base('assets load from the page address, with no fixed host', async ({ page }) => {
    const bad = [];
    page.on('response', (res) => {
      const u = new URL(res.url());
      if (/github\.io/.test(u.hostname)) bad.push(res.url());
      if (u.hostname === '127.0.0.1' && res.status() >= 400 && !/favicon\.ico$/.test(u.pathname)) bad.push(res.status() + ' ' + u.pathname);
    });
    const res = await page.goto('cdhub/staff/inspect/');
    expect(res.status()).toBe(200);
    await expect(page.locator('#screen')).toContainText('This link is not complete.');
    const attrs = await page.locator('link[href], script[src]').evaluateAll((els) => els.map((e) => e.getAttribute('src') || e.getAttribute('href')));
    const local = attrs.filter((u) => u && !/^https?:/i.test(u));
    expect(local.length).toBeGreaterThan(0);
    for (const u of local) expect(u.startsWith('/'), u).toBe(false);
    expect(attrs.join('\n')).not.toMatch(/github\.io/);
    expect(bad).toEqual([]);
  });
});
