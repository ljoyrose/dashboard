// JOB 34 (group A): the home page sign-in flow paths no other spec walks.
// Pretend Google and Drive only (tests/support). Every row is invented.
const { test, expect, IDS } = require('../fixtures/job34/load');

// Since TidyUp stage 5 (#135) Bin access is asked from the "Allow access, then bin" button, so these paths tick
// one invented ready file first. bin-page.spec.js covers the label and the grant-then-bin path; this file covers
// what happens around the permission answer.
const readyFile = (world) => {
  world.file('zz-sample-ready', 'ZZ_DELETE_sample-ready.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
  world.byId(IDS.ledger).content = 'file_id\nzz-sample-ready\n';
};
const tickReady = async (page) => {
  await page.locator('#sweepCard li:has([title="ZZ_DELETE_sample-ready.txt"]) input').check();
  const btn = page.locator('#sweepCard [data-action="sweep"]');
  await expect(btn).toContainText('Allow access, then bin (1)');
  return btn;
};

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Home sign-in: the paths around the button', () => {
  test('Google sign-in script never arrives: the button says "Sign-in unavailable" and a banner explains', async ({ page }) => {
    test.setTimeout(30_000);
    // An empty script: window.google never appears, so the page gives up after its 100 tries.
    await page.route('https://accounts.google.com/gsi/client', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await page.goto('./');
    await expect(page.locator('#signInBtn')).toHaveText('Sign-in unavailable', { timeout: 15_000 });
    await expect(page.locator('#signInBtn')).toBeDisabled();
    await expect(page.locator('#banner')).toHaveText('Google sign-in did not load.');
    await expect(page.locator('#mainNav')).toBeHidden();
  });

  test('after a failed sign-in, "Sign in again" in the banner signs in and clears the banner', async ({ page }) => {
    await page.addInitScript(() => { window.__GIS_MODE = 'error'; });
    await page.goto('./');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    const again = page.locator('#banner [data-action="signin"]');
    await expect(again).toHaveText('Sign in again');
    await page.evaluate(() => { window.__GIS_MODE = 'ok'; });
    await again.click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#banner')).toBeHidden();
    await expect(page.locator('#mainNav')).toBeVisible();
  });

  test('Bin permission refused by Google: says browsing still works, stays signed in, no "Sign in again"', async ({ page, guard }) => {
    readyFile(guard.world);
    await page.goto('./#/bin');
    await signIn(page);
    const allow = await tickReady(page);
    await page.evaluate(() => { window.__GIS_MODE = 'error'; });
    await allow.click();
    await expect(page.locator('#banner')).toHaveText('Bin access not granted. Browsing still works.');
    await expect(page.locator('#banner [data-action="signin"]')).toHaveCount(0);
    await expect(page.locator('#signOutBtn')).toBeVisible();
    await expect(allow).toContainText('Allow access, then bin (1)');
    expect(guard.world.byId('zz-sample-ready').trashed).toBeFalsy();
  });

  // J34-F01 FIX-REQUEST (index.html onToken ~line 2775 and requestWrite ~line 1386): the Bin permission window closing is
  // reported as a failed sign-in, and wantWrite is never reset. DECISION NEEDED: fix the page (JOB 4 TidyUp) or accept.
  // OWNER: JOB 4 TidyUp lead. BY 2026-11-06
  test.fixme('J34-F01 closing the Bin permission window says the Bin was not allowed, not "Sign in again" while still signed in', async ({ page, guard }) => {
    readyFile(guard.world);
    await page.goto('./#/bin');
    await signIn(page);
    const allow = await tickReady(page);
    await page.evaluate(() => { window.__GIS_MODE = 'popup-closed'; });
    await allow.click();
    // Today: "Sign-in window closed early." with a "Sign in again" button, although the person is signed in.
    await expect(page.locator('#banner')).toContainText('Bin access not granted');
    await expect(page.locator('#banner [data-action="signin"]')).toHaveCount(0);
    // A later ordinary sign-in must not be treated as a Bin permission answer.
    await page.evaluate(() => { window.__GIS_MODE = 'ok'; });
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#banner')).toBeHidden();
  });

  test('Bin permission granted: no banner, nothing binned yet, and the button turns into the red "Bin these (1)"', async ({ page, guard }) => {
    readyFile(guard.world);
    await page.goto('./#/bin');
    await signIn(page);
    const allow = await tickReady(page);
    await allow.click();
    await expect(allow).toContainText('Bin these (1)');
    await expect(allow).toHaveClass(/danger/);
    await expect(page.locator('#banner')).toBeHidden();
    expect(guard.world.byId('zz-sample-ready').trashed).toBeFalsy();
  });

  test('a sign-in that runs out during the 5-minute refresh says "Sign-in expired." and Sign in again works', async ({ page }) => {
    await page.clock.install();
    await page.goto('./');
    await signIn(page);
    await page.clock.fastForward(60 * 60 * 1000);
    const banner = page.locator('#banner');
    await expect(banner).toContainText('Sign-in expired. Sign in again.');
    await banner.locator('[data-action="signin"]').click();
    await expect(banner).toBeHidden();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  });

  test('the Refresh button reads Drive again and shows "Reading…" while it does', async ({ page, guard }) => {
    await page.goto('./');
    await signIn(page);
    const before = guard.world.calls.length;
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/drives/, async (route) => { await held; return route.fallback(); });
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#refreshBtn')).toBeDisabled();
    await expect(page.locator('#refreshBtn')).toHaveText('Reading…');
    await expect(page.locator('#readStamp')).toHaveText('Reading…');
    release();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#refreshBtn')).toBeEnabled();
    await expect(page.locator('#refreshBtn')).toHaveText('Refresh');
    expect(guard.world.calls.length).toBeGreaterThan(before);
  });
});
