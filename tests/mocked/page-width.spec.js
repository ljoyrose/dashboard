// One page width (Lisa, 2 Nov 2026): every page uses the full window with the same side gap (--house-gutter: 24px on a laptop,
// 16px on a phone). The top bar's row, the page's frame and its widest content line up to the same edges on all 8 pages, and
// nothing scrolls sideways. The hub's name (Lisa's pick A): centred in the bar from 768px up, the same spot on every page; on a
// phone it sits left, straight after the Home icon (the Dashboard keeps an empty place the same size). It never overlaps an icon.
// Pretend Google, Drive and Sheets; every row is invented.
const { test, expect } = require('../support/test');
const { HUBS } = require('../support/hubs');

const SHOTS = process.env.WIDTH_SHOTS || '';
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

// The frame, the bar and the name, measured in the page.
function measure() {
  const W = document.documentElement.clientWidth;
  const shown = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const box = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { left: r.left, right: r.right, inL: r.left + parseFloat(cs.paddingLeft), inR: r.right - parseFloat(cs.paddingRight) }; };
  const row = document.querySelector('header.house-head > .house-row');
  const main = document.querySelector('main');
  const frame = main.closest('.house-page') || main;
  const h1 = row.querySelector(':scope > h1');
  const rg = document.createRange(); rg.selectNodeContents(h1);
  const words = rg.getBoundingClientRect(), hb = h1.getBoundingClientRect(), hcs = getComputedStyle(h1);
  // What a person sees of the name: the words, cut to the name's own inner box when they are cut short with ...
  const seen = { left: Math.max(words.left, hb.left + parseFloat(hcs.paddingLeft)), right: Math.min(words.right, hb.right - parseFloat(hcs.paddingRight)) };
  const others = [...row.children].filter((e) => e !== h1 && shown(e) && !e.classList.contains('house-sp')).map((e) => { const r = e.getBoundingClientRect(); return { what: e.outerHTML.slice(0, 80), left: r.left, right: r.right }; });
  // The page's widest content: any shown block inside the frame (not the frame itself) with a real width.
  const blocks = [...frame.querySelectorAll('*')].filter((e) => shown(e) && getComputedStyle(e).position !== 'fixed' && !e.closest('[hidden], .hidden, dialog, [role="dialog"]'))
    .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 40);
  const tabs = document.querySelector('nav.house-tabs');
  const tb = tabs && shown(tabs) ? tabs.getBoundingClientRect() : null;
  return {
    W, scrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth,
    gutter: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--house-gutter')),
    row: box(row), frame: box(frame), header: box(document.querySelector('header.house-head')),
    minLeft: Math.min(...blocks.map((r) => r.left)), maxRight: Math.max(...blocks.map((r) => r.right)),
    tabs: tb && { left: tb.left, right: tb.right },
    name: { left: hb.left, seenL: seen.left, seenR: seen.right, mid: (seen.left + seen.right) / 2, cut: h1.scrollWidth > h1.clientWidth + 1 || words.width > seen.right - seen.left + 1, words: words.width },
    others,
    slot: (row.querySelector(':scope > #backHome, :scope > .house-slot') || {}).getBoundingClientRect?.() || null,
  };
}

function noOverlap(m) {
  for (const o of m.others) {
    const apart = m.name.seenR <= o.left + 0.5 || m.name.seenL >= o.right - 0.5;
    expect(apart, `the name (${Math.round(m.name.seenL)}-${Math.round(m.name.seenR)}) clear of ${o.what} (${Math.round(o.left)}-${Math.round(o.right)})`).toBe(true);
  }
}

const seenAt = {};
for (const width of [1280, 390]) {
  for (const [hub, H] of Object.entries(ALL)) {
    test(`${hub} at ${width}px: full window, the house side gap on the bar and the page, the name in its place`, async ({ page, guard }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.emulateMedia({ colorScheme: 'light' });
      await H.open(page, guard);
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(100);
      const m = await page.evaluate(measure);
      const G = width === 390 ? 16 : 24;
      expect(m.gutter, 'the --house-gutter token').toBe(G);
      // Nothing scrolls sideways.
      expect(m.scrollW, 'page width (no sideways scroll)').toBeLessThanOrEqual(m.W);
      expect(m.bodyScrollW, 'body width (no sideways scroll)').toBeLessThanOrEqual(m.W);
      // The bar, its row and the page frame run the full window; their insides sit exactly G in from each edge.
      for (const [what, b] of [['top bar', m.header], ['top bar row', m.row], ['page frame', m.frame]]) {
        expect(Math.abs(b.left), what + ' left edge at the window').toBeLessThanOrEqual(0.5);
        expect(Math.abs(b.right - m.W), what + ' right edge at the window').toBeLessThanOrEqual(0.5);
      }
      for (const [what, b] of [['top bar row', m.row], ['page frame', m.frame]]) {
        expect(Math.abs(b.inL - G), what + ' inside left = gutter').toBeLessThanOrEqual(0.5);
        expect(Math.abs(b.inR - (m.W - G)), what + ' inside right = window - gutter').toBeLessThanOrEqual(0.5);
      }
      // The content itself fills the frame: nothing starts outside the gutter, and the widest content reaches both edges
      // (no narrow middle column, no 980px box).
      expect(m.minLeft, 'content starts at the gutter').toBeGreaterThanOrEqual(G - 0.5);
      expect(Math.abs(m.minLeft - G), 'content reaches the left gutter').toBeLessThanOrEqual(0.5);
      expect(m.maxRight, 'content stays inside the right gutter').toBeLessThanOrEqual(m.W - G + 0.5);
      expect(Math.abs(m.maxRight - (m.W - G)), 'content reaches the right gutter').toBeLessThanOrEqual(0.5);
      // The bottom tabs' bar runs the full window too (the same outer edges as the top bar).
      if (m.tabs) { expect(Math.abs(m.tabs.left)).toBeLessThanOrEqual(0.5); expect(Math.abs(m.tabs.right - m.W)).toBeLessThanOrEqual(0.5); }
      // The name: centred on the bar from 768px up; on a phone straight after the Home icon (or the Dashboard's empty place).
      // (On a phone a long name may be cut short with ...; at 1280 every name shows whole.)
      if (width === 1280) {
        expect(m.name.cut, 'the name shows whole at 1280').toBe(false);
        expect(Math.abs(m.name.mid - m.W / 2), 'name centred on the bar').toBeLessThanOrEqual(2);
      }
      else {
        expect(m.slot, 'Home icon or the empty place first in the bar').not.toBeNull();
        expect(Math.abs(m.slot.left - G), 'Home / empty place at the gutter').toBeLessThanOrEqual(0.5);
        expect(Math.round(m.slot.width), 'Home / empty place size').toBe(44);
        expect(Math.abs(m.name.left - (G + 44 + 8)), 'name straight after Home (gutter + 44 + 8)').toBeLessThanOrEqual(0.5);
      }
      noOverlap(m);
      seenAt[width + hub] = m.name.left;
      if (SHOTS && ['home', 'marketplace', 'estate'].includes(hub)) await page.screenshot({ path: `${SHOTS}/${hub}-${width}.png` });
    });
  }
}

// Tight room: at 768px (the smallest laptop / tablet width) and with a very long name, the name stays centred, is cut short
// with ... and never runs under an icon; nothing scrolls sideways.
for (const [hub, H] of Object.entries(ALL)) {
  test(`${hub}: at 768px and with a very long name the name is centred, cut with ... and never overlaps an icon`, async ({ page, guard }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await H.open(page, guard);
    await page.setViewportSize({ width: 768, height: 900 });
    await page.waitForTimeout(150);
    let m = await page.evaluate(measure);
    expect(m.scrollW, 'no sideways scroll at 768').toBeLessThanOrEqual(m.W);
    noOverlap(m);
    // Centred, unless the right-hand things themselves reach past the middle of the bar (Studio's status pills at 768): then the
    // name sits as near the middle as it can without touching them.
    const rightStart = Math.min(...m.others.filter((o) => o.left > m.name.seenL).map((o) => o.left));
    if (rightStart - 8 >= m.W / 2 + m.name.words / 2) expect(Math.abs(m.name.mid - m.W / 2), 'name centred at 768').toBeLessThanOrEqual(2);
    else expect(m.name.seenR, 'name pushed only as far as the right-hand things').toBeGreaterThanOrEqual(rightStart - 8 - 1);
    // A name far too long for the bar.
    await page.evaluate(() => { const h = document.querySelector('header .house-row > h1'); const t = h.querySelector('a') || h; t.append(' with a very long extra name that cannot possibly fit in the top bar at all'); });
    await page.waitForTimeout(150);
    m = await page.evaluate(measure);
    expect(m.scrollW, 'no sideways scroll with a long name').toBeLessThanOrEqual(m.W);
    expect(m.name.cut, 'a long name is cut short').toBe(true);
    expect(await page.locator('header .house-row > h1').evaluate((e) => getComputedStyle(e).textOverflow), 'cut with ...').toBe('ellipsis');
    noOverlap(m);
    const bar = await page.locator('header.house-head').evaluate((e) => e.getBoundingClientRect().height);
    expect(bar, 'the bar stays one 56px row').toBe(56);
  });
}

// A very wide window (1920): still the full window, no 1600px or 980px box, the same 24px gap; the name still centred.
for (const [hub, H] of Object.entries(ALL)) {
  test(`${hub} at 1920px: the frame runs the full window with the 24px gap`, async ({ page, guard }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1920, height: 1000 });
    await H.open(page, guard);
    await page.waitForTimeout(100);
    const m = await page.evaluate(measure);
    expect(m.scrollW).toBeLessThanOrEqual(m.W);
    for (const [what, b] of [['top bar row', m.row], ['page frame', m.frame]]) {
      expect(Math.abs(b.inL - 24), what + ' inside left').toBeLessThanOrEqual(0.5);
      expect(Math.abs(b.inR - (m.W - 24)), what + ' inside right').toBeLessThanOrEqual(0.5);
    }
    expect(Math.abs(m.maxRight - (m.W - 24)), 'content reaches the right gutter').toBeLessThanOrEqual(0.5);
    expect(Math.abs(m.name.mid - m.W / 2), 'name centred').toBeLessThanOrEqual(2);
    noOverlap(m);
    // Straight down to a phone: the centring's padding is never used there, so nothing scrolls sideways even for a moment.
    await page.setViewportSize({ width: 390, height: 844 });
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(w[0], 'no sideways scroll straight after shrinking to a phone').toBeLessThanOrEqual(w[1]);
  });
}
