// Studio Main (Lisa's house style, 2 Nov 2026): exactly Next, Needs you (at most 5 rows from Decide and Do, late > today >
// waiting, each with its action), then Approve · Due Today · Sold, each a link to its list; "–" when Studio cannot be read
// (Sold is always "–": the state keeps running sales totals, never dated sales); ONE "Nothing needs you" when nothing does.
// Pretend Google and Drive only; the state is tests/fixtures/studio/state.js (invented).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/studio/state');
const { checkMain, onlyMain, clickNumbers, noSideways, shot, steadyRows, numberGroup } = require('../support/hub-main');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const ST = ctx.window.DASH_CONFIG.studio;
const NOW = new Date('2026-10-28T10:10:00');
const LABELS = ['Approve', 'Due Today', 'Sold'];
const HREFS = ['#/review', '#/me/today', '#/library'];
const day = (d) => new Date(NOW.getTime() + d * 864e5).toISOString().slice(0, 10);

async function open(page, guard, { change, fail } = {}) {
  await page.clock.setFixedTime(NOW);
  if (fail) {
    guard.world.failWith = { status: 500, reason: 'backendError', message: 'Sample failure' };
  } else {
    const s = build(NOW.getTime());
    if (change) change(s);
    guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
    guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(s), { parents: [ST.logsFolderId], mimeType: 'application/json' });
  }
  await page.goto('studio/#/me');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('[data-hub-main="studio"]')).toBeVisible({ timeout: fail ? 45_000 : 7_000 });
}
// Lots to do: two late pieces, one due today, plus the fixture's gates, reviews and hand tasks (more than 5 rows).
const busy = (s) => {
  const base = s.assets.find((a) => a.stage === 7) || s.assets[0];
  s.assets.push(Object.assign({}, base, { id: 'hm-late1', title: 'Sample late review', stage: 7, dated: true, eventDate: day(-2), flags: [] }));
  s.assets.push(Object.assign({}, base, { id: 'hm-late2', title: 'Sample late gate', stage: 3, dated: true, eventDate: day(-1), gate: { question: 'Go ahead?' }, flags: [] }));
  s.assets.push(Object.assign({}, base, { id: 'hm-today', title: 'Sample talk today', stage: 7, dated: true, eventDate: day(0), flags: [] }));
};

test.describe('Studio Main', () => {
  test('Needs you rows and the 3 numbers never move on hover or focus; one left edge, a straight bar, one number size', async ({ page, guard }) => {
    await open(page, guard, { change: busy });
    await steadyRows(page, '[data-hm="needs"] .hm-row', '.hm-t');
    await numberGroup(page, '[data-hm="nums"] a.hm-n', '.hm-v');
  });

  test('Next, Needs you (5, late first) and Approve · Due Today · Sold, each a link to its list', async ({ page, guard }) => {
    await open(page, guard, { change: busy });
    const got = await checkMain(page, { labels: LABELS, hrefs: HREFS, late: [false, false, false] });
    await onlyMain(page);
    await page.mouse.move(0, 0);
    await shot(page, 'studio', 1280, 'light');
    await expect(page.locator('[data-hm="needs"] .hm-row')).toHaveCount(5);
    await expect(page.locator('[data-hm="needs"] [data-hm-more]')).toHaveAttribute('href', '#/do');
    const kinds = await page.locator('[data-hm="needs"] .hm-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
    expect(kinds.slice(0, 3)).toEqual(['late', 'late', 'today']);
    await expect(page.locator('[data-hm="next"] .hm-what')).toHaveText('Sample late review');
    await expect(page.locator('[data-hm="next"] a[data-hm-act]')).toHaveAttribute('href', '#/asset/hm-late1');
    // Sold: Studio keeps running totals only, so "–", never a made-up number. Due Today counts exactly the piece due today.
    expect(got[2].value).toBe('–');
    expect(got[1].value).toBe('1');
    await page.locator('a.hm-n[data-k="Due Today"]').click();
    await expect(page.locator('[data-melist="today"] .crow')).toHaveCount(1);
    await expect(page.locator('[data-melist="today"]')).toContainText('Sample talk today');
    await page.goBack();
    const approve = Number(got[0].value);
    await page.locator('a.hm-n[data-k="Approve"]').click();
    await expect(page.locator('#view .crow')).toHaveCount(approve);
    await page.goBack();
    await clickNumbers(page, LABELS);
  });

  test('the old Main lists (Needs you, Overdue, On track) open from the top of Do', async ({ page, guard }) => {
    await open(page, guard, { change: busy });
    await page.evaluate(() => { location.hash = '#/do'; });
    for (const k of ['need', 'over', 'ok']) await expect(page.locator(`#view [data-melinks] a[data-melink="${k}"]`)).toHaveAttribute('href', '#/me/' + k);
    await page.locator('#view a[data-melink="over"]').click();
    await expect(page.locator('[data-melist="over"] .crow')).toHaveCount(2);
  });

  test('nothing waiting: ONE "Nothing needs you", the 3 numbers stay', async ({ page, guard }) => {
    await open(page, guard, { change: (s) => { s.assets = []; s.ideas = []; s.gaps = []; } });
    await checkMain(page, { labels: LABELS, hrefs: HREFS, empty: true, values: ['0', '0', '–'] });
    expect(await page.locator('#view').evaluate((v) => (v.innerText.match(/Nothing needs you/g) || []).length)).toBe(1);
  });

  test('Drive cannot be read: the numbers show "–"', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: the server responded with a status of 500/);
    await open(page, guard, { fail: true });
    await checkMain(page, { labels: LABELS, hrefs: HREFS, fail: true });
  });

  test('phone 390: no sideways scroll', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard, { change: busy });
    await checkMain(page, { labels: LABELS, hrefs: HREFS });
    await noSideways(page);
  });
});
