const { test, expect, HUBS, go, sideScroll } = require('../fixtures/job34/load');

test.describe.configure({ timeout: 90_000 });
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

for (const hub of ['home', 'marketplace', 'studio']) {
  test(`${hub} at 390 x 844: every view fits the screen with no sideways scroll`, async ({ page, guard }) => {
    await HUBS[hub].open(page, guard);
    const wide = [];
    for (const v of HUBS[hub].views) {
      await go(page, v);
      if (await sideScroll(page)) {
        wide.push(v + ': ' + (await page.evaluate(() => {
          const W = document.documentElement.clientWidth;
          const e = [...document.querySelectorAll('body *')].find((x) => x.getBoundingClientRect().right > W + 1 && x.getClientRects().length);
          return document.documentElement.scrollWidth + 'px wide' + (e ? ', first too wide: ' + e.tagName.toLowerCase() + '.' + [...e.classList].join('.') : '');
        })));
      }
    }
    expect(wide, `${hub}: views that scroll sideways on a phone`).toEqual([]);
  });
}

