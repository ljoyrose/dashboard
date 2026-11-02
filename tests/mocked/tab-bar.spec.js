// The bottom tab bar (Lisa's picks, 2 Nov 2026): the SAME bar on all 8 pages, at 1280 and at 390.
// One row, 70px high, at most 6 tabs, Main first, Decide second where a hub has it, More always last (the other views sit in its
// menu). Each tab is an icon above one word (or two capitalised words), a real link or button with a name. At rest: grey icon,
// no ring, no fill, a short grey line. Hover and selected: the icon takes the tab's colour and the line widens; the 1px ring round
// the icon shows only on hover, focus and press. Counts: top-right corner, ring only, no fill. Nothing scrolls sideways.
// Pretend Google, Drive and Sheets; every row is invented.
const { test, expect } = require('../support/test');
const { HUBS, setLook } = require('../support/hubs');

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
// What each hub's bar shows, in order, and what sits under More (Lisa's picks; the first is Main, More is always last).
const PLAN = {
  home: { tabs: ['Main', 'Decide', 'Do', 'More'], more: ['Drives', 'Bin', 'Changes'], out: ['MOVE'] }, // Decide + Do: Dashboard Main (2 Nov); MOVE is a link out (new tab)
  money: { tabs: ['Main', 'Money', 'Do', 'Dates', 'Accountant', 'More'], more: ['Control'] },
  marketplace: { tabs: ['Main', 'Decide', 'Do', 'Reply', 'New Stock', 'More'], more: ['Insights'] },
  studio: { tabs: ['Main', 'Decide', 'Do', 'Line', 'More'], more: ['Kits'] },
  factory: { tabs: ['Main', 'Decide', 'Do', 'Rooms', 'More'], more: ['Today', 'Docs'] },
  cdhub: { tabs: ['Main', 'Do', 'Today', 'Dogs', 'Assocs', 'More'], more: ['Table map', 'The round', 'Areas', 'Litters', 'Vet link'] },
  food: { tabs: ['Main', 'Invoices', 'Orders', 'Products', 'More'], more: ['GA'] },
  estate: { tabs: ['Main', 'Do', 'Shops', 'More'], more: ['Unchecked', 'Access'] },
};
// Each tab's colour (Lisa's LJR7 slots): Main 1, Decide 2 (red), Do 4 (yellow), More 0 (grey).
const SLOT = { Main: '1', Decide: '2', Do: '4', More: '0', Orders: '4', Assocs: '6' };
const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;

function measureBar() {
  const nav = [...document.querySelectorAll('nav.house-tabs')].find((n) => n.getBoundingClientRect().height > 0);
  if (!nav) return null;
  const nr = nav.getBoundingClientRect();
  const cs = (e) => getComputedStyle(e);
  const tabs = [...nav.querySelectorAll(':scope > .ht, :scope > .ht-more > .ht')];
  return {
    navs: document.querySelectorAll('nav.house-tabs').length,
    height: nr.height, bottom: nr.bottom, win: innerHeight, winW: innerWidth,
    pageW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, navScroll: nav.scrollWidth - nav.clientWidth,
    card: cs(document.body).getPropertyValue('--card').trim(),
    tabs: tabs.map((t) => {
      const r = t.getBoundingClientRect(), hic = t.querySelector(':scope > .hic'), label = t.querySelector(':scope > .htl'), bar = t.querySelector(':scope > .bar'), n = t.querySelector(':scope > .n, :scope > .cnt');
      const lr = label.getBoundingClientRect(), ir = hic.getBoundingClientRect();
      return {
        tag: t.tagName, word: label.textContent.trim(), slot: t.getAttribute('data-slot'), name: t.getAttribute('aria-label') || t.textContent.trim(),
        more: t.hasAttribute('data-house-more'), top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height,
        iconAbove: ir.bottom <= lr.top + 1, ringGap: ir.top - r.top, labelFits: label.scrollWidth <= label.clientWidth + 1, labelLines: Math.round(lr.height / parseFloat(cs(label).lineHeight)),
        bg: cs(t).backgroundColor, hicBg: cs(hic).backgroundColor, ring: cs(hic).borderTopColor, ringW: cs(hic).borderTopWidth,
        icon: cs(hic).color, barW: bar.getBoundingClientRect().width, barBg: cs(bar).backgroundImage !== 'none' ? 'gradient' : cs(bar).backgroundColor,
        selected: t.getAttribute('aria-current') === 'page' || !!(t.closest('.ht-more') && t.closest('.ht-more').querySelector('.house-more [aria-current="page"]')),
        count: n && n.textContent.trim() ? { bg: cs(n).backgroundColor, ring: cs(n).borderTopColor, need: n.classList.contains('need'), right: r.right - n.getBoundingClientRect().right, top: n.getBoundingClientRect().top - r.top, overLabel: (() => { const b = n.getBoundingClientRect(); return !(b.right <= lr.left || b.left >= lr.right || b.bottom <= lr.top || b.top >= lr.bottom); })() } : null,
      };
    }),
  };
}

for (const [hub, H] of Object.entries(ALL)) {
  for (const W of [1280, 390]) {
    test(`${hub} at ${W}: one 70px row, at most 6 tabs, Main first, More last, no fills at rest, nothing sideways`, async ({ page, guard }) => {
      await page.setViewportSize({ width: W, height: W > 600 ? 800 : 844 });
      await H.open(page, guard);
      await page.mouse.move(W / 2, 200);   // the pointer away from the bar: everything at rest
      const m = await page.evaluate(measureBar);
      expect(m, 'a bottom tab bar shows').not.toBeNull();
      expect(m.navs, 'one bar on the page').toBe(1);
      expect(m.height, 'the bar is 70px high').toBeCloseTo(70, 0);
      expect(Math.abs(m.bottom - m.win), 'the bar sits on the bottom edge').toBeLessThan(1);
      const words = m.tabs.map((t) => t.word);
      expect(words, 'the tabs, in order').toEqual(PLAN[hub].tabs);
      expect(m.tabs.length, 'at most 6 tabs').toBeLessThanOrEqual(6);
      expect(words[0], 'Main first').toBe('Main');
      expect(m.tabs[m.tabs.length - 1].more, 'More last, and it is the More button').toBe(true);
      if (words.includes('Decide')) expect(words.indexOf('Decide'), 'Decide second').toBe(1);
      for (const t of m.tabs) {
        expect(['A', 'BUTTON'], `${t.word} is a real link or button`).toContain(t.tag);
        expect(t.name, `${t.word} has a name`).toMatch(new RegExp('^' + t.word));
        expect(t.word, `${t.word}: one word, or two words each capitalised`).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/);
        expect(Math.abs(t.height - m.tabs[0].height), `${t.word} same height as the others`).toBeLessThan(1);
        expect(Math.abs(t.top - m.tabs[0].top), `${t.word} on the one row`).toBeLessThan(1);
        expect(t.iconAbove, `${t.word}: the icon sits above the word`).toBe(true);
        // Lisa (2 Nov): the icon's ring needs clear space above it, at least 6px below the tab's top edge.
        expect(t.ringGap, `${t.word}: at least 6px between the tab's top and the icon ring`).toBeGreaterThanOrEqual(6);
        expect(t.labelFits, `${t.word}: the word is not cut short`).toBe(true);
        expect(t.labelLines, `${t.word}: the word stays on one line`).toBe(1);
        expect(t.left, `${t.word} inside the screen`).toBeGreaterThanOrEqual(0);
        expect(t.right, `${t.word} inside the screen`).toBeLessThanOrEqual(m.winW + 0.5);
        if (SLOT[t.word]) expect(t.slot, `${t.word} wears slot ${SLOT[t.word]}`).toBe(SLOT[t.word]);
        // No fills anywhere: the tab is the card colour (selected too), the icon's round place is empty.
        expect(t.bg, `${t.word}: the tab is the plain card colour`).toBe(m.tabs[0].bg);
        expect(t.hicBg, `${t.word}: no fill behind the icon`).toMatch(TRANSPARENT);
        expect(t.ring, `${t.word}: no ring round the icon at rest (selected or not)`).toMatch(TRANSPARENT);
        if (!t.selected) {
          expect(t.icon, `${t.word}: grey icon at rest`).toBe('rgb(147, 133, 110)');
          expect(t.barW, `${t.word}: short line at rest`).toBeCloseTo(18, 0);
        } else {
          expect(t.barW, `${t.word}: selected = the long line`).toBeCloseTo(40, 0);
        }
        if (t.count) {
          expect(t.count.bg, `${t.word}: the count has no fill`).toMatch(TRANSPARENT);
          expect(t.count.right, `${t.word}: the count sits in the top-right corner`).toBeLessThan(5);
          expect(t.count.top, `${t.word}: the count sits in the top-right corner`).toBeLessThan(5);
          expect(t.count.overLabel, `${t.word}: the count never covers the word`).toBe(false);
          expect(t.count.ring, `${t.word}: rose ring = late or due today, grey ring = waiting`).toBe(t.count.need ? 'rgb(230, 68, 61)' : 'rgb(138, 127, 112)');
        }
      }
      expect(m.tabs.filter((t) => t.selected).length, 'exactly one tab shows where you are').toBe(1);
      const main = m.tabs[0];
      if (main.selected) expect(main.barBg, 'Main selected: every colour in its line').toBe('gradient');
      expect(m.pageW, 'no sideways page scroll').toBeLessThanOrEqual(W);
      expect(m.bodyW, 'no sideways page scroll').toBeLessThanOrEqual(W);
      expect(m.navScroll, 'the bar never scrolls sideways').toBeLessThanOrEqual(0);
    });
  }

  test(`${hub}: More opens its menu, every view in it opens, Esc shuts it`, async ({ page, guard }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await H.open(page, guard);
    const nav = page.locator('nav.house-tabs');
    const more = nav.locator('[data-house-more]');
    const menu = nav.locator('.house-more');
    await expect(more).toHaveAccessibleName('More');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeHidden();
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();
    const items = menu.locator(':scope > a, :scope > button');
    // A view may carry its count after the word (e.g. "Kits1"): the word itself must match exactly.
    await expect(items).toHaveText(PLAN[hub].more.concat(PLAN[hub].out || []).map((w) => new RegExp('^' + w + '\\d*$')));
    // A link out of the site (not a view) opens a new tab and so never shows "where you are".
    for (const w of PLAN[hub].out || []) await expect(menu.locator(':scope > a', { hasText: w })).toHaveAttribute('target', '_blank');
    // Each view in the menu takes its own colour in its icon on hover (grey only for slot 0).
    for (const it of await items.all()) {
      if ((await it.getAttribute('data-slot')) === '0') continue;
      await it.hover();
      await expect.poll(() => it.evaluate((e) => getComputedStyle(e.querySelector('svg, .ti, i')).color), { message: 'menu icon colour on hover' }).not.toBe('rgb(147, 133, 110)');
    }
    // The menu stays on screen.
    const box = await menu.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();
    // Each view under More opens from the menu, the menu shuts, and More then shows where you are.
    for (const word of PLAN[hub].more) {
      await more.click();
      await menu.locator(':scope > a, :scope > button', { hasText: word }).click();
      await expect(menu).toBeHidden();
      await expect(menu.locator(':scope > [aria-current="page"]')).toHaveText(new RegExp('^' + word + '\\d*$'));
      // The line grows with a short transition; wait for it to settle.
      await expect.poll(() => more.evaluate((b) => b.querySelector('.bar').getBoundingClientRect().width), { message: `More shows where you are (${word})` }).toBeCloseTo(40, 0);
    }
    // A click outside shuts it too.
    await more.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(640, 200);
    await expect(menu).toBeHidden();
  });

  test(`${hub}: hover is one movement (colour + long line + a 1px ring), and the ring is never there at rest`, async ({ page, guard }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await H.open(page, guard);
    const tabs = page.locator('nav.house-tabs .ht');
    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      const t = tabs.nth(i);
      if (await t.getAttribute('aria-current') === 'page') continue;
      await t.hover();
      await page.waitForTimeout(250);
      const s = await t.evaluate((e) => { const h = getComputedStyle(e.querySelector('.hic')); return { ring: h.borderTopColor, w: h.borderTopWidth, icon: h.color, bar: e.querySelector('.bar').getBoundingClientRect().width, bg: getComputedStyle(e).backgroundColor, hicBg: h.backgroundColor }; });
      expect(s.w, 'a 1px ring on hover').toBe('1px');
      expect(s.ring, 'the ring is the icon colour').toBe(s.icon);
      expect(s.bar, 'the line widens on hover').toBeCloseTo(40, 0);
      expect(s.hicBg, 'still no fill on hover').toMatch(TRANSPARENT);
      await page.mouse.move(640, 200);
      await page.waitForTimeout(250);
      const r = await t.evaluate((e) => getComputedStyle(e.querySelector('.hic')).borderTopColor);
      expect(r, 'the ring goes again').toMatch(TRANSPARENT);
    }
  });
}

test('keyboard: every tab is reachable with Tab, shows a visible focus ring, and opens with Enter', async ({ page, guard }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ALL.money.open(page, guard);
  const dates = page.locator('nav.house-tabs .ht[data-nav="dates"]');
  await dates.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(dates).toBeFocused();
  const f = await dates.evaluate((e) => ({ o: getComputedStyle(e).outlineStyle, w: getComputedStyle(e).outlineWidth, ring: getComputedStyle(e.querySelector('.hic')).borderTopColor }));
  expect(f.o).toBe('solid');
  expect(f.w).toBe('2px');
  expect(f.ring).not.toMatch(TRANSPARENT);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/dates$/);
  // More by keyboard: Enter opens, the first view takes the focus, Enter goes there.
  const more = page.locator('nav.house-tabs [data-house-more]');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#houseMore a', { hasText: 'Control' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/control$/);
});

for (const look of [{ bg: 'warm', scheme: 'dark' }, { bg: 'cool', scheme: 'dark' }, { bg: 'cool', scheme: 'light' }]) {
  for (const [hub, H] of Object.entries(ALL)) {
    test(`${hub}, ${look.bg} ${look.scheme}: Main's ink icon follows the look (light in dark), no fills, colours from the slots`, async ({ page, guard }) => {
      await setLook(page, look);
      await page.setViewportSize({ width: 1280, height: 800 });
      await H.open(page, guard);
      await page.mouse.move(640, 200);
      const m = await page.evaluate(measureBar);
      const main = m.tabs[0];
      if (main.selected) expect(main.icon, `${hub}: Main's icon`).toBe(look.scheme === 'dark' ? 'rgb(243, 238, 229)' : 'rgb(44, 44, 42)');
      for (const t of m.tabs) {
        expect(t.hicBg, `${hub} ${t.word}: no fill behind the icon`).toMatch(TRANSPARENT);
        expect(t.ring, `${hub} ${t.word}: no ring at rest`).toMatch(TRANSPARENT);
        expect(t.bg, `${hub} ${t.word}: plain card colour`).toBe(main.bg);
        if (!t.selected) expect(t.icon, `${hub} ${t.word}: grey at rest`).toBe('rgb(147, 133, 110)');
      }
    });
  }
}
