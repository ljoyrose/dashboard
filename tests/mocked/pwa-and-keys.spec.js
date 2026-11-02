// Phone install (manifest, icon, service worker) and keyboard keys.
// The service worker may keep ONLY the site's own page files: never Drive data, never the sign-in token.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { BASE, esc, at } = require('../support/site');

const ROOT = path.resolve(__dirname, '..', '..');
const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Install on your phone', () => {
  test('every page links the manifest and a real icon, and the manifest is valid', async ({ page }) => {
    for (const [url, pre] of [['./', ''], ['money/', '../'], ['cdhub/', '../']]) {
      await page.goto(url);
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', pre + 'manifest.webmanifest');
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', pre + 'icons/icon.svg');
    }
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
    for (const i of m.icons) expect(fs.existsSync(path.join(ROOT, i.src)), i.src).toBe(true);
    expect(m.icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(m.icons.some((i) => i.sizes === '512x512')).toBe(true);
  });

  test('the service worker code never keeps Drive data, Google addresses or anything with a sign-in token', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    expect(sw).not.toMatch(/googleapis|accounts\.google|localStorage|sessionStorage|access_token/);
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
    expect(sw).toMatch(/headers\.get\('Authorization'\)\) return/);
  });

  test.describe('with the service worker running', () => {
    test.use({ serviceWorkers: 'allow' });
    test('after signing in and reading, the kept copy holds only the page files @regression', async ({ page }) => {
      await page.goto('./');
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await signIn(page);
      await page.goto('money/'); // already signed in: the sign-in is shared between the pages
      await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
      const kept = await page.evaluate(async () => {
        const out = [];
        for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(new URL(r.url).pathname);
        return out.sort();
      });
      expect(kept.length).toBeGreaterThan(5);
      for (const p of kept) expect(p, 'kept: ' + p).toMatch(new RegExp('^' + esc(BASE) + /(|index\.html|auth\.js|config\.js|toolkit\.js|tokens\.css|house\.css|manifest\.webmanifest|sw\.js|icons\/icon[-\w]*\.(svg|png)|money\/|money\/index\.html|money\/core\.js|cdhub\/|cdhub\/index\.html|studio\/|studio\/index\.html|factory\/|factory\/index\.html|food\/|food\/index\.html|marketplace\/|marketplace\/index\.html)$/.source));
    });
  });
});

test.describe('Keyboard keys', () => {
  test('? shows the list, g then b opens the Bin, g then m goes back to the Map', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await page.keyboard.press('?');
    const dlg = page.locator('#dashKeys');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('Bin');
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await page.keyboard.press('g');
    await page.keyboard.press('b');
    await expect(page).toHaveURL(/#\/bin$/);
    await page.keyboard.press('g');
    await page.keyboard.press('m');
    await expect(page).toHaveURL(/#\/map$/);
  });

  test('r reads again, and keys do nothing while typing in a box', async ({ page, guard }) => {
    await page.goto('./#/drives/shared/drv-alpha1');
    await signIn(page);
    const before = guard.world.calls.filter((c) => c.path === '/drives').length;
    await page.keyboard.press('r');
    await expect.poll(() => guard.world.calls.filter((c) => c.path === '/drives').length).toBeGreaterThan(before);
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await page.goto('cdhub/'); // already signed in: the sign-in is shared between the pages
    await page.locator('#nav button[data-go="dogs"]').click();
    const box = page.locator('#main .srch input').first();
    await box.click();
    await page.keyboard.type('gb?');
    await expect(page).toHaveURL(/cdhub\//);
    await expect(page.locator('#dashKeys')).toHaveCount(0);
  });

  test('g then f opens Money Hub from CD Hub', async ({ page }) => {
    await page.goto('cdhub/');
    await page.keyboard.press('g');
    await page.keyboard.press('f');
    await expect(page).toHaveURL(at('money/'));
  });
});

// JOB 35 (30 Oct 2026) @regression: Factory, Food and Marketplace were left out of the phone's kept copy, so they did
// not open offline while Money, CD Hub and Studio did. Every hub page the site publishes must be on the list.
test('@regression every published hub page is on the service worker list', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const hub of ['money', 'cdhub', 'studio', 'factory', 'food', 'marketplace']) {
    expect(sw, hub).toContain(`'${hub}/', '${hub}/index.html'`);
  }
});
