// The top bar (Lisa's pick A, 2 Nov 2026): the SAME bar on all 8 pages. One dark row, exactly 56px high at 1280 and at 390,
// never wrapping. Home icon top left (not on home), the hub's name, then icon-only buttons, each with a name for screen
// readers and no words on screen; Refresh is called "Refresh" everywhere; a Look button on every page. On a phone Sign out
// and the read time leave the bar and sit inside the Look menu. Pretend Google, Drive and Sheets; every row is invented.
const { test, expect } = require('../support/test');
const { HUBS } = require('../support/hubs');

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
// Pages that show a read time in the bar today (it moves into the Look menu on a phone).
const READ = { home: /^Read \d/, money: /^Read \d/, marketplace: /^Read \d/, cdhub: /^Read \d/ };

// Everything a person sees in the bar, measured: the header box, each item in the row and each button or link.
function measure() {
  const h = document.querySelector('header');
  const hr = h.getBoundingClientRect();
  const shown = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const row = h.querySelector('.house-row');
  const items = row ? [...row.children].filter(shown).map((e) => { const r = e.getBoundingClientRect(); return { tag: e.tagName, top: r.top, bottom: r.bottom, mid: (r.top + r.bottom) / 2, left: r.left }; }) : [];
  const presses = [...h.querySelectorAll('button, a')].filter((e) => shown(e) && !e.closest('.house-menu, [role="dialog"]'));
  return {
    height: hr.height, top: hr.top, bottom: hr.bottom, rows: !!row,
    items,
    presses: presses.map((e) => ({
      what: e.outerHTML.slice(0, 120), icon: e.classList.contains('house-ib'), label: e.getAttribute('aria-label') || '', title: e.getAttribute('title') || '',
      words: (e.innerText || '').trim(), signin: e.getAttribute('data-action') === 'signin', inH1: !!e.closest('h1'), pill: e.matches('a.pill'),
    })),
  };
}

for (const [hub, H] of Object.entries(ALL)) {
  for (const width of [1280, 390]) {
    test(`${hub} at ${width}px: one 56px row, icon buttons with names, a Look button, the Home icon top left`, async ({ page, guard }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await H.open(page, guard);
      const m = await page.evaluate(measure);
      // Exactly 56px high, one row: every item sits inside the bar on the same middle line.
      expect(m.rows, 'the bar is one .house-row').toBe(true);
      expect(m.height, 'header height').toBe(56);
      expect(m.items.length).toBeGreaterThan(2);
      for (const it of m.items) {
        expect(it.top, it.tag + ' inside the bar (top)').toBeGreaterThanOrEqual(m.top - 0.5);
        expect(it.bottom, it.tag + ' inside the bar (bottom)').toBeLessThanOrEqual(m.bottom + 0.5);
        expect(Math.abs(it.mid - (m.top + 28)), it.tag + ' on the one middle line').toBeLessThanOrEqual(1);
      }
      // Every button or link in the bar is an icon button with a name and no words on screen; only Sign in (and the name) has words.
      for (const p of m.presses) {
        if (p.inH1 || p.signin || p.pill) continue;   // the name, the one Sign in word button, Studio's status pills (desktop)
        expect(p.icon, 'icon-only button: ' + p.what).toBe(true);
        expect(p.label, 'aria-label: ' + p.what).not.toBe('');
        expect(p.title, 'title: ' + p.what).not.toBe('');
        expect(p.words, 'no visible words: ' + p.what).toBe('');
      }
      // Buttons are 36px on a desktop and 44px on a phone.
      for (const b of await page.locator('header .house-ib:visible').all()) {
        const r = await b.boundingBox();
        expect(Math.round(r.height), 'icon button height').toBe(width === 390 ? 44 : 36);
        expect(Math.round(r.width), 'icon button width').toBe(width === 390 ? 44 : 36);
      }
      // Home: exactly one link named Dashboard, to ../, top left (first in the bar). None on the home page itself.
      const home = page.locator('header a[aria-label="Dashboard"]');
      if (hub === 'home') await expect(home).toHaveCount(0);
      else {
        await expect(home).toHaveCount(1);
        await expect(home).toHaveAttribute('href', '../');
        await expect(home).toHaveAttribute('id', 'backHome');
        const hb = await home.boundingBox(), first = Math.min(...m.items.map((i) => i.left));
        expect(hb.x, 'Home is the first thing in the bar').toBeLessThanOrEqual(first + 0.5);
      }
      // Refresh has one name everywhere.
      await expect(page.locator('header').getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
      // Look on every page.
      const look = page.locator('header').getByRole('button', { name: 'Look', exact: true });
      await expect(look).toHaveCount(1);
      await expect(look).toBeVisible();
      // Sign out: in the bar on a desktop; on a phone it (and the read time) leave the bar and sit inside Look.
      const out = page.locator('header').getByRole('button', { name: 'Sign out', exact: true });
      if (width === 1280) {
        await expect(out).toBeVisible();
        if (READ[hub]) await expect(page.locator('header [data-house-read]')).toBeVisible();
      } else {
        await expect(out).toBeHidden();
        if (READ[hub]) await expect(page.locator('header [data-house-read]')).toBeHidden();
        await look.click();
        const menu = page.locator('header [role="dialog"][aria-label="Look"]');
        await expect(menu).toBeVisible();
        if (READ[hub]) await expect(menu.locator('[data-house-mread]')).toHaveText(READ[hub]);
        const item = menu.getByRole('button', { name: 'Sign out', exact: true });
        await expect(item).toBeVisible();
        await item.click();
        await expect(page.getByRole('button', { name: /^Sign in/ }).first()).toBeVisible();
      }
    });
  }

  test(`${hub}: the Look menu sets Background, Selected and Mode and keeps Studio's other choices; no ljoyrose.github.io in the page`, async ({ page, guard }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('dash-look', JSON.stringify({ text: 'lg', words: 'light', space: 'roomy' })); } });
    await H.open(page, guard);
    const src = await (await page.request.get(page.url().split('#')[0])).text();
    expect(src, 'page source').not.toContain('ljoyrose.github.io');
    const look = page.locator('header').getByRole('button', { name: 'Look', exact: true });
    await look.click();
    await expect(look).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('header [role="dialog"][aria-label="Look"]');
    for (const w of ['Warm clear', 'Cool clear', 'Outline', 'Soft tint', 'Device', 'Light', 'Dark']) await expect(menu.getByRole('button', { name: w, exact: true })).toBeVisible();
    await menu.getByRole('button', { name: 'Cool clear', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/(^|\s)look-cool(\s|$)/);
    await page.locator('header [role="dialog"][aria-label="Look"]').getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dash-look')));
    expect(saved).toMatchObject({ bg: 'cool', mode: 'dark', text: 'lg', words: 'light', space: 'roomy' });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(look).toBeFocused();
  });
}
