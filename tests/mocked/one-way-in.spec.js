// Stage 2c: one way into each area. The front page keeps the Needs you row and the Next card; nothing else on it
// points at a tab. Key projects = MOVE + one tile per hub. Four bottom tabs. The Bin has one entry (section 9).
const { test, expect } = require('../support/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const TAB_LINK = /^#\/(drives|bin|changes)(\/|$)/;

test.describe('One way in', () => {
  test('the front page has no links to Drives, Bin or Changes outside the Needs you row and the Next card', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#view #homeTop')).toBeVisible();
    const stray = await page.locator('#view a[href]').evaluateAll((els, re) => els
      .filter((a) => new RegExp(re).test(a.getAttribute('href')))
      .filter((a) => !a.closest('#urgentOne, #needsToday'))
      .map((a) => a.getAttribute('href') + ' "' + a.textContent.trim() + '"'), TAB_LINK.source);
    expect(stray).toEqual([]);
    await expect(page.locator('#view a.hometile')).toHaveCount(0);
    await expect(page.locator('#view .figs, #view .fig')).toHaveCount(0);
  });

  test('Key projects holds exactly MOVE and the six hubs', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#key-projects a.keytile')).toHaveText(['MOVE', 'Money Hub', 'CD Hub', 'Factory', 'Marketplace', 'GA Hub', 'Studio']);
    for (const a of await page.locator('#key-projects a.keytile').all()) await expect(a).toHaveAttribute('target', '_blank');
  });

  test('the bottom bar has the four agreed tabs and no More', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const tabs = page.locator('#mainNav a');
    await expect(tabs).toHaveCount(4);
    expect(await tabs.evaluateAll((els) => els.map((a) => a.getAttribute('href')))).toEqual(['#/map', '#/drives', '#/bin', '#/changes']);
    await expect(page.locator('#mainNav a[data-nav="map"]')).toContainText('Dashboard');
    await expect(page.locator('#mainNav a[data-nav="drives"]')).toContainText('Drives');
  });

  test('#/more and its old shortcuts land on the Dashboard', async ({ page }) => {
    await page.goto('./#/more');
    await signIn(page);
    await expect(page).toHaveURL(/#\/map$/);
    await expect(page.locator('#hereTitle')).toHaveText('Dashboard');
  });
});

test.describe('Bin has a single entry (job file section 9)', () => {
  test('index.html names #/bin, #/personal or #/usb only in the tab, the router note, the two Needs you rows and code comments', () => {
    const lines = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n')
      .map((l, i) => ({ n: i + 1, l }))
      .filter((x) => /#\/bin|#\/personal|#\/usb/.test(x.l));
    const allowed = (l) => /^\s*\/\//.test(l) || /<a href="#\/bin" data-nav="bin"/.test(l) || (/out\.push\(/.test(l) && /tag: 'Bin'/.test(l));
    expect(lines.filter((x) => !allowed(x.l)).map((x) => x.n + ': ' + x.l.trim().slice(0, 80))).toEqual([]);
    expect(lines.filter((x) => /out\.push\(/.test(x.l))).toHaveLength(2);
  });

  test('the only visible way to the Bin on the front page is the tab (plus a Needs you row when files are ready)', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const bins = await page.locator('a[href="#/bin"]:visible').evaluateAll((els) => els.map((a) => a.closest('#mainNav') ? 'tab' : a.closest('#urgentOne, #needsToday') ? 'needs' : 'other'));
    expect(bins).toContain('tab');
    expect(bins.filter((b) => b === 'other')).toEqual([]);
  });
});
