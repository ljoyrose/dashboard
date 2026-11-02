// JOB 35b Stage 0 audit (30 Oct 2026): the second half of the pages (marketplace, marketplace/privacy, money, studio).
// Report only, never fails: axe (WCAG 2.2 AA tags) on every view at 1280px and 390px, buttons and links under the
// 24px tap target, and load weight (requests, bytes, longest script, layout shift) with the pretend Google, Drive and Sheets.
// Runs only with JOB35B_AUDIT=<file.json>; writes one row per page x view x width to that file. Every row is invented.
const fs = require('fs');
const { test } = require('../support/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { HUBS, go } = require('../support/hubs');
const { BASE } = require('../support/site');

const OUT = process.env.JOB35B_AUDIT;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const PAGES = [
  { key: 'marketplace', hub: HUBS.marketplace },
  { key: 'money', hub: HUBS.money },
  { key: 'studio', hub: HUBS.studio },
  { key: 'privacy', hub: { views: [''], async open(page) { await page.goto('marketplace/privacy.html'); } } },
];

test.describe.configure({ mode: 'parallel' });
for (const p of PAGES) {
  for (const width of [1280, 390]) {
    test(`job35b audit ${p.key} ${width}px`, async ({ page, guard }) => {
      test.skip(!OUT, 'report only: set JOB35B_AUDIT=<file.json>');
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: width > 400 ? 900 : 844 });
      const reqs = [];
      page.on('requestfinished', async (r) => { try { const s = await r.sizes(); reqs.push({ url: r.url(), type: r.resourceType(), bytes: s.responseBodySize + s.responseHeadersSize }); } catch (e) {} });
      await page.addInitScript(() => {
        window.__cls = 0; window.__long = 0;
        try {
          new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
          new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__long = Math.max(window.__long, e.duration); })).observe({ type: 'longtask', buffered: true });
        } catch (e) {}
      });
      await p.hub.open(page, guard);
      await page.waitForTimeout(400);
      const load = await page.evaluate(() => ({ fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0), cls: +window.__cls.toFixed(3), longTask: Math.round(window.__long) }));
      const local = reqs.filter((r) => r.url.includes('127.0.0.1'));
      const rows = [{ page: p.key, width, view: '(load)', requests: local.length, bytes: local.reduce((a, r) => a + r.bytes, 0),
        scripts: local.filter((r) => r.type === 'script').map((r) => `${new URL(r.url).pathname.slice(BASE.length)}:${r.bytes}`), ...load }];
      for (const v of p.hub.views) {
        if (v) await go(page, v);
        const res = await new AxeBuilder({ page }).withTags(TAGS).options({ preload: false }).analyze();
        const small = await page.evaluate(() => [...document.querySelectorAll('button, a[href], [role=button], input, select, summary')]
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && getComputedStyle(e).visibility !== 'hidden'; })
          .slice(0, 5).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : ''} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
        rows.push({ page: p.key, width, view: v || '(page)', axe: res.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, first: x.nodes[0].target.join(' '), html: x.nodes[0].html.slice(0, 160) })), smallTargets: small });
      }
      fs.appendFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    });
  }
}
