// Home screen: Key projects & docs. Big links, one tap each, on a phone-sized screen.
const { test, expect } = require('../support/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MOVE = require('../support/world').IDS.moveSheet; // read from config.js, never copied (this repo is public)
const TILES = [
  ['MOVE', MOVE, true],
  ['Money Hub', 'money/', true],
  ['CD Hub', 'cdhub/', true],
  ['Factory', 'factory/', true],
  ['Marketplace', 'marketplace/', true],
  ['GA Hub', 'food/', true],
  ['Studio', 'studio/', true],
  ['Web Estate', 'estate/', true],
];
// As shipped: config.js may hold the Projects Hub address; its tile then comes last.
const PH = require('../support/world').IDS.projectsHub;
const SHIPPED = PH ? TILES.concat([['Projects Hub', PH, true]]) : TILES;

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
    await expect(page.locator('#hereTitle')).toHaveText('Dashboard');
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);

    const block = page.locator('#view > #key-projects');
    await expect(block).toBeVisible();
    await expect(block.locator('h2')).toHaveText('Key projects & docs');
    // Hub V2: "Needs you" and its tiles come first; Key projects still starts on the first screen, above the bottom bar.
    const top = await block.boundingBox();
    expect(top.y).toBeLessThan(844 - 96);

    const move = page.locator('#move-link');
    await expect(move).toHaveAttribute('href', MOVE);
    await expect(move).toHaveAttribute('target', '_blank');
    expect(() => new URL(MOVE)).not.toThrow();

    const tiles = block.locator('a.keytile');
    await expect(tiles).toHaveCount(SHIPPED.length);
    await expect(block.locator('a.keytile[href="#/drive"]')).toHaveCount(0);
    await expect(block.getByRole('link', { name: 'Drive', exact: true })).toHaveCount(0);
    await expect(page.locator('#mainNav a[data-nav="drives"]')).toHaveAttribute('href', '#/drives');
    for (let i = 0; i < SHIPPED.length; i++) {
      const [label, href, blank] = SHIPPED[i];
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
    // On a phone Sign out sits inside the Look menu (the top bar, Lisa's pick A).
    await page.locator('#houseLookBtn').click();
    await page.locator('#houseLook').getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.locator('#key-projects')).toHaveCount(0);
  });

  // Projects Hub: no tile while config.js has no address (as shipped); a tile only for a valid Apps Script /exec address.
  // The addresses below are invented (EXAMPLE), never a real deployment.
  for (const [what, url, shown] of [
    ['valid /exec address', 'https://script.google.com/macros/s/EXAMPLE-PROJECTS-HUB/exec', true],
    ['valid work-account /exec address', 'https://script.google.com/a/macros/puppyclassroom.com/s/EXAMPLE-PROJECTS-HUB/exec', true],
    ['not an Apps Script address', 'https://example.com/projects', false],
  ]) {
    test('Projects Hub tile: ' + what, async ({ page }) => {
      await page.route('**/config.js', async (route) => {
        const res = await route.fetch();
        const body = (await res.text()) + "\nwindow.DASH_CONFIG.projectsHub = { webAppUrl: " + JSON.stringify(url) + " };\n";
        await route.fulfill({ response: res, body });
      });
      await page.goto('./');
      await page.locator('#signInBtn').click();
      await expect(page.locator('#readStamp')).toContainText(/^Read \d/); // reads finished: no more redraws
      const block = page.locator('#view > #key-projects');
      await expect(block).toBeVisible();
      const tile = block.getByRole('link', { name: 'Projects Hub', exact: true });
      if (!shown) { await expect(tile).toHaveCount(0); await expect(block.locator('a.keytile')).toHaveCount(TILES.length); return; }
      await expect(tile).toHaveAttribute('href', url);
      await expect(tile).toHaveAttribute('target', '_blank');
      await expect(block.locator('a.keytile')).toHaveCount(TILES.length + 1);
      await expect(tile).toBeVisible();
      const box = await tile.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(48);
    });
  }
});
