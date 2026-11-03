// Type on every page (Lisa's picks, 2 Nov 2026): ONE font, Lexend, everywhere (buttons, inputs, tables, menus and pills too);
// three weights only, 400 / 500 / 600; and only these sizes, as tokens in tokens.css:
//   18px headings (h1-h4, card titles), big numbers and the hub name in the top bar (a number is never bigger than a heading)
//   15px body text
//   14px labels, tabs, counts, pills, tags, notes, meta lines, table text and menu items; nothing anywhere under 14px
// Ringed numbers (Lisa's pick A) are 14px, the same as the words beside them: the house counts, the bottom-tab counts and
// Money's summary rings, each in one box that fits 14px (1 and 2 digits the same width), ring only, no fill.
// Read back by computed style on all 8 pages at 1280 and 390, signed in with invented data, on a few views and the open
// More and Look menus. Pretend Google, Drive and Sheets only.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, setLook, go } = require('../support/hubs');

const SIZES = [14, 15, 18];
const WEIGHTS = ['400', '500', '600'];
const ROOT = path.resolve(__dirname, '..', '..');

const ALL = {
  ...HUBS,
  estate: {
    url: 'estate/',
    async open(page) {
      await page.goto('estate/#/home');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('header #signin')).toHaveAttribute('aria-label', 'Sign out');
    },
  },
};
// A few views per page besides the first (every view of 7 hubs is also read by house-look.spec.js).
const VIEWS = {
  home: ['map', 'drive', 'bin', 'changes'],
  money: ['now', 'money', 'dates', 'accountant'],
  marketplace: ['me', 'decide', 'do', 'stock'],
  studio: ['me', 'decide', 'line', 'tools'],
  factory: ['rooms', 'me', 'do', 'docs'],
  cdhub: ['map', 'today', 'dogs', 'litters'],
  food: ['home', 'orders', 'invoices', 'products'],
  estate: ['home', 'shops', 'unchecked', 'access'],
};

// Runs in the page: every visible element that holds words (and svg <text>), with its type.
function readType({ sizes, weights }) {
  const seen = (e) => { if (!e.getClientRects().length) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const icon = (e) => e.closest('.ti, [class^="ti-"], .ico-font, canvas, img, video, svg:not(:has(text))') || (e.closest('svg') && !e.closest('text'));
  const name = (e) => { const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (c ? '.' + c : '') + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"'; };
  const bad = new Set();
  let n = 0;
  for (const e of document.querySelectorAll('body *')) {
    if (!seen(e) || icon(e) || e.closest('#credential_picker_container, .sr')) continue;
    // A phone's bottom-tab count is a dot with no number showing (Lisa's pick b; tab-dots.spec.js pins it): not words.
    if (innerWidth < 768 && e.matches('nav.house-tabs .ht > .n, nav.house-tabs .ht > .cnt')) continue;
    if (![...e.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())) continue;
    n++;
    const s = getComputedStyle(e), px = Math.round(parseFloat(s.fontSize) * 100) / 100;
    if (!sizes.includes(px)) bad.add('size ' + px + 'px: ' + name(e));
    if (!weights.includes(s.fontWeight)) bad.add('weight ' + s.fontWeight + ': ' + name(e));
    if (!/^"?lexend"?$/i.test(s.fontFamily.split(',')[0].trim())) bad.add('font ' + s.fontFamily.split(',')[0] + ': ' + name(e));
  }
  // Headings are 18px; the hub name in the top bar is 18px.
  for (const h of document.querySelectorAll('h1, h2, h3, h4')) {
    if (!seen(h) || !(h.textContent || '').trim() || h.closest('.sr')) continue;
    const px = parseFloat(getComputedStyle(h).fontSize);
    if (px !== 18) bad.add('heading ' + px + 'px: ' + name(h));
  }
  // Ringed numbers: a ringed box holding only a number is 14px, one size; 1 and 2 digits the same width; no fill. (Except a
  // number in a group of 3, which is 18px like the rest of its group.)
  const rgbA = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 1; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
  const rings = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!seen(e) || e.children.length) continue;
    const t = (e.textContent || '').trim(), s = getComputedStyle(e);
    if (!/^\d{1,2}\+?$/.test(t)) continue;
    let box = e, bs = s;
    const ringed = (x) => x.borderTopStyle !== 'none' && parseFloat(x.borderTopWidth) > 0 && rgbA(x.borderTopColor) > 0.3;
    if (!ringed(bs) && e.parentElement && e.parentElement.children.length === 1 && ringed(getComputedStyle(e.parentElement))) { box = e.parentElement; bs = getComputedStyle(box); }
    if (!ringed(bs) || box.matches('button, summary, select, a.btn, a.lk, a.pill, a.chip, [role="button"]')) continue; // a button with a number on it is a button
    const r = box.getBoundingClientRect();
    if (r.width > 80 || r.height > 60) continue; // a card with a number in it, not a ring
    const px = parseFloat(s.fontSize);
    // A number in a group of 3 (a hub Main's or a Dashboard tile's numbers) is 18px like its neighbours, ringed or not (Lisa, 2 Nov:
    // "sizes in one group must match"); its ring is sized to it, so it is checked here and not with the 14px count rings.
    if (box.matches('.hm-v, .hk b')) { if (px !== 18) bad.add('group number ' + px + 'px: ' + name(e)); continue; }
    if (px !== 14) bad.add('ringed number ' + px + 'px: ' + name(e));
    rings.push({ w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, digits: t.replace('+', '').length, what: name(box), tab: !!box.closest('nav.house-tabs') });
  }
  return { bad: [...bad], n, rings };
}

test.describe('Type: one font, three weights, sizes 14 / 15 / 18 only (Lisa, 2 Nov 2026)', () => {
  test('tokens.css holds the four type tokens once; the shared files use them', () => {
    const tok = fs.readFileSync(path.join(ROOT, 'tokens.css'), 'utf8');
    for (const v of ['--fs-head: 18px', '--fs-figure: 18px', '--fs-body: 15px', '--fs-small: 14px', '--house-min: 14px']) expect(tok, 'tokens.css ' + v).toContain(v);
    for (const f of ['house.css', 'index.html', 'money/index.html', 'marketplace/index.html', 'studio/index.html', 'factory/index.html', 'cdhub/index.html', 'food/index.html', 'estate/index.html', 'toolkit.js']) {
      const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      // Only icons keep a px size of their own (an icon is not words).
      const px = [...t.matchAll(/([^{};]*)\{[^}]*?font-size:\s*(\d+)px/g)].filter((m) => !/\.ti\b|::?before|::?after|svg|\bi\b|\.ic\b/.test(m[1].split(',').pop())).map((m) => m[1].trim().slice(-40) + ' ' + m[2] + 'px');
      expect(px, f + ': words take their size from the tokens').toEqual([]);
      expect(t, f + ': no other font family').not.toMatch(/font-family:(?!\s*(var\(--house-font\)|inherit))[^;"'}]+/);
      expect(t, f + ': weights only 400 / 500 / 600').not.toMatch(/font-weight:\s*(bold|bolder|lighter|[1-37-9]00)\b/);
    }
  });

  for (const hub of Object.keys(ALL)) {
    for (const phone of [false, true]) {
      test(`${hub} at ${phone ? 390 : 1280}: every word is Lexend, 400/500/600, 14/15/18px; ringed numbers are 14px`, async ({ page, guard }) => {
        test.setTimeout(120_000);
        await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1280, height: 900 });
        await setLook(page, phone ? { bg: 'warm', scheme: 'dark' } : { bg: 'warm', scheme: 'light' });
        await ALL[hub].open(page, guard);
        const found = [], rings = [];
        let words = 0;
        const read = async (where) => {
          const r = await page.evaluate(readType, { sizes: SIZES, weights: WEIGHTS });
          words += r.n; rings.push(...r.rings);
          for (const b of r.bad) found.push(where + ': ' + b);
        };
        for (const v of VIEWS[hub]) {
          await go(page, v);
          await read(v);
        }
        // The open More menu (bottom tabs) and the open Look menu (top bar).
        const more = page.locator('nav.house-tabs [data-house-more]').first();
        if (await more.isVisible().catch(() => false)) { await more.click(); await read('More menu'); await page.keyboard.press('Escape'); }
        const look = page.locator('#houseLookBtn');
        if (await look.isVisible().catch(() => false)) { await look.click(); await expect(page.locator('#houseLook')).toBeVisible(); await read('Look menu'); await page.keyboard.press('Escape'); }
        expect(words, 'the check read some words').toBeGreaterThan(20);
        expect(found).toEqual([]);
        // Ringed numbers: 1 and 2 digits share one box (per kind: tab counts and the rest), at least 24px high so 14px fits.
        for (const kind of [true, false]) {
          const k = rings.filter((r) => r.tab === kind);
          const w = [...new Set(k.map((r) => r.w))], h = [...new Set(k.map((r) => r.h))];
          expect(w.length, `${kind ? 'tab' : 'page'} rings, one width for 1 and 2 digits: ${JSON.stringify(w.map((x) => k.find((r) => r.w === x)))}`).toBeLessThanOrEqual(1);
          expect(h.length, `${kind ? 'tab' : 'page'} rings, one height: ${JSON.stringify(h.map((x) => k.find((r) => r.h === x)))}`).toBeLessThanOrEqual(1);
          for (const x of h) expect(x, 'ring fits 14px words').toBeGreaterThanOrEqual(24);
        }
      });
    }
  }
});
