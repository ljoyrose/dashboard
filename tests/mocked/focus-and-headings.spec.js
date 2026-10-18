// Keyboard focus follows a screen change, and CD Hub headings never skip a level.
const { test, expect } = require('../support/test');

test.describe('Focus moves to the new screen title', () => {
  test('home: clicking a menu item puts focus on the screen title @regression', async ({ page }) => {
    await page.goto('./');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await page.locator('nav.main a[data-nav="drive"]').click();
    await expect(page.locator('#hereTitle')).toBeFocused();
    await expect(page.locator('#hereTitle')).toHaveText(/^Drive/);
    await page.locator('nav.main a[data-nav="bin"]').click();
    await expect(page.locator('#hereTitle')).toBeFocused();
  });

  test('CD Hub: a menu button and a Next button both put focus on the new screen heading', async ({ page }) => {
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await page.locator('#nav button[data-go="dogs"]').click();
    const h = page.locator('#main h2').first();
    await expect(h).toBeFocused();
    await page.locator('#nav button[data-go="areas"]').click();
    await expect(page.locator('#main h2').first()).toBeFocused();
    const next = page.locator('#next button[data-go]').first();
    if (await next.count()) { await next.click(); await expect(page.locator('#main h2').first()).toBeFocused(); }
  });
});

test.describe('CD Hub headings', () => {
  test('no screen jumps from a page title straight to a smaller heading', async ({ page }) => {
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    const ids = await page.locator('#nav button[data-go]').evaluateAll((bs) => bs.map((b) => b.dataset.go));
    for (const id of ids) {
      await page.locator(`#nav button[data-go="${id}"]`).click();
      const jumps = await page.evaluate(() => {
        let prev = 1; const bad = [];
        document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => { const l = +h.tagName[1]; if (l > prev + 1) bad.push(h.tagName + ' ' + h.textContent.slice(0, 40)); prev = l; });
        return bad;
      });
      expect(jumps, id).toEqual([]);
    }
  });

  test('Dogs status chips keep full colour (no fading) and show which one is chosen', async ({ page }) => {
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await page.locator('#nav button[data-go="dogs"]').click();
    const chip = page.locator('.sfb').nth(1);
    expect(await chip.evaluate((b) => getComputedStyle(b).opacity)).toBe('1');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(await chip.evaluate((b) => getComputedStyle(b, '::after').content)).toContain('✓');
  });
});
