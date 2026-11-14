// Dashboard › More › Tech on a phone (TECH-HUB-1): at 360px and 390px the search box is full width, tiles stack in one column,
// nothing scrolls sideways, and every button is phone-sized. Invented rows only (tests/fixtures/tech-tools.js).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const FX = require('../fixtures/tech-tools');
const SHOTS = process.env.TECH_SHOTS;

for (const width of [360, 390]) {
  test(`Tech at ${width}px: one column, full-width search, no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.route(/^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\/OWNED_TOOLS/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: FX.values() }) }));
    await page.goto('./');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toBeAttached();
    await page.evaluate(() => { location.hash = '#/tech'; });
    const sec = page.locator('#techSec');
    await expect(sec).toHaveAttribute('data-tech', 'live');
    await expect(sec.locator('.ttile').first()).toBeVisible();
    // Phone: the filter chips start folded behind Filter.
    await expect(sec.locator('#techFbody')).toBeHidden();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
    const box = await sec.locator('.tbar .sbox').boundingBox(), bar = await sec.locator('.tbar').boundingBox();
    expect(Math.round(box.width)).toBe(Math.round(bar.width));
    const lefts = await sec.locator('.tgroup[data-group="comms"] .ttile').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1); // stacked
    for (const b of await sec.locator('.tbar .srow button, a.tt-rev').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await sec.locator('[data-action="techfilter"]').click();
    await expect(sec.locator('#techFbody')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.addStyleTag({ content: 'nav.main { position: static !important; }' }); await page.screenshot({ path: path.join(SHOTS, `tech-phone-${width}.png`), fullPage: true }); }
  });
}
