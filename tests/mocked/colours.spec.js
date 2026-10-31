// One shared colour file (tokens.css) for all three pages, LJR7 palette A "Clear". Pretend Google and Drive.
const { test, expect } = require('../support/test');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const FILLS = { 2: '#E6443D', 3: '#E78615', 4: '#F3D84E', 5: '#51AD57', 6: '#129FE7', 7: '#A570D1' };
const OLD_SOFT = ['#BE6A5D', '#C07D59', '#B3A74D', '#89AF6A', '#4098BE', '#8D6B9C', '#756E65'];

test('tokens.css holds palette A and every slot has a readable text colour', () => {
  const css = read('tokens.css');
  for (const [k, hex] of Object.entries(FILLS)) expect(css, `slot ${k}`).toContain(`--ljr-${k}: ${hex};`);
  for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8]) expect(css).toMatch(new RegExp(`--ljr-${k}-text:`));
});

test('no page hard-codes the old soft LJR7 colours (a palette swap is one change in tokens.css)', () => {
  const bad = [];
  for (const f of ['index.html', 'money/index.html', 'cdhub/index.html', 'money/core.js']) {
    const text = read(f).toUpperCase();
    OLD_SOFT.forEach((h) => { if (text.includes(h)) bad.push(`${f}: ${h}`); });
  }
  expect(bad).toEqual([]);
});

for (const [name, url] of [['Main dashboard', './'], ['Money Hub', 'money/'], ['CD Hub', 'cdhub/']]) {
  test(`${name} loads tokens.css and uses its colours`, async ({ page }) => {
    await page.goto(url);
    const v = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ljr-2').trim().toUpperCase());
    expect(v).toBe(FILLS[2]);
  });
}

// Calm layer (Lisa, 20 Oct 2026), house look (28 Oct): the slot colour shows on hover, so the check hovers first.
// Bottom tabs carry their colour in the small bar above the label (slot 8 = warm charcoal #3A3632, never black);
// Stage 2c removed the More tab, so Money (slot 3) is checked on its Dashboard card and Work My Drive (slot 4) on its Drives page.
test('the colour carries meaning on the dashboard menu: Bin is slot 8, Money slot 3, Work My Drive slot 4', async ({ page }) => {
  await page.goto('./');
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await page.locator('#mainNav a[data-nav="bin"]').hover();
  expect(await page.locator('#mainNav a[data-nav="bin"] .bar').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(58, 54, 50)');
  const slot = (sel) => page.locator(sel).first().evaluate((e) => { const d = document.createElement('i'); d.style.color = getComputedStyle(e).getPropertyValue('--slot').trim(); document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  await expect(page.locator('#view section.card.slotfin')).toHaveCount(1);
  expect(await slot('#view section.card.slotfin')).toBe('rgb(231, 134, 21)');
  await page.locator('#mainNav a[data-nav="drives"]').click();
  await page.locator('#view nav.subnav a', { hasText: /^Work My Drive$/ }).click();
  expect(await slot('#view section.card.slot4')).toBe('rgb(243, 216, 78)');
});
