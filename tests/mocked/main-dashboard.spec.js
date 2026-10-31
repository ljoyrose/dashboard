// Main dashboard: https://ljoyrose.github.io/dashboard/
const { test, expect, buildWorld } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled(); // the page found the (pretend) Google script
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/); // finished reading Drive
};

test.describe('Main dashboard: loads', () => {
  test('page loads with HTTP 200 and shows only a sign-in button when signed out', async ({ page }) => {
    const res = await page.goto('./');
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(/Lisa Dashboard/);
    await expect(page.locator('#signInBtn')).toBeVisible();
    await expect(page.locator('#readStamp')).toHaveText('Not signed in');
    // README: signed out shows no tabs, labels or data
    await expect(page.locator('#mainNav')).toBeHidden();
    await expect(page.locator('#hereBox')).toBeHidden();
    await expect(page.locator('#pageFoot')).toBeHidden();
  });

  test('sign-in button wakes up once the (pretend) Google script has loaded', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await expect(page.locator('#signInBtn')).toContainText('Sign in with Google');
  });
});

test.describe('Main dashboard: sign-in (mocked)', () => {
  test('asks Google for read-only Drive access only, with the public client id', async ({ page, guard }) => {
    await page.goto('./');
    await signIn(page);
    const cfg = await page.evaluate(() => window.__GIS_LAST_CONFIG);
    expect(cfg.scope).toBe('https://www.googleapis.com/auth/drive.readonly');
    expect(cfg.client_id).toMatch(/\.apps\.googleusercontent\.com$/);
    // Browsing never writes: only GET calls hit the pretend Drive.
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  test('after sign-in the Dashboard shows and the nav, header and footer appear', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#hereTitle')).toHaveText('Dashboard');
    await expect(page.locator('#view')).toHaveAttribute('data-view', 'map');
    await expect(page.locator('#signOutBtn')).toBeVisible();
    await expect(page.locator('#signInBtn')).toBeHidden();
    await expect(page.locator('#pageFoot')).toBeVisible();
  });

  test('keeps only the shared sign-in, one key in this browser (no cookies, no refresh token)', async ({ page, context }) => {
    await page.goto('./');
    await signIn(page);
    const stores = await page.evaluate(() => ({ local: Object.keys(localStorage), session: sessionStorage.length, key: window.DashAuth.KEY, saved: JSON.parse(localStorage.getItem(window.DashAuth.KEY)) }));
    expect(stores.local).toEqual([stores.key]);
    expect(stores.session).toBe(0);
    expect(Object.keys(stores.saved).sort()).toEqual(['access_token', 'expires_at', 'scope']); // no refresh token, no secret
    expect(await context.cookies()).toEqual([]);
  });

  test('sign out clears the page and says nothing is kept', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await page.locator('#signOutBtn').click();
    await expect(page.locator('#banner')).toContainText('Signed out. Nothing kept.');
    await expect(page.locator('#mainNav')).toBeHidden();
    await expect(page.locator('#signInBtn')).toBeVisible();
    expect(await page.evaluate(() => window.__GIS_CALLS.revoke)).toBe(1);
    expect(await page.evaluate(() => sessionStorage.length + localStorage.length)).toBe(0);
  });
});

test.describe('Main dashboard: navigation', () => {
  // [label, route, data-view, title, how to get there]. The bottom bar holds Dashboard, Drives, Bin, Changes and More;
  // the Drives pages open from the Drives pill row (Read first is pinned inside Shared drives).
  const tabs = [
    ['Dashboard', 'map', 'map', 'Dashboard', 'tab'],
    ['Drives', 'drives', 'drives', 'Drives', 'tab'],
    ['Shared drives', 'drives/shared', 'drive', 'Shared drives', 'pill'],
    ['Read first', 'drives/readfirst', 'readfirst', 'Read first', 'pin'],
    ['Work My Drive', 'drives/work', 'personal', 'Work My Drive', 'pill'],
    ['Personal Drive', 'drives/personal-drive', 'pdrive', 'Personal Drive', 'pill'],
    ['Drive check', 'drives/usb', 'usb', 'Drive check', 'pill'],
    ['Bin', 'bin', 'bin', 'Bin', 'tab'],
    ['Changes', 'changes', 'changes', 'Changes · Recent', 'tab'],
  ];
  for (const [label, route, view, title, how] of tabs) {
    test(`"${label}" opens #/${route}`, async ({ page }) => {
      await page.goto('./');
      await signIn(page);
      if (how === 'tab') {
        await page.locator(`#mainNav a[data-nav="${route}"]`).click();
      } else {
        await page.locator('#mainNav a[data-nav="drives"]').click();
        await expect(page.locator('#hereTitle')).toHaveText('Drives');
        if (how === 'pin') await page.locator('#view [data-readfirst-pin] a').click();
        else await page.locator('#view nav.subnav a', { hasText: new RegExp(`^${label}$`) }).click();
      }
      await expect(page).toHaveURL(new RegExp(`#/${route}$`));
      await expect(page.locator('#view')).toHaveAttribute('data-view', view);
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(page.locator(`#mainNav a[data-nav="${how === 'tab' ? route : 'drives'}"]`)).toHaveAttribute('aria-current', 'page');
    });
  }

  test('back button returns to the previous section (sections live in the URL)', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await page.locator('#mainNav a[data-nav="bin"]').click();
    await expect(page.locator('#hereTitle')).toHaveText('Bin');
    await page.locator('#mainNav a[data-nav="drives"]').click();
    await expect(page.locator('#hereTitle')).toHaveText('Drives');
    await page.goBack();
    await expect(page.locator('#hereTitle')).toHaveText('Bin');
  });

  for (const [hash, title] of [
    ['#/changes/24h', 'Changes · Last 24h'],
    ['#/changes/7d', null],
    ['#/bin', 'Bin'],
    ['#/drives/work', 'Work My Drive'],
    ['#/drives/shared/drv-alpha1', 'Shared drives · Test Drive Alpha'],
  ]) {
    test(`a link straight to ${hash} lands on the right section after sign-in`, async ({ page }) => {
      await page.goto('./' + hash);
      await expect(page.locator('#mainNav')).toBeHidden(); // still signed out
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#mainNav')).toBeVisible();
      await expect(page).toHaveURL(new RegExp(hash.replace(/[/#]/g, (c) => '\\' + c)));
      if (title) await expect(page.locator('#hereTitle')).toHaveText(title);
      else await expect(page.locator('#hereTitle')).toContainText('Changes');
    });
  }

  test('an unknown hash falls back to the Dashboard', async ({ page }) => {
    await page.goto('./#/nonsense');
    await signIn(page);
    await expect(page.locator('#hereTitle')).toHaveText('Dashboard');
  });

  test('Changes sub-menu links work (Recent, Last 24h, Last 7 days, Totals)', async ({ page }) => {
    await page.goto('./#/changes');
    await signIn(page);
    for (const [label, route] of [['Last 24h', '24h'], ['Last 7 days', '7d'], ['Totals', 'totals'], ['Recent', 'recent']]) {
      const link = page.locator('#view a', { hasText: new RegExp(`^${label}$`) }).first();
      await link.click();
      await expect(page).toHaveURL(new RegExp(`#/changes/${route}`));
      await expect(page.locator('#hereTitle')).toContainText('Changes · ' + label);
    }
  });

  test('"← Dashboard" at the top of a section goes back to the Dashboard', async ({ page }) => {
    await page.goto('./#/drives/readfirst');
    await signIn(page);
    await expect(page.locator('#hereTitle')).toHaveText('Read first');
    await page.locator('#view a.btn.back[data-back-home]').click();
    await expect(page).toHaveURL(/#\/map/);
    await expect(page.locator('#hereTitle')).toHaveText('Dashboard');
  });
});

test.describe('Main dashboard: reads Drive (mocked)', () => {
  test('Read first lists the files in the Read first folder', async ({ page }) => {
    await page.goto('./#/drives/readfirst');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('2 items in folder');
    await expect(page.locator('#view')).toContainText('READ-ME-FIRST sample.txt');
  });

  test('Drive lists the shared drives and opens one', async ({ page }) => {
    await page.goto('./#/drives/shared');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('Test Drive Alpha');
    await expect(page.locator('#view')).toContainText('Test Drive Bravo');
    await page.locator('#drivePicker').selectOption({ label: 'Test Drive Alpha' });
    await expect(page).toHaveURL(/#\/drives\/shared\/drv-alpha1/);
    await expect(page.locator('#view')).toContainText('Sample Docs');
  });

  test('Show more reveals a file that the first page was hiding', async ({ page }) => {
    await page.goto('./#/drives/shared/drv-alpha1');
    await signIn(page);
    const view = page.locator('#view');
    await expect(view).toContainText('Showing 7 of');
    await expect(view).not.toContainText('ZZ_sample-old-copy.txt');
    await view.locator('[data-action="showmore"]').click();
    await expect(view).toContainText('ZZ_sample-old-copy.txt');
    await expect(view.locator('[data-action="showall"]')).toHaveCount(0);
  });

  test('opening a folder shows its files and an "Up one level" link that works', async ({ page }) => {
    await page.goto('./#/drives/shared/drv-alpha1');
    await signIn(page);
    await page.locator('#view a', { hasText: 'Sample Docs' }).first().click();
    await expect(page.locator('#view')).toContainText('sample-report.txt');
    await page.locator('#view a', { hasText: 'Up one level' }).click();
    await expect(page.locator('#hereTitle')).toHaveText('Shared drives · Test Drive Alpha');
  });

  test('every panel says where it read from and when', async ({ page }) => {
    await page.goto('./#/drives/readfirst');
    await signIn(page);
    await expect(page.locator('#view .source')).toContainText(/From .*Read first/);
    await expect(page.locator('#view .source')).toContainText(/Read \d\d:\d\d/);
  });

  test('Changes: the last-24h list contains the recently changed file only', async ({ page }) => {
    await page.goto('./#/changes/24h');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('cf-notes-recent.txt');
    await expect(page.locator('#view')).not.toContainText('cf-notes-older.txt');
  });
});

test.describe('Main dashboard: Money tile and links to /money/', () => {
  test('Money tile shows each entity separately, with cash, for Lisa', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const tile = page.locator('#view');
    await expect(tile).toContainText('TESTCO');
    await expect(tile).toContainText('TESTPERS');
    await expect(tile).toContainText('£12,000');
    await expect(tile).toContainText('£3,000');
    await expect(tile).toContainText('never added together');
  });

  test('"Open Money Hub" link goes to /money/ and that page loads', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const [tab] = await Promise.all([page.context().waitForEvent('page'), page.locator('#view a', { hasText: 'Open Money Hub' }).click()]); // opens in a new tab
    await expect(tab).toHaveURL(/\/dashboard\/money\/$/);
    await expect(tab.locator('h1')).toContainText('Money Hub');
  });

  test('Key projects "Money Hub" tile goes to /money/', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const [tab] = await Promise.all([page.context().waitForEvent('page'), page.locator('#view a.keytile[href="money/"]').click()]); // opens in a new tab
    await expect(tab).toHaveURL(/\/dashboard\/money\/$/);
    await expect(tab).toHaveTitle(/Money Hub/);
  });

  test('clicking an entity on the tile opens that entity in the Money Hub', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const [tab] = await Promise.all([page.context().waitForEvent('page'), page.locator('#view a.ment', { hasText: 'TESTCO' }).click()]); // opens in a new tab
    await expect(tab).toHaveURL(/\/money\/#\/e\/TESTCO$/);
  });

  test('a to-do on the tile links to that row in the Money Hub', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const [tab] = await Promise.all([page.context().waitForEvent('page'), page.locator('#view a[href^="money/#/register/"]').first().click()]); // opens in a new tab
    await expect(tab).toHaveURL(/\/money\/#\/register\/R001$/);
  });

  test('the Money Hub back link returns to the dashboard', async ({ page }) => {
    await page.goto('money/');
    await page.getByRole('link', { name: /Dashboard/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/(#\/map)?$/); // the dashboard adds #/map itself
    await expect(page.locator('#signInBtn')).toBeVisible();
  });
});

test.describe('Main dashboard: Bin', () => {
  test('lists other ZZ_ names under Rename needed, and never lists an RR_ archive item', async ({ page }) => {
    await page.goto('./#/bin');
    await signIn(page);
    const view = page.locator('#view');
    await expect(page.locator('#sweepCard h3')).toHaveText('Google Drive: ZZ_DELETE_ files ready to bin');
    await expect(view.locator('[data-bin-list="rename"]')).toContainText('ZZ_sample-old-copy.txt');
    await expect(view.locator('[data-bin-list="rename"]')).toContainText('ZZ_sample-dupe.txt');
    await expect(view).toContainText('Ready (0)');
    await expect(page.locator('[data-action="sweep"]')).toBeDisabled();
    // the archive file must not appear anywhere on the Bin page
    await expect(view).not.toContainText('RR_sample-archive.txt');
  });

  test('moving to the bin needs a ticked row, a permission step, then a confirm; Cancel changes nothing', async ({ page, guard }) => {
    const { IDS } = require('../support/world');
    guard.world.file('zz-del-1', 'ZZ_DELETE_sample-ready.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    guard.world.byId(IDS.ledger).content = 'file_id\nzz-del-1\n';
    await page.goto('./#/bin');
    await signIn(page);
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    const sweep = page.locator('[data-action="sweep"]');
    await expect(sweep).toBeDisabled();
    await page.locator('[data-action="selectall"][data-group="bin"]').click();
    await expect(sweep).toContainText('Move selected (1)');
    await sweep.click(); // first click only asks for the extra (pretend) permission
    await expect(page.locator('#view')).toContainText(/Bin actions on|Move selected \(1\)/);
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toMatch(/Move 1 selected item to the bin/);
    expect(dialogs[0]).toMatch(/RR_ names are never included/);
    expect(guard.world.calls.filter((c) => c.method === 'PATCH')).toEqual([]);
    expect(guard.world.byId('zz-del-1').trashed).toBe(false);
    expect(guard.world.byId('zz-1').trashed).toBe(false);
  });

  test('confirming moves only the ticked ZZ_DELETE_ item to the bin (pretend Drive)', async ({ page, guard }) => {
    const { IDS } = require('../support/world');
    guard.world.file('zz-del-1', 'ZZ_DELETE_sample-ready.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    guard.world.byId(IDS.ledger).content = 'file_id\nzz-del-1\n';
    await page.goto('./#/bin');
    await signIn(page);
    page.on('dialog', (d) => d.accept());
    await page.locator('[data-action="selectall"][data-group="bin"]').click();
    await page.locator('[data-action="sweep"]').click();
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => guard.world.byId('zz-del-1').trashed).toBe(true);
    expect(guard.world.byId('zz-1').trashed).toBe(false);
    expect(guard.world.byId('zz-2').trashed).toBe(false);
    expect(guard.world.byId('rr-1').trashed).toBe(false);
    await expect(page.locator('#view')).toContainText('Moved to bin');
  });

  test('Dropbox line shows counts only (no file names) from DROPBOX-TOTALS.json, and its two buttons point to the right places', async ({ page, guard }) => {
    const { IDS, FIX } = require('../support/world');
    const totals = require('fs').readFileSync(require('path').join(FIX, 'dropbox/DROPBOX-TOTALS.json'), 'utf8');
    guard.world.file('dbx-totals', IDS.dbxName, totals, { parents: [IDS.dbx], driveId: null, mimeType: 'application/json' });
    await page.goto('./#/bin');
    await signIn(page);
    const card = page.locator('#dropboxCard');
    await expect(card).toContainText('Waiting to delete: 12 files (3.5 GB)');
    await expect(card).toContainText('Duplicates found: 40 files');
    await expect(card).toContainText('scan not finished');
    const job = card.locator('a', { hasText: 'Delete marked files from DROPBOX only' });
    await expect(job).toHaveAttribute('href', /^https:\/\/github\.com\/ljoyrose\/dropbox-cleanup\/actions\/workflows\//);
    await expect(job).toHaveAttribute('target', '_blank');
    await expect(job).toHaveAttribute('rel', /noopener/);
    await expect(card.locator('a', { hasText: 'Empty DROPBOX trash' })).toHaveAttribute('href', 'https://www.dropbox.com/deleted_files');
  });

  test('Dropbox line says nothing is published when no totals file exists, and the Dropbox links are present', async ({ page }) => {
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('No Dropbox scan published yet');
  });
});

test.describe('Main dashboard: PC-Personal (mocked)', () => {
  test('scan compares personal files with shared drives and reports matches', async ({ page, guard }) => {
    // Two identical files (same checksum + size): one in a shared drive, one in the personal drive.
    guard.world.file('sh-dup', 'shared-copy.pdf', 'x', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', md5Checksum: 'abc123', size: 10, mimeType: 'application/pdf' });
    guard.world.file('me-dup', 'personal-copy.pdf', 'x', { parents: ['my-root'], driveId: null, md5Checksum: 'abc123', size: 10, mimeType: 'application/pdf' });
    guard.world.file('me-unique', 'only-mine.pdf', 'y', { parents: ['my-root'], driveId: null, md5Checksum: 'zzz999', size: 12, mimeType: 'application/pdf' });
    await page.goto('./#/drives/work');
    await signIn(page);
    await page.locator('[data-action="pcpscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
    await expect(page.locator('#view')).toContainText('personal-copy.pdf');
    await expect(page.locator('#view')).not.toContainText('only-mine.pdf');
    // The scan only reads.
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });
});

test.describe('Main dashboard: sign-in problems and Drive errors', () => {
  test.describe('Google says the permission was not granted', () => {
    test.use({ gisMode: 'denied-scope' });
    test('shows "Drive access not granted." and offers sign-in again', async ({ page }) => {
      await page.goto('./');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#banner')).toContainText('Drive access not granted.');
      await expect(page.locator('#mainNav')).toBeHidden();
    });
  });
  test.describe('Google returns an error', () => {
    test.use({ gisMode: 'error' });
    test('shows "Sign-in did not complete."', async ({ page }) => {
      await page.goto('./');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#banner')).toContainText('Sign-in did not complete.');
    });
  });
  test.describe('The sign-in window is closed', () => {
    test.use({ gisMode: 'popup-closed' });
    test('shows "Sign-in window closed early."', async ({ page }) => {
      await page.goto('./');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#banner')).toContainText('Sign-in window closed early.');
    });
  });
  test.describe('The browser blocks the sign-in window', () => {
    test.use({ gisMode: 'popup-blocked' });
    test('shows "Sign-in window blocked by browser."', async ({ page }) => {
      await page.goto('./');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#banner')).toContainText('Sign-in window blocked by browser.');
    });
  });

  test('Drive refusing access (403) shows a friendly message, not a crash', async ({ page, guard, allowedConsole }) => {
    // Chrome logs every failed network call as a console error. Expected here, so allowed for this one test.
    allowedConsole.push(/Failed to load resource: the server responded with a status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('./');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#view')).toContainText(/Access refused by Google|failed/i, { timeout: 10_000 });
    await expect(page.locator('#readStamp')).toHaveText('A read failed');
  });
});

test.describe('Main dashboard: a different Google account', () => {
  test('a non-Lisa account still browses Drive, but the Money tile does not show money', async ({ page, guard }) => {
    const w = buildWorld({ email: 'someone.else@example.test' });
    guard.world.email = w.email; // same pretend Drive, different signed-in person
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#view')).not.toContainText('£12,000');
    await expect(page.locator('#view')).not.toContainText('TESTCO');
  });
});
