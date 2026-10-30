// Puppy Enquiries Hub on a phone: no sideways scroll at 360 px, every tap target at least 44 px. Example rows only.
const { test, expect } = require('../support/test');

test.use({ viewport: { width: 360, height: 780 } });

test('enquiries: every view at 360 px, no sideways scroll, tap targets 44 px', async ({ page }) => {
  await page.goto('enquiries/');
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('[data-count="hot"]')).toBeVisible();
  for (const h of ['#/home', '#/today', '#/list?band=hot', '#/litters', '#/add', '#/results', '#/e/K-a000000000000001', '#/e/K-a000000000000003', '#/e/K-a000000000000005']) {
    await page.goto('enquiries/' + h);
    await expect(page.locator('#view')).not.toBeEmpty();
    const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, screen: window.innerWidth }));
    expect(w.doc, h + ': sideways scroll').toBeLessThanOrEqual(w.screen);
    const small = await page.evaluate(() => [...document.querySelectorAll('#view button, #view a.btn, #view a.erow, #view a.tile, #view select, #view input, header .btn, nav.tabs a')]
      .filter((b) => b.offsetParent && b.getBoundingClientRect().width > 1).filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim()));
    expect(small, h + ': tap targets under 44px').toEqual([]);
  }
});
