// JOB 35 regression guard (30 Oct 2026) for the first half of the pages: home (root index.html), cdhub, factory, food.
// The second half (marketplace, privacy, money, studio) is job35b-a11y-budget.spec.js.
// Fails if any view gains an axe problem (WCAG 2.2 AA tags, 1280px and 390px), or if a page's own load (its files from
// this site, signed in with pretend Google, Drive and Sheets) grows more than 10% over the size measured on 30 Oct 2026.
// Every-view-access uses axe's default rules; this adds the WCAG 2.2 tags and phone width.
// When a page is made smaller, or a KNOWN item is fixed, lower its number here so it can never creep back.
const { test, expect } = require('../support/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { HUBS, go } = require('../support/hubs');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Body bytes of the page's own files on first load, measured 30 Oct 2026 (JOB 35.2 audit). Allowed: +10%.
const BYTES = { home: 277000, cdhub: 211500, factory: 205000, food: 113000 };
// food raised 102000 > 113000 on 1 Nov 2026 (JOB 34.3): real growth from the Food stages (orders, growth numbers, fish treats, postage; PRs #199-#210). Measured 113019.
// Known axe problems kept on purpose: { 'page:view@width': { ruleId: places } }, each with its reason.
const KNOWN = {
  // FIX-REQUEST to the Factory owner (JOB 32): the health column header needs visible text; an attribute does not satisfy axe.
  'factory:all@1280': { 'empty-table-header': 1 },
  'factory:all@390': { 'empty-table-header': 1 },
};
const PAGES = [
  { key: 'home', hub: HUBS.home },
  { key: 'cdhub', hub: HUBS.cdhub },
  { key: 'factory', hub: HUBS.factory },
  { key: 'food', hub: HUBS.food },
];

for (const p of PAGES) {
  for (const width of [1280, 390]) {
    test(`${p.key} ${width}px: no new accessibility problems, load within 10%`, async ({ page, guard }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: width > 400 ? 900 : 844 });
      const sizes = [];
      page.on('requestfinished', (r) => { if (new URL(r.url()).hostname === '127.0.0.1') sizes.push(r.sizes().then((s) => s.responseBodySize).catch(() => 0)); });
      await p.hub.open(page, guard);
      await page.waitForLoadState('load');
      const bytes = (await Promise.all(sizes)).reduce((a, b) => a + b, 0);
      expect(bytes, `${p.key} loads ${bytes} bytes of its own files; budget ${BYTES[p.key]} + 10%`).toBeLessThanOrEqual(Math.round(BYTES[p.key] * 1.1));
      const worse = [];
      for (const v of p.hub.views) {
        if (v) await go(page, v);
        const res = await new AxeBuilder({ page }).withTags(TAGS).options({ preload: false }).analyze();
        const known = KNOWN[`${p.key}:${v}@${width}`] || {};
        res.violations.filter((x) => (known[x.id] || 0) < x.nodes.length)
          .forEach((x) => worse.push(`${p.key}:${v || '(page)'} @${width}px ${x.id} (${x.impact}): ${x.nodes.length} place(s). ${x.help}. First: ${x.nodes[0].target.join(' ')}`));
      }
      expect(worse, 'Accessibility got worse').toEqual([]);
    });
  }
}
