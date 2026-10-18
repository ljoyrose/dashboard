// CD Hub: https://ljoyrose.github.io/dashboard/cdhub/
const { test, expect, buildWorld } = require('../support/test');
const { IDS, WANT_BLD, FIX } = require('../support/world');
const fs = require('fs');
const path = require('path');

const SECTIONS = ['map', 'work', 'shape', 'today', 'round', 'dogs', 'areas', 'litters', 'vet', 'buyers'];
const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

test.describe('CD Hub: loads', () => {
  test('page loads with HTTP 200 and asks for sign-in; no tables shown yet', async ({ page }) => {
    const res = await page.goto('cdhub/');
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(/CD Hub/);
    await expect(page.locator('h1')).toHaveText('Cobberdog Hub');
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    await expect(page.locator('#livepill')).toHaveText('signed out');
    await expect(page.locator('#nav button')).toHaveCount(0);
  });

  test('holds no table data; only the shared sign-in is kept in this tab', async ({ page, context }) => {
    await page.goto('cdhub/');
    await expect(page.locator('#main')).toContainText('This page holds no data of its own');
    await signIn(page);
    const stores = await page.evaluate(() => ({ local: localStorage.length, session: Object.keys(sessionStorage), key: window.DashAuth.KEY }));
    expect(stores.local).toBe(0);
    expect(stores.session).toEqual([stores.key]);
    expect(await context.cookies()).toEqual([]);
    await page.locator('#nav button[data-signout]').click();
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  });
});

test.describe('CD Hub: sign-in and reading the BLD tables (mocked)', () => {
  test('asks for read-only Drive access only', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    const cfg = await page.evaluate(() => window.__GIS_LAST_CONFIG);
    expect(cfg.scope).toBe('https://www.googleapis.com/auth/drive.readonly');
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  test('lists the BLD-app-tables folder and reads each sample BLD-*.csv', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    // folder listing used the right folder
    const listing = guard.world.calls.find((c) => c.path === '/files' && c.query.includes(IDS.bld));
    expect(listing, 'folder listing call').toBeTruthy();
    // every sample file that exists in the pretend folder was fetched exactly once
    const sampleCount = fs.readdirSync(path.join(FIX, 'bld')).filter((f) => f.endsWith('.csv')).length;
    const reads = guard.world.calls.filter((c) => /^\/files\/bld-\d+$/.test(c.path));
    expect(reads.length).toBe(sampleCount);
  });

  test('live pill shows live, read-only, and the number of tables', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#livepill')).toContainText(/^live · read-only · \d+ tables · read \d\d:\d\d/);
    expect(WANT_BLD.length).toBeGreaterThan(40);
  });

  test('the sample CSVs are parsed into the right things on the Dogs page', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="dogs"]').click();
    const main = page.locator('#main');
    await expect(main).toContainText('Test Dog One');
    await expect(main).toContainText('Test Dog Two');
    await expect(main).toContainText('Test Pup One');
    await expect(main).toContainText('3 of 3');
  });

  test('joined tables work: cabins show their dogs, litters show dam and sire, weighings are counted @regression', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="round"]').click();
    await expect(page.locator('#main')).toContainText('Test Cabin A');
    await expect(page.locator('#main')).toContainText('Test Dog One');
    await page.locator('#nav button[data-go="litters"]').click();
    await expect(page.locator('#main')).toContainText('Test Dog One'); // dam
    await expect(page.locator('#main')).toContainText('Test Dog Two'); // sire
    await page.locator('#nav button[data-go="vet"]').click();
    await expect(page.locator('#main')).toContainText('3'); // three sample weighings
  });

  test('the Outstanding page reads BLD-WORK.csv', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="work"]').click();
    await expect(page.locator('#main')).toContainText('Sample item waiting on Lisa');
    await expect(page.locator('#main')).toContainText('Sample finished item');
  });

  test('tables missing from the folder are reported, not hidden', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#main')).toContainText(/\d+ file\(s\) not in the folder/);
  });
});

test.describe('CD Hub: navigation', () => {
  for (const id of SECTIONS) {
    test(`section button "${id}" opens that section`, async ({ page }) => {
      await page.goto('cdhub/');
      await signIn(page);
      await page.locator(`#nav button[data-go="${id}"]`).click();
      await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#main')).not.toBeEmpty();
      await expect(page.locator('#main')).not.toContainText('Sign in to see the tables');
    });
  }

  test('all ten sections plus Reread and Sign out are in the menu', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#nav button[data-go]')).toHaveCount(10);
    await expect(page.locator('#nav button[data-reload]')).toHaveCount(1);
    await expect(page.locator('#nav button[data-signout]')).toHaveCount(1);
  });

  test('the "Next:" buttons at the bottom lead to other sections', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="today"]').click();
    const next = page.locator('#next button[data-go]').first();
    const target = await next.getAttribute('data-go');
    await next.click();
    await expect(page.locator(`#nav button[data-go="${target}"]`)).toHaveAttribute('aria-current', 'page');
  });

  test('Reread reads the folder again', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    const before = guard.world.calls.filter((c) => c.path === '/files' && c.query.includes(IDS.bld)).length;
    await page.locator('#nav button[data-reload]').click();
    await expect(page.locator('#livepill')).toContainText('live');
    await expect.poll(() => guard.world.calls.filter((c) => c.path === '/files' && c.query.includes(IDS.bld)).length).toBe(before + 1);
  });

  test('Sign out forgets everything and shows the sign-in card again', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-signout]').click();
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    await expect(page.locator('#livepill')).toHaveText('signed out');
    await expect(page.locator('#main')).not.toContainText('Test Dog One');
    expect(await page.evaluate(() => window.__GIS_CALLS.revoke)).toBe(1);
  });

  test('saving is switched off and says so', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="round"]').click();
    await expect(page.locator('#main')).toContainText('Saving is off in this web version');
  });
});

test.describe('CD Hub: things that go wrong', () => {
  test('two files with the same title: refuses to guess which is current', async ({ page, guard }) => {
    const w = buildWorld({ bld: { duplicate: ['BLD-subject.csv'] } });
    guard.world.files = w.files; guard.world.drives = w.drives;
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('More than one file shares a title');
    await expect(page.locator('#main')).toContainText('BLD-subject.csv');
    await expect(page.locator('#livepill')).toHaveText('duplicate file titles');
  });

  test('Drive refuses the folder (403): shows an error card, not a blank page', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('The folder could not be read');
    await expect(page.locator('#main')).toContainText('Google refused access');
    await expect(page.locator('#livepill')).toHaveText('read failed');
  });

  test('folder not found (404) says the folder cannot be seen by this account', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 404/);
    guard.world.failWith = { status: 404, reason: 'notFound', message: 'Not found' };
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('Folder not found, or this account cannot see it');
  });

  test.describe('Drive permission not granted', () => {
    test.use({ gisMode: 'denied-scope' });
    test('explains the tables cannot be read', async ({ page }) => {
      await page.goto('cdhub/');
      await page.locator('#signinbtn').click();
      await expect(page.locator('#main')).toContainText('Drive read access was not granted');
    });
  });
  test.describe('Sign-in window closed', () => {
    test.use({ gisMode: 'popup-closed' });
    test('explains the window was closed', async ({ page }) => {
      await page.goto('cdhub/');
      await page.locator('#signinbtn').click();
      await expect(page.locator('#main')).toContainText('The sign-in window was closed before it finished');
    });
  });
  test.describe('Sign-in window blocked', () => {
    test.use({ gisMode: 'popup-blocked' });
    test('tells the person to allow pop-ups', async ({ page }) => {
      await page.goto('cdhub/');
      await page.locator('#signinbtn').click();
      await expect(page.locator('#main')).toContainText('Allow pop-ups');
    });
  });
});
