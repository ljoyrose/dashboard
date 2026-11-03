// Typing boxes on a phone (Lisa, 3 Nov 2026): every visible input, textarea, select and contenteditable is at least 16px on every
// page and view, so iPhone Safari never zooms in when one is tapped (--fs-input in tokens.css, house.css section 16). Also the
// shared search box (DashKit.search) and Studio's comment box, which only show once opened. Pretend Google, Drive and Sheets.
// SWEEP_SHOTS=<folder> also saves 390px pictures of a focused search box and a focused comment box.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, go } = require('../support/hubs');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const PAGES = {
  ...HUBS,
  estate: {
    url: 'estate/', views: ['home', 'all', 'shops', 'unchecked', 'access'],
    async open(page) {
      const F = require('../fixtures/estate/rows.js');
      await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
      await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(F.HEADER, F.ROWS) }) }));
      await page.goto('estate/#/home');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    },
  },
};
const SHOTS = process.env.SWEEP_SHOTS;

// Runs in the page: every visible typing box under 16px, as "what: size".
function small() {
  const sel = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="image"]), textarea, select, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';
  return [...document.querySelectorAll(sel)].filter((e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden';
  }).map((e) => ({ what: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.name ? '[name=' + e.name + ']' : '') + (e.className ? '.' + String(e.className).split(' ')[0] : ''), px: parseFloat(getComputedStyle(e).fontSize) }))
    .filter((x) => !(x.px >= 16)).map((x) => x.what + ': ' + x.px + 'px');
}

test.describe('typing boxes are 16px on a phone (no zoom on tap)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const [hub, P] of Object.entries(PAGES)) {
    test(`${hub}: every view, and the search box`, async ({ page, guard }) => {
      test.setTimeout(180_000);
      await P.open(page, guard);
      const bad = [];
      for (const v of P.views) {
        await go(page, v);
        bad.push(...(await page.evaluate(small)).map((x) => '#/' + v + ' ' + x));
      }
      // The shared search box (every page that has DashKit.search).
      if (await page.evaluate(() => !!(window.DashKit && DashKit.search && DashKit.search.open))) {
        await page.evaluate(() => DashKit.search.open());
        const box = page.locator('#dashSearchBox');
        await expect(box).toBeFocused();
        bad.push(...(await page.evaluate(small)).map((x) => 'search ' + x));
        if (SHOTS && hub === 'home') { await box.fill('invoice'); await page.screenshot({ path: path.join(SHOTS, 'search-box-focused-390.png') }); }
        await page.keyboard.press('Escape');
      }
      expect([...new Set(bad)], hub + ': typing boxes under 16px').toEqual([]);
    });
  }

  test('studio: the comment box on an opened item', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    await go(page, 'assets');
    if (!(await page.locator('[data-more="sa-client"]').count())) await page.locator('.crow[data-row="sa-client"] .ttl').first().click();
    const box = page.locator('#cbox-sa-client');
    await expect(box).toBeVisible();
    await box.focus();
    expect(await page.evaluate(small)).toEqual([]);
    expect(parseFloat(await box.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
    if (SHOTS) { await box.fill('Looks good, one small change'); await box.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(SHOTS, 'comment-box-focused-390.png') }); }
  });
});
