// PHONE SUBSET. Pixel-sized screen (390 x 844). Deliberately small: it does NOT repeat the desktop suite.
// For each of the three pages: it loads, the menu works, nothing unexpected in the browser's error log
// (the shared guard in tests/support/test.js does that on every test), and nothing scrolls sideways.
// Google sign-in and Drive are pretend here too.
const { test, expect } = require('../support/test');

// Sideways scroll = the page is wider than the screen. 1px of slack for rounding.
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('Phone: Main dashboard', () => {
  test('loads, signs in, menu works, no sideways scroll', async ({ page }) => {
    expect((await page.goto('./')).status()).toBe(200);
    await noSidewaysScroll(page, 'signed out');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await noSidewaysScroll(page, 'Map');
    for (const [key, title] of [['drive', 'Drive'], ['bin', 'Bin'], ['changes', 'Changes · Recent'], ['map', 'Map']]) {
      await page.locator(`#mainNav a[data-nav="${key}"]`).click();
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await noSidewaysScroll(page, title);
    }
  });
});

test.describe('Phone: CD Hub', () => {
  test('loads, signs in, menu works, no sideways scroll', async ({ page }) => {
    expect((await page.goto('cdhub/')).status()).toBe(200);
    await noSidewaysScroll(page, 'signed out');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await noSidewaysScroll(page, 'first section');
    for (const id of ['dogs', 'litters', 'work', 'map']) {
      await page.locator(`#nav button[data-go="${id}"]`).click();
      await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'true');
      await noSidewaysScroll(page, id);
    }
  });
});

test.describe('Phone: Money Hub', () => {
  test('loads, signs in, menu works, no sideways scroll', async ({ page }) => {
    expect((await page.goto('money/')).status()).toBe(200);
    await noSidewaysScroll(page, 'signed out');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await noSidewaysScroll(page, 'Now');
    for (const [key, title] of [['money', 'Money'], ['dates', 'Dates'], ['todo', 'To-do'], ['control', 'Control'], ['now', 'Now']]) {
      await page.locator(`nav.main a[data-nav="${key}"]`).click();
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await noSidewaysScroll(page, title);
    }
  });
});
