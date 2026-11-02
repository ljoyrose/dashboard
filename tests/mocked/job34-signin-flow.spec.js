// JOB 34 (group A): the home page sign-in flow paths no other spec walks.
// Pretend Google and Drive only (tests/support). Every row is invented.
const { test, expect } = require('../fixtures/job34/load');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

// Since TidyUp stage 5 (05fc972) the Bin page has no Permission card: access is asked from the "Bin these" button.
// One invented ready file (ZZ_DELETE_ name + ledger row), ticked, so that button has something to ask for.
const tickReady = async (page, guard) => {
  guard.world.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
  guard.world.byId(IDS.ledger).content = 'file_id\nzz-ready\n';
  await page.goto('./#/bin');
  await signIn(page);
  await page.locator('#sweepCard li:has([title="ZZ_DELETE_ready.txt"]) input').check();
  const btn = page.locator('#sweepCard [data-action="sweep"]');
  await expect(btn).toContainText('Allow access, then bin (1)');
  return btn;
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
    const allow = await tickReady(page, guard);
    await page.evaluate(() => { window.__GIS_MODE = 'error'; });
    await allow.click();
    await expect(page.locator('#banner')).toHaveText('Bin access not granted. Browsing still works.');
    await expect(page.locator('#banner [data-action="signin"]')).toHaveCount(0);
    await expect(page.locator('#signOutBtn')).toBeVisible();
    // Still asks for access, still not red, nothing binned.
    await expect(allow).toContainText('Allow access, then bin (1)');
    await expect(allow).not.toHaveClass(/danger/);
    expect(guard.world.calls.filter((c) => c.method === 'PATCH')).toEqual([]);
  });

  // J34-F01 FIX-REQUEST (index.html onError ~line 2832 and requestWrite ~line 1386): the Bin permission window closing is
  // reported as a failed sign-in, and wantWrite is never reset. DECISION NEEDED: fix the page (JOB 4 TidyUp) or accept.
  // OWNER: JOB 4 TidyUp lead. BY 2026-11-06
  test.fixme('J34-F01 closing the Bin permission window says the Bin was not allowed, not "Sign in again" while still signed in', async ({ page, guard }) => {
    const allow = await tickReady(page, guard);
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

  test('Bin permission granted: the button turns into a red "Bin these (1)", with no banner and nothing binned yet', async ({ page, guard }) => {
    const allow = await tickReady(page, guard);
    await allow.click();
    const btn = page.locator('#sweepCard [data-action="sweep"]');
    await expect(btn).toHaveText('Bin these (1)');
    await expect(btn).toHaveClass(/danger/);
    await expect(page.locator('#sweepCard li:has([title="ZZ_DELETE_ready.txt"]) input')).toBeChecked();
    await expect(page.locator('#banner')).toBeHidden();
    expect(guard.world.calls.filter((c) => c.method === 'PATCH')).toEqual([]);
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

  test('the Refresh button reads Drive again; while it does the button is off and the read time says "Reading…"', async ({ page, guard }) => {
    await page.goto('./');
    await signIn(page);
    const before = guard.world.calls.length;
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/drives/, async (route) => { await held; return route.fallback(); });
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#refreshBtn')).toBeDisabled();
    // The top bar's Refresh is an icon (Lisa's pick A): its name stays "Refresh"; the read time says what is happening.
    await expect(page.locator('#refreshBtn')).toHaveAccessibleName('Refresh');
    await expect(page.locator('#refreshBtn')).toHaveText('');
    await expect(page.locator('#readStamp')).toHaveText('Reading…');
    release();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#refreshBtn')).toBeEnabled();
    await expect(page.locator('#refreshBtn')).toHaveAccessibleName('Refresh');
    await expect(page.locator('#refreshBtn')).toHaveText('');
    expect(guard.world.calls.length).toBeGreaterThan(before);
  });
});
