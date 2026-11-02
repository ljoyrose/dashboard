// Stage 2b: one Drives tab with one pill row (Shared drives · Work My Drive · Personal Drive · Drive check),
// old addresses redirect, one purpose line per page, look-only Drives pages, and a second look-only sign-in
// for Personal Drive that never touches the work sign-in.
const { test, expect } = require('../support/test');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PILLS = [
  ['Shared drives', 'drives/shared', 'drive'],
  ['Work My Drive', 'drives/work', 'personal'],
  ['Personal Drive', 'drives/personal-drive', 'pdrive'],
  ['Drive check', 'drives/usb', 'usb'],
];
const PERSONAL_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Drives: tab, pills and purpose lines', () => {
  test('the Drives tab opens the landing page with the pill row and one purpose line', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await page.locator('#mainNav a[data-nav="drives"]').click();
    await expect(page).toHaveURL(/#\/drives$/);
    await expect(page.locator('#hereTitle')).toHaveText('Drives');
    await expect(page.locator('#mainNav a[data-nav="drives"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view nav.subnav a')).toHaveText(PILLS.map((p) => p[0]));
    await expect(page.locator('#view [data-purpose]')).toHaveCount(1);
    await expect(page.locator('#view [data-purpose]')).toHaveText("See what's where, spot what changed, and send anything to tidy to Bin.");
    await expect(page.locator('#view [data-readfirst-pin] a')).toHaveAttribute('href', '#/drives/readfirst');
  });

  for (const [label, route, view] of PILLS) {
    test(`the "${label}" pill is marked current, lights the Drives tab and shows one purpose line`, async ({ page }) => {
      await page.goto('./#/drives');
      await signIn(page);
      await page.locator('#view nav.subnav a', { hasText: new RegExp(`^${label}$`) }).click();
      await expect(page).toHaveURL(new RegExp(`#/${route}$`));
      await expect(page.locator('#view')).toHaveAttribute('data-view', view);
      const current = page.locator('#view nav.subnav a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(label);
      await expect(page.locator('#mainNav a[data-nav="drives"]')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#view [data-purpose]')).toHaveCount(1);
      await expect(page.locator('#view [data-purpose]')).not.toBeEmpty();
    });
  }

  test('Read first (pinned in Shared drives) keeps Shared drives current and shows one purpose line', async ({ page }) => {
    await page.goto('./#/drives/readfirst');
    await signIn(page);
    await expect(page.locator('#hereTitle')).toHaveText('Read first');
    await expect(page.locator('#view nav.subnav a[aria-current="page"]')).toHaveText('Shared drives');
    await expect(page.locator('#view [data-purpose]')).toHaveCount(1);
  });

  for (const [old, now, title] of [
    ['#/drive', '#/drives/shared', 'Shared drives'],
    ['#/drive/drv-alpha1', '#/drives/shared/drv-alpha1', 'Shared drives · Test Drive Alpha'],
    ['#/readfirst', '#/drives/readfirst', 'Read first'],
    ['#/personal', '#/drives/work', 'Work My Drive'],
    ['#/usb', '#/drives/usb', 'Drive check'],
  ]) {
    test(`the old address ${old} lands on ${now}`, async ({ page }) => {
      await page.goto('./' + old);
      await signIn(page);
      await expect(page).toHaveURL(new RegExp(now.replace(/[/#]/g, (c) => '\\' + c) + '$'));
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(page.locator('#mainNav a[data-nav="drives"]')).toHaveAttribute('aria-current', 'page');
    });
  }

  for (const route of ['drives/work', 'drives/personal-drive']) {
    test(`#/${route} is look-only: no rename, move or bin buttons`, async ({ page }) => {
      await page.goto('./#/' + route);
      await signIn(page);
      const view = page.locator('#view');
      await expect(view.locator('[data-purpose]')).toHaveCount(1);
      for (const a of ['pcpmark', 'pcpbin', 'selectall', 'clearpick', 'sweep', 'usbmark']) await expect(view.locator(`[data-action="${a}"]`)).toHaveCount(0);
      await expect(view.locator('.btn.danger')).toHaveCount(0);
      await expect(view.locator('input[type="checkbox"]')).toHaveCount(0);
    });
  }

  test('Work My Drive scan lists its exact copies and says how many are ready in Bin; Bin holds the rename and bin steps', async ({ page, guard }) => {
    const w = guard.world;
    w.file('sh-a', 'invoice-a.pdf', 'x', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/pdf', md5Checksum: 'md5-aaa', size: 100 });
    w.byId('sh-a').mine = false;
    w.file('me-a', 'invoice-a.pdf', 'x', { parents: ['my-root'], driveId: null, mimeType: 'application/pdf', md5Checksum: 'md5-aaa', size: 100 });
    await page.goto('./#/drives/work');
    await signIn(page);
    await page.locator('[data-action="pcpscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
    await expect(page.locator('[data-pcp-list="work"]')).toContainText('invoice-a.pdf');
    await expect(page.locator('[data-pcp-inbin]')).toContainText('ready in Bin');
    await page.locator('#mainNav a[data-nav="bin"]').click();
    // Stage 5: the rename step sits at the end of Ready to bin, next to the one Bin these button.
    await expect(page.locator('#sweepCard [data-bin-list="pcp-rename"]')).toContainText('invoice-a.pdf');
    await expect(page.locator('#sweepCard [data-action="pcpmark"]')).toHaveCount(1);
    await expect(page.locator('#sweepCard [data-action="sweep"]')).toHaveCount(1);
    expect(w.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });
});

test.describe('Personal Drive: a second, look-only sign-in', () => {
  test('asks for its own sign-in only when the page is opened and the button pressed', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const before = await page.evaluate(() => window.__GIS_CALLS.request);
    await page.locator('#mainNav a[data-nav="drives"]').click();
    await page.locator('#view nav.subnav a', { hasText: /^Personal Drive$/ }).click();
    await expect(page.locator('#view [data-action="psignin"]')).toBeVisible();
    await expect(page.locator('#view [data-action="pcpscan"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__GIS_CALLS.request)).toBe(before); // opening the page asks nothing
    await page.locator('#view [data-action="psignin"]').click();
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBe(before + 1);
    expect(await page.evaluate(() => window.__GIS_LAST_CONFIG.scope)).toBe(PERSONAL_SCOPE);
    expect(await page.evaluate(() => window.__GIS_LAST_REQUEST.prompt)).toBe('select_account');
    await expect(page.locator('#view [data-action="pcpscan"][data-slot="personal"]')).toBeVisible();
  });

  test('the work sign-in is untouched, the personal token is never stored and never used for work calls', async ({ page, guard }) => {
    const w = guard.world;
    w.file('sh-a', 'invoice-a.pdf', 'x', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/pdf', md5Checksum: 'md5-aaa', size: 100 });
    w.byId('sh-a').mine = false;
    w.file('me-a', 'invoice-a.pdf', 'x', { parents: ['my-root'], driveId: null, mimeType: 'application/pdf', md5Checksum: 'md5-aaa', size: 100 });
    await page.goto('./#/drives/personal-drive');
    await signIn(page);
    const workBefore = await page.evaluate(() => localStorage.getItem('ljr-dash-auth'));
    await page.locator('#view [data-action="psignin"]').click();
    await page.locator('#view [data-action="pcpscan"][data-slot="personal"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
    await expect(page.locator('[data-pcp-list="personal"]')).toContainText('invoice-a.pdf');
    // The work sign-in is the same one, and the personal token is in no storage at all.
    expect(await page.evaluate(() => localStorage.getItem('ljr-dash-auth'))).toBe(workBefore);
    const stored = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)) + document.cookie);
    expect(stored).not.toContain('FAKE-PERSONAL-TOKEN');
    // Personal token: only reads of the personal My Drive list. Shared drives and everything else: the work token.
    const personal = w.calls.filter((c) => c.auth === 'Bearer FAKE-PERSONAL-TOKEN');
    expect(personal.length).toBeGreaterThan(0);
    for (const c of personal) {
      expect(c.method).toBe('GET');
      expect(c.path).toBe('/files');
      expect(c.url).toContain('corpora=user');
    }
    const work = w.calls.filter((c) => c.auth !== 'Bearer FAKE-PERSONAL-TOKEN');
    expect(work.some((c) => c.path === '/drives' || c.url.includes('corpora=drive'))).toBe(true);
    for (const c of w.calls.filter((x) => x.path === '/drives' || x.url.includes('corpora=drive'))) expect(c.auth).toBe('Bearer FAKE-TEST-TOKEN');
    expect(w.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    // Back on a work page, every new call uses the work token.
    const n = w.calls.length;
    await page.locator('#mainNav a[data-nav="bin"]').click();
    await expect(page.locator('#hereTitle')).toHaveText('Bin');
    await page.waitForTimeout(300);
    for (const c of w.calls.slice(n)) expect(c.auth).toBe('Bearer FAKE-TEST-TOKEN');
  });

  test('signing out forgets the personal sign-in', async ({ page }) => {
    await page.goto('./#/drives/personal-drive');
    await signIn(page);
    await page.locator('#view [data-action="psignin"]').click();
    await expect(page.locator('#view [data-action="pcpscan"][data-slot="personal"]')).toBeVisible();
    await page.locator('#signOutBtn').click();
    await signIn(page);
    await page.evaluate(() => { location.hash = '#/drives/personal-drive'; });
    await expect(page.locator('#view [data-action="psignin"]')).toBeVisible();
    await expect(page.locator('#view [data-action="pcpscan"]')).toHaveCount(0);
  });
});

test.describe('Personal address stays out of the public repo', () => {
  // CJ9 stage 5 (merged) removed the old lines, so the stage 2b done-test is now strict: 0 places outside config.js.
  test('the personal mail domain appears nowhere outside config.js', () => {
    let hits = '';
    try { hits = execSync("git grep -n -i 'gmail\\.com' -- . ':!config.js'", { cwd: ROOT, encoding: 'utf8' }); } catch (e) { hits = ''; }
    const lines = hits.split('\n').filter(Boolean).map((l) => l.split(':').slice(0, 2).join(':'));
    expect(lines).toEqual([]);
  });
});
