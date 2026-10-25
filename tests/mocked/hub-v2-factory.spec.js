// Hub V2 on the Factory (25 Oct 2026, same layout as Marketplace): a bar at the bottom with
// Me, Decide, Do, Rooms and More (Docs, Today, All apps). Me opens with "Needs you: N" and three big tiles.
// Pretend Google and Drive only; the data is tests/fixtures/factory/state.js (invented).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'factory', 'index.html'), 'utf8');
const LOGS = /logs: '([^']+)'/.exec(SRC)[1];

async function open(page, guard, hash) {
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(build(Date.now())), { parents: [LOGS], mimeType: 'application/json' });
  await page.goto('factory/' + hash);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await expect(page.locator('#tabs')).toBeHidden(); // no menu until signed in
  await page.locator('#signInBtn').click();
  await expect(page.locator('#appPick')).toBeVisible();
}
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('Factory: Hub V2 bottom bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the bar sits at the bottom after sign-in, every tab routes, no sideways scroll', async ({ page, guard }) => {
    await open(page, guard, '#/rooms');
    const bar = page.locator('#tabs');
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((e) => getComputedStyle(e).position)).toBe('fixed');
    const box = await bar.boundingBox();
    expect(Math.round(box.y + box.height)).toBe(844);
    await expect(bar.locator('a')).toHaveCount(5);
    for (const a of await bar.locator('a').all()) expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await noSidewaysScroll(page, 'Rooms');
    for (const key of ['me', 'decide', 'do', 'more', 'rooms']) {
      await bar.locator(`a[data-nav="${key}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/${key}`));
      await expect(bar.locator(`a[data-nav="${key}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(bar.locator('a[aria-current="page"]')).toHaveCount(1);
      await noSidewaysScroll(page, key);
    }
    // Docs and Today open from More and light up More.
    for (const key of ['docs', 'today']) {
      await bar.locator('a[data-nav="more"]').click();
      await page.locator(`#moreList a[href="#/${key}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/${key}`));
      await expect(bar.locator('a[data-nav="more"]')).toHaveAttribute('aria-current', 'page');
      await noSidewaysScroll(page, key);
    }
  });

  test('Me opens with Needs you: N and three tiles that open tabs; the Me tab carries the count', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    const n = await page.locator('#nMe').textContent();
    await expect(page.locator('#homeTop .needsline')).toHaveText('Needs you: ' + n);
    const tiles = page.locator('#homeTop a.hometile');
    await expect(tiles).toHaveCount(3);
    for (const t of await tiles.all()) expect((await t.boundingBox()).height).toBeGreaterThanOrEqual(52);
    await expect(tiles.nth(0).locator('.v')).toHaveText(await page.locator('#nDecide').textContent());
    await tiles.nth(1).click();
    await expect(page).toHaveURL(/#\/do/);
    await expect(page.locator('#tabs a[data-nav="do"]')).toHaveAttribute('aria-current', 'page');
  });

  test('deep links still land and light the right tab', async ({ page, guard }) => {
    await open(page, guard, '#/item/wrk000009');
    await expect(page.locator('#tabs a[aria-current="page"]')).toHaveCount(0);
    await page.goto('factory/#/today');
    await expect(page.locator('#tabs a[data-nav="more"]')).toHaveAttribute('aria-current', 'page');
  });
});
