// Count colours (Lisa, 3 Nov 2026): grey ring = waiting, rose ring = LATE, black badge = BROKEN (a site down, a domain expired,
// a project stuck, a data check failed, a Factory engine error). The black badge is near-black with a white number in the light
// looks and inverted (light ink, near-black number) in the dark looks; it is the same box as the ring, so nothing shifts. The
// screen reader hears the word ("3 stuck", "1 down", "4 failed"). One rule: toolkit.js DashKit.count. Also the shared Search
// dialog: its hint follows every key, and its Close button is a house button.
// Pretend Google, Drive and Sheets; every row is invented.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');
const { HUBS, setLook } = require('../support/hubs');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const BLACK = { light: ['rgb(30, 28, 26)', 'rgb(255, 255, 255)'], dark: ['rgb(239, 236, 230)', 'rgb(30, 28, 26)'] };
const look = (sel) => (e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { bg: s.backgroundColor, ink: s.color, line: s.borderTopColor, img: s.backgroundImage, w: r.width, h: r.height }; };

async function home(page) {
  await page.goto('./');
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
}
async function estate(page) {
  const F = require('../fixtures/estate/rows.js');
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(F.HEADER, F.ROWS) }) }));
  await page.goto('estate/#/home');
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('#view [data-hub-main]')).toBeVisible();
}

test('DashKit.count: late is rose, down / expired / stuck / failed are black, everything else (and 0, "–") grey', async ({ page }) => {
  await page.goto('./');
  const got = await page.evaluate(() => {
    const C = DashKit.count;
    return {
      cls: [[3, true], [3, 'late'], [3, 'overdue'], [1, 'down'], [1, 'expired'], [3, 'stuck'], [4, 'failed'], [2, ''], [2, 'waiting'], [0, 'stuck'], ['–', 'down'], ['0', true], [2, 'constructor']].map((x) => C.cls(x[0], x[1])),
      say: [C.say(3, 'stuck'), C.say(1, 'down'), C.say(4, 'failed'), C.say(2, true), C.say(2, ''), C.say(2, '', 'to do')],
    };
  });
  expect(got.cls).toEqual([' need', ' need', ' need', ' broken', ' broken', ' broken', ' broken', '', '', '', '', '', '']);
  expect(got.say).toEqual(['3 stuck', '1 down', '4 failed', '2 late', '2 waiting', '2 to do']);
});

for (const scheme of ['light', 'dark']) {
  test.describe(`${scheme} look`, () => {
    test.beforeEach(async ({ page }) => { await setLook(page, { scheme }); });

    test('Dashboard Projects tile: Stuck is the black badge, read out as "3 stuck"; Waiting and Running stay grey, one size', async ({ page }) => {
      test.skip(!IDS.projectsHub, 'config.js has no Projects Hub address');
      await page.setViewportSize({ width: 390, height: 844 });
      await home(page);
      const nums = page.locator('#hubTiles .hubtile[data-hub="projects"] a.hk');
      await expect(nums).toHaveText(['3 Stuck', '2 Waiting', '2 Running']);
      await expect(nums.nth(0).locator('b')).toHaveClass('broken');
      await expect(nums.nth(0)).toHaveAttribute('aria-label', '3 Stuck stuck, Projects');
      await expect(nums.locator('b.need')).toHaveCount(0);
      await expect(nums.nth(1).locator('b.broken')).toHaveCount(0);
      await expect(nums.nth(2).locator('b.broken')).toHaveCount(0);
      const s = await nums.nth(0).locator('b').evaluate(look());
      const w = await nums.nth(1).locator('b').evaluate(look());
      expect([s.bg, s.ink], 'black badge (inverted in dark)').toEqual(BLACK[scheme]);
      expect(s.line, 'its line is the badge colour').toBe(BLACK[scheme][0]);
      expect(w.bg, 'Waiting has no fill').toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
      expect(s.h, 'the same height as the grey number beside it: nothing shifts').toBe(w.h);
    });

    for (const W of [1280, 390]) test(`Web Estate at ${W}: Down is black on Main, on the tiles and on the Do tab ("down"); Expiring and Live stay grey`, async ({ page }) => {
      {
        await page.setViewportSize({ width: W, height: W > 600 ? 900 : 844 });
        await estate(page);
        const down = page.locator('[data-hm="nums"] a.hm-n[data-k="Down"]');
        await expect(down.locator('.hm-v')).toHaveClass(/\bbroken\b/);
        await expect(down).toHaveAttribute('aria-label', /^\d+ Down down\. Open the list$/);
        for (const k of ['Expiring', 'Live']) await expect(page.locator(`[data-hm="nums"] a.hm-n[data-k="${k}"] .hm-v`)).not.toHaveClass(/\b(broken|need)\b/);
        const v = await down.locator('.hm-v').evaluate(look());
        expect([v.bg, v.ink, v.line]).toEqual([...BLACK[scheme], BLACK[scheme][0]]);
        // Needs you holds a down site: its count is black (broken wins over late).
        await expect(page.locator('[data-hm="needs"] .cnt')).toHaveClass(/\bbroken\b/);
        await expect(page.locator('[data-hm="needs"] .cnt')).not.toHaveClass(/\bneed\b/);
        // The Do tab: black, its name says "down" (a phone shows the black dot).
        const tab = page.locator('nav.house-tabs a[data-nav="look"]');
        await expect(tab.locator('.n')).toHaveClass(/\bbroken\b/);
        await expect(tab).toHaveAttribute('aria-label', /^Do \d+ down$/);
        expect((await tab.locator('.n').evaluate(look())).bg).toBe(BLACK[scheme][0]);
        // The tiles on All: Down black; Live grey.
        await page.evaluate(() => { location.hash = '#/all'; });
        await expect(page.locator('.tile .v[data-count="Down"]')).toHaveClass(/\bbroken\b/);
        await expect(page.locator('a.tile[data-show="down"]')).toHaveAttribute('aria-label', /^Down: \d+ down\. Open the list$/);
        await expect(page.locator('.tile .v[data-count="Live"]')).not.toHaveClass(/\bbroken\b/);
        expect((await page.locator('.tile .v[data-count="Down"]').evaluate(look())).bg).toBe(BLACK[scheme][0]);
      }
    });

    test('CD Hub Data checks: failed checks are the black badge, read out as "failed"', async ({ page }) => {
      await HUBS.cdhub.open(page);
      await page.locator('#nav [data-house-more]').click();
      await page.locator('#houseMore button[data-go="shape"]').click();
      const c = page.locator('#checksCard h3 .cnt');
      await expect(c).toHaveText('6');
      await expect(c).toHaveClass(/\bbroken\b/);
      await expect(c).not.toHaveClass(/\bneed\b/);
      await expect(page.locator('#checksCard h3')).toContainText('6 failed');
      const v = await c.evaluate(look());
      expect([v.bg, v.ink]).toEqual(BLACK[scheme]);
    });

    test('Factory: Stuck and Engine faults are black ("1 stuck", "1 failed"); Apps stays grey', async ({ page, guard }) => {
      const { build } = require('../fixtures/factory/state');
      const logs = IDS.factoryLogs;
      const st = build(Date.now());
      st.lists.apps[1].updated = Date.now() - 20 * 864e5;                             // Kennel Book: untouched for 20 days = stuck
      st.health.push({ job: 'sampleJob', result: 'FAILED', last: new Date().toISOString() });   // one engine fault
      guard.world.folder(logs, 'AF logs (sample)');
      guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(st), { parents: [logs], mimeType: 'application/json' });
      await page.goto('factory/#/rooms');
      await page.locator('#signInBtn').click();
      const stuck = page.locator('a.pill[href="#/stuck"]'), engine = page.locator('a.pill[href="#/health"]');
      await expect(stuck.locator('.cnt')).toHaveClass(/\bbroken\b/);
      await expect(stuck).toHaveAttribute('aria-label', 'Stuck: 1 stuck');
      await expect(engine.locator('.cnt')).toHaveClass(/\bbroken\b/);
      await expect(engine).toHaveAttribute('aria-label', /^Engine: 1 failed\. /);
      await expect(page.locator('a.pill[href="#/all"] .cnt')).not.toHaveClass(/\b(broken|need)\b/);
      const v = await stuck.locator('.cnt').evaluate(look());
      expect([v.bg, v.ink]).toEqual(BLACK[scheme]);
    });
  });
}

test.describe('Search dialog (390px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the hint follows every key: shown under 2 letters, gone from the 2nd letter on, back when the box is cleared @regression', async ({ page }) => {
    await home(page);
    await page.locator('[data-search-open]').first().click();
    const hint = page.locator('#dashSearchHint'), box = page.locator('#dashSearchBox');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText('Type at least 2 letters.');
    await box.pressSequentially('i');
    await expect(hint).toBeVisible();
    await box.pressSequentially('nvoice');
    // At once, before the search itself runs (it waits 300ms): the hint is gone.
    expect(await hint.isHidden()).toBe(true);
    await expect(page.locator('#dashSearchStatus')).toContainText(/for "invoice"/);
    await expect(hint).toBeHidden();
    expect(await page.locator('#dashSearch').innerText()).not.toContain('Type at least 2 letters.');
    await box.fill('');
    await expect(hint).toBeVisible();
    await expect(page.locator('#dashSearchStatus')).toHaveText('');
  });

  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: Close is a house button: 1px line, 12px corners, Lexend 14px/600, no fill; hover a 1px line inside, focus the ring @regression`, async ({ page }) => {
      await setLook(page, { scheme });
      await home(page);
      await page.locator('[data-search-open]').first().click();
      const close = page.locator('#dashSearch button', { hasText: 'Close' });
      const st = () => close.evaluate((e) => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { bw: s.borderTopWidth, bs: s.borderTopStyle, r: s.borderTopLeftRadius, ff: s.fontFamily, fs: s.fontSize, fw: s.fontWeight, bg: s.backgroundColor, img: s.backgroundImage, ow: s.outlineWidth, os: s.outlineStyle, oo: s.outlineOffset, box: [r.x, r.y, r.width, r.height].join() }; });
      const rest = await st();
      expect([rest.bw, rest.bs, rest.r, rest.fs, rest.fw]).toEqual(['1px', 'solid', '12px', '14px', '600']);
      expect(rest.ff).toMatch(/^Lexend/);
      expect(rest.bg).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
      expect(rest.img).toBe('none');
      expect(rest.os, 'no ring at rest').toBe('none');
      expect((await close.boundingBox()).height, 'a phone press target').toBeGreaterThanOrEqual(44);
      await close.hover();
      const hv = await st();
      expect([hv.ow, hv.os, hv.oo], 'hover: a 1px line inside').toEqual(['1px', 'solid', '-1px']);
      expect([hv.bg, hv.img, hv.box], 'hover: no fill, nothing moves').toEqual([rest.bg, rest.img, rest.box]);
      await page.mouse.move(0, 0);
      await page.locator('#dashSearchBox').focus();
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      const fc = await st();
      expect([fc.ow, fc.os, fc.oo], 'keyboard focus: one 1px line inside (Lisa, 3 Nov 2026)').toEqual(['1px', 'solid', '-1px']);
      expect([fc.bg, fc.box]).toEqual([rest.bg, rest.box]);
    });
  }
});
