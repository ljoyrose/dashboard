// "Needs you" on the Dashboard: what needs attention across the hubs, from data already read.
// Grouped into hub colour cards (Projects, Web, Money, …) that start folded. Late still comes before due soon
// inside a card. Money is one of those cards, not an open overdue row at the top.
const fs = require('fs');
const path = require('path');
const { test, expect, buildWorld } = require('../support/test');
const { tabClick } = require('../support/tabs');
const { IDS } = require('../support/world');
const ESTATE = require('../fixtures/estate/rows.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const HUB_ORDER = ['projects', 'web', 'money', 'food', 'dogs', 'apps', 'market', 'studio', 'dash'];

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

// Give Web a sheet so a hub that sits before Money has rows. Invented example.com rows only.
async function seedWeb(page) {
  await page.route(/\/config\.js$/, (route) => route.fulfill({
    status: 200, contentType: 'text/javascript',
    body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'"),
  }));
  await page.route(/\/spreadsheets\/SHEET_TEST\/values\/Properties/, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ values: ESTATE.values() }),
  }));
}

test.describe('Needs you today', () => {
  test('signed out there is no panel; signed in it comes straight after Next, before the hub tiles', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#needsToday')).toHaveCount(0);
    await signIn(page);
    const panel = page.locator('#needsToday');
    await expect(panel).toBeVisible();
    await expect(panel.locator('#needsTitle')).toHaveText('Needs you');
    const order = await page.locator('#view > *').evaluateAll((els) => els.map((e) => e.id));
    expect(order.slice(0, 3)).toEqual(['homeTop', 'needsToday', 'hubTiles']);
  });

  test('hub colour cards start folded; inside a card, overdue first; each row is a link; the tab title carries the count @regression', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const cards = page.locator('#needsToday details[data-need-card="needs"]');
    await expect(cards.first()).toBeVisible();
    await expect(page.locator('#needsToday details[open]')).toHaveCount(0);
    const n = await page.locator('#needsToday li').count();
    expect(n).toBeGreaterThan(0);
    const total = Number((await page.locator('#needsToday .cardhead .mtag').textContent()).match(/\d+/)[0]);
    expect(n).toBe(total);
    await expect(page).toHaveTitle(new RegExp('^\\(' + total + '\\) Dashboard'));
    await expect(page.locator('#needsToday a[data-needs-more]')).toHaveCount(0);
    const rank = { 'n-risk': 0, 'n-fin': 1, 'n-ops': 2, 'n-bin': 3 };
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await card.locator('summary').click();
      const rows = card.locator('li');
      const rn = await rows.count();
      const kinds = await rows.evaluateAll((ls) => ls.map((l) => (l.className.match(/\bn-(risk|fin|ops|bin)\b/) || [])[0]));
      for (let j = 1; j < kinds.length; j++) expect(rank[kinds[j]]).toBeGreaterThanOrEqual(rank[kinds[j - 1]]);
      for (let j = 0; j < rn; j++) await expect(rows.nth(j).locator('a')).toHaveAttribute('href', /.+/);
      await expect(card.locator('summary .cnt')).toHaveText(String(rn));
      await card.locator('summary').click();
      await expect(card).not.toHaveAttribute('open', '');
    }
  });

  test('a failed read shows up as a red row, so a broken read is never silent', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('./');
    await page.locator('#signInBtn').click();
    const card = page.locator('#needsToday details').filter({ has: page.locator('li.n-risk', { hasText: 'Access refused by Google' }) }).first();
    await expect(card.locator('summary')).toBeVisible({ timeout: 10_000 });
    await card.locator('summary').click();
    await expect(card.locator('li.n-risk').first()).toContainText('Access refused by Google');
  });

  test('after the Bin is read, files ready to bin are one row that opens the Bin', async ({ page, guard }) => {
    const w = guard.world;
    // Someone other than the Money owner: no money rows, so the Bin row (it ranks last) fits in the 5.
    w.email = buildWorld({ email: 'someone.else@example.test' }).email;
    w.file('zz-ready-n', 'ZZ_DELETE_ready-for-needs.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.byId(IDS.ledger).content = 'file_id\nzz-ready-n\n';
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('[data-bin-list="ready"]').locator('[title="' + 'ZZ_DELETE_ready-for-needs.txt' + '"]')).toHaveCount(1);
    await tabClick(page, 'nav.main a[data-nav="map"]');
    const card = page.locator('#needsToday details').filter({ has: page.locator('li.n-bin') });
    await card.locator('summary').click();
    const row = card.locator('li.n-bin');
    await expect(row).toContainText('1 file is ready to bin');
    await expect(row.locator('a')).toHaveAttribute('href', '#/bin');
  });

  test('a different Google account sees no money rows', async ({ page, guard }) => {
    guard.world.email = buildWorld({ email: 'someone.else@example.test' }).email;
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#needsToday a[href^="money/"]')).toHaveCount(0);
  });

  test('money overdue plus another hub: colour cards start folded, money is not the top Next detail, including on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedWeb(page);
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#urgentOne details[data-hub="web"]')).toBeVisible();
    await expect(page.locator('#urgentOne details[data-hub="money"]')).toBeVisible();
    await expect(page.locator('#needsToday details[data-hub="web"]')).toBeVisible();
    await expect(page.locator('#needsToday details[data-hub="money"]')).toBeVisible();
    await expect(page.locator('#urgentOne details[open], #needsToday details[open]')).toHaveCount(0);
    const rank = (k) => HUB_ORDER.indexOf(k);
    for (const root of ['#urgentOne', '#needsToday']) {
      const order = await page.locator(root + ' details[data-need-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hub')));
      expect(order.indexOf('web'), root + ' has Web').toBeGreaterThanOrEqual(0);
      expect(order.indexOf('money'), root + ' money is after Web').toBeGreaterThan(order.indexOf('web'));
      for (let i = 1; i < order.length; i++) expect(rank(order[i]), root + ' hub order').toBeGreaterThan(rank(order[i - 1]));
      const cards = page.locator(root + ' details[data-need-card]');
      const n = await cards.count();
      for (let i = 0; i < n; i++) {
        await expect(cards.nth(i)).not.toHaveAttribute('open', '');
        await expect(cards.nth(i).locator('summary .cnt')).toHaveText(/^[1-9]\d*$/);
      }
    }
    await expect(page.locator('#urgentOne details[data-need-card]').first()).not.toHaveAttribute('data-hub', 'money');
    const money = page.locator('#needsToday details[data-hub="money"]');
    const line = await money.evaluate((el) => {
      const b = getComputedStyle(el, '::before'), c = getComputedStyle(el);
      return { line: b.borderLeftColor, w: b.borderLeftWidth, bg: c.backgroundColor };
    });
    expect(line.w).toBe('3px');
    expect(line.line).toBe('rgb(231, 134, 21)');
    expect(line.bg).not.toBe('rgb(231, 134, 21)');
    const topText = await page.evaluate(() => {
      const out = [];
      const walk = (el) => {
        if (!el || el.nodeType !== 1) return;
        if (el.closest('details:not([open])') && !el.closest('summary')) return;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.height < 1 || r.width < 1 || r.top >= window.innerHeight || r.bottom <= 0) return;
        for (const node of el.childNodes) if (node.nodeType === 3 && node.textContent.trim()) out.push(node.textContent.trim());
        for (const child of el.children) walk(child);
      };
      walk(document.getElementById('view'));
      return out.join('\n');
    });
    expect(topText, 'phone fold does not show an overdue money line').not.toMatch(/Overdue\s+\d+\s+day/i);
    await page.locator('#needsToday details[data-hub="money"] summary').click();
    await expect(page.locator('#needsToday details[data-hub="money"] li').first()).toBeVisible();
    await expect(page.locator('#urgentOne details[data-hub="money"]')).not.toHaveAttribute('open', '');
  });
});
