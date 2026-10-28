// Money Hub on a phone (390 x 844): every view, no sideways scroll, 44px press targets, bottom tabs on screen
// with their counts in flow (never over a label). Pretend Google and Drive.
const { test, expect } = require('../support/test');

const VIEWS = ['now', 'money', 'dates', 'todo', 'todo/others', 'todo/closed', 'accountant', 'control', 'e/TESTCO', 'e/TESTPERS', 'register/R001'];

for (const scheme of ['light', 'dark']) {
  test(`Money Hub phone ${scheme}: every view fits, press targets are 44px, tabs and counts stay clear`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    for (const v of VIEWS) {
      await page.evaluate((h) => { location.hash = '#/' + h; }, v);
      await expect(page.locator('#view')).toHaveAttribute('data-view', v.split('/')[0]);
      const r = await page.evaluate(() => {
        const out = [], W = window.innerWidth;
        if (document.documentElement.scrollWidth > W + 1) out.push('page is ' + document.documentElement.scrollWidth + 'px wide');
        if (document.body.scrollWidth > W + 1) out.push('body is ' + document.body.scrollWidth + 'px wide');
        document.querySelectorAll('main .btn, main details > summary, main .subnav a, header .btn, nav.main a').forEach((e) => {
          if (!e.getClientRects().length) return;
          const b = e.getBoundingClientRect();
          if (b.height < 43.5) out.push('press target ' + Math.round(b.height) + 'px: ' + e.textContent.trim().slice(0, 20));
          if (b.right > W + 1 || b.left < -1) out.push('off screen: ' + e.textContent.trim().slice(0, 20));
        });
        document.querySelectorAll('nav.main a').forEach((a) => {
          const n = a.querySelector('.n'), l = a.querySelector('.tl');
          if (!n || !n.textContent) return;
          const nb = n.getBoundingClientRect(), lb = l.getBoundingClientRect();
          const overlap = !(nb.right <= lb.left || nb.left >= lb.right || nb.bottom <= lb.top || nb.top >= lb.bottom);
          if (overlap) out.push('count sits on the label: ' + l.textContent);
          if (getComputedStyle(n).position !== 'static') out.push('count not in flow: ' + l.textContent);
        });
        return out;
      });
      expect(r, `#/${v}`).toEqual([]);
    }
  });
}
