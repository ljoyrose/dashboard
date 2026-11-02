// Apps (Factory) Main (Lisa's house style, 2 Nov 2026): exactly Next, Needs you (at most 5, late > today > waiting, each row with its
// action), then Questions · Gates · Live (the Dashboard's Apps tile numbers, worked out the same way), each a link to its filtered
// list; "–" when the state cannot be read; ONE "Nothing needs you" when nothing waits. Pretend Google and Drive; the data is
// tests/fixtures/factory/state.js (invented).
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/factory/state');
const { checkMain, clickNumbers, onlyMain, noSideways, shot, steadyRows, numberGroup } = require('../support/hub-main');
const LOGS = require('../support/world').IDS.factoryLogs;

const LABELS = ['Questions', 'Gates', 'Live'];
const HREFS = ['#/decide/questions', '#/decide/gates', '#/all/live'];

async function open(page, guard, { change, fail, width = 1280, scheme = 'light' } = {}) {
  await page.setViewportSize({ width, height: width > 400 ? 900 : 844 });
  await page.emulateMedia({ colorScheme: scheme });
  const state = build(Date.now());
  if (change) change(state);
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(state), { parents: [LOGS], mimeType: 'application/json' });
  if (fail) guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample failure' };
  await page.goto('factory/#/me');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#view [data-hub-main="apps"]')).toBeVisible();
}
// One live app (stage 8, fresh) and one task due today, so every kind of row and number shows.
function lively(st) {
  const now = Date.now();
  st.lists.apps.push(Object.assign({}, st.lists.apps[1], { id: 'app000008', name: 'Sample Live App', status: '8 operate', tags: [], updated: now - 36e5 }));
  const d = new Date(); d.setHours(17, 0, 0, 0);
  st.lists.work[1].due = d.getTime();
}

test.describe('Apps Main', () => {
  test('Needs you rows and the 3 numbers never move on hover or focus; one left edge, a straight bar, one number size', async ({ page, guard }) => {
    await open(page, guard, { change: lively });
    await steadyRows(page, '[data-hm="needs"] .hm-row', '.hm-t');
    await numberGroup(page, '[data-hm="nums"] a.hm-n', '.hm-v');
  });

  test('Next, Needs you (5, late first), then Questions · Gates · Live as links to their lists', async ({ page, guard }) => {
    await open(page, guard, { change: lively });
    await checkMain(page, { labels: LABELS, hrefs: HREFS, values: [2, 1, 1], late: [false, false, false] });
    await onlyMain(page);
    // Next: the overdue Lisa task, with its action one tap away (its item page, where Done is).
    const next = page.locator('[data-hm="next"]');
    await expect(next.locator('.hm-what')).toHaveText('Vet Converter · Test the import on 3 files');
    await expect(next.locator('a[data-hm-act]')).toHaveAttribute('href', '#/item/wrk000001');
    const kinds = await page.locator('[data-hm="needs"] .hm-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
    expect(kinds.slice(0, 2)).toEqual(['late', 'today']);
    // More than 5 wait: "+N more" opens Do. TEST items never show.
    await expect(page.locator('[data-hm-more]')).toHaveAttribute('href', '#/do');
    await expect(page.locator('[data-hub-main]')).not.toContainText('TEST-');
    await page.locator('[data-hm="next"] a[data-hm-act]').click();
    await expect(page.locator('#view .appcard[data-item="wrk000001"]')).toBeVisible();
    await page.goBack();
    await shot(page, 'factory', 1280, 'light');
  });

  test('each number opens exactly what it counts', async ({ page, guard }) => {
    await open(page, guard, { change: lively });
    await clickNumbers(page, LABELS);
    await page.goto('factory/#/decide/gates');
    await expect(page.locator('#view [data-only="gates"]')).toBeVisible();
    await expect(page.locator('#view .crow[data-row="dec000001"]')).toBeVisible();
    await expect(page.locator('#view .crow[data-row="dec000002"]')).toHaveCount(0);
    await page.goto('factory/#/decide/questions');
    await expect(page.locator('#view .crow[data-row="dec000002"]')).toBeVisible();
    await expect(page.locator('#view .crow[data-row="dec000001"]')).toHaveCount(0);
    await page.goto('factory/#/all/live');
    await expect(page.locator('#view a.chip[href="#/card/app000008"]')).toBeVisible();
    await expect(page.locator('#view a.chip')).toHaveCount(1);
  });

  test('the old Main list (Decide + Do with the find bar) is kept at #/me/all', async ({ page, guard }) => {
    await open(page, guard);
    await page.goto('factory/#/me/all');
    await expect(page.locator('#view .fbar2[data-bar="me"]')).toBeVisible();
    await expect(page.locator('#view .crow[data-row="dec000001"]')).toBeVisible();
    await expect(page.locator('#view [data-hub-main]')).toHaveCount(0);
  });

  test('nothing waits: ONE "Nothing needs you", the numbers stay', async ({ page, guard }) => {
    await open(page, guard, { change: (st) => { st.lists.decisions = []; st.lists.work = st.lists.work.filter((t) => t.tags.indexOf('who-lisa') < 0); st.lists.sends = []; } });
    await checkMain(page, { empty: true, labels: LABELS, hrefs: HREFS, values: [0, 0, 0] });
    await expect(page.locator('#view')).toContainText('Nothing needs you');
  });

  test('state cannot be read: "–" for every number, never invented ones', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/403|500|Sample failure|Failed to load/i);
    await open(page, guard, { fail: true });
    await checkMain(page, { fail: true, labels: LABELS, hrefs: HREFS });
  });

  test('phone 390: no sideways scroll, rows keep their action', async ({ page, guard }) => {
    await open(page, guard, { change: lively, width: 390, scheme: 'dark' });
    await checkMain(page, { labels: LABELS, hrefs: HREFS });
    await noSideways(page);
  });
});
