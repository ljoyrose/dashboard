// The style sweep (Lisa, 3 Nov 2026) on all 8 pages, every tab and More page, at 1280 and 390, in all four looks
// (warm and cool, light and dark):
//  1 no background fill on hover, focus, press or selected anywhere except typing boxes and the one pale grey state fill
//    (Lisa, 12 Nov 2026: hover and tap = --hov, selected = --sel-fill, no outline);
//  2 numbers side by side in one group are the same size;
//  3 no explainer lines or sub-lines that restate a label;
//  4 nothing moves on hover or focus;
//  5 a rose count means late only (a tab's rose count is read out as "N late"), everything else is grey.
// Pretend Google, Drive and Sheets; every row is invented (tests/support/hubs.js).
//
// SWEEP_AUDIT=<file> adds every finding to that file (one per line) instead of failing: the before / after list in the pull request.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, setLook, go, settle } = require('../support/hubs');
const { stateRules, drawn, roseTabs, lateShown } = require('../support/sweep-audit');

const AUDIT = process.env.SWEEP_AUDIT;
const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const PAGES = {
  ...HUBS,
  estate: {
    url: 'estate/', views: ['home', 'all', 'shops', 'unchecked', 'access'],
    async open(page) {
      const F = require('../fixtures/estate/rows.js');
      await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
      await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(F.HEADER, F.ROWS) }) }));
      await page.goto('estate/#/home');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    },
  },
};
const LOOKS = [
  { bg: 'warm', scheme: 'light' }, { bg: 'warm', scheme: 'dark' },
  { bg: 'cool', scheme: 'light' }, { bg: 'cool', scheme: 'dark' },
];
const report = (list, where) => {
  if (AUDIT) { if (list.length) fs.appendFileSync(AUDIT, list.map((x) => where + ': ' + x + '\n').join('')); return; }
  expect(list, where).toEqual([]);
};

for (const [hub, P] of Object.entries(PAGES)) {
  test.describe(hub, () => {
    // 1 and 4, from the style sheets: no state rule fills or moves anything (typing boxes aside).
    test('no style rule fills or moves anything on hover, focus, press or selected', async ({ page, guard }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await P.open(page, guard);
      const rules = await page.evaluate(stateRules);
      report(rules.map((r) => `${r.sheet}: ${r.sel} { ${r.prop}: ${r.value} } (${r.kind === 'fill' ? 'a fill' : 'moves'})`), hub + ' style rules');
    });

    for (const look of LOOKS) {
      for (const W of [1280, 390]) {
        test(`${look.bg} ${look.scheme} ${W}: no selected fill, one size per number group, no explainer lines, rose = late`, async ({ page, guard }) => {
          test.setTimeout(300_000);   // every view of the page; the shared Mac is slow under a full run
          await page.setViewportSize({ width: W, height: W > 600 ? 900 : 844 });
          await setLook(page, { bg: look.bg, mode: 'device', scheme: look.scheme });
          await P.open(page, guard);
          const all = [];
          for (const v of P.views) {
            await go(page, v);
            const d = await page.evaluate(drawn);
            for (const k of ['selected', 'groups', 'explainers', 'rose']) all.push(...d[k].map((x) => `#/${v} ${k}: ${x}`));
          }
          report([...new Set(all)], `${hub} ${look.bg}-${look.scheme} ${W}`);
        });
      }
    }

    // 4 and 1, by the pointer and the keyboard: hover and press show only the pale grey fill (--hov), focus no fill, and nothing
    // moves (warm light, 1280;
    // up to 8 kinds of control per view: the style-rule test above reads every rule).
    test('hover, focus and press: only the pale grey fill, nothing moves (every view)', async ({ page, guard }) => {
      test.setTimeout(480_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      await P.open(page, guard);
      const bad = [];
      for (const v of P.views) {
        await go(page, v);
        const picks = await page.evaluate(() => {
          document.querySelectorAll('[data-sw]').forEach((e) => e.removeAttribute('data-sw'));
          const seen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 60 && r.bottom <= innerHeight - 90 && getComputedStyle(e).visibility !== 'hidden'; };
          const kinds = new Map();
          for (const e of document.querySelectorAll('a[href], button, summary, [role="button"], [tabindex="0"]')) {
            if (!seen(e) || e.disabled || e.closest('header, nav.house-tabs, dialog') || e.matches('input, textarea, select')) continue;
            const k = e.tagName + '.' + [...e.classList].sort().join('.');
            if (!kinds.has(k)) kinds.set(k, e);
          }
          return [...kinds.values()].slice(0, 8).map((e, i) => { e.setAttribute('data-sw', String(i)); return { sel: '[data-sw="' + i + '"]', what: e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 3).join('.') + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + '"' }; });
        });
        for (const p of picks) {
          const el = page.locator(p.sel);
          if (!(await el.count())) continue;
          // Its box against its parent's, so a row that scrolls sideways into view (a board) is not a move.
          const read = () => el.evaluate((e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(), p = (e.parentElement || e).getBoundingClientRect();
            const pr = document.createElement('span'); pr.style.background = 'var(--hov)'; (e.parentElement || document.body).appendChild(pr); const hov = getComputedStyle(pr).backgroundColor; pr.remove();
            return { hov, bg: s.backgroundColor, img: s.backgroundImage, box: [r.x - p.x, r.y - p.y, r.width, r.height].map((n) => Math.round(n * 2) / 2).join(',') }; });
          await page.mouse.move(2, 2);
          const rest = await read();
          const check = async (how) => {
            const now = await read();
            const greyOk = how !== 'focus' && now.bg === now.hov;   // hover and press: the pale grey fill (Lisa, 12 Nov 2026)
            if ((now.bg !== rest.bg && !greyOk) || now.img !== rest.img) bad.push(`#/${v} ${p.what}: ${how} fills (${rest.bg} > ${now.bg})`);
            if (now.box !== rest.box) bad.push(`#/${v} ${p.what}: moves on ${how} (${rest.box} > ${now.box})`);
          };
          try { await el.hover({ timeout: 1500 }); } catch (e) { continue; }
          await settle(el); await check('hover');
          await page.mouse.move(2, 2);
          await el.focus(); await settle(el); await check('focus');
          // Press: the pointer goes down on it and comes up somewhere else, so nothing is clicked.
          const b = await el.boundingBox();
          if (b) { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await settle(el); await check('press'); await page.mouse.move(2, 2); await page.mouse.up(); }
          await el.evaluate((e) => e.blur());
        }
      }
      report([...new Set(bad)], hub + ' hover / focus / press');
    });

    // 5 A bottom tab whose count is rose (read out as "N late") opens on something late.
    test('a rose tab count opens on something late', async ({ page, guard }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1280, height: 900 });
      await P.open(page, guard);
      const tabs = await page.evaluate(roseTabs);
      const bad = [];
      for (const t of tabs) {
        if (!/^#\//.test(t.href)) continue;
        await go(page, t.href.slice(2));
        if (!(await page.evaluate(lateShown))) bad.push(`${t.word} (${t.n}): rose count, but nothing on ${t.href} is late`);
      }
      report(bad, hub + ' tab counts');
    });
  });
}
