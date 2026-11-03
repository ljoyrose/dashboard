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
const BYTES = { home: 349600, cdhub: 239700, factory: 245400, food: 153800 };
// home 348100 > 349600 (+1500) on 3 Nov 2026: the Do page's Standing approvals card is its own file (estate/donq.js, fetched only on the Do page);
// index.html keeps only the hooks that fetch and call it.
// home 337600 > 348100 (+10500), cdhub 238300 > 239700 (+1400), factory 233800 > 245400 (+11600) and food 140600 > 153800 (+13200)
// on 2 Nov 2026: Hub Mains (Lisa's house style: every hub's Main is Next, Needs you and 3 numbers) add DashKit.hubMain to toolkit.js
// and its rules to house.css, which every hub loads, and the moved sections keep their code in their new tabs.
// Measured 382818, 263546, 269890 and 169071.
// home 337000 > 337600 and factory 232000 > 233800 on 2 Nov 2026: phone tab counts become dots and every tab one size (Lisa's pick b)
// add the tab names and the one-size measure to the shared toolkit.js (about 1.8 KB, comments trimmed to one line); measured 371133
// and 256983 bytes.
// home 329000 > 337000 on 2 Nov 2026 (TidyUp stage 7, #141): the Bin page Log reads RUN-LOG.csv (7-day run list, UK times, Lessons); measured 369795 bytes.
// home 325000 > 329000 (+4000) and factory 229700 > 232000 (+2300) on 2 Nov 2026: every number and row opens what it counts and
// the icon-font fallback (Lisa's clickable picks) add to the shared toolkit.js and house.css; measured 360921 and 254207 bytes.
// home 311500 > 325000 (+13500) on 2 Nov 2026: Dashboard Main (Lisa's hub tiles with 3 linked numbers each, Decide and Do, the inline hub
// reader, clickable Needs you pills) measured 357051 bytes, over 311500 + 10%.
// home 277000 > 311500, cdhub 211500 > 238300 and food 126600 > 140600 on 2 Nov 2026: the shared bottom tab bar (Lisa's tab picks) adds
// the tab rules to house.css (about 7 KB), the tab colours to tokens.css (about 1.5 KB) and the tab icons and More menu to toolkit.js
// (about 5 KB), which every hub loads, on top of their own growth since 30 Oct-1 Nov. Measured 311435, 238249 and 140530. Factory still fits.
// factory 205000 > 229700 and food 113000 > 126600 on 2 Nov 2026: the shared top bar (Lisa's pick A) adds the Look menu and the one
// icon set to toolkit.js, which every hub loads (about 7 KB); food also had its own growth since 1 Nov. Measured 229608 and 126575.
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
