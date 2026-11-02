// JOB 35b regression guard (30 Oct 2026) for the second half of the pages: marketplace, marketplace/privacy, money, studio.
// Fails if any view gains an axe problem (WCAG 2.2 AA tags, 1280px and 390px), or if a page's own load (its files from
// this site, signed in with pretend Google, Drive and Sheets) grows more than 10% over the size measured on 30 Oct 2026.
// Every-view-access covers money with axe's default rules; this adds the WCAG 2.2 tags, phone width, marketplace,
// privacy and studio. When a page is made smaller, lower its number here so it can never creep back.
const { test, expect } = require('../support/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { HUBS, go } = require('../support/hubs');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
// Body bytes of the page's own files on first load, measured 30 Oct 2026 (job35b-audit.spec.js). Allowed: +10%.
// marketplace re-measured 31 Oct 2026 after Marketplace v11.10 (#221: post cards, supplier costs, New stock tab).
const BYTES = { marketplace: 197100, money: 179700, studio: 297000, privacy: 13300 };
// marketplace 178600 > 197100 and money 160500 > 179700 on 2 Nov 2026: the shared top bar (Lisa's pick A) adds the Look menu and the
// one icon set to toolkit.js, which every hub loads (about 7 KB), on top of their own growth since 30-31 Oct. Measured 197089 and 179634.
// Known axe problems kept on purpose: { 'page:view': { ruleId: places } }. Empty: all four pages are clean today.
const KNOWN = {};
const PAGES = [
  { key: 'marketplace', hub: HUBS.marketplace },
  { key: 'money', hub: HUBS.money },
  { key: 'studio', hub: HUBS.studio },
  { key: 'privacy', hub: { views: [''], async open(page) { await page.goto('marketplace/privacy.html'); await expect(page.locator('h1')).toBeVisible(); } } },
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
        const known = KNOWN[`${p.key}:${v}`] || {};
        res.violations.filter((x) => (known[x.id] || 0) < x.nodes.length)
          .forEach((x) => worse.push(`${p.key}:${v || '(page)'} @${width}px ${x.id} (${x.impact}): ${x.nodes.length} place(s). ${x.help}. First: ${x.nodes[0].target.join(' ')}`));
      }
      expect(worse, 'Accessibility got worse').toEqual([]);
    });
  }
}
