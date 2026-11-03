// Hub Mains (Lisa's house style, 2 Nov 2026) for Money, Dogs (CD Hub), Food (GA Hub), Marketplace and Web (Estate). Apps and Studio
// have their own files (hub-main-factory / hub-main-studio). Each Main is exactly Next, Needs you (at most 5, late > today > waiting,
// each row with its action), then the hub's 3 numbers in Lisa's order as links to their filtered lists; "–" when the read fails;
// ONE "Nothing needs you" when nothing waits; no sideways scroll at 390. Pretend Google, Drive and Sheets; every row is invented.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, sheets, foodBook, marketRows } = require('../support/hubs');
const { checkMain, clickNumbers, onlyMain, noSideways, shot, steadyRows, numberGroup } = require('../support/hub-main');
const F = require('../fixtures/estate/rows.js');

const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');

const WANT = {
  money: { labels: ['Overdue', 'Due Soon', 'Cash'], hrefs: ['#/now/over', '#/dates/soon', '#/money/biz'] },
  cdhub: { labels: ['Temps', 'Unplaced', 'Bitches'], hrefs: ['#/round', '#/today/unplaced', '#/today/bitches'] },
  food: { labels: ['Late', 'Owe GA', 'Today'], hrefs: ['#/orders?late', '#/invoices?unpaid', '#/orders?today'] },
  marketplace: { labels: ['To Post', 'To Reply', 'Sold'], hrefs: ['#/do?post', '#/reply', '#/sold'] },
  web: { labels: ['Down', 'Expiring', 'Live'], hrefs: ['#/all?show=down', '#/all?show=expiring', '#/all?show=live'] },
};
const MAIN = { money: 'money/#/now', cdhub: 'cdhub/#/map', food: 'food/#/home', marketplace: 'marketplace/#/me', web: 'estate/#/home' };

async function size(page, width, scheme) {
  await page.setViewportSize({ width, height: width > 400 ? 900 : 844 });
  await page.emulateMedia({ colorScheme: scheme });
}
async function webSheet(page, values) {
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript',
    body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(SHEETS, (route) => values ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values }) })
    : route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 403, message: 'Sample failure', status: 'PERMISSION_DENIED' } }) }));
}
// Opens a hub's Main signed in with its sample data (the shared hubs.js openers; Web reads the estate fixture rows).
async function open(page, guard, hub) {
  if (hub === 'web') {
    await webSheet(page, F.values());
    await page.goto('estate/#/home');
    await page.locator('#view [data-action="signin"]').click();
  } else {
    await HUBS[hub].open(page, guard);
    await page.goto(MAIN[hub]);
  }
  await expect(page.locator('[data-hub-main]')).toBeVisible();
}

for (const hub of Object.keys(WANT)) {
  test.describe(hub + ' Main', () => {
    test('exactly Next, Needs you (5 at most, late first, each with its action) and the 3 numbers as links', async ({ page, guard }) => {
      await size(page, 1280, 'light');
      await open(page, guard, hub);
      await checkMain(page, WANT[hub]);
      await onlyMain(page, hub === 'cdhub' ? '#main' : '#view');
      await shot(page, hub === 'web' ? 'estate' : hub, 1280, 'light');
    });

    test('Needs you rows never move on hover or focus, and share one left edge and a straight bar', async ({ page, guard }) => {
      await size(page, 1280, 'light');
      await open(page, guard, hub);
      await steadyRows(page, '[data-hm="needs"] .hm-row', '.hm-t');
      await numberGroup(page, '[data-hm="nums"] a.hm-n', '.hm-v');
    });

    test('each number opens its filtered list', async ({ page, guard }) => {
      await size(page, 1280, 'light');
      await open(page, guard, hub);
      await clickNumbers(page, WANT[hub].labels);
    });

    test('phone 390: no sideways scroll', async ({ page, guard }) => {
      await size(page, 390, 'dark');
      await open(page, guard, hub);
      await checkMain(page, WANT[hub]);
      await noSideways(page);
      if (hub === 'money' || hub === 'cdhub') await shot(page, hub, 390, 'dark');
    });
  });
}

test.describe('Hub Mains when the read fails: "–", never invented numbers', () => {
  test('Money: each file that failed is a late row up top, and every number is "–"', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/403|500|Sample failure|Failed to load/i);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample failure' };
    await page.goto('money/#/now');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    // Money reads file by file, so a failure is never hidden behind "Nothing needs you": it is Next, with Control one tap away.
    await checkMain(page, Object.assign({ values: ['–', '–', '–'] }, WANT.money));
    await expect(page.locator('[data-hm="next"] .hm-what')).toContainText('could not be read');
    await expect(page.locator('[data-hm="next"]')).toHaveAttribute('data-kind', 'late');
  });
  test('Dogs', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/403|500|Sample failure|Failed to load/i);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample failure' };
    await page.goto('cdhub/#/map');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await page.locator('#signinbtn').click();
    await expect(page.locator('#view [data-hub-main], [data-hub-main]').first()).toBeVisible();
    await checkMain(page, Object.assign({ fail: true }, WANT.cdhub));
  });
  for (const hub of ['food', 'marketplace']) {
    test(hub === 'food' ? 'Food' : 'Marketplace', async ({ page, allowedConsole }) => {
      allowedConsole.push(/403|500|Sample failure|Failed to load/i);
      await page.route(SHEETS, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 403, message: 'Sample failure', status: 'PERMISSION_DENIED' } }) }));
      await page.goto(MAIN[hub]);
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#view [data-hub-main]')).toBeVisible();
      await checkMain(page, Object.assign({ fail: true }, WANT[hub]));
    });
  }
  test('Web', async ({ page, allowedConsole }) => {
      allowedConsole.push(/403|500|Sample failure|Failed to load/i);
    await webSheet(page, null);
    await page.goto('estate/#/home');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    await checkMain(page, Object.assign({ fail: true }, WANT.web));
  });
});

test.describe('Hub Mains when nothing needs Lisa: ONE "Nothing needs you", the numbers stay', () => {
  test('Food: no open cards and no order Not at GA (the ✓ XML tick shows)', async ({ page }) => {
    const b = foodBook();
    b.orders[2][26] = 'Matched';
    await sheets(page, (url) => /:batchGet/.test(url)
      ? { valueRanges: [{ values: [] }, { values: b.orders }, { values: b.invoices }, { values: b.products }, { values: b.settings }, { values: [['statement_date', 'total_outstanding']] }, { values: [['date', 'amount']] }, { values: [['kind', 'code', 'name']] }] }
      : { values: [] });
    await page.goto('food/#/home');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    await checkMain(page, Object.assign({ empty: true }, WANT.food));
    await expect(page.locator('[data-hub-main] [data-hm="nums"]')).toContainText('✓ XML');
  });
  test('Marketplace: no cards waiting', async ({ page }) => {
    await sheets(page, () => ({ values: [] }));
    await page.goto('marketplace/#/me');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    await checkMain(page, Object.assign({ empty: true }, WANT.marketplace));
  });
  test('Web: one healthy site, nothing down, expiring or blocked', async ({ page }) => {
    const ok = Object.assign({}, F.ROWS[0], { ssl_expires: '2099-01-15', domain_expires: '2099-06-01', dmarc: 'found', spf: 'pass', dkim: 'found' });
    await webSheet(page, F.values(F.HEADER, [ok]));
    await page.goto('estate/#/home');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    await checkMain(page, Object.assign({ empty: true, values: [0, 0, 1] }, WANT.web));
  });
});
