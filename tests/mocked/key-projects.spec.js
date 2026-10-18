// Home screen: Key projects & docs. Big links, one tap each, on a phone-sized screen.
const { test, expect } = require('../support/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MOVE = 'https://docs.google.com/spreadsheets/d/1AIgIefQMATEdWLtAkdvE7SvdnX8g2sTX87VnvOX5c-I/edit';
const TILES = [
  ['MOVE', MOVE, true],
  ['Money Hub', 'money/', false],
  ['CD Hub', 'cdhub/', false],
  ['Map', '#/map', false],
  ['Read first', '#/readfirst', false],
  ['Drive', '#/drive', false],
  ['PC-Personal', '#/personal', false],
  ['Drive check', '#/usb', false],
  ['Bin', '#/bin', false],
  ['Changes', '#/changes', false],
];

function pageFile(href) {
  const route = href.split('#')[0];
  if (!route || route === './') return 'index.html';
  const rel = route.replace(/^\.\//, '').replace(/\/$/, '');
  if (fs.existsSync(path.join(ROOT, rel, 'index.html'))) return rel + '/index.html';
  return rel;
}

test.describe('Home: Key projects & docs', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the block is hidden until sign-in, then every tile has a working link and is tap-sized', async ({ page }) => {
    const res = await page.goto('./');
    expect(res.status()).toBe(200);

    // Signed out: the links are not drawn at all, only the sign-in card.
    await expect(page.locator('#key-projects')).toHaveCount(0);
    await expect(page.locator('#move-link')).toHaveCount(0);
    await expect(page.locator('a.keytile')).toHaveCount(0);
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#mainNav')).toBeVisible();
    await expect(page.locator('#hereTitle')).toHaveText('Map');
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);

    const block = page.locator('#view > #key-projects');
    await expect(block).toBeVisible();
    await expect(block.locator('h2')).toHaveText('Key projects & docs');
    const top = await block.boundingBox();
    expect(top.y).toBeLessThan(420);

    const move = page.locator('#move-link');
    await expect(move).toHaveAttribute('href', MOVE);
    await expect(move).toHaveAttribute('target', '_blank');
    expect(() => new URL(MOVE)).not.toThrow();

    const tiles = block.locator('a.keytile');
    await expect(tiles).toHaveCount(TILES.length);
    for (let i = 0; i < TILES.length; i++) {
      const [label, href, blank] = TILES[i];
      const tile = tiles.nth(i);
      await expect(tile).toHaveText(label);
      await expect(tile).toHaveAttribute('href', href);
      if (blank) await expect(tile).toHaveAttribute('target', '_blank');
      else expect(await tile.getAttribute('target')).toBeNull();

      const box = await tile.boundingBox();
      expect(box.height, label).toBeGreaterThanOrEqual(48);
      const font = await tile.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(font, label).toBeGreaterThanOrEqual(16);

      if (/^https?:\/\//.test(href)) {
        const url = new URL(href);
        expect(url.protocol).toBe('https:');
        expect(url.hostname).toBeTruthy();
      } else {
        const file = pageFile(href);
        expect(fs.existsSync(path.join(ROOT, file)), href + ' -> ' + file).toBe(true);
        const got = await page.request.get(href.split('#')[0] || './');
        expect(got.status(), href).toBe(200);
      }
    }

    // Signing out removes the links again.
    await page.locator('#signOutBtn').click();
    await expect(page.locator('#key-projects')).toHaveCount(0);
  });
});
