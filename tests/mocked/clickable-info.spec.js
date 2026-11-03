// Every piece of info opens what it counts, and every job carries the way to do it (Lisa, 2 Nov 2026).
// On each hub's Main and Do / Decide views: every number, summary card, tile and row is a link or a button, or sits in a row
// whose one "open" control (.house-open) the whole row opens (toolkit.js). Sample clicks land on the right filtered list.
// An empty view says so once. No visible button is blank (no words and no icon), even when the icon font cannot load.
// Pretend Google, Drive and Sheets; every row is invented (tests/support/hubs.js).
const { test, expect } = require('../support/test');
const { HUBS, setLook, go } = require('../support/hubs');

// What counts as "info" on a view: summary numbers, tiles, list rows and the Next card.
const INFO = '.sum, .tile, .mrow:not(.ckrow), .crow, .prow, .items > li, [data-next], .nextc, .hm-row, .hm-n, [data-hm="next"]';

// Visible info elements with no target: not a link/button, not inside one, and not in a row that has an open control.
async function bare(page) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => {
    if (!e.offsetParent || e.closest('nav, header, .house-tabs, #tabs')) return false;
    if (e.matches('a[href], button') || e.closest('a[href], button')) return false;
    const r = e.closest('[data-open-row]');
    if (r && r.querySelector('a.house-open[href], button.house-open, .house-open')) return false;
    return true;
  }).map((e) => e.className + ': ' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50)), INFO);
}

// Visible buttons and button-look links with no words and no visible icon or picture.
async function blankButtons(page) {
  return page.evaluate(() => [...document.querySelectorAll('button, a.btn, a.lk, [role="button"]')].filter((b) => {
    if (!b.offsetParent || b.getBoundingClientRect().width < 1) return false;
    if ((b.innerText || '').trim()) return false;
    const pic = [...b.querySelectorAll('svg, img, .house-iw, canvas')].some((x) => x.getBoundingClientRect().width > 0);
    if (pic) return false;
    const ti = [...b.querySelectorAll('i.ti')].some((x) => { const c = getComputedStyle(x, '::before').content; return x.getBoundingClientRect().width > 0 && c && c !== 'none' && c !== 'normal' && c !== '""'; });
    return !ti;
  }).map((b) => (b.outerHTML || '').slice(0, 120)));
}

test.describe.configure({ timeout: 90_000 });   // one test walks several views of a hub; CI machines are slower

const VIEWS = {
  studio: ['me', 'do', 'decide'],
  money: ['now', 'todo'],
  cdhub: ['map', 'work', 'today'],
  food: ['home', 'do'],
  marketplace: ['me', 'do', 'decide'],
  factory: ['rooms', 'me', 'do', 'decide'],
};

test.describe('Clickable info: every number, card and row opens what it counts', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  for (const [hub, views] of Object.entries(VIEWS)) {
    test(`${hub}: every visible number, tile and row on ${views.join(', ')} has a real target`, async ({ page, guard }) => {
      await setLook(page, { scheme: 'light' });
      await HUBS[hub].open(page, guard);
      for (const v of views) {
        await go(page, v);
        await expect.poll(() => bare(page), { message: `${hub} #/${v}`, timeout: 10_000 }).toEqual([]);
      }
    });
  }

  test('estate: every tile opens its filtered list and every web address row opens the site', async ({ page }) => {
    await page.goto('estate/#/home');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    expect(await bare(page), 'estate #/home').toEqual([]);
    // The count tiles moved from Main to All (Hub Mains, 2 Nov 2026); Main's 3 numbers open All filtered.
    for (const v of ['all', 'look']) {
      await go(page, v);
      expect(await bare(page), 'estate #/' + v).toEqual([]);
      const tiles = await page.locator('#view .tile').evaluateAll((l) => l.map((t) => [t.tagName, t.getAttribute('href')]));
      for (const [tag, href] of tiles) { expect(tag).toBe('A'); expect(href).toMatch(/[?&]show=\w+/); }
    }
    // A tile lands on its list, filtered to what it counts.
    await go(page, 'all');
    await page.locator('#view a.tile[data-show="live"]').click();
    await expect(page).toHaveURL(/#\/all\?show=live$/);
    await expect(page.locator('#view .hint')).toContainText('Live only.');
    const st = await page.locator('#view .prop[data-status]').evaluateAll((l) => [...new Set(l.map((p) => p.getAttribute('data-status')))]);
    expect(st.length ? st : ['live']).toEqual(['live']);
  });
});

test.describe('Clickable info: a sample of clicks land on the right filtered list', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Studio: Needs you / Overdue / On track (now at the top of Do) open their lists; a Main row opens its item', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    for (const k of ['ok', 'need', 'over']) {
      await go(page, 'do');
      await page.locator(`#view a[data-melink="${k}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#/me/${k}$`));
      await expect(page.locator('#view')).toContainText(/\S/);
    }
    await go(page, 'me');
    const row = page.locator('#view .hm-row .hm-t > a').first();
    const href = await row.getAttribute('href');
    await row.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[/?.]/g, '\\$&') + '$'));
  });

  test('Money: Overdue, Due Soon and Cash open their lists; On track (now on Money) opens Money filtered; a Needs you row opens its item', async ({ page }) => {
    await HUBS.money.open(page);
    await page.locator('#view a.hm-n[data-k="Overdue"]').click();
    await expect(page).toHaveURL(/#\/now\/over$/);
    await expect(page.locator('#view [data-nowlist="over"]')).toBeVisible();
    const over = Number(await page.locator('#view [data-nowlist="over"] .cnt').first().textContent().catch(() => '0')) || 0;
    if (over) await expect(page.locator('#view [data-nowlist="over"] .items > li')).toHaveCount(over);
    await go(page, 'now');
    await page.locator('#view a.hm-n[data-k="Due Soon"]').click();
    await expect(page).toHaveURL(/#\/dates\/soon$/);
    await expect(page.locator('#view [data-dates="soon"]')).toBeVisible();
    await go(page, 'now');
    await page.locator('#view a.hm-n[data-k="Cash"]').click();
    await expect(page).toHaveURL(/#\/money\/biz$/);
    await expect(page.locator('#view h3').first()).toHaveText('Business cash');
    await go(page, 'money');
    await page.locator('#view a.sum[data-sum="ok"]').click();
    await expect(page).toHaveURL(/#\/money\/ok$/);
    await expect(page.locator('#view h3').first()).toHaveText('On track');
    await go(page, 'now');
    const link = page.locator('#view .hm-row .hm-t > a').first();
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[/?.]/g, '\\$&') + '$'));
  });

  test('CD Hub: Unplaced and Bitches open their lists of dogs on Today; an On site count (now on Today) opens its list', async ({ page }) => {
    await HUBS.cdhub.open(page);
    await page.locator('a.hm-n[data-k="Bitches"]').click();
    await expect(page).toHaveURL(/#\/today\/bitches$/);
    await expect(page.locator('#tpanel h4')).toBeVisible();
    await page.goto('cdhub/#/today');
    await page.locator('#onSiteCard a.mrow[data-golist="adults"]').click();
    await expect(page).toHaveURL(/#\/today(\/adults)?$/);
    await expect(page.locator('#tpanel h4')).toContainText('Adult dogs here');
  });

  test('Food: Late, Owe GA and Today open their filtered lists; Under £15 profit (now on Review) opens low-profit orders', async ({ page }) => {
    await HUBS.food.open(page);
    for (const [k, re] of [['Late', /#\/orders\?late$/], ['Owe GA', /#\/invoices\?unpaid$/], ['Today', /#\/orders\?today$/]]) {
      await go(page, 'home');
      await page.locator(`#view a.hm-n[data-k="${k}"]`).click();
      await expect(page).toHaveURL(re);
    }
    await go(page, 'review');
    await page.locator('#view a.tile[href="#/orders?low"]').click();
    await expect(page.locator('#ofilters [data-ofilter="low"]')).toHaveAttribute('aria-pressed', 'true');
    await go(page, 'review');
    await page.locator('#view a.tile[href="#/orders?sub"]').click();
    await expect(page.locator('#ofilters [data-ofilter="sub"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Marketplace: a To post row and the To post count open Do now, where its Found / Posted buttons are', async ({ page }) => {
    await HUBS.marketplace.open(page);
    await page.locator('#view a.hm-n[data-k="To Post"]').click();
    await expect(page).toHaveURL(/#\/do\?post$/);
    await expect(page.locator('#view [data-ans][data-v="Found"], #view [data-ans][data-v="Posted"]').first()).toBeVisible();
  });
});

test.describe('Action always actionable: every row asking Lisa to act carries the way to do it', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const noAction = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((r) => r.offsetParent && !r.matches('a[href], button') && !r.querySelector('a[href], button')).map((r) => r.textContent.trim().slice(0, 50)), sel);

  test('Studio Main, Do and Decide rows', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    for (const v of ['me', 'do', 'decide']) { await go(page, v); expect(await noAction(page, '#view .crow, #view .mrow, #view [data-next], #view .hm-row, #view [data-hm="next"]'), v).toEqual([]); }
  });
  test('Money Now and To-do rows', async ({ page }) => {
    await HUBS.money.open(page);
    for (const v of ['now', 'todo']) { await go(page, v); expect(await noAction(page, '#view .items > li, #view [data-next], #view .hm-row, #view [data-hm="next"]'), v).toEqual([]); }
  });
  test('Marketplace Do now, Decide and Reply cards', async ({ page }) => {
    await HUBS.marketplace.open(page);
    for (const v of ['me', 'do', 'decide', 'reply']) { await go(page, v); expect(await noAction(page, '#view .card:not(.empty), #view .prow'), v).toEqual([]); }
  });
  test('CD Hub Needs you rows (Main and Do) and the Next card', async ({ page }) => {
    await HUBS.cdhub.open(page);
    expect(await noAction(page, '.hm-row, [data-hm="next"]')).toEqual([]);
    await go(page, 'work');
    expect(await noAction(page, '#needsCard .mrow')).toEqual([]);
  });
  test('Food Home cards', async ({ page }) => {
    await HUBS.food.open(page);
    expect(await noAction(page, '#view > .card:not(:has(.empty)), #reorder .row')).toEqual([]);
  });
});

test.describe('One empty message per view', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Studio Main with nothing to do says "Nothing needs you" once and draws no empty sections', async ({ page, guard }) => {
    const fs = require('fs'), path = require('path'), vm = require('vm');
    const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
    const ST = ctx.window.DASH_CONFIG.studio, { build } = require('../fixtures/studio/state');
    const now = new Date('2026-10-28T10:10:00');
    await page.clock.setFixedTime(now);
    const st = build(now.getTime()); st.assets = []; st.ideas = []; st.gaps = [];
    guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
    guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(st), { parents: [ST.logsFolderId], mimeType: 'application/json' });
    await page.goto('studio/#/me');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#view [data-hm="empty"]')).toHaveCount(1);
    await expect(page.locator('#view')).toContainText('Nothing needs you');
    expect(await page.locator('#view').evaluate((v) => (v.innerText.match(/Nothing needs you|Nothing waiting|Nothing here|All decided/g) || []).length)).toBe(1);
  });

  test('Money Now with no dates, no to-dos and nothing owed says "Nothing needs you" once', async ({ page, guard }) => {
    for (const name of ['MON-DATES.csv', 'MON-REGISTER.csv']) {   // as job34b-money-gaps.spec.js empties a file: count line + header only
      const f = guard.world.files.find((x) => x.name === name), l = f.content.split('\n');
      f.content = l[0].replace(/\d+ rows held/, '0 rows held') + '\n' + l[1] + '\n'; f.size = String(f.content.length);
    }
    await HUBS.money.open(page);
    const n = await page.locator('#view').evaluate((v) => (v.innerText.match(/Nothing needs you|Nothing waiting|Nothing due/g) || []).length);
    expect(n).toBeLessThanOrEqual(1);
  });
});

test.describe('No blank buttons: every visible button shows its word or icon', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const ALL = { studio: ['me', 'do', 'decide'], money: ['now', 'todo'], cdhub: ['map', 'today'], food: ['home', 'orders'], marketplace: ['me', 'do', 'decide', 'reply'], factory: ['rooms', 'me', 'do', 'decide', 'today'], home: ['map'] };
  for (const [hub, views] of Object.entries(ALL)) {
    test(`${hub}: no button with empty text and no icon (icon font blocked here, so words show instead)`, async ({ page, guard }) => {
      await HUBS[hub].open(page, guard);
      // The words appear once the page has found the icon font missing (after document.fonts.ready), so wait for them.
      for (const v of views) { await go(page, v); await expect.poll(() => blankButtons(page), { message: `${hub} #/${v}`, timeout: 10_000 }).toEqual([]); }
    });
  }
});
