// One name for the front page ("Dashboard"), one way back to it ("← Dashboard"), and no "Next:" cards.
const { test, expect } = require('../support/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const HUBS = ['money', 'cdhub', 'factory', 'food', 'marketplace', 'studio'];
const VIEWS = ['drives', 'drives/shared', 'drives/readfirst', 'drives/work', 'drives/personal-drive', 'drives/usb', 'bin', 'changes'];

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Structure: one name and one way back', () => {
  test('the front page is called "Dashboard" in the tab, the title and the page name', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#hereTitle')).toHaveText('Dashboard');
    await expect(page).toHaveTitle(/Dashboard · Lisa Dashboard$/);
    await expect(page.locator('nav.main a[data-nav="map"]')).toContainText('Dashboard');
    // No visible link to #/map is named "Map" or "Home".
    const names = await page.locator('a[href="#/map"]:visible').allInnerTexts();
    for (const n of names) expect(n.trim()).not.toMatch(/^(Map|Home)\b/);
    await expect(page.locator('#view a.btn.back[data-back-home]')).toHaveCount(0);
  });

  for (const v of VIEWS) {
    test(`#/${v} has exactly one "← Dashboard" back link, top left, and no "Next:" cards`, async ({ page }) => {
      await page.goto('./#/' + v);
      await signIn(page);
      const back = page.locator('#view a[data-back-home]');
      await expect(back).toHaveCount(1);
      await expect(back).toHaveClass(/\bbtn\b/);
      await expect(back).toHaveClass(/\bback\b/);
      await expect(back).toHaveText('← Dashboard');
      await expect(back).toHaveAttribute('href', '#/map');
      const first = await page.locator('#view > *').first().locator('a[data-back-home]').count();
      expect(first).toBe(1);
      await expect(page.locator('#view nav.next')).toHaveCount(0);
      await expect(page.locator('#view', { hasText: 'Next:' })).toHaveCount(0);
    });
  }

  test('index.html has no nextSteps calls and no NX list', () => {
    const s = read('index.html');
    expect(s.match(/nextSteps\(/g)).toBeNull();
    expect(s).not.toMatch(/\bNX\./);
    expect(s).toMatch(/<h2 id="hereTitle"[^>]*>Dashboard<\/h2>/);
  });

  test('the hidden key "g m" is named "Dashboard"', () => {
    expect(read('toolkit.js')).toMatch(/\['g m', 'Dashboard'/);
  });

  // The top bar (Lisa's pick A, 2 Nov 2026): the way back is the Home icon, first in the bar, named "Dashboard" for screen readers.
  for (const h of HUBS) {
    test(`${h}/ has exactly one Home icon link named "Dashboard" with class "btn back", first in the top bar`, () => {
      const s = read(h + '/index.html');
      const btns = s.match(/<a [^>]*data-back-home[^>]*>(?:(?!<\/a>)[\s\S])*<\/a>/g) || [];
      const back = btns.filter((a) => /class="[^"]*\bbtn\b[^"]*\bback\b[^"]*"/.test(a));
      expect(back).toHaveLength(1);
      expect(back[0]).toMatch(/^<a id="backHome" class="btn back[^"]*\bhouse-ib\b[^"]*" href="\.\.\/" data-back-home aria-label="Dashboard" title="Dashboard">/);
      expect(back[0]).toMatch(/><svg aria-hidden="true"><use href="#hi-home"\/><\/svg><\/a>$/);   // the icon only, no words on screen
      const head = s.slice(s.indexOf('<header'), s.indexOf('</header>'));
      expect(head.indexOf(back[0]), 'inside the top bar').toBeGreaterThan(-1);
      expect(head.replace(/<header[^>]*>\s*<div[^>]*>\s*/, '').indexOf('<a id="backHome"'), 'first in the bar').toBe(0);
    });
  }
});
