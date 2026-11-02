// Dashboard Main (Lisa's house-style picks, 2 Nov 2026): one tile per hub in her order and colours, 3 labelled numbers each
// (worked out the way each hub does, "–" when a hub cannot be read), the Food ✓ XML tick, Needs you (at most 5, late first),
// no big hub buttons and no "You are here", and the Decide and Do tabs with their views. Pretend Google, Drive and Sheets only;
// every row is invented (the hub fixtures in tests/fixtures and tests/support/hubs.js).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const { foodBook, marketRows, setLook } = require('../support/hubs');
const { tabClick } = require('../support/tabs');
const { IDS } = require('../support/world');

const ROOT = path.resolve(__dirname, '..', '..');
const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const CFG = (() => { const c = { window: {} }; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), c); return c.window.DASH_CONFIG; })();
const SHOTS = process.env.MAIN_SHOTS || '';

// Every number is its own link to the place in the hub where Lisa acts on it (Projects: the hub itself).
const ROUTES = {
  projects: ['', '', ''], web: ['#/look', '#/look', '#/home'], money: ['#/dates', '#/dates', '#/money'], food: ['#/orders', '#/invoices', '#/orders'],
  dogs: ['#/today', '#/today', '#/dogs'], apps: ['#/decide', '#/decide', '#/all'], market: ['#/do', '#/reply', '#/numbers'], studio: ['#/review', '#/me', '#/library'],
};
// Lisa's order, colour (the 3px line; Projects has the rainbow line) and link for each tile. Projects opens config.js projectsHub.webAppUrl.
const TILES = [
  ['projects', 'Projects', 'gradient', CFG.projectsHub.webAppUrl, ['Stuck', 'Waiting', 'Running']],
  ['web', 'Web', 'rgb(230, 68, 61)', 'estate/', ['Down', 'Expiring', 'Live']],
  ['money', 'Money', 'rgb(231, 134, 21)', 'money/', ['Overdue', 'Due Soon', 'Cash']],
  ['food', 'Food', 'rgb(243, 216, 78)', 'food/', ['Late', 'Owe GA', 'Today']],
  ['dogs', 'Dogs', 'rgb(243, 216, 78)', 'cdhub/', ['Temps', 'Unplaced', 'Bitches']],
  ['apps', 'Apps', 'rgb(243, 216, 78)', 'factory/', ['Questions', 'Gates', 'Live']],
  ['market', 'Marketplace', 'rgb(18, 159, 231)', 'marketplace/', ['To Post', 'To Reply', 'Sold']],
  ['studio', 'Studio', 'rgb(165, 112, 209)', 'studio/', ['Approve', 'Due Today', 'Sold']],
];

// Food: the shared sample book plus one order placed today. `lateOrder` false turns the Not at GA order into Matched.
function food(lateOrder = true) {
  const b = foodBook();
  const orders = b.orders.map((r) => r.slice());
  if (!lateOrder) orders[2][26] = 'Matched';
  orders.push(['9010', 'Shopify', 'DDF', 'GA', 'Placed', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'One-off (Online Store)', '40.00', '1', new Date().toISOString(), '[]', 'Matched']);
  return { valueRanges: [{ values: b.cards }, { values: orders }, { values: b.invoices }] };
}
// Pretend Sheets for Food (batchGet) and Marketplace, and the Apps and Studio state files in the pretend Drive.
async function seed(page, guard, { foodAnswer = food(), market = true, apps = true, studio = true } = {}) {
  const rows = marketRows();
  await page.route(SHEETS, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (/:batchGet/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(foodAnswer) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(market ? { values: rows } : {}) });
  });
  if (apps) {
    const st = require('../fixtures/factory/state').build(Date.now());
    guard.world.folder(IDS.factoryLogs, 'AF logs (sample)');
    guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(st), { parents: [IDS.factoryLogs], mimeType: 'application/json' });
  }
  if (studio) {
    const st = require('../fixtures/studio/state').build(Date.now());
    st.assets.push(Object.assign({}, st.assets[2], { id: 'sa-today', title: 'Sample talk today', eventDate: new Date().toISOString().slice(0, 10) }));
    guard.world.folder(CFG.studio.logsFolderId, 'Studio logs (sample)');
    guard.world.file('studio-state-sample', CFG.studio.stateFile, JSON.stringify(st), { parents: [CFG.studio.logsFolderId], mimeType: 'application/json' });
  }
}
async function signIn(page, hash = '') {
  await page.goto('./' + hash);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  await expect(page.locator('#hubTiles .hubtile[data-hub="apps"]')).toBeVisible();
}
const nums = (page, hub) => page.locator('#hubTiles .hubtile[data-hub="' + hub + '"] .hk').evaluateAll((ks) => ks.map((k) => [k.getAttribute('data-k'), k.firstElementChild.textContent, k.firstElementChild.classList.contains('need')]));

test.describe('Dashboard Main', () => {
  test('tiles: Lisa\'s order, colours and links; every hub tile has 3 labelled numbers worked out as the hub does', async ({ page, guard }) => {
    await seed(page, guard);
    await signIn(page);
    const tiles = page.locator('#view #hubTiles .hubtile');
    await expect(tiles).toHaveCount(TILES.length);
    for (let i = 0; i < TILES.length; i++) {
      const [key, name, colour, href, labels] = TILES[i];
      const t = tiles.nth(i);
      await expect(t).toHaveAttribute('data-hub', key);
      const go = t.locator('a.hgo');
      await expect(go).toContainText(name);
      await expect(go).toHaveAttribute('href', href);
      expect(href.startsWith('https://ljoyrose.github.io'), 'relative links only').toBe(false);
      // Every piece of info is clickable: the name and each number are links, all opening in a new tab.
      for (const a of await t.locator('a').all()) await expect(a).toHaveAttribute('target', '_blank');
      const ks = t.locator('a.hk');
      await expect(ks).toHaveCount(3);
      for (let j = 0; j < 3; j++) {
        await expect(ks.nth(j), name + ' number ' + j).toHaveAttribute('href', href + ROUTES[key][j]);
        expect((await ks.nth(j).boundingBox()).height, name + ' number tap height').toBeGreaterThanOrEqual(24);
      }
      expect((await go.boundingBox()).height, name + ' name tap height').toBeGreaterThanOrEqual(48);
      const look = await t.evaluate((el) => { const b = getComputedStyle(el, '::before'); const c = getComputedStyle(el); return { line: b.borderLeftColor, img: b.backgroundImage, w: b.borderLeftWidth, bg: c.backgroundColor, card: getComputedStyle(document.body).getPropertyValue('--card') }; });
      if (colour === 'gradient') expect(look.img, name + ' rainbow line').toMatch(/linear-gradient/);
      else expect(look.line, name + ' line colour').toBe(colour);
      expect(look.w).toBe('3px');
      await expect(t.locator('svg.hico use')).toHaveCount(1);
      if (key === 'projects') await expect(t).toContainText('Opens in your work account');
      expect((await nums(page, key)).map((n) => n[0]), name + ' labels').toEqual(labels);
      for (const lab of labels) expect(lab.split(' ').length, 'labels are 1-2 words').toBeLessThanOrEqual(2);
    }
    // Sizes: numbers 18px, labels 14px; a late number is a 14px rose ring.
    const sz = await page.locator('#hubTiles .hubtile[data-hub="apps"] .hk').first().evaluate((k) => [getComputedStyle(k.firstElementChild).fontSize, getComputedStyle(k.lastElementChild).fontSize]);
    expect(sz).toEqual(['18px', '14px']);
    // The numbers, from the shared samples (see each hub's own spec for the same rules).
    expect(await nums(page, 'food')).toEqual([['Late', '1', true], ['Owe GA', '£207.23', false], ['Today', '1', false]]);
    expect(await nums(page, 'apps')).toEqual([['Questions', '2', false], ['Gates', '1', false], ['Live', '0', false]]);
    expect(await nums(page, 'market')).toEqual([['To Post', '3', true], ['To Reply', '1', false], ['Sold', '3', false]]);
    expect(await nums(page, 'studio')).toEqual([['Approve', '2', false], ['Due Today', '1', true], ['Sold', '–', false]]);
    expect(await nums(page, 'dogs')).toEqual([['Temps', '–', false], ['Unplaced', '1', false], ['Bitches', '0', false]]); // the sample pup has no cabin; the sample bitch is sex F, not Female
    const money = await nums(page, 'money');
    expect(money.map((n) => n[0])).toEqual(['Overdue', 'Due Soon', 'Cash']);
    expect(money[2][1]).toMatch(/^−?£[\d.]+k?$/);
    await expect(page.locator('#hubTiles .cnt.need').first()).toHaveCSS('font-size', '14px');
    // Web: the RR_WEB-ESTATE sheet id is empty in config.js, so nothing is read and every number is "–".
    expect(await nums(page, 'web')).toEqual([['Down', '–', false], ['Expiring', '–', false], ['Live', '–', false]]);
  });

  test('a hub that cannot be read shows "–", never a number; the Food ✓ XML tick needs a read with no order Not at GA', async ({ page, guard }) => {
    await seed(page, guard, { foodAnswer: {}, market: false, apps: false, studio: false });
    await signIn(page);
    for (const k of ['web', 'food', 'apps', 'studio']) {
      expect((await nums(page, k)).map((n) => n[1]), k).toEqual(['–', '–', '–']);
    }
    await expect(page.locator('#hubTiles [data-xml]')).toHaveCount(0);
    // An empty Marketplace tab is a real read: zeros, not dashes.
    expect((await nums(page, 'market')).map((n) => n[1])).toEqual(['0', '0', '0']);
  });

  test('Food ✓ XML tick: on when no order is Not at GA, off when one is', async ({ page, guard }) => {
    await seed(page, guard, { foodAnswer: food(false) });
    await signIn(page);
    await expect(page.locator('#hubTiles .hubtile[data-hub="food"] [data-xml]')).toHaveText('✓ XML');
    expect((await nums(page, 'food'))[0]).toEqual(['Late', '0', false]);
    await page.unroute(SHEETS);
    await seed(page, guard, { foodAnswer: food(true), apps: false, studio: false });
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#hubTiles .hubtile[data-hub="food"] .hk').first()).toContainText('1');
    await expect(page.locator('#hubTiles [data-xml]')).toHaveCount(0);
  });

  test('Needs you: at most 5 rows across the hubs, late first, then due soon, then waiting; each row has its hub icon and line', async ({ page, guard }) => {
    await seed(page, guard);
    await signIn(page);
    const rows = page.locator('#needsToday ol > li');
    await expect(rows).toHaveCount(5);
    const got = await rows.evaluateAll((ls) => ls.map((l) => ({ k: (l.className.match(/n-(risk|fin|ops|bin)/) || [])[1], hub: l.getAttribute('data-hub'), icon: !!l.querySelector('svg.hico use'), line: getComputedStyle(l, '::before').borderLeftWidth })));
    const rank = { risk: 0, fin: 1, ops: 2, bin: 3 };
    for (let i = 1; i < got.length; i++) expect(rank[got[i].k]).toBeGreaterThanOrEqual(rank[got[i - 1].k]);
    for (const g of got) { expect(g.icon).toBe(true); expect(g.line).toBe('3px'); expect(g.hub).toBeTruthy(); }
    expect(new Set(got.map((g) => g.hub)).size, 'rows come from more than one hub').toBeGreaterThan(1);
    expect(got[0].k).toBe('risk');
    await expect(page.locator('#needsToday')).toContainText(/And \d+ more\. Open Do\./);
  });

  test('the big hub buttons and "You are here" are gone; the top bar says Dashboard', async ({ page, guard }) => {
    await seed(page, guard, { apps: false, studio: false });
    await signIn(page);
    await expect(page.locator('#key-projects')).toHaveCount(0);
    await expect(page.locator('a.keytile')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('You are here');
    // The page name stays for screen readers only: a 1px box, clipped.
    const box = await page.locator('#hereTitle').boundingBox();
    expect(box.width).toBeLessThanOrEqual(1);
    await expect(page.locator('header h1')).toHaveText('Dashboard');
    await expect(page).toHaveTitle(/^(\(\d+\) )?Dashboard$/);
    const order = await page.locator('#view > *').evaluateAll((els) => els.map((e) => e.id));
    expect(order.slice(0, 3)).toEqual(['homeTop', 'needsToday', 'hubTiles']);
  });

  test('Decide (red, slot 2) and Do (yellow, slot 4) tabs open their views, built from the hubs\' own lists', async ({ page, guard }) => {
    await seed(page, guard);
    await signIn(page);
    const tabs = await page.locator('#mainNav > a.ht').evaluateAll((as) => as.map((a) => [a.getAttribute('data-nav'), a.getAttribute('data-slot')]));
    expect(tabs).toEqual([['map', '1'], ['decide', '2'], ['do', '4']]);
    await tabClick(page, '#mainNav a[data-nav="decide"]');
    await expect(page).toHaveURL(/#\/decide$/);
    await expect(page.locator('#hereTitle')).toHaveText('Decide');
    const dec = page.locator('#decideList ol > li');
    await expect(dec.first()).toBeVisible();
    expect(await dec.count()).toBeGreaterThan(3);
    const decHubs = new Set(await dec.evaluateAll((ls) => ls.map((l) => l.getAttribute('data-hub'))));
    for (const h of ['food', 'apps', 'market', 'studio']) expect(decHubs.has(h), 'Decide has ' + h).toBe(true);
    for (const h of ['web', 'dogs']) expect(decHubs.has(h), 'no Decide list in ' + h).toBe(false);
    await expect(page.locator('#decideList a[href="factory/#/item/dec000002"]')).toHaveCount(1);
    await expect(page.locator('#decideList a[href^="factory/#/item/dec000003"]')).toHaveCount(0); // TEST- rows stay out
    await tabClick(page, '#mainNav a[data-nav="do"]');
    await expect(page).toHaveURL(/#\/do$/);
    const todo = page.locator('#todoList ol > li');
    await expect(todo.first()).toBeVisible();
    const doHubs = new Set(await todo.evaluateAll((ls) => ls.map((l) => l.getAttribute('data-hub'))));
    for (const h of ['dogs', 'apps', 'market', 'studio']) expect(doHubs.has(h), 'Do has ' + h).toBe(true);
    await expect(page.locator('#todoList a[href="factory/#/item/wrk000001"]')).toHaveCount(1);
    expect(await todo.first().getAttribute('class')).toMatch(/k-late/);
    await expect(page.locator('#n-do')).toHaveClass(/need/);
    await expect(page.locator('#n-decide')).not.toBeEmpty();
  });

  for (const bg of ['warm', 'cool']) {
    for (const scheme of ['light', 'dark']) {
      test(`${bg} ${scheme}: no sideways scroll at 390, tile lines keep their colours, words stay readable`, async ({ page, guard }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await setLook(page, { bg, scheme, mode: scheme });
        await seed(page, guard);
        await signIn(page);
        for (const v of ['map', 'decide', 'do']) {
          await page.evaluate((x) => { location.hash = '#/' + x; }, v);
          await expect(page.locator('#view')).toHaveAttribute('data-view', v);
          const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.body.scrollWidth, innerWidth]);
          expect(w[0], v + ' page width').toBeLessThanOrEqual(w[2]);
          expect(w[1], v + ' body width').toBeLessThanOrEqual(w[2]);
        }
        await page.evaluate(() => { location.hash = '#/map'; });
        const lines = await page.locator('#hubTiles .hubtile').evaluateAll((ts) => ts.map((t) => { const b = getComputedStyle(t, '::before'); return /linear-gradient/.test(b.backgroundImage) ? 'gradient' : b.borderLeftColor; }));
        expect(lines).toEqual(TILES.map((t) => t[2]));
        const ink = await page.locator('#hubTiles .hubtile[data-hub="apps"] .hk b').first().evaluate((b) => [getComputedStyle(b).color, getComputedStyle(document.body).backgroundColor]);
        expect(ink[0]).not.toBe(ink[1]);
      });
    }
  }

  test('screenshots for the PR (only with MAIN_SHOTS=<folder>)', async ({ page, guard }) => {
    test.skip(!SHOTS, 'set MAIN_SHOTS to save the screenshots');
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await setLook(page, { bg: 'warm', scheme: 'light', mode: 'light' });
    await seed(page, guard);
    await signIn(page);
    await page.screenshot({ path: path.join(SHOTS, 'main-1280-light.png'), fullPage: true });
    await tabClick(page, '#mainNav a[data-nav="decide"]');
    await expect(page.locator('#decideList')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'decide-1280-light.png'), fullPage: true });
    await tabClick(page, '#mainNav a[data-nav="do"]');
    await expect(page.locator('#todoList')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'do-1280-light.png'), fullPage: true });
  });

  test('phone screenshot for the PR (only with MAIN_SHOTS=<folder>)', async ({ page, guard }) => {
    test.skip(!SHOTS, 'set MAIN_SHOTS to save the screenshots');
    await page.setViewportSize({ width: 390, height: 844 });
    await setLook(page, { bg: 'warm', scheme: 'dark', mode: 'dark' });
    await seed(page, guard);
    await signIn(page);
    await page.screenshot({ path: path.join(SHOTS, 'main-390-dark.png'), fullPage: true });
  });
});
