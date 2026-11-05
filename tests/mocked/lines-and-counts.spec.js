// Counts and colour lines (Lisa's house-style picks, 2 Nov 2026), on all 8 pages:
//  - a ringed count is a ring only: never a fill or tint behind the number (rose ring = late, grey ring = waiting, 0 = no ring);
//    the ONE exception (Lisa, 3 Nov 2026): a BROKEN count (down, expired, stuck, failed) is the black badge, --house-broken-fill
//    with a --house-broken-ink number, in the same box as the ring (light ink with a near-black number in the dark looks);
//  - a coloured left line on a card or row runs the WHOLE height of it, 3px wide, curved with a card's corner and straight on
//    a square row (no short stub floating in the middle, no inset shadow);
//  - icon shades are the --ljr-N-icon tokens (slots 0 to 7, light and dark looks);
//  - a bottom tab's count never overlaps the tab's icon, on a phone (390, a dot beside the icon's top-right corner, Lisa's pick b)
//    or a laptop (1280, the ring), and on a wide tab the icon stays centred.
// Pretend Google, Drive and Sheets; every row is invented (tests/support/hubs.js).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, go, setLook } = require('../support/hubs');

const ROOT = path.resolve(__dirname, '..', '..');
const ALL = {
  ...HUBS,
  estate: {
    url: 'estate/', views: ['home'],
    async open(page) {
      await page.goto('estate/#/home');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('header #signin')).toHaveAttribute('aria-label', 'Sign out');
    },
  },
};
// Pages whose sample data shows coloured left lines: at least one must be found there.
const HAS_LINES = ['studio', 'marketplace', 'factory'];

// Read every ringed count and every left colour line on the view.
function scan() {
  const px = (v) => parseFloat(v) || 0;
  const alpha = (c) => { if (!c || c === 'transparent') return 0; const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const p = m[1].split(/[,/ ]+/).filter(Boolean); return p.length > 3 ? +p[3] : 1; };
  const seen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + [...e.classList].join('.');
  const counts = [], lines = [], stubs = [];
  for (const e of document.querySelectorAll('.cnt, .n')) {
    if (!seen(e) || !e.textContent.trim()) continue;
    const s = getComputedStyle(e);
    const ring = s.borderTopStyle !== 'none' && px(s.borderTopWidth) > 0 && alpha(s.borderTopColor) > 0;
    if (!ring) continue;
    counts.push({ what: name(e) + ' "' + e.textContent.trim() + '"', bg: s.backgroundColor, bgA: alpha(s.backgroundColor), img: s.backgroundImage,
      broken: e.classList.contains('broken'), color: s.color, line: s.borderTopColor, h: e.getBoundingClientRect().height,
      fill: getComputedStyle(document.documentElement).getPropertyValue('--house-broken-fill').trim(), ink: getComputedStyle(document.documentElement).getPropertyValue('--house-broken-ink').trim() });
  }
  for (const e of document.querySelectorAll('body *')) {
    if (!seen(e)) continue;
    const host = getComputedStyle(e);
    if (/inset/.test(host.boxShadow) && /(^|,\s*)(rgb[^)]*\)\s*)?3px 0px 0px/.test(host.boxShadow)) stubs.push(name(e) + ': inset 3px shadow');
    const s = getComputedStyle(e, '::before');
    if (s.content === 'none' || s.content === 'normal' || s.display === 'none' || s.position !== 'absolute') continue;
    const r = e.getBoundingClientRect();
    const h = px(s.height) || (r.height - px(s.top) - px(s.bottom));
    const lw = s.borderLeftStyle === 'none' ? 0 : px(s.borderLeftWidth);
    if (lw > 2 && alpha(s.borderLeftColor) > 0) {
      lines.push({ what: name(e), h, host: r.height, w: lw, radius: px(s.borderTopLeftRadius), radiusB: px(s.borderBottomLeftRadius), hostRadius: px(host.borderTopLeftRadius) });
      continue;
    }
    // The old look: a thin coloured strip (2 to 4px wide) floating down the left, shorter than its card.
    const w = px(s.width);
    if (w >= 2 && w <= 4 && alpha(s.backgroundColor) > 0.5 && h >= 8 && h < r.height - 1.5) stubs.push(name(e) + ': ' + w + 'x' + Math.round(h) + ' in ' + Math.round(r.height));
  }
  return { counts, lines, stubs };
}

for (const [hub, H] of Object.entries(ALL)) {
  test(`${hub}: counts are rings only (no fill), colour lines run the full height, 3px, curved`, async ({ page, guard }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await H.open(page, guard);
    let found = 0;
    for (const v of H.views) {
      await go(page, v);
      const m = await page.evaluate(scan);
      for (const c of m.counts) {
        if (c.broken) {
          // Broken: the black badge (light look: #1E1C1A with a white number), its line the same colour, nothing else.
          expect([c.fill, c.ink], `${hub} #/${v}: the broken tokens (light look)`).toEqual(['#1E1C1A', '#FFFFFF']);
          expect([c.bg, c.line, c.color], `${hub} #/${v} ${c.what}: a broken count is the black badge`).toEqual(['rgb(30, 28, 26)', 'rgb(30, 28, 26)', 'rgb(255, 255, 255)']);
          expect(c.img, `${hub} #/${v} ${c.what}: a solid badge`).toBe('none');
          continue;
        }
        expect(c.bgA, `${hub} #/${v} ${c.what}: a ringed count has no fill (${c.bg})`).toBe(0);
        expect(c.img, `${hub} #/${v} ${c.what}: a ringed count has no fill`).toBe('none');
      }
      expect(m.stubs, `${hub} #/${v}: no short or inset colour lines`).toEqual([]);
      for (const l of m.lines) {
        expect(l.w, `${hub} #/${v} ${l.what}: the line is 3px`).toBeCloseTo(3, 1);
        expect(Math.abs(l.h - l.host), `${hub} #/${v} ${l.what}: the line runs the full height (${l.h} vs ${l.host})`).toBeLessThanOrEqual(1);
        // A card's line curves with the card's corner; a row inside a card has square corners, so its line is straight
        // (Lisa, 2 Nov 2026: rows use a straight 3px .house-lbar, never a "(" bracket).
        if (l.hostRadius > 0) expect(l.radius, `${hub} #/${v} ${l.what}: the line curves with the card's corner`).toBeGreaterThanOrEqual(Math.max(8, l.hostRadius - 0.5));
        else expect(l.radius, `${hub} #/${v} ${l.what}: a row's line is straight`).toBe(0);
        expect(l.radiusB, `${hub} #/${v} ${l.what}: both ends curve`).toBeCloseTo(l.radius, 1);
      }
      found += m.lines.length;
    }
    if (HAS_LINES.includes(hub)) expect(found, `${hub}: the sample data shows coloured lines`).toBeGreaterThan(0);
  });

  for (const W of [1280, 390]) {
    test(`${hub} at ${W}: a tab's count ring never overlaps its icon`, async ({ page, guard }) => {
      await page.setViewportSize({ width: W, height: W > 600 ? 800 : 844 });
      await H.open(page, guard);
      await page.mouse.move(W / 2, 200);
      // Every tab gets a two-digit count (the widest fixed ring), so every tab is checked, waiting, late and broken.
      const m = await page.evaluate(() => {
        const nav = [...document.querySelectorAll('nav.house-tabs')].find((n) => n.getBoundingClientRect().height > 0);
        const tabs = [...nav.querySelectorAll(':scope > .ht, :scope > .ht-more > .ht')];
        tabs.forEach((t, i) => {
          let n = t.querySelector(':scope > .n, :scope > .cnt');
          if (!n) { n = document.createElement('span'); n.className = 'n'; t.appendChild(n); }
          if (!n.textContent.trim()) n.textContent = '88';
          n.classList.toggle('need', i % 3 === 0);
          n.classList.toggle('broken', i % 3 === 1);
          n.classList.remove('wide');
        });
        return tabs.map((t) => {
          const r = t.getBoundingClientRect(), a = t.querySelector(':scope > .hic').getBoundingClientRect(), b = t.querySelector(':scope > .n, :scope > .cnt').getBoundingClientRect();
          const l = t.querySelector(':scope > .htl').getBoundingClientRect();
          const cs = getComputedStyle(t.querySelector(':scope > .n, :scope > .cnt'));
          return { word: l.width ? t.querySelector(':scope > .htl').textContent.trim() : '?', need: t.querySelector(':scope > .n, :scope > .cnt').classList.contains('need'), broken: t.querySelector(':scope > .n, :scope > .cnt').classList.contains('broken'), size: [b.width, b.height], tab: [r.left, r.right], icon: [a.left, a.top, a.right, a.bottom], count: [b.left, b.top, b.right, b.bottom], bg: cs.backgroundColor,
            overlap: !(b.right <= a.left || b.left >= a.right || b.bottom <= a.top || b.top >= a.bottom) };
        });
      });
      for (const t of m) {
        expect(t.overlap, `${t.word}: count ${t.count.map(Math.round)} clear of the icon ${t.icon.map(Math.round)}`).toBe(false);
        // A broken count is the black badge (Lisa, 3 Nov 2026), the same size as the ring beside it: nothing shifts.
        if (W === 1280) expect(t.bg, `${t.word}: the count has no fill, or is the black badge when broken`).toMatch(t.broken ? /^rgb\(30, 28, 26\)$/ : /^(transparent|rgba\(0, 0, 0, 0\))$/);
        expect(t.size, `${t.word}: late, broken and waiting counts are one size`).toEqual(m[0].size);
        // On a phone the count is a dot (Lisa's pick b, 2 Nov): filled rose (late), black (broken) or grey, beside the icon's top-right corner.
        if (W !== 1280) {
          expect(t.bg, `${t.word}: the dot is rose (late), black (broken) or grey (waiting)`).toBe(t.need ? 'rgb(230, 68, 61)' : t.broken ? 'rgb(30, 28, 26)' : 'rgb(138, 127, 112)');
          expect(t.count[0] - t.icon[2], `${t.word}: the dot sits right beside the icon's right edge`).toBeLessThanOrEqual(3);
          expect(Math.abs(t.count[1] - t.icon[1]), `${t.word}: level with the icon's top`).toBeLessThanOrEqual(2);
          expect(t.count[2], `${t.word}: the dot stays inside its tab`).toBeLessThanOrEqual(t.tab[1]);
        }
        expect(t.icon[0], `${t.word}: the icon stays inside its tab`).toBeGreaterThanOrEqual(t.tab[0]);
        expect(Math.abs((t.icon[0] + t.icon[2]) / 2 - (t.tab[0] + t.tab[1]) / 2), `${t.word}: the icon stays centred in its tab (phone too: the dot needs no room)`).toBeLessThan(1);
      }
    });
  }
}

test('--ljr-N-icon: one icon shade per slot 0 to 7, light and dark looks (Lisa\'s pick 3e)', async ({ page }) => {
  const want = {
    light: ['#93856E', 'ink', '#E0251D', '#B66A11', '#A2890B', '#428C46', '#0F82BC', '#995DCB'],
    dark: ['#93856E', '#F3EEE5', 'fill', 'fill', 'fill', 'fill', 'fill', 'fill'],
  };
  const hex = (c) => '#' + (c.match(/\d+/g) || []).slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  for (const scheme of ['light', 'dark']) {
    await setLook(page, { scheme });
    await page.goto('./');
    const got = await page.evaluate(() => [0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
      const p = document.createElement('i');
      document.body.appendChild(p);
      p.style.color = 'var(--ljr-' + n + '-icon)'; const icon = getComputedStyle(p).color;
      p.style.color = 'var(--ljr-' + n + ')'; const fill = getComputedStyle(p).color;
      p.style.color = 'var(--ljr-ink)'; const ink = getComputedStyle(p).color;
      p.remove();
      return { raw: getComputedStyle(document.documentElement).getPropertyValue('--ljr-' + n + '-icon').trim(), icon, fill, ink };
    }));
    got.forEach((g, n) => {
      expect(g.raw, `--ljr-${n}-icon is set (${scheme})`).not.toBe('');
      const w = want[scheme][n];
      const exp = w === 'ink' ? hex(g.ink) : w === 'fill' ? hex(g.fill) : w;
      expect(hex(g.icon), `--ljr-${n}-icon (${scheme})`).toBe(exp);
    });
  }
});

test('pages colour their hover icons with the --ljr-N-icon shades, not the fill or text colours', async () => {
  const cd = fs.readFileSync(path.join(ROOT, 'cdhub/index.html'), 'utf8');
  const fa = fs.readFileSync(path.join(ROOT, 'factory/index.html'), 'utf8');
  expect(cd.match(/class="mcard[^"]*" id="\w+" style="--hc:var\(--ljr-\d\)/g), 'CD Hub card icons use --ljr-N-icon').toBeNull();
  expect((cd.match(/class="mcard[^"]*" id="\w+" style="--hc:var\(--ljr-\d-icon\)/g) || []).length).toBeGreaterThan(0);
  expect(fa, 'Factory card icons use --ljr-N-icon').toContain("style=\"--hc:var(--ljr-' + x[4] + '-icon)\"");
});
