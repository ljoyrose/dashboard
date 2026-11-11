// Fold (Lisa, 2 Nov 2026): every card or section with a heading, on every page and tab, folds down to its heading with ONE real
// button (the grey chevron): aria-expanded, aria-controls, Enter and Space. A fold is remembered through a reload, a folded heading
// keeps its count ring, a phone list of more than 5 rows starts at 3 with "+N more", phone titles stop at 2 lines, and a row that
// opens its item still does. Pretend Google and Drive only; every row is invented.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, go } = require('../support/hubs');

// Pictures for Lisa only when asked: FOLD_SHOTS=<folder>.
const SHOTS = process.env.FOLD_SHOTS || '';

// Checks every fold button on the screen now: named, open, its parts real; click folds (parts hidden, heading row still shown),
// Enter opens, Space folds, Space opens. Returns how many it checked.
async function checkFolds(page, where) {
  const btns = page.locator('button.house-fold:visible');
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i);
    const label = await b.getAttribute('aria-label');
    expect(label, where + ' fold ' + i + ' has a name').toMatch(/^Fold \S/);
    await expect(b, where + ' ' + label).toHaveAttribute('aria-expanded', 'true');
    const ids = (await b.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean);
    expect(ids.length, where + ' ' + label + ' controls something').toBeGreaterThan(0);
    const box = b.locator('xpath=ancestor::*[@data-fold-box][1]');
    const row = box.locator(':scope > [data-fold-row]');
    const shown = async () => box.evaluate((c, list) => list.map((id) => { const e = document.getElementById(id); return !!e && c.contains(e) && e.getClientRects().length > 0; }), ids);
    expect((await shown()).every((x) => x), where + ' ' + label + ' starts open').toBe(true);
    await b.click();
    await expect(b).toHaveAttribute('aria-expanded', 'false');
    expect((await shown()).some((x) => x), where + ' ' + label + ' folded hides its parts').toBe(false);
    await expect(row, where + ' ' + label + ' heading stays').toBeVisible();
    await b.focus(); await page.keyboard.press('Enter');
    await expect(b).toHaveAttribute('aria-expanded', 'true');
    expect((await shown()).every((x) => x), where + ' ' + label + ' Enter opens').toBe(true);
    await page.keyboard.press('Space');
    await expect(b).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(b).toHaveAttribute('aria-expanded', 'true');
  }
  return n;
}

test.describe('Fold: every section heading on every page and tab', () => {
  for (const [hub, h] of Object.entries(HUBS)) {
    test(`${hub}: every fold button names itself, folds and opens by click, Enter and Space`, async ({ page, guard }) => {
      test.setTimeout(240_000);
      await h.open(page, guard);
      let total = 0;
      for (const v of h.views) {
        await go(page, v);
        total += await checkFolds(page, hub + ' #/' + v);
      }
      expect(total, hub + ': at least one section folds').toBeGreaterThan(0);
      // Every card or section whose first part is a heading (and has more under it) has its fold.
      for (const v of h.views) {
        await go(page, v);
        const missing = await page.evaluate(() => [...document.querySelectorAll('.card, section')].filter((c) => {
          if (!c.getClientRects().length || c.closest('header, nav, dialog, details, a, button, [data-no-fold]')) return false;
          const kids = [...c.children].filter((k) => !k.classList.contains('house-fold') && k.getAttribute('aria-hidden') !== 'true').slice(0, 2);
          const i = kids.findIndex((k) => k.matches('h2, h3, h4') || k.querySelector(':scope > h2, :scope > h3, :scope > h4'));
          return i >= 0 && kids[i].nextElementSibling && !c.hasAttribute('data-fold-box');
        }).map((c) => c.tagName + '.' + c.className));
        expect(missing, hub + ' #/' + v + ' sections without a fold').toEqual([]);
      }
    });
  }

  test('Web Estate: its cards fold too', async ({ page }) => {
    const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
    const F = require('../fixtures/estate/rows.js');
    await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
    await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => {
      const url = decodeURIComponent(route.request().url());
      if (!/\/values\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sheets: [{ properties: { title: 'Properties' } }] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(F.HEADER, F.ROWS) }) });
    });
    await page.goto('estate/#/home');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    let total = 0;
    for (const v of ['home', 'access']) { await go(page, v); total += await checkFolds(page, 'estate #/' + v); }
    expect(total).toBeGreaterThan(0);
  });
});

test('a fold survives a reload, and a folded Needs you still shows its count ring', async ({ page, guard }) => {
  await HUBS.money.open(page, guard);
  await page.goto('money/#/now');
  const needs = page.locator('[data-hm="needs"]');
  const b = needs.locator('button.house-fold');
  await b.click();
  await expect(b).toHaveAttribute('aria-expanded', 'false');
  await page.reload();   // a fresh page load (still signed in)
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  await expect(needs.locator('button.house-fold')).toHaveAttribute('aria-expanded', 'false');
  await expect(needs.locator('.hm-rows')).toBeHidden();
  await expect(needs.locator('.hm-head .cnt')).toBeVisible();
  await expect(needs.locator('.hm-head .cnt')).toHaveText(/^\d+$/);
  // The other sections were never folded, so they stay open.
  await expect(page.locator('[data-hm="next"] button.house-fold')).toHaveAttribute('aria-expanded', 'true');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dash-fold')));
  expect(Object.keys(saved).some((k) => /money\/#\/now\|Needs you$/.test(k))).toBe(true);
});

test('the heading row folds; the heading link still opens Do; a row still opens its item', async ({ page, guard }) => {
  await HUBS.money.open(page, guard);
  await page.goto('money/#/now');
  const needs = page.locator('[data-hm="needs"]');
  const b = needs.locator('button.house-fold');
  // A tap on the heading row's empty middle folds and opens.
  const head = await needs.locator('.hm-head').boundingBox();
  const h3 = await needs.locator('.hm-head h3').boundingBox();
  await page.mouse.click(h3.x + h3.width + 20, head.y + head.height / 2);
  await expect(b).toHaveAttribute('aria-expanded', 'false');
  await page.mouse.click(h3.x + h3.width + 20, head.y + head.height / 2);
  await expect(b).toHaveAttribute('aria-expanded', 'true');
  // The heading's own link still goes to Do.
  const href = await needs.locator('h3 a').getAttribute('href');
  await needs.locator('h3 a').click();
  await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  await page.goBack();
  // Clicking anywhere on a [data-open-row] row (its pill, its empty edge) still opens its item.
  const rows = page.locator('[data-hm="needs"] li.hm-row[data-open-row]');
  await expect(rows.first()).toBeVisible();
  const n = await rows.count();
  let checked = 0;
  for (let i = 0; i < n && checked < 2; i++) {
    const a = rows.nth(i).locator('.house-open');
    const to = await a.getAttribute('href');
    if (!/^#\//.test(to) || await a.getAttribute('target')) continue;
    const r = await rows.nth(i).boundingBox();
    await page.mouse.click(r.x + 4, r.y + r.height / 2);
    await expect(page).toHaveURL(new RegExp(to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
    await page.goto('money/#/now');
    await expect(rows.first()).toBeVisible();
    checked++;
  }
  expect(checked, 'a row with an in-page item was clicked').toBeGreaterThan(0);
  // The Next card opens its item from its heading too (a row that opens keeps doing that); its chevron folds.
  const next = page.locator('[data-hm="next"]');
  const to = await next.locator('.house-open').getAttribute('href');
  if (/^#\//.test(to) && !(await next.locator('.house-open').getAttribute('target'))) {
    await next.locator('.hm-head h3').click();
    await expect(page).toHaveURL(new RegExp(to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
  }
});

test('the chevron: grey outline icon in a house control (1px line), no fill and nothing moves on hover, focus and press; still with reduced motion', async ({ page, guard }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await HUBS.money.open(page, guard);
  await page.goto('money/#/now');
  const b = page.locator('[data-hm="needs"] button.house-fold');
  const read = () => b.evaluate((e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(), i = e.querySelector('svg'), is = getComputedStyle(i);
    return { bg: s.backgroundColor, box: [r.x, r.y, r.width, r.height].map(Math.round).join(','), border: s.borderTopStyle === 'none' ? 0 : parseFloat(s.borderTopWidth), shadow: s.boxShadow, iw: i.getBoundingClientRect().width, fill: is.fill, stroke: is.stroke, ink: getComputedStyle(document.body).color, motion: is.transitionDuration, ow: s.outlineWidth, os: s.outlineStyle }; });
  const rest = await read();
  expect(rest.bg).toBe('rgba(0, 0, 0, 0)');
  expect(rest.border, 'rests on the one 1px control line').toBe(1);
  expect(rest.shadow).toBe('none');
  expect(rest.iw).toBeGreaterThanOrEqual(14); expect(rest.iw).toBeLessThanOrEqual(18);
  expect(rest.fill).toBe('none');
  expect(rest.stroke, 'grey, not ink').not.toBe(rest.ink);
  expect(rest.motion).toBe('0s');
  await b.hover();
  const hov = await read();
  expect(hov.bg, 'no fill on hover').toBe(rest.bg); expect(hov.box, 'nothing moves on hover').toBe(rest.box);
  expect(hov.os, 'hover line follows the corner, not a square outline').toBe('none');
  expect(hov.shadow, 'hover is the 1px line inside').toMatch(/0px 0px 0px 1px inset/);
  await b.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const foc = await read();
  expect(foc.bg, 'no fill on focus').toBe(rest.bg); expect(foc.box, 'nothing moves on focus').toBe(rest.box);
  await page.mouse.move(0, 0);
});

test.describe('on a phone (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('long Main titles stop at 2 lines with the whole title in the name; nothing scrolls sideways', async ({ page, guard }) => {
    await HUBS.money.open(page, guard);
    await page.goto('money/#/now');
    await expect(page.locator('[data-hub-main]')).toBeVisible();
    const LONG = 'A very long invented title that goes on and on about a sample filing for a sample company with a supercalifragilisticexpialidocious word in the middle so it would wrap onto four or five lines';
    await page.evaluate((t) => {
      const rows = [1, 2, 3, 4].map((i) => ({ kind: i === 1 ? 'late' : 'wait', text: t + ' ' + i, href: '#/todo', act: 'Open' }));
      const hm = document.querySelector('[data-hub-main]');
      hm.outerHTML = DashKit.hubMain({ hub: 'money', rows, doHref: '#/todo', nums: [{ label: 'A', value: 1, href: '#/todo' }, { label: 'B', value: 2, href: '#/todo' }, { label: 'C', value: 3, href: '#/todo' }] });
    }, LONG);
    const titles = page.locator('[data-hub-main] :is(.hm-what, .hm-t) > a.house-open');
    await expect(titles).toHaveCount(5);
    const got = await titles.evaluateAll((els) => els.map((a) => { const s = getComputedStyle(a); return { h: a.getBoundingClientRect().height, lh: parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.5, label: a.getAttribute('aria-label'), clipped: a.scrollHeight > a.clientHeight + 1 }; }));
    for (const g of got) {
      expect(g.h, 'at most 2 lines').toBeLessThanOrEqual(g.lh * 2 + 1);
      expect(g.clipped, 'the rest is cut with …').toBe(true);
      expect(g.label).toMatch(new RegExp('^' + LONG + ' \\d$'));
    }
    const side = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(side, 'no sideways scroll').toBeLessThanOrEqual(0);
  });

  test('a list of more than 5 rows starts at 3 rows and "+N more" opens the rest (remembered)', async ({ page, guard }) => {
    await HUBS.home.open(page, guard);
    await page.goto('./#/drive');
    const more = page.locator('button.house-fold-more').first();
    await expect(more).toBeVisible();
    const list = page.locator('#' + await more.getAttribute('aria-controls'));
    const sec = (await more.getAttribute('data-fold-rows')).replace(/\|rows\d+$/, '');
    const all = await list.locator(':scope > li').count();
    expect(all).toBeGreaterThan(5);
    await expect(list.locator(':scope > li:visible')).toHaveCount(3);
    await expect(more).toHaveText('+' + (all - 3) + ' more');
    await more.click();
    await expect(list.locator(':scope > li:visible')).toHaveCount(all);
    await expect(page.locator('button.house-fold-more')).toHaveCount(0);
    await page.reload();   // a fresh load (still signed in): the opened list stays open
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    const again = page.locator('[data-fold-box="' + sec + '"] li:visible');
    await expect(again.first()).toBeVisible();
    await expect(again).toHaveCount(all);
    await expect(page.locator('button.house-fold-more')).toHaveCount(0);
  });

  test('Dashboard Main at 390, open and folded (pictures for Lisa)', async ({ page, guard }) => {
    await HUBS.home.open(page, guard);
    await page.goto('./#/map');
    const needs = page.locator('#needsToday');
    await expect(needs.locator('button.house-fold')).toBeVisible();
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'dashboard-main-390-open.png'), fullPage: true });
    await page.locator('#urgentOne button.house-fold').click();
    await needs.locator('button.house-fold').click();
    await expect(needs.locator('ol')).toBeHidden();
    await expect(needs.locator('.cardhead .mtag')).toBeVisible();
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'dashboard-main-390-folded.png'), fullPage: true });
  });
});
