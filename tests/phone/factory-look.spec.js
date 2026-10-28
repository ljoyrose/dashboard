// Factory on a phone (390 x 844): every view, no sideways scroll, 44px press targets, bottom tabs on screen with their
// counts in flow beside the label (never over it), counts still the fixed 30 x 22 box. Pretend Google and Drive; invented data.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'factory', 'index.html'), 'utf8');
const LOGS = /logs: '([^']+)'/.exec(SRC)[1];
const VIEWS = ['rooms', 'me', 'decide', 'do', 'docs', 'today', 'card/869fjxpc2', 'room/rig', 'item/869fk9d1r', 'item/869fk6k00', 'app/links', 'health', 'all', 'new'];
const PRESS = 'main .btn, main button.pill, main a.pill, main .fbtn, main .ch, main .more, main .copy, main label.date, main a.chip, main a.need, main .ico, main .flagb, main .mark, main .plus, main a.lk, main button.lk, main .sbox, header .btn, nav.tabs a';

for (const scheme of ['light', 'dark']) {
  test(`Factory phone ${scheme}: every view fits, press targets are 44px, tabs and counts stay clear`, async ({ page, guard }) => {
    test.setTimeout(120_000);
    const st = build(Date.now());
    st.lists.decisions[0].cm = [{ by: 'Claude', at: Date.now(), text: 'A sample note' }];
    guard.world.folder(LOGS, 'AF logs (sample)');
    guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(st), { parents: [LOGS], mimeType: 'application/json' });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('factory/#/rooms');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#appPick')).toBeVisible();
    for (const v of VIEWS) {
      await page.evaluate((h) => { location.hash = '#/' + h; }, v);
      await expect(page.locator('#view > *').first()).toBeVisible();
      if (v === 'do') { await page.locator('#filterSum').click(); await page.locator('#filtersBtn').click(); }
      const r = await page.evaluate((PRESS) => {
        const out = [], W = window.innerWidth;
        if (document.documentElement.scrollWidth > W + 1) out.push('page is ' + document.documentElement.scrollWidth + 'px wide');
        if (document.body.scrollWidth > W + 1) out.push('body is ' + document.body.scrollWidth + 'px wide');
        document.querySelectorAll(PRESS).forEach((e) => {
          if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return;
          const b = e.getBoundingClientRect();
          if (b.height < 43.5) out.push('press target ' + Math.round(b.height) + 'px: ' + e.className + ' "' + e.textContent.trim().slice(0, 20) + '"');
          if (b.right > W + 1 || b.left < -1) out.push('off screen: ' + e.className + ' "' + e.textContent.trim().slice(0, 20) + '"');
        });
        document.querySelectorAll('nav.tabs a').forEach((a) => {
          const b = a.getBoundingClientRect();
          if (b.bottom > window.innerHeight + 1) out.push('tab below the screen: ' + a.textContent.trim());
          const n = a.querySelector('.n'), l = a.querySelector('.tl');
          if (!n || !n.textContent) return;
          const nb = n.getBoundingClientRect(), lb = l.getBoundingClientRect();
          if (!(nb.right <= lb.left || nb.left >= lb.right || nb.bottom <= lb.top || nb.top >= lb.bottom)) out.push('count sits on the label: ' + l.textContent);
          if (getComputedStyle(n).position !== 'static') out.push('count not in flow: ' + l.textContent);
          if (Math.round(nb.width) !== 30 || Math.round(nb.height) !== 22) out.push('tab count ' + nb.width + 'x' + nb.height + ': ' + l.textContent);
        });
        return out.slice(0, 10);
      }, PRESS);
      expect(r, `#/${v}`).toEqual([]);
    }
  });
}

// One calm row on the phone (Lisa's Studio choice): Search, Factory on/off and Filter in one row; the chips wait behind Filter.
test('Factory phone: Rooms opens with one calm row, the first room card within 260px of the top of the content', async ({ page, guard }) => {
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(build(Date.now())), { parents: [LOGS], mimeType: 'application/json' });
  await page.goto('factory/#/rooms');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('.rooms .room').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const top = document.querySelector('main').getBoundingClientRect().top, room = document.querySelector('.rooms .room').getBoundingClientRect().top;
    const row = (sel) => document.querySelector(sel).getBoundingClientRect();
    const a = row('.srow .sbox'), b = row('.srow [data-action="factory"]'), c = row('#filterSum');
    return { gap: room - top, search: a.top, sw: b.top, filter: c.top, order: a.right <= b.left + 0.5 && b.right <= c.left + 0.5 && c.right <= window.innerWidth, searchW: a.width };
  });
  expect(r.order, 'search, switch and Filter side by side, none overlapping, all on screen').toBe(true);
  expect(r.searchW, 'the search box keeps room to type').toBeGreaterThanOrEqual(80);
  expect(r.gap, 'first room card from the top of the content').toBeLessThanOrEqual(260);
  expect(Math.abs(r.sw - r.search), 'Factory on/off sits beside the search').toBeLessThan(2);
  expect(Math.abs(r.filter - r.search), 'Filter sits in the same row').toBeLessThan(2);
  await expect(page.locator('.srow [data-action="factory"]')).toContainText(/Factory (on|off)/);
  await expect(page.locator('details.fdet')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-fx="app"]').first()).toBeHidden();
  // Filter opens the chips, and the count on it says how many are on.
  await page.locator('#filterSum').click();
  await expect(page.locator('[data-fx="app"]').first()).toBeVisible();
  await page.locator('[data-fx="app"][data-val="links"]').click();
  await expect(page.locator('#nFilters')).toHaveText('1');
  await expect(page.locator('details.fdet')).toHaveAttribute('open', ''); // stays open after a redraw
});
