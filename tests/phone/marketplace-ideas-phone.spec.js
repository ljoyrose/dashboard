// Marketplace Product ideas on a phone (390px): no sideways scroll, every control at least 44px tall. Invented rows only.
const { test, expect } = require('../support/test');
const { rowsFor, world, open } = require('../support/mkt-ideas-world');

test.describe('Marketplace ideas on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const hash of ['#/ideas', '#/ideas/add', '#/idea/IDEA-SAMPLE-1', '#/newstock']) {
    test(`${hash}: no sideways scroll at 390px, tap targets at least 44px`, async ({ page }) => {
      await world(page, rowsFor()); await open(page, hash);
      await expect(page.locator('#view')).not.toBeEmpty();
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(wide).toBeLessThanOrEqual(0);
      const small = await page.evaluate(() => [...document.querySelectorAll('#view button, #view a.btn, #view input.txtin, nav.tabs a')]
        .filter((el) => el.offsetParent !== null).map((el) => [(el.textContent || '').trim() || el.id, Math.round(el.getBoundingClientRect().height)])
        .filter(([, h]) => h < 44));
      expect(small).toEqual([]);
    });
  }
});
