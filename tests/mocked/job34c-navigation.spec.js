const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');
const { HUBS, go, sheets, marketRows, foodBook } = require('../support/hubs');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const LANDED = {
  'money/': '#signInBtn, #readStamp',
  'cdhub/': '#signinbtn, #nav button[data-go]',
  'estate/': '#view',
  'factory/#/me': '#view',
  'marketplace/': '#view',
  'food/': '#view',
  'studio/': '#signInBtn, #enginePill',
};
const current = (page) => page.evaluate(() => [...document.querySelectorAll('[aria-current="page"]')]
  .map((e) => (e.getAttribute('href') || e.dataset.go || e.dataset.nav || '').replace(/^#\//, '')).filter(Boolean));

const DEEP = [
  ['cdhub', 'litters', 'map'],   // Table map is off the menus (the owner 13 Nov), so a menu view is the deep link
  ['food', 'invoices', 'home'],
  ['marketplace', 'decide', 'me'],
  ['factory', 'decide', 'rooms'],
  ['studio', 'do', 'me'],
];
async function openAt(page, guard, hub, hash) {
  const real = page.goto.bind(page);
  let first = true;
  if (hub === 'marketplace') {
    const rows = marketRows();
    await sheets(page, (url) => /!A2:L$/.test(url) ? { values: rows } : { values: [(rows[Number((/!A(\d+)/.exec(url) || [0, 2])[1]) - 2] || [])] });
    await real(HUBS[hub].url + hash);
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#readAt')).toContainText(/^Read \d/);
    return;
  }
  if (hub === 'food') {
    const b = foodBook();
    await sheets(page, (url) => /:batchGet/.test(url)
      ? { valueRanges: [{ values: b.cards }, { values: b.orders }, { values: b.invoices }, { values: b.products }, { values: b.settings }, { values: [['statement_date', 'total_outstanding']] }, { values: [['date', 'amount']] }, { values: [['kind', 'code', 'name']] }] }
      : { values: [(b.cards[Number((/Cards!A(\d+)/.exec(url) || [0, 2])[1]) - 2] || [])] });
    await real(HUBS[hub].url + hash);
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#tabs')).toBeVisible();
    await expect(page.locator('#view')).not.toContainText('Reading');
    return;
  }
  page.goto = (u, o) => { const to = first ? HUBS[hub].url + hash : u; first = false; return real(to, o); };
  try { await HUBS[hub].open(page, guard); } finally { page.goto = real; }
}

test.describe('Navigation across pages', () => {
  test('every hub tile on Main loads in the same tab, and its Dashboard button brings Home back still signed in', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto('./');
    await signIn(page);
    const hrefs = await page.locator('#hubTiles .hubtile a.hgo').evaluateAll((els) => els.map((a) => a.getAttribute('href')).filter((h) => !/^https?:/.test(h)));
    expect(hrefs.sort()).toEqual(Object.keys(LANDED).sort());
    const home = page.url().replace(/#.*$/, '');
    for (const href of hrefs) {
      const res = await page.goto(new URL(href, home).href);
      expect(res.status(), href).toBe(200);
      await expect(page.locator(LANDED[href]).first(), href).toBeVisible();
      const back = page.locator('#backHome');
      await expect(back, href).toHaveAttribute('href', '../');
      expect(await back.evaluate((a) => a.href), href).toBe(home);
      await back.click();
      await expect(page, href).toHaveURL(new RegExp('^' + home.replace(/[.?/]/g, (c) => '\\' + c) + '(#/map)?$'));
      await expect(page.locator('#readStamp'), href).toContainText(/^Read \d/);
      await expect(page.locator('#hereTitle')).toHaveText('Dashboard');
    }
  });

  test('bottom tabs round trip Dashboard > Drives > Bin > Changes > Dashboard, then Back and Forward retrace every step', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const steps = [['drives', 'Drives'], ['bin', 'Bin'], ['changes', /^Changes/], ['map', 'Dashboard']];
    const seen = [['map', 'Dashboard']];
    for (const [nav, title] of steps) {
      await tabClick(page, `#mainNav a[data-nav="${nav}"]`);
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(page.locator(`#mainNav a[data-nav="${nav}"]`)).toHaveAttribute('aria-current', 'page');
      seen.push([nav, title]);
    }
    const check = async ([nav, title]) => {
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(page.locator(`#mainNav a[data-nav="${nav}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#mainNav a[aria-current="page"]')).toHaveCount(1);
    };
    for (let i = seen.length - 2; i >= 1; i--) { await page.goBack(); await check(seen[i]); }
    for (let i = 2; i < seen.length; i++) { await page.goForward(); await check(seen[i]); }
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  });

  test('browser history spans pages: Home Changes > Money Hub > Back lands on Home Changes, Forward on Money', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const href = await page.locator('#hubTiles .hubtile[data-hub="money"] a.hgo').getAttribute('href');
    expect(href).toBe('money/');
    await tabClick(page, '#mainNav a[data-nav="changes"]');
    await expect(page.locator('#hereTitle')).toHaveText(/^Changes/);
    const changesUrl = page.url();
    await page.goto(new URL(href, page.url()).href);
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#hereTitle')).toHaveText('Now');
    await page.goBack();
    await expect(page).toHaveURL(changesUrl);
    await expect(page.locator('#hereTitle')).toHaveText(/^Changes/);
    await expect(page.locator('#mainNav a[data-nav="changes"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await page.goForward();
    await expect(page).toHaveURL(/\/money\/(#\/now)?$/);
    await expect(page.locator('#hereTitle')).toHaveText('Now');
  });

  for (const [hub, deep] of DEEP) {
    test(`${hub}: a deep link to #/${deep} survives sign-in, and Back after moving on returns to it`, async ({ page, guard }) => {
      await openAt(page, guard, hub, '#/' + deep);
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/' + deep);
      await expect.poll(() => current(page)).toContain(deep);
      const other = HUBS[hub].views.find((v) => v !== deep && !v.includes('/') && v !== 'new');
      await go(page, other);
      await expect.poll(() => current(page)).toContain(other);
      await page.goBack();
      await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/' + deep);
      await expect.poll(() => current(page)).toContain(deep);
    });
  }

  for (const [hub, , home] of DEEP) {
    test(`${hub}: an unknown address shows the first view with its tab lit, without errors`, async ({ page, guard }) => {
      await openAt(page, guard, hub, '#/no-such-view');
      await expect(page.locator('#view, main').first()).toBeVisible();
      await expect.poll(() => current(page)).toContain(home);
      const other = HUBS[hub].views.find((v) => v !== home && !v.includes('/') && v !== 'new');
      await go(page, other);
      await expect.poll(() => current(page)).toContain(other);
      await go(page, 'still-no-such-view');
      await expect.poll(() => current(page)).toContain(home);
    });
  }
});

