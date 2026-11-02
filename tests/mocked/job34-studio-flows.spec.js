// JOB 34 (group C): Studio gaps only. studio.spec.js already covers tabs, find bar, forms, writes and looks;
// this adds what it never presses or opens: Sign out and a working Read again (desktop and the phone More menu),
// the Engine switch write (and a refused write), unknown addresses, two state files, every link, keyboard reach.
// Invented data only (tests/fixtures/studio/state.js through HUBS.studio.open).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect, HUBS, go } = require('../fixtures/job34/load');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const ST = ctx.window.DASH_CONFIG.studio;
const UPLOAD = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/;
async function uploads(page, { status = 200 } = {}) {
  const got = [];
  await page.route(UPLOAD, (route) => {
    const parts = route.request().postData().split(/\r\n--st\d+(?:--)?/).map((p) => p.slice(p.indexOf('\r\n\r\n') + 4)).filter((p) => p.trim().startsWith('{'));
    got.push({ meta: JSON.parse(parts[0]), body: JSON.parse(parts[1]) });
    if (status !== 200) return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: status, message: 'Sample failure' } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'req-SAMPLE-' + got.length }) });
  });
  return got;
}
const view = (page) => page.locator('#view');
const stateReads = (guard) => guard.world.calls.filter((c) => /alt=media/.test(c.url)).length;

test.describe('JOB 34 Studio: header buttons', () => {
  test('Read again reads studio-state.json again and keeps the page; Sign out shows Sign in and forgets drafts', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    await go(page, 'new');
    await view(page).locator('textarea, input[type="text"], input:not([type])').first().fill('Sample draft words');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('st-idea'))).toContain('Sample draft words');
    await go(page, 'me');
    const before = stateReads(guard);
    await page.locator('#refreshBtn').click();
    await expect.poll(() => stateReads(guard)).toBeGreaterThan(before);
    await expect(page.locator('#enginePill')).not.toHaveClass(/\bhidden\b/); // drawn: Studio has read its state
    if (page.viewportSize().width > 600) await expect(page.locator('#enginePill')).toBeVisible(); // the pill shows on a desktop only (no room in the 56px phone bar)
    await expect(page.locator('#banner')).toBeHidden();
    await page.locator('#signOutBtn').click();
    await expect(view(page).locator('[data-action="signin"]')).toBeVisible();
    for (const id of ['#refreshBtn', '#signOutBtn', '#enginePill']) await expect(page.locator(id)).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('st-idea'))).toBeNull();
  });

  test('390px top bar (it replaced the More menu): Refresh reads again, New opens the brief, Sign out (inside Look) signs out', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await HUBS.studio.open(page, guard);
    await expect(page.locator('#moreBtn, #moreMenu')).toHaveCount(0);
    const head = page.locator('header');
    const before = stateReads(guard);
    await head.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => stateReads(guard)).toBeGreaterThan(before);
    await head.getByRole('link', { name: 'New idea', exact: true }).click();
    await expect(view(page)).toHaveAttribute('data-view', 'new');
    await expect(head.getByRole('button', { name: 'Sign out', exact: true })).toBeHidden();
    await head.getByRole('button', { name: 'Look', exact: true }).click();
    const look = page.locator('#lookMenu');
    await expect(look).toBeVisible();
    await look.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(view(page).locator('[data-action="signin"]')).toBeVisible();
    await expect(look).toBeHidden(); // a press outside the menu's own buttons closes it
  });
});

test.describe('JOB 34 Studio: Engine switch', () => {
  test('Engine: the Studio switch flips at once and writes one studio request (on: false)', async ({ page, guard }) => {
    const got = await uploads(page);
    await HUBS.studio.open(page, guard);
    await page.locator('#enginePill').click();
    await expect(view(page)).toHaveAttribute('data-view', 'engine');
    await expect(view(page)).toContainText('syncState');
    const sw = view(page).locator('[data-action="studio"]');
    await expect(sw).toHaveAttribute('aria-pressed', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].meta.parents).toEqual([ST.requestsFolderId]);
    expect(got[0].meta.name).toMatch(/^studio-\d+\.json$/);
    expect(got[0].body).toMatchObject({ kind: 'studio', on: false });
  });

  test('a write Drive refuses: "Not sent" banner and the switch goes back on', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: .*500/); // the browser's own line for the refused upload; the page says Not sent
    await uploads(page, { status: 500 });
    await HUBS.studio.open(page, guard);
    await go(page, 'engine');
    const sw = view(page).locator('[data-action="studio"]');
    await sw.click();
    await expect(page.locator('#banner')).toContainText('Not sent');
    await expect(sw).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('JOB 34 Studio: addresses and state', () => {
  test('an unknown address falls back to Me; an unknown asset says Not found and its link opens Assets', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    await go(page, 'zz-unknown');
    await expect(page.locator('nav.tabs a[data-nav="me"]')).toHaveAttribute('aria-current', 'page');
    await go(page, 'asset/nope-SAMPLE');
    await expect(view(page)).toContainText('Not found.');
    await view(page).locator('a[href="#/assets"]').click();
    await expect(view(page)).toHaveAttribute('data-view', 'assets');
  });

  test('two studio-state.json files: says one must go and shows no example data', async ({ page, guard }) => {
    const { build } = require('../fixtures/studio/state');
    await page.clock.setFixedTime(new Date('2026-10-28T10:10:00'));
    guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
    for (const id of ['studio-state-SAMPLE-1', 'studio-state-SAMPLE-2']) guard.world.file(id, ST.stateFile, JSON.stringify(build(Date.now())), { parents: [ST.logsFolderId], mimeType: 'application/json' });
    await page.goto('studio/#/me');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(view(page)).toContainText('Two ' + ST.stateFile + ' files. One must go.');
    await expect(page.locator('#exBanner')).toBeHidden();
  });

  test('every in-page link on every view opens a real view (never Not found); every new-tab link is https with noopener', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    const seen = new Set();
    for (const v of HUBS.studio.views.concat(['engine'])) {
      await go(page, v);
      const links = await page.locator('header a[href], nav a[href], #view a[href]').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') || '' })));
      for (const l of links) {
        if (l.target === '_blank') { expect(l.href, l.href).toMatch(/^https:\/\//); expect(l.rel, l.href).toContain('noopener'); }
        else if (l.href.startsWith('#/')) seen.add(l.href);
      }
    }
    expect(seen.size).toBeGreaterThan(10);
    for (const h of seen) {
      await go(page, h.slice(2));
      await expect(view(page), h).not.toContainText('Not found.');
      await expect(view(page).locator('.banner'), h).toHaveCount(0);
    }
  });

  test('Tab reaches every bottom tab and Enter opens it', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    for (const tab of ['me', 'decide', 'do', 'line', 'kits']) {
      const a = page.locator(`nav.tabs a[data-nav="${tab}"]`);
      let reached = false;
      for (let i = 0; i < 150 && !reached; i++) { await page.keyboard.press('Tab'); reached = await a.evaluate((el) => el === document.activeElement); }
      expect(reached, tab + ' reached by Tab').toBe(true);
      await page.keyboard.press('Enter');
      await expect(a).toHaveAttribute('aria-current', 'page');
    }
  });
});

test.describe('JOB 34 Studio: phone', () => {
  test('390px: Engine, an asset page and Not found fit with no sideways scroll', async ({ page, guard }) => {
    const { sideScroll } = require('../fixtures/job34/load');
    await page.setViewportSize({ width: 390, height: 844 });
    await HUBS.studio.open(page, guard);
    for (const v of ['engine', 'asset/sa-make', 'asset/sa-lib', 'asset/nope-SAMPLE']) {
      await go(page, v);
      await expect(view(page)).toHaveAttribute('data-view', v.split('/')[0]);
      expect(await sideScroll(page), v).toBe(false);
    }
  });
});
