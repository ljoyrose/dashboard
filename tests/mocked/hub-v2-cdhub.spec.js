// Hub V2 on the CD Hub (25 Oct 2026, same layout as Marketplace): a bar at the bottom with
// Home, Today, The round, Dogs and More. The full menu (#nav) stays at the top as before.
// Home (Live) opens with "Needs you: N", three big tiles and ONE most urgent card.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('CD Hub: Hub V2 bottom bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the bar is hidden signed out, sits at the bottom after sign-in, every tab routes, no sideways scroll', async ({ page }) => {
    await page.goto('cdhub/');
    await expect(page.locator('#tabs')).toBeHidden();
    await signIn(page);
    const bar = page.locator('#tabs');
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((e) => getComputedStyle(e).position)).toBe('fixed');
    const box = await bar.boundingBox();
    expect(Math.round(box.y + box.height)).toBe(844);
    await expect(bar.locator('button')).toHaveCount(5);
    for (const b of await bar.locator('button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await noSidewaysScroll(page, 'Home');
    for (const [id, h2] of [['today', 'Today'], ['round', null], ['dogs', null], ['more', 'More'], ['map', 'Live']]) {
      await bar.locator(`button[data-go="${id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/${id}$`));
      if (h2) await expect(page.locator('#main h2').first()).toHaveText(h2);
      await expect(bar.locator(`button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(bar.locator('button[aria-current="page"]')).toHaveCount(1);
      if (id !== 'more') await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page'); // top menu agrees
      await noSidewaysScroll(page, id);
    }
    // Sections not in the bar open from More and light up More.
    await bar.locator('button[data-go="more"]').click();
    await page.locator('#moreList button[data-go="litters"]').click();
    await expect(page).toHaveURL(/#\/litters$/);
    await expect(bar.locator('button[data-go="more"]')).toHaveAttribute('aria-current', 'page');
    await noSidewaysScroll(page, 'litters');
  });

  test('Home opens with Needs you: N, three tiles that open tabs, then one urgent card; the full menu is still there', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#needsLine')).toContainText(/^Needs you: \d+$/);
    const n = Number((await page.locator('#needsLine').textContent()).match(/\d+/)[0]);
    const bad = await page.locator('.chk .ci.bad').count();
    expect(n).toBe(bad);
    const tiles = page.locator('#homeTiles button.htile');
    await expect(tiles).toHaveCount(3);
    for (const t of await tiles.all()) expect((await t.boundingBox()).height).toBeGreaterThanOrEqual(52);
    await expect(page.locator('#urgentOne')).toHaveCount(n ? 1 : 0);
    await expect(page.locator('#nav button[data-go]')).toHaveCount(10);
    await tiles.nth(1).click();
    await expect(page).toHaveURL(/#\/round$/);
  });

  test('deep links still open their section and light the right tab', async ({ page }) => {
    await page.goto('cdhub/#/vet');
    await signIn(page);
    await expect(page.locator('#nav button[data-go="vet"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#tabs button[data-go="more"]')).toHaveAttribute('aria-current', 'page');
  });
});
