// Bottom-tab counts and tab size (Lisa's pick b, 2 Nov 2026: "use b not different sized rectangles ... same size ideally square").
//  - Phone (390): a tab's count is a DOT, not a number: 8px, just off the icon's top-right corner, rose = late or due today,
//    grey = waiting, no dot when 0. Every tab on the bar is the same width (no tab widens for its count) and as close to square
//    as fits: height >= width - 2px, never under 56px high. The tab's name still says the number ("Do 3 waiting").
//  - Laptop (1280): the 14px number in its 24px ring stays as it was; tabs are equal width there too.
//  - Phone words (Lisa, 2 Nov 2026): Money's "Accountant" shows as "Acct" and Marketplace's "New Stock" as "Stock" on a phone, so
//    every phone tab is one square size; laptops keep the full words. The tab's name keeps the full word ("Accountant 3 waiting").
// On all 8 pages. Pretend Google, Drive and Sheets; every row is invented.
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
const ROSE = 'rgb(230, 68, 61)', GREY = 'rgb(138, 127, 112)', BLACK = 'rgb(30, 28, 26)';   // black = broken (Lisa, 3 Nov 2026)
const CLEAR = /^(transparent|rgba\(0, 0, 0, 0\))$/;

// Every tab on the bar: its box, its word's room, its icon, its count (box, colours, whether a number shows) and its name.
function read() {
  const nav = [...document.querySelectorAll('nav.house-tabs')].find((n) => n.getBoundingClientRect().height > 0);
  return [...nav.querySelectorAll(':scope > .ht, :scope > .ht-more > .ht')].map((t) => {
    const r = t.getBoundingClientRect(), w = t.querySelector(':scope > .htl'), ws = getComputedStyle(w), i = t.querySelector(':scope > .hic').getBoundingClientRect();
    const n = t.querySelector(':scope > .n, :scope > .cnt'), ns = n && getComputedStyle(n), nr = n && n.getBoundingClientRect();
    return {
      word: w.innerText.trim(), full: (w.querySelector(':scope > .htl-long') || w).textContent.trim(), w: r.width, h: r.height, wordRoom: w.scrollWidth + parseFloat(ws.marginLeft) + parseFloat(ws.marginRight),
      wordFits: w.scrollWidth <= w.clientWidth + 1, wordPx: parseFloat(ws.fontSize), name: t.getAttribute('aria-label') || t.textContent.trim(),
      icon: { l: i.left - r.left, t: i.top - r.top, r: i.right - r.left, b: i.bottom - r.top },
      n: n ? { text: n.textContent.trim(), need: n.classList.contains('need'), broken: n.classList.contains('broken'), why: n.getAttribute('data-why'), shown: nr.width > 0 && nr.height > 0 && ns.display !== 'none',
        l: nr.left - r.left, t: nr.top - r.top, r: nr.right - r.left, b: nr.bottom - r.top, w: nr.width, h: nr.height,
        bg: ns.backgroundColor, ring: ns.borderTopWidth === '0px' || ns.borderTopStyle === 'none' ? 'none' : ns.borderTopColor, radius: ns.borderTopLeftRadius,
        px: parseFloat(ns.fontSize), color: ns.color } : null,
    };
  });
}

for (const [hub, H] of Object.entries(ALL)) {
  test(`${hub} at 390: tabs one size, close to square; a count is a coloured dot (no number), none at 0; the name says the number`, async ({ page, guard }) => {
    await setLook(page, { bg: 'warm', scheme: 'light' });
    await page.setViewportSize({ width: 390, height: 844 });
    await H.open(page, guard);
    await page.mouse.move(195, 200);
    const tabs = await page.evaluate(read);
    expect(tabs.length).toBeGreaterThan(2);
    // One size: every tab the width of the narrowest (+-1px). The only tab that may be wider is one whose single 14px word cannot
    // fit the bar's equal share at all (then it keeps just its word's room, never more, and the word stays whole).
    const share = Math.min(...tabs.map((t) => t.w));
    // Square unless a word needs more: then every tab takes the longest word's room (no wider), and stays at least 56px high.
    const longest = Math.max(...tabs.filter((t) => t.wordRoom <= share + 1).map((t) => t.wordRoom));
    for (const t of tabs) {
      if (t.wordRoom > share + 1) expect(t.w, `${hub} ${t.word}: wider only by its word's room (${t.wordRoom})`).toBeLessThanOrEqual(t.wordRoom + 1);
      else expect(Math.abs(t.w - share), `${hub} ${t.word}: the same width as every other tab (${t.w} vs ${share})`).toBeLessThanOrEqual(1);
      expect(t.h, `${hub} ${t.word}: never under 56px high`).toBeGreaterThanOrEqual(56);
      if (t.wordRoom <= share + 1) {
        if (longest <= t.h + 1) expect(t.h, `${hub} ${t.word}: square (${t.w} x ${t.h})`).toBeGreaterThanOrEqual(t.w - 2);
        else expect(t.w, `${hub} ${t.word}: no wider than the longest word needs (${longest})`).toBeLessThanOrEqual(longest + 1);
      }
      expect(t.wordFits, `${hub} ${t.word}: the word is whole`).toBe(true);
      expect(t.wordPx, `${hub} ${t.word}: the word is 14px`).toBe(14);
    }
    let dots = 0;
    for (const t of tabs) {
      if (!t.n || !t.n.text) {
        if (t.n) expect(t.n.shown, `${hub} ${t.word}: 0 = no dot`).toBe(false);
        expect(t.name, `${hub} ${t.word}: no count = just the word`).toBe(t.full);
        continue;
      }
      dots++;
      expect(t.n.shown, `${hub} ${t.word}: the dot shows`).toBe(true);
      expect([t.n.w, t.n.h], `${hub} ${t.word}: an 8px dot`).toEqual([8, 8]);
      expect(t.n.radius, `${hub} ${t.word}: round`).toBe('50%');
      expect(t.n.ring, `${hub} ${t.word}: a dot, not a ring`).toBe('none');
      expect(t.n.bg, `${hub} ${t.word}: rose = late, black = broken, grey = waiting`).toBe(t.n.need ? ROSE : t.n.broken ? BLACK : GREY);
      expect(t.n.px, `${hub} ${t.word}: no number shows`).toBe(0);
      expect(t.n.color, `${hub} ${t.word}: no number shows`).toMatch(CLEAR);
      // Top right of the icon: just off its right edge, level with its top, clear of it and inside the tab.
      expect(t.n.l, `${hub} ${t.word}: the dot starts at the icon's right edge`).toBeGreaterThanOrEqual(t.icon.r);
      expect(t.n.l - t.icon.r, `${hub} ${t.word}: ...right beside it`).toBeLessThanOrEqual(3);
      expect(Math.abs(t.n.t - t.icon.t), `${hub} ${t.word}: level with the icon's top`).toBeLessThanOrEqual(2);
      expect(t.n.r, `${hub} ${t.word}: inside the tab`).toBeLessThanOrEqual(t.w);
      expect(t.name, `${hub} ${t.word}: the name says the number`).toBe(`${t.full} ${t.n.text} ${t.n.need ? 'late' : t.n.broken ? t.n.why : 'waiting'}`);
      if (t.n.broken) expect(t.n.why, `${hub} ${t.word}: a black count says what is broken`).toMatch(/^(down|expired|stuck|failed)$/);
    }
    expect(dots, `${hub}: the sample data shows at least one tab count`).toBeGreaterThan(0);
  });

  test(`${hub} at 390: the dot and the name follow the count (0 = none, waiting = grey, late = rose)`, async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await H.open(page, guard);
    // The first tab with a count place: write 3 waiting, then 1 late, then 0, as the pages do.
    const ix = await page.evaluate(() => [...document.querySelectorAll('nav.house-tabs > .ht, nav.house-tabs > .ht-more > .ht')].findIndex((t) => t.querySelector(':scope > .n') && t.getBoundingClientRect().width));
    expect(ix).toBeGreaterThanOrEqual(0);
    const tab = page.locator('nav.house-tabs > .ht, nav.house-tabs > .ht-more > .ht').nth(ix);
    const dot = tab.locator(':scope > .n');
    const word = await tab.locator(':scope > .htl').evaluate((w) => (w.querySelector(':scope > .htl-long') || w).textContent.trim());
    const set = (text, need) => dot.evaluate((n, [t, l]) => { n.textContent = t; n.classList.toggle('need', l); }, [text, need]);
    await set('3', false);
    await expect(tab).toHaveAttribute('aria-label', `${word} 3 waiting`);
    await expect(dot).toHaveCSS('background-color', GREY);
    await expect(dot).toBeVisible();
    await set('1', true);
    await expect(tab).toHaveAttribute('aria-label', `${word} 1 late`);
    await expect(dot).toHaveCSS('background-color', ROSE);
    await set('', true);
    await expect(tab).toHaveAttribute('aria-label', word);
    await expect(dot).toBeHidden();
  });

  test(`${hub} at 1280: tabs one width; a count is still the 14px number in its 24px ring, no fill`, async ({ page, guard }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await H.open(page, guard);
    await page.mouse.move(640, 200);
    const tabs = await page.evaluate(read);
    for (const t of tabs) expect(Math.abs(t.w - tabs[0].w), `${hub} ${t.word}: the same width as the others`).toBeLessThanOrEqual(1);
    let rings = 0;
    for (const t of tabs) {
      if (!t.n || !t.n.text) continue;
      rings++;
      expect([t.n.w, t.n.h], `${hub} ${t.word}: the 24px ring`).toEqual([24, 24]);
      expect(t.n.px, `${hub} ${t.word}: a 14px number`).toBe(14);
      expect(t.n.color, `${hub} ${t.word}: the number shows`).not.toMatch(CLEAR);
      if (t.n.broken) expect([t.n.bg, t.n.ring], `${hub} ${t.word}: broken = the black badge, the same 24px box`).toEqual([BLACK, BLACK]);
      else expect(t.n.bg, `${hub} ${t.word}: no fill`).toMatch(CLEAR);
      if (!t.n.broken) expect(t.n.ring, `${hub} ${t.word}: rose ring = late, grey ring = waiting`).toBe(t.n.need ? ROSE : GREY);
      expect(t.w - t.n.r, `${hub} ${t.word}: in the tab's top-right corner`).toBeLessThan(5);
      expect(t.n.t, `${hub} ${t.word}: in the tab's top-right corner`).toBeLessThan(5);
      expect(t.name, `${hub} ${t.word}: the name says the number`).toBe(`${t.full} ${t.n.text} ${t.n.need ? 'late' : t.n.broken ? t.n.why : 'waiting'}`);
      if (t.n.broken) expect(t.n.why, `${hub} ${t.word}: a black count says what is broken`).toMatch(/^(down|expired|stuck|failed)$/);
    }
    expect(rings, `${hub}: the sample data shows at least one tab count`).toBeGreaterThan(0);
  });
}

test("dark look at 390: the dots take the look's own rose and grey (Money)", async ({ page, guard }) => {
  await setLook(page, { bg: 'warm', scheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await ALL.money.open(page, guard);
  const tok = await page.evaluate(() => Object.fromEntries(['--house-late', '--house-ring'].map((v) => {
    const p = document.createElement('i'); document.body.appendChild(p); p.style.color = 'var(' + v + ')'; const c = getComputedStyle(p).color; p.remove(); return [v, c];
  })));
  const tabs = await page.evaluate(read);
  const counted = tabs.filter((t) => t.n && t.n.text);
  expect(counted.length).toBeGreaterThan(0);
  for (const t of counted) expect(t.n.bg, `${t.word}: rose = late, grey = waiting`).toBe(t.n.need ? tok['--house-late'] : tok['--house-ring']);
});

// Lisa (2 Nov 2026): phone words for the two long tabs, so every phone tab is the same square; laptops keep the full words.
const SHORT = { money: ['Accountant', 'Acct'], marketplace: ['New Stock', 'Stock'] };
for (const [hub, [full, short]] of Object.entries(SHORT)) {
  test(`${hub} at 390: "${full}" shows as "${short}" and every tab is the same width; at 1280 it says "${full}"`, async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ALL[hub].open(page, guard);
    await page.mouse.move(195, 200);
    let tabs = await page.evaluate(read);
    const tab = tabs.find((t) => t.full === full);
    expect(tab, `${hub}: the ${full} tab is on the bar`).toBeTruthy();
    expect(tab.word, `${hub}: the phone word`).toBe(short);
    expect(tab.wordFits, `${hub}: ${short} is whole`).toBe(true);
    expect(tab.name, `${hub}: the name keeps the full word`).toMatch(new RegExp('^(' + full + '( \\d+ (late|waiting))?|' + short + '( \\d+ (late|waiting))? \\(' + full + '\\))$'));   // the name starts with the visible word
    for (const t of tabs) {
      expect(Math.abs(t.w - tabs[0].w), `${hub} ${t.word}: the same width as every other tab (${t.w} vs ${tabs[0].w})`).toBeLessThanOrEqual(1);
      expect(t.h, `${hub} ${t.word}: square (${t.w} x ${t.h})`).toBeGreaterThanOrEqual(t.w - 2);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.mouse.move(640, 200);
    await expect.poll(async () => (await page.evaluate(read)).find((t) => t.full === full).word).toBe(full);
    tabs = await page.evaluate(read);
    const wide = tabs.find((t) => t.full === full);
    expect(wide.wordFits, `${hub}: ${full} is whole at 1280`).toBe(true);
    expect(wide.name, `${hub}: the name keeps the full word`).toMatch(new RegExp('^' + full + '(, \\d+ (late|waiting))?$'));
  });
}
