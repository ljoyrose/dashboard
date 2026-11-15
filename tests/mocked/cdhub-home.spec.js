// Main answers "what needs me today?" (OV11 15 Nov 2026): cards, each a count or its top 3, then "See all" to the full list
// in its own section. Each person builds their own Main: card order is owner-setting rows nav.home.<ROLE>.<card>, dated, with
// a source; no rows = the pack's starter. Arrange saves one new row per card. Invented rows only; pretend save script.
const { test, expect, HUBS } = require('../fixtures/job34/load');
const { SINK } = require('../support/dog-photo-world');

async function open(page, guard) {
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  await page.evaluate(() => go('map'));
}
const cards = (page) => page.locator('.hhome > [data-home]');
const ids = (page) => cards(page).evaluateAll((els) => els.map((e) => e.dataset.home));

test.describe('CD Hub Main: the home each person builds', () => {
  test('no rows: the starter is the house Main; an added card has a count and See all to its own section', async ({ page, guard }) => {
    await open(page, guard);
    expect(await ids(page)).toEqual(['needs']);
    await page.evaluate(() => {
      T['BLD-breeding_rule.csv'] = (T['BLD-breeding_rule.csv'] || []).concat([
        { id: 'h0', rule_key: 'nav.home.OWNER.litters', value: '1', effective_from: '2020-01-01', source: 'Pretend' }]);
      go('map', false);
    });
    expect(await ids(page)).toEqual(['litters']);
    const lit = page.locator('.hcard[data-home="litters"]');
    await expect(lit).toHaveAttribute('data-slot', '4');
    await expect(lit.locator('.hcnum')).toHaveText(/^\d+$/);
    expect(await lit.locator('.hctop li').count()).toBeLessThanOrEqual(3);
    await lit.locator('a.hsee').click();
    await expect(page).toHaveURL(/#\/litters$/);
  });

  test('rows set the cards and order; a row of 0 takes a card off; a later row wins', async ({ page, guard }) => {
    await open(page, guard);
    await page.evaluate(() => {
      T['BLD-breeding_rule.csv'] = (T['BLD-breeding_rule.csv'] || []).concat([
        { id: 'h1', rule_key: 'nav.home.OWNER.dogs', value: '1', effective_from: '2020-01-01', source: 'Pretend' },
        { id: 'h2', rule_key: 'nav.home.OWNER.needs', value: '2', effective_from: '2020-01-01', source: 'Pretend' },
        { id: 'h3', rule_key: 'nav.home.OWNER.areas', value: '3', effective_from: '2020-01-01', source: 'Pretend' },
        { id: 'h4', rule_key: 'nav.home.OWNER.areas', value: '0', effective_from: '2021-01-01', source: 'Pretend' },
        { id: 'h5', rule_key: 'nav.home.OWNER.sops', value: '3', effective_from: '2999-01-01', source: 'Pretend' }]);
      go('map', false);
    });
    expect(await ids(page)).toEqual(['dogs', 'needs']);
  });

  test('Arrange: move, take off, add, Save writes one dated row per card and Main redraws in that order', async ({ page, guard }) => {
    await open(page, guard);
    const bodies = [];
    await page.route(SINK, async (route) => {
      bodies.push(JSON.parse(route.request().postData() || '{}'));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'r' + bodies.length } }) });
    });
    await page.locator('[data-home-arrange]').click();
    await page.locator('[data-home-add="unplaced"]').click();
    await page.locator('[data-home-add="round"]').click();
    await page.locator('[data-home-add="litters"]').click();
    await page.locator('[data-home-down="needs"]').click();
    await expect(page.locator('[data-home-down="needs"]')).toBeFocused();
    await page.locator('[data-home-off="round"]').click();
    await page.locator('[data-home-add="dogs"]').click();
    await expect(page.locator('#homeEdit .hlist li span')).toHaveText(['Not placed', 'Needs you', 'Litters', 'Dogs here']);
    await page.locator('[data-home-save]').click();
    await expect.poll(() => ids(page)).toEqual(['unplaced', 'needs', 'litters', 'dogs']);
    await expect(page.locator('.hm-go .sv-line[data-saved="good"]')).toContainText(/^Saved \d\d:\d\d$/);
    const today = await page.evaluate(() => todayISO());
    const got = {};
    bodies.forEach((b) => { expect(b.table).toBe('breeding_rule'); expect(b.fields.effective_from).toBe(today); expect(b.fields.source).toBe('CD Hub, Arrange Main'); got[b.fields.rule_key] = b.fields.value; });
    expect(got['nav.home.OWNER.unplaced']).toBe('1');
    expect(got['nav.home.OWNER.needs']).toBe('2');
    expect(got['nav.home.OWNER.dogs']).toBe('4');
    expect(got['nav.home.OWNER.round']).toBe('0');
  });

  test('a failed save keeps Arrange open with a Not saved line', async ({ page, guard }) => {
    await open(page, guard);
    await page.route(SINK, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'pretend refusal' }) }));
    await page.locator('[data-home-arrange]').click();
    await page.locator('[data-home-save]').click();
    await expect(page.locator('#homeMsg')).toContainText('Not saved');
    await expect(page.locator('#homeEdit')).toBeVisible();
  });
});

test.describe('HubNav.home', () => {
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const ctx = { window: {} }; ctx.self = ctx.window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../cdhub/hub-nav.js'), 'utf8'), ctx);
  const H = (ctx.window.HubNav || ctx.HubNav).home;
  const r = (k, v, f, t) => ({ rule_key: k, value: String(v), effective_from: f || '2020-01-01', to_date: t || '' });
  test('person beats role beats starter; unknown cards and ended rows ignored', () => {
    const cards = ['a', 'b', 'c'];
    expect(H({ cards, starter: ['c', 'x', 'a'] })).toEqual(['c', 'a']);
    const rows = [r('nav.home.OWNER.b', 1), r('nav.home.OWNER.a', 2), r('nav.home.person.p1.c', 1), r('nav.home.OWNER.c', 3, '2020-01-01', '2020-06-01')];
    expect(H({ rows, iso: '2026-11-15', role: 'OWNER', cards })).toEqual(['b', 'a']);
    expect(H({ rows, iso: '2026-11-15', role: 'OWNER', person: 'p1', cards })).toEqual(['c']);
    expect(H({ rows: [r('nav.home.OWNER.a', 0)], iso: '2026-11-15', role: 'OWNER', cards, starter: ['a'] })).toEqual([]);
  });
});
