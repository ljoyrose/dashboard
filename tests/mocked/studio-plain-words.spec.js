// Studio Stage 8 (29 Oct 2026): plain words and calmer screens. Visible text only; code ids (routes, data keys) stay.
// "Spec lock" reads "Agree the brief", "Bricks" read "Parts", "Engine" reads "Studio helper".
// Pretend Google and Drive only; the data is tests/fixtures/studio/state.js (invented).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/studio/state');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const ST = ctx.window.DASH_CONFIG.studio;
const NOW = new Date('2026-10-28T10:10:00');
const ROUTES = ['me', 'decide', 'do', 'line', 'ideas', 'assets', 'review', 'brands', 'library', 'kits', 'tools', 'new', 'engine',
  'kits/playbooks', 'kits/packs', 'kits/kits', 'kits/bricks', 'kits/styles', 'kits/formats'];
const ASSET = 'asset/sa-make';
const OLD = /\b(spec lock|bricks?|engine)\b/i;

async function open(page, guard, hash, { state = true, change } = {}) {
  await page.clock.setFixedTime(NOW);
  if (state) {
    const s = build(NOW.getTime());
    if (change) change(s);
    guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
    guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(s), { parents: [ST.logsFolderId], mimeType: 'application/json' });
  }
  await page.goto('studio/' + (hash || '#/me'));
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#enginePill')).toBeVisible();
}
const go = async (page, key) => { await page.evaluate((k) => { location.hash = '#/' + k; }, key); await expect(page.locator('#view')).toHaveAttribute('data-view', key.split('/')[0]); };
// Words a reader meets: the text on screen plus the names a screen reader says (aria-label, title, placeholder).
const visibleWords = (page) => page.evaluate(() => {
  const out = [document.body.innerText];
  document.querySelectorAll('[aria-label],[title],[placeholder]').forEach((el) => {
    ['aria-label', 'title', 'placeholder'].forEach((a) => { if (el.getAttribute(a)) out.push(el.getAttribute(a)); });
  });
  return out.join('\n');
});
const oldLines = (txt) => txt.split('\n').filter((l) => OLD.test(l));

test.describe('Studio plain words (Stage 8)', () => {
  for (const withState of [true, false]) {
    test(`no old word on any page (${withState ? 'real state' : 'example data'}): Spec lock, Bricks and Engine are gone from what you read`, async ({ page, guard }) => {
      await open(page, guard, '#/me', { state: withState });
      const found = [];
      for (const r of ROUTES.concat(withState ? [ASSET] : [])) {
        await go(page, r);
        oldLines(await visibleWords(page)).forEach((l) => found.push(r + ': ' + l.trim()));
      }
      expect(found).toEqual([]);
    });
  }

  test('the new words are there: Agree the brief on the Line, Parts in Kits, Studio helper on its page', async ({ page, guard }) => {
    await open(page, guard, '#/line');
    await expect(page.locator('#view')).toContainText('Agree the brief');
    await go(page, 'kits');
    await expect(page.locator('#view')).toContainText('Parts');
    await go(page, 'engine');
    await expect(page.locator('#view')).toContainText('Studio helper');
  });

  test('Me has a closed 3-line "How Studio works" fold that opens with one tap', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    const f = page.locator('#view [data-howto]');
    await expect(f).toHaveCount(1);
    await expect(f).not.toHaveAttribute('open', '');
    await expect(f.locator('li')).toHaveCount(3);
    await expect(f.locator('li').first()).toBeHidden();
    await f.locator('summary').click();
    await expect(f.locator('li').nth(2)).toBeVisible();
    await expect(f.locator('li').nth(2)).toHaveText('Nothing is sent, shared or paid for without your own tap.');
  });

  test('"Open in Infinity" shows only when the item has an https Infinity card link, and opens in a new tab', async ({ page, guard }) => {
    const card = 'https://app.startinfinity.com/b/invented-board/invented-card';
    await open(page, guard, '#/' + ASSET, { change: (s) => {
      s.assets.find((a) => a.id === 'sa-make').lineCardUrl = card;
      s.assets.find((a) => a.id === 'sa-rev1').lineCardUrl = 'http://app.startinfinity.com/b/x/y'; // not https: no link
      s.assets.find((a) => a.id === 'sa-rev2').lineCardUrl = 'https://example.com/startinfinity.com/'; // not Infinity: no link
    } });
    const l = page.locator('#view a[data-infinity]');
    await expect(l).toHaveCount(1);
    await expect(l).toHaveText('Open in Infinity');
    await expect(l).toHaveAttribute('href', card);
    await expect(l).toHaveAttribute('target', '_blank');
    for (const id of ['sa-rev1', 'sa-rev2', 'sa-hand']) {
      await go(page, 'asset/' + id);
      await expect(page.locator('#view a[data-infinity]')).toHaveCount(0);
    }
  });

  // Calmer screens: every page is at most two taps from a bottom tab (tap the tab, then one link on that page or its sub-row).
  test('every page is two taps or fewer from a bottom tab', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    const tabs = await page.locator('nav.tabs a[data-nav]').evaluateAll((l) => l.map((a) => a.getAttribute('data-nav')));
    const far = [];
    for (const r of ROUTES) {
      let ok = false;
      for (const t of tabs) {
        await page.locator(`nav.tabs a[data-nav="${t}"]`).click();
        await expect(page.locator('#view')).toHaveAttribute('data-view', t);
        if (t === r) { ok = true; break; }
        if (await page.locator(`a[href="#/${r}"]:visible`).count()) { ok = true; break; }
      }
      if (!ok) far.push(r);
    }
    expect(far).toEqual([]);
  });

  test('phone: no sideways scroll on any tab, and the last button on the page clears the bottom tab bar', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard, '#/me');
    const tabs = await page.locator('nav.tabs a[data-nav]').evaluateAll((l) => l.map((a) => a.getAttribute('data-nav')));
    for (const t of tabs) {
      await page.locator(`nav.tabs a[data-nav="${t}"]`).click();
      await expect(page.locator('#view')).toHaveAttribute('data-view', t);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const m = await page.evaluate(() => {
        const bar = document.getElementById('tabs').getBoundingClientRect();
        const btns = [...document.querySelectorAll('#view button, #view a.btn, #view summary')].filter((b) => b.offsetParent);
        const last = btns.reduce((x, b) => (!x || b.getBoundingClientRect().bottom > x.getBoundingClientRect().bottom ? b : x), null);
        return { doc: document.documentElement.scrollWidth, screen: window.innerWidth, barTop: bar.top, lastBottom: last ? last.getBoundingClientRect().bottom : 0 };
      });
      expect(m.doc, `${t}: page is ${m.doc}px wide on a ${m.screen}px screen`).toBeLessThanOrEqual(m.screen + 1);
      expect(m.lastBottom, `${t}: last button ends at ${m.lastBottom}px, tab bar starts at ${m.barTop}px`).toBeLessThanOrEqual(m.barTop);
    }
  });
});
