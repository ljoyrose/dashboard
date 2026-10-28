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
      if (v === 'do') await page.locator('#filtersBtn').click();
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
