// Web Estate page on a phone: no sideways scroll at 360px and every control at least 44px tall. Invented rows only.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');

test.describe('Web Estate on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  for (const hash of ['#/home', '#/look', '#/unchecked', '#/shops', '#/home?kind=site']) {
    test(`${hash}: no sideways scroll at 360px, tap targets at least 44px`, async ({ page }) => {
      await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
      await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values() }) }));
      await page.goto('estate/' + hash);
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#view .needs')).toBeVisible();
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(wide).toBeLessThanOrEqual(0);
      const small = await page.evaluate(() => [...document.querySelectorAll('button, select, nav.tabs a, a.btn')]
        .filter((el) => el.offsetParent !== null).map((el) => [el.textContent.trim() || el.getAttribute('data-filter'), Math.round(el.getBoundingClientRect().height)])
        .filter(([, h]) => h < 44));
      expect(small).toEqual([]);
    });
  }
});
