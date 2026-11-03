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
const BYTES = { marketplace: 261000, money: 222000, studio: 350100, privacy: 18500 };
// marketplace 255900 > 261000 (+5100), money 217100 > 222000 (+4900), studio 345200 > 350100 (+4900) and privacy 15000 > 18500
// (+3500) on 3 Nov 2026: the style sweep (Lisa) adds the house style sheet's token index and new tokens to tokens.css (about 3.6 KB),
// which every page loads, privacy too. Measured 287096, 244200, 385040 and 20331.
// marketplace 247600 > 255900 (+8300), money 201100 > 217100 (+16000) and studio 334100 > 345200 (+11100) on 3 Nov 2026: the fold
// control (DashKit.fold in toolkit.js, about 12.9 KB, and house.css, about 4.2 KB). Measured 281148, 238505 and 379318.
// money 201100 > 201500 (+400) on 3 Nov 2026: config.js grew 336 bytes (TidyUp stage 9, #142), and every page loads it. Measured 221465.
// money 197700 > 201100 (+3400) on 2 Nov 2026: Hub Mains (DashKit.hubMain in toolkit.js and house.css, Main's numbers and the moved
// sections' routes), on top of the shared tab-dots growth. Measured 221129.
// studio 297000 > 334100 and privacy 13300 > 15000 on 2 Nov 2026: the shared bottom tab bar (Lisa's tab picks) adds the tab rules to
// house.css and the tab colours to tokens.css (privacy loads both), and the tab icons and More menu to toolkit.js, on top of studio's
// own growth since 30 Oct. Measured 334013 and 14917. Marketplace and money still fit.
// marketplace 178600 > 197100 and money 160500 > 179700 on 2 Nov 2026: the shared top bar (Lisa's pick A) adds the Look menu and the
// one icon set to toolkit.js, which every hub loads (about 7 KB), on top of their own growth since 30-31 Oct. Measured 197089 and 179634.
// money 179700 > 197700 on 2 Nov 2026: one page width and the centred hub name (Lisa's picks) add the frame rules to house.css, the
// gutter token to tokens.css and the name-centring helper to toolkit.js (about 2 KB), on top of #247's tab bar. Measured 197680.
// marketplace 197100 > 217800 on 2 Nov 2026: one type scale (Lisa's picks: Lexend, 400/500/600, 14/15/18px) writes every size as a
// token and adds the type tokens to tokens.css and house.css, on top of growth since 31 Oct that was already near the +10% line.
// Measured 217712. Money, studio and privacy still fit.
// marketplace 217800 > 247600 on 2 Nov 2026: Product ideas (list, Add idea form, card page, board link: about 20 KB in index.html + 10 KB ideas.js)
// on top of the type-scale baseline. Measured 247530. Shrinking option: load the form and card code only when #/ideas is opened.
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
