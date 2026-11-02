// Stage 2c: one way into each area. The front page keeps the Needs you row and the Next card; nothing else on it
// points at a tab. Main = one tile per hub (MOVE moved to More, 2 Nov). Main, Decide, Do and More. The Bin has one entry (section 9).
const { test, expect } = require('../support/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PH = require('../support/world').IDS.projectsHub; // Projects Hub tile only when config.js holds its address
const MOVE = require('../support/world').IDS.moveSheet;
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

  test('Main holds exactly the hub tiles (Lisa\'s order, 2 Nov) and MOVE sits in More', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#key-projects')).toHaveCount(0);
    await expect(page.locator('#hubTiles .hubtile a.hgo')).toHaveText((PH ? ['Projects'] : []).concat(['Web', 'Money', /^Food/, 'Dogs', 'Apps', 'Marketplace', 'Studio']));
    for (const a of await page.locator('#hubTiles .hubtile a').all()) await expect(a).toHaveAttribute('target', '_blank');
    await expect(page.locator('#houseMore #move-link')).toHaveText('MOVE');
  });

  test('the bottom bar has the agreed tabs: Main, Decide, Do, then More holding Drives, Bin, Changes and MOVE (Lisa\'s tab picks, 2 Nov)', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const tabs = page.locator('#mainNav a');
    await expect(tabs).toHaveCount(7);
    expect(await tabs.evaluateAll((els) => els.map((a) => a.getAttribute('href')))).toEqual(['#/map', '#/decide', '#/do', '#/drives', '#/bin', '#/changes', MOVE]);
    await expect(page.locator('#mainNav > .ht')).toHaveCount(3);
    await expect(page.locator('#mainNav .house-more > a')).toHaveCount(4);
    await expect(page.locator('#mainNav a[data-nav="map"]')).toContainText('Main');
    await expect(page.locator('#mainNav a[data-nav="drives"]')).toContainText('Drives');
    await expect(page.locator('#mainNav [data-house-more]')).toHaveAccessibleName('More');
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

  test('the only visible way to the Bin on the front page is the tab under More (plus a Needs you row when files are ready)', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await page.locator('#mainNav [data-house-more]').click();
    const bins = await page.locator('a[href="#/bin"]:visible').evaluateAll((els) => els.map((a) => a.closest('#mainNav') ? 'tab' : a.closest('#urgentOne, #needsToday') ? 'needs' : 'other'));
    expect(bins).toContain('tab');
    expect(bins.filter((b) => b === 'other')).toEqual([]);
  });
});
