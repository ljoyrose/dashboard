// Lisa had to sign in twice: the sign-in lived in one browser tab only, so a new tab, window or the installed
// app window started signed out. Now one sign-in (kept in this browser until it expires or you sign out)
// covers every tab, and Money Hub and CD Hub open in their own tab with a "Dashboard" button.
const { test, expect } = require('../support/test');
const { at } = require('../support/site');

const MOVE = require('../support/world').IDS.moveSheet; // read from config.js, never copied (this repo is public)
const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const gisRequests = (p) => p.evaluate(() => window.__GIS_CALLS.request);

test.describe('One sign-in for every tab', () => {
  test('sign in on home, open Money Hub and CD Hub: each opens in a new tab already signed in, no prompt @regression', async ({ page, context }) => {
    await page.goto('./');
    await signIn(page);

    for (const [sel, url] of [['a.keytile[href="money/"]', /\/money\/$/]]) {
      const [tab] = await Promise.all([context.waitForEvent('page'), page.locator(sel).click()]);
      await expect(tab).toHaveURL(url);
      await expect(tab.locator('#readStamp')).toContainText(/^Read \d/);
      await expect(tab.locator('#signInBtn')).toBeHidden();
      expect(await gisRequests(tab)).toBe(0);
      await tab.close();
    }
    await page.locator('#mainNav a[data-nav="map"]').click();
    const [cd] = await Promise.all([context.waitForEvent('page'), page.locator('a.keytile[href="cdhub/"]').click()]);
    await expect(cd).toHaveURL(/\/cdhub\/$/);
    await expect(cd.locator('#nav button[data-go]').first()).toBeVisible();
    await expect(cd.locator('#signinbtn')).toHaveCount(0);
    expect(await gisRequests(cd)).toBe(0);
    // The dashboard tab itself was not replaced.
    await expect(page).toHaveURL(at('(#/map)?'));
  });

  test('a brand-new tab (or the installed app window) typed straight to money/ is signed in too', async ({ page, context }) => {
    await page.goto('./');
    await signIn(page);
    const tab = await context.newPage();
    await tab.goto('money/');
    await expect(tab.locator('#readStamp')).toContainText(/^Read \d/);
    expect(await gisRequests(tab)).toBe(0);
  });

  test('every home link to Money Hub or CD Hub opens a new tab', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('a[href^="money/#/"]').first()).toBeVisible(); // Money tile drawn
    const links = await page.locator('a[href^="money/"], a[href^="cdhub/"]').evaluateAll((as) => as.map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]));
    expect(links.length).toBeGreaterThan(4);
    for (const [href, target, rel] of links) {
      expect(target, href).toBe('_blank');
      expect(rel, href).toBe('opener'); // same site only: lets "Dashboard" bring this tab back
    }
  });

  test('search results that point to Money Hub open in a new tab', async ({ page, context }) => {
    await page.goto('./');
    await signIn(page);
    await page.keyboard.press('/');
    await page.locator('#dashSearchBox').fill('sample task ready');
    const hit = page.locator('[data-search-group="Money to-dos"] a', { hasText: 'Sample task ready now' });
    await expect(hit).toHaveAttribute('target', '_blank');
    const [tab] = await Promise.all([context.waitForEvent('page'), hit.click()]);
    await expect(tab).toHaveURL(/\/money\/#\/register\/R001$/);
    await expect(tab.locator('#readStamp')).toContainText(/^Read \d/);
    expect(await gisRequests(tab)).toBe(0);
  });

  test('signing out in one tab signs out the others; signing in in one tab signs in the others', async ({ page, context }) => {
    await page.goto('./');
    await signIn(page);
    const money = await context.newPage();
    await money.goto('money/');
    await expect(money.locator('#readStamp')).toContainText(/^Read \d/);
    const cd = await context.newPage();
    await cd.goto('cdhub/');
    await expect(cd.locator('#nav button[data-go]').first()).toBeVisible();

    await page.locator('#signOutBtn').click();
    await expect(money.locator('#readStamp')).toHaveText('Not signed in');
    await expect(money.locator('#banner')).toContainText('Signed out in another tab');
    await expect(money.locator('#view')).not.toContainText('£');
    await expect(cd.locator('#signinbtn')).toBeVisible();
    expect(await money.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    expect(await page.evaluate(() => window.__GIS_CALLS.revoke)).toBe(1);
    expect(await money.evaluate(() => window.__GIS_CALLS.revoke)).toBe(0);

    const homeAsked = await gisRequests(page);
    await money.locator('#signInBtn').click();
    await expect(money.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#mainNav')).toBeVisible();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(cd.locator('#nav button[data-go]').first()).toBeVisible();
    expect(await gisRequests(page)).toBe(homeAsked); // home picked it up without asking Google
  });

  test('an expired saved sign-in is not reused in a new tab', async ({ page, context }) => {
    await page.goto('./');
    await signIn(page);
    await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem(window.DashAuth.KEY));
      d.expires_at = Date.now() - 1000;
      localStorage.setItem(window.DashAuth.KEY, JSON.stringify(d));
    });
    const tab = await context.newPage();
    await tab.goto('money/');
    await expect(tab.locator('#signInBtn')).toBeEnabled();
    await expect(tab.locator('#readStamp')).toHaveText('Not signed in');
  });

  test('a sign-in kept by the old version (this tab only) is moved over, not lost', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.setItem('ljr-dash-auth', JSON.stringify({ access_token: 'FAKE-TEST-TOKEN', expires_at: Date.now() + 3e6, scope: window.DASH_CONFIG.scopes.read }));
    });
    await page.goto('money/');
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    expect(await page.evaluate(() => [sessionStorage.length, Object.keys(localStorage)])).toEqual([0, ['ljr-dash-auth']]);
  });
});

test.describe('Dashboard button (every page except home)', () => {
  for (const [url, ready] of [['money/', '#signInBtn'], ['cdhub/', '#main'], ['marketplace/', '#signin'], ['studio/', '#signInBtn']]) {
    test(`${url}: top-left Home "Dashboard" button is always shown, keyboard reachable, and goes home`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator(ready)).toBeVisible();
      const b = page.locator('#backHome');
      await expect(b).toBeVisible(); // signed out too
      await expect(b).toHaveAttribute('aria-label', 'Dashboard');
      await expect(b).toHaveText('');   // the Home icon only (Lisa's pick A, 2 Nov)
      await expect(b.locator('svg use')).toHaveAttribute('href', '#hi-home');
      await expect(b).toHaveAttribute('href', '../');
      const box = await b.boundingBox();
      const vw = page.viewportSize().width;
      expect(box.y).toBeLessThan(56);
      expect(box.x + box.width).toBeLessThan(vw * 0.25);   // top left
      expect(box.height).toBe(vw <= 600 ? 44 : 36);   // the house button size
      await b.focus();
      await expect(b).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(at('(#/map)?'));
      await expect(page).toHaveTitle(/Lisa Dashboard|Map/);
    });

    test(`${url}: opened from the dashboard, "Dashboard" brings the dashboard tab back and closes this one`, async ({ page, context }) => {
      await page.goto('./');
      await signIn(page);
      const link = 'a.keytile[href="' + url + '"]';
      const [tab] = await Promise.all([context.waitForEvent('page'), page.locator(link).click()]);
      await expect(tab.locator('#backHome')).toBeVisible();
      // The tab can close before click() returns; that close is the point, not an error.
      await Promise.all([tab.waitForEvent('close'), tab.locator('#backHome').click().catch((e) => { if (!/closed/.test(e.message)) throw e; })]);
      expect(context.pages()).toEqual([page]);
      await expect(page).toHaveURL(at('(#/map)?'));
    });
  }
});

test.describe('Home: one MOVE link', () => {
  test('the MOVE spreadsheet is linked exactly once (the tile)', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const url = await page.evaluate(() => window.DASH_CONFIG.urls.moveSheet);
    expect(url).toBe(MOVE);
    await expect(page.locator(`a[href="${url}"]`)).toHaveCount(1);
    await expect(page.locator('#move-link')).toHaveClass(/keytile/);
    await expect(page.locator('#key-projects p.lead')).toHaveCount(0);
  });
});
