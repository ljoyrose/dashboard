// Accessibility (axe) on EVERY view of the three pages, not just the first screen (review part 2, G1).
// Same ratchet idea as look-and-access.spec.js: today's known problems are written down below and the test
// fails only if a view gets WORSE. When you fix something, lower the number so it can never creep back.
// Run with MEASURE=1 to print today's numbers instead of checking them.
const { test, expect } = require('../support/test');
const AxeBuilder = require('@axe-core/playwright').default;

const MAIN = ['map', 'readfirst', 'drive', 'drive/drv-alpha1', 'personal', 'usb', 'bin', 'changes/recent', 'changes/24h', 'changes/7d', 'changes/totals'];
const MONEY = ['now', 'money', 'dates', 'todo', 'accountant', 'control', 'e/TESTCO', 'e/TESTPERS'];
const CDHUB = ['map', 'work', 'shape', 'today', 'round', 'dogs', 'areas', 'litters', 'vet', 'buyers'];

// Known problems today: { 'page:view:scheme': { ruleId: most places allowed } }. Anything missing = 0 allowed.
const KNOWN = require('./every-view-access.known.json');

const PAGES = [
  { key: 'main', url: './', button: '#signInBtn', views: MAIN,
    ready: async (page) => expect(page.locator('#readStamp')).toContainText(/^Read \d/),
    open: async (page, v) => { await page.evaluate((h) => { location.hash = h; }, '#/' + v); await expect(page.locator('#view')).toHaveAttribute('data-view', v.split('/')[0]); } },
  { key: 'money', url: 'money/', button: '#signInBtn', views: MONEY,
    ready: async (page) => expect(page.locator('#readStamp')).toContainText(/^Read \d/),
    open: async (page, v) => { await page.evaluate((h) => { location.hash = h; }, '#/' + v); await page.waitForTimeout(150); } },
  { key: 'cdhub', url: 'cdhub/', button: '#signinbtn', views: CDHUB,
    ready: async (page) => expect(page.locator('#nav button[data-go]').first()).toBeVisible(),
    open: async (page, v) => { await page.locator(`#nav button[data-go="${v}"]`).click(); await expect(page.locator(`#nav button[data-go="${v}"]`)).toHaveAttribute('aria-current', 'page'); } },
];

const measured = {};
for (const p of PAGES) {
  for (const scheme of ['light', 'dark']) {
    test(`${p.key} ${scheme}: every view, no new accessibility problems`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(p.url);
      await expect(page.locator(p.button)).toBeEnabled();
      await page.locator(p.button).click();
      await p.ready(page);
      const worse = [];
      for (const v of p.views) {
        await p.open(page, v);
        const res = await new AxeBuilder({ page }).options({ preload: false }).analyze();
        const key = `${p.key}:${v}:${scheme}`;
        const known = KNOWN[key] || {};
        if (process.env.MEASURE) { measured[key] = Object.fromEntries(res.violations.map((x) => [x.id, x.nodes.length])); continue; }
        res.violations.filter((x) => (known[x.id] || 0) < x.nodes.length)
          .forEach((x) => worse.push(`${key} ${x.id} (${x.impact}): ${x.nodes.length} place(s), allowed ${known[x.id] || 0}. ${x.help}. First: ${x.nodes[0].target.join(' ')}`));
      }
      if (process.env.MEASURE) { console.log('MEASURED ' + JSON.stringify(measured)); return; }
      expect(worse, 'Accessibility got worse').toEqual([]);
    });
  }
}
