// Hub V2 on the Money Hub (25 Oct 2026, same layout as Marketplace): a bar at the bottom with
// Home, Money, Dates, To-do and More. Home opens with "Needs you: N", three big tiles and ONE most urgent card.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('Money Hub: Hub V2 bottom bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the bar is hidden signed out, sits at the bottom after sign-in, every tab routes, no sideways scroll', async ({ page }) => {
    await page.goto('money/');
    await expect(page.locator('#tabs')).toBeHidden();
    await signIn(page);
    const bar = page.locator('#tabs');
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((e) => getComputedStyle(e).position)).toBe('fixed');
    const box = await bar.boundingBox();
    expect(Math.round(box.y + box.height)).toBe(844);
    await expect(bar.locator('a')).toHaveCount(5);
    for (const a of await bar.locator('a').all()) expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await noSidewaysScroll(page, 'Home');
    for (const [key, title] of [['money', 'Money'], ['dates', 'Dates'], ['todo', 'To-do'], ['more', 'More'], ['now', 'Now']]) {
      await bar.locator(`a[data-nav="${key}"]`).click();
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(bar.locator(`a[data-nav="${key}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(bar.locator('a[aria-current="page"]')).toHaveCount(1);
      const bg = await bar.locator(`a[data-nav="${key}"]`).evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(bg, title + ': selected tab has a fill').not.toBe('rgba(0, 0, 0, 0)');
      await noSidewaysScroll(page, title);
    }
    // Accountant and Control open from More, and light up More.
    for (const [key, title] of [['accountant', 'Accountant'], ['control', 'Control']]) {
      await bar.locator('a[data-nav="more"]').click();
      await page.locator(`#view a[data-nav="${key}"]`).click();
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(bar.locator('a[data-nav="more"]')).toHaveAttribute('aria-current', 'page');
      await noSidewaysScroll(page, title);
    }
  });

  test('Home opens with Needs you: N, three tiles that open tabs, then one urgent card', async ({ page }) => {
    await page.goto('money/');
    await signIn(page);
    const top = page.locator('#view > #homeTop');
    await expect(top).toBeVisible();
    const tagText = await page.locator('#view > section.now .cardhead .tag').textContent();
    const total = /All clear/.test(tagText) ? 0 : Number(tagText.match(/\d+/)[0]);
    await expect(top.locator('.needsline')).toHaveText('Needs you: ' + total);
    if (total) await expect(page.locator('#n-now')).toHaveText(String(total));
    const tiles = top.locator('a.hometile');
    await expect(tiles).toHaveCount(3);
    for (const t of await tiles.all()) expect((await t.boundingBox()).height).toBeGreaterThanOrEqual(52);
    await expect(top.locator('#urgentOne')).toHaveCount(1);
    await tiles.nth(1).click();
    await expect(page.locator('#hereTitle')).toHaveText('Dates');
  });

  test('deep links still land on their section and light the right tab', async ({ page }) => {
    for (const [hash, title, tab] of [['#/e/TESTCO', 'TESTCO', 'money'], ['#/control', 'Control', 'more'], ['#/register/R001', 'To-do', 'todo']]) {
      await page.goto('money/' + hash);
      await signIn(page);
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await expect(page.locator(`#tabs a[data-nav="${tab}"]`)).toHaveAttribute('aria-current', 'page');
      await page.locator('#signOutBtn').click();
    }
  });
});
