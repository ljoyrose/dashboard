// How the three pages LOOK and READ: dark mode, accessibility (axe) and smallest text size.
// Same pretend Google and Drive as everywhere else. Cheap extras: they never need real data.
//
// Accessibility and text size are a RATCHET, not a wish list: today's known problems are written down below,
// and the test fails only if something gets WORSE (a new kind of problem, more of one kind, or smaller text).
// When you fix one, lower the number here so it can never creep back. Known problems are listed in TESTS.md.
const { test, expect } = require('../support/test');
const AxeBuilder = require('@axe-core/playwright').default;

const PAGES = [
  { key: 'main', name: 'Main dashboard', url: './', button: '#signInBtn', ready: '#readStamp', after: /^Read \d/ },
  { key: 'cdhub', name: 'CD Hub', url: 'cdhub/', button: '#signinbtn', ready: '#nav button[data-go]', after: null },
  { key: 'money', name: 'Money Hub', url: 'money/', button: '#signInBtn', ready: '#readStamp', after: /^Read \d/ },
];

// Known problems today: { 'page/colour-scheme/signed-out|in': { ruleId: most nodes allowed } }
const KNOWN_AXE = {
  'main/light/out': { 'heading-order': 1 },
  'main/dark/out': { 'heading-order': 1 },
  'cdhub/light/out': { 'heading-order': 1 },
  'cdhub/dark/out': { 'heading-order': 1 },
  'cdhub/light/in': { 'color-contrast': 4, 'heading-order': 1 },
  'cdhub/dark/in': { 'color-contrast': 4, 'heading-order': 1 },
};
// Every other view (Bin, Drive, Money entity pages, all CD Hub sections) is checked in every-view-access.spec.js.
// Smallest text allowed, in pixels, per page (today's smallest). Raise when text is made bigger.
const MIN_FONT_PX = { main: 13, cdhub: 13, money: 13 };

async function open(page, p, signedIn) {
  await page.goto(p.url);
  await expect(page.locator(p.button)).toBeEnabled();
  if (!signedIn) return;
  await page.locator(p.button).click();
  if (p.after) await expect(page.locator(p.ready)).toContainText(p.after);
  else await expect(page.locator(p.ready).first()).toBeVisible();
}

test.describe('Dark mode (browser set to dark)', () => {
  test.use({ colorScheme: 'dark' });
  for (const p of PAGES) {
    test(`${p.name}: loads, signs in and shows its sections, no unexpected errors`, async ({ page }) => {
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
      await open(page, p, false);
      await open(page, p, true);
      // dark mode must not blank the page: the page background is dark and there is visible text
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const [r, g, b] = bg.match(/\d+/g).map(Number);
      expect(r + g + b, `page background ${bg} should be dark`).toBeLessThan(384);
      expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(50);
    });
  }
});

test.describe('Accessibility (axe) and smallest text', () => {
  for (const p of PAGES) {
    for (const scheme of ['light', 'dark']) {
      for (const signedIn of [false, true]) {
        const state = signedIn ? 'in' : 'out';
        test(`${p.name} ${scheme} ${signedIn ? 'signed in' : 'signed out'}: no new accessibility problems`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: scheme });
          await open(page, p, signedIn);
          const res = await new AxeBuilder({ page }).options({ preload: false }).analyze();
          const known = KNOWN_AXE[`${p.key}/${scheme}/${state}`] || {};
          const worse = res.violations
            .filter((v) => (known[v.id] || 0) < v.nodes.length)
            .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} place(s), allowed ${known[v.id] || 0}. ${v.help}. First: ${v.nodes[0].target.join(' ')}`);
          expect(worse, 'Accessibility got worse').toEqual([]);
        });
      }
    }

    test(`${p.name}: no text smaller than ${MIN_FONT_PX[p.key]}px`, async ({ page }) => {
      await open(page, p, true);
      const small = await page.evaluate((floor) => {
        const bad = [];
        document.querySelectorAll('body *').forEach((e) => {
          if (!e.offsetParent) return; // hidden
          if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
          const px = parseFloat(getComputedStyle(e).fontSize);
          if (px < floor) bad.push(`${px}px "${e.textContent.trim().slice(0, 30)}"`);
        });
        return bad.slice(0, 5);
      }, MIN_FONT_PX[p.key]);
      expect(small, 'Text smaller than the floor').toEqual([]);
    });
  }
});
