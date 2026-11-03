// Text contrast (Lisa, 3 Nov 2026): every piece of text holds 4.5:1 or better on whatever it sits on — the white card,
// the darker page backgrounds (paper, canvas, soft) and the cool look's — on all 8 pages, every tab and More page,
// at 1280 and 390, in all four looks (warm and cool, light and dark). The colour tokens aim for 4.6:1 so there is room.
// The background is read from the drawn page: up through the parents to the first solid colour (tests/support/sweep-audit.js).
// Disabled controls and aria-hidden (decorative) text are skipped. Pretend Google, Drive and Sheets; every row is invented.
//
// CONTRAST_AUDIT=<file> adds every finding to that file (one per line) instead of failing: the before / after list in the pull request.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, setLook, go, settle } = require('../support/hubs');
const { textContrast } = require('../support/sweep-audit');

const AUDIT = process.env.CONTRAST_AUDIT;
// CONTRAST_MIN raises the bar for a look-around (say 4.6, the tokens' aim); it can never go under 4.5.
const MIN = Math.max(4.5, Number(process.env.CONTRAST_MIN) || 0);
const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const PAGES = {
  ...HUBS,
  estate: {
    url: 'estate/', views: ['home', 'all', 'shops', 'unchecked', 'access'],
    async open(page) {
      const F = require('../fixtures/estate/rows.js');
      await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
      await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(F.HEADER, F.ROWS) }) }));
      await page.goto('estate/#/home');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    },
  },
};
const LOOKS = [
  { bg: 'warm', scheme: 'light' }, { bg: 'warm', scheme: 'dark' },
  { bg: 'cool', scheme: 'light' }, { bg: 'cool', scheme: 'dark' },
];

// One page load per hub and width; on each view the four looks are switched in place, the way the Look menu does it
// (html.look-cool, and the device's light or dark), so the suite stays inside the CI time limit.
for (const [hub, P] of Object.entries(PAGES)) {
  test.describe(hub, () => {
    for (const W of [1280, 390]) {
      test(`${W}, all four looks: all text 4.5:1 or better on what it sits on`, async ({ page, guard }) => {
        test.setTimeout(300_000);   // every view of the page in four looks; the shared Mac is slow under a full run
        await page.setViewportSize({ width: W, height: W > 600 ? 900 : 844 });
        await setLook(page, { bg: 'warm', mode: 'device', scheme: 'light' });
        await P.open(page, guard);
        const all = [];
        for (const v of P.views) {
          await go(page, v);
          for (const look of LOOKS) {
            await page.emulateMedia({ colorScheme: look.scheme });
            await page.evaluate((cool) => document.documentElement.classList.toggle('look-cool', cool), look.bg === 'cool');
            await settle(page.locator('body'));
            all.push(...(await page.evaluate(textContrast, MIN)).map((x) => `${look.bg}-${look.scheme} #/${v} ${x}`));
          }
        }
        const list = [...new Set(all)];
        const where = `${hub} ${W}`;
        if (AUDIT) { if (list.length) fs.appendFileSync(AUDIT, list.map((x) => where + ': ' + x + '\n').join('')); return; }
        expect(list, where).toEqual([]);
      });
    }
  });
}
