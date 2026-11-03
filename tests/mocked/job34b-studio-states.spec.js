// JOB 34b (Studio): the states nobody else opens. studio.spec.js covers a failed REFRESH (page kept, "Offline" banner)
// and job34-studio-flows covers two state files; this adds the FIRST read failing (500, no access, offline, sign-in
// expired) and recovering with Read again, the slow first read (no example data while it waits), an empty studio-state.json on every view,
// a signed-out deep link, and a sign-in Google refuses. Invented data only (tests/fixtures/studio/state.js, HUBS.studio).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect, HUBS, go, slow, fail, sideScroll } = require('../fixtures/job34/load');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const ST = ctx.window.DASH_CONFIG.studio;
const LIST = /^https:\/\/www\.googleapis\.com\/drive\/v3\/files\?q=/; // the "find studio-state.json" call
const MEDIA = /^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/[^?]+\?alt=media/; // reading the file itself
const view = (page) => page.locator('#view');
const NOW = new Date('2026-10-28T10:10:00');

// Put a studio-state.json in the pretend Drive (the sample one, or the text given) and open Studio at `hash`, signed in.
async function openWith(page, guard, { text, hash = '#/me', wait = true } = {}) {
  const { build } = require('../fixtures/studio/state');
  await page.clock.setFixedTime(NOW);
  guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
  guard.world.file('studio-state-sample', ST.stateFile, text != null ? text : JSON.stringify(build(NOW.getTime())), { parents: [ST.logsFolderId], mimeType: 'application/json' });
  await page.goto('studio/' + hash);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  // Ready = the engine pill is drawn (it is hidden by CSS under 600px wide, so wait for its class, not for it to show).
  if (wait) await expect(page.locator('#enginePill')).not.toHaveClass(/hidden/);
}

test.describe('JOB 34b Studio: the first read fails', () => {
  for (const [status, words] of [[500, 'Drive error 500'], [403, 'No access'], [404, 'No access']]) {
    test(`first read answers ${status}: "${words}" in the page, no pills, no example banner; Read again recovers`, async ({ page, guard, allowedConsole }) => {
      allowedConsole.push(new RegExp(`Failed to load resource: .*${status}`));
      await fail(page, LIST, status);
      await openWith(page, guard, { wait: false });
      await expect(view(page).locator('.banner')).toHaveText(words, { timeout: 15000 }); // a 500 is tried 4 times (toolkit.js) first
      for (const id of ['#enginePill', '#budgetPill', '#exBanner']) await expect(page.locator(id)).toBeHidden();
      await expect(page.locator('#refreshBtn')).toBeVisible(); // a way out is offered
      await expect(page.locator('#tabs')).toBeVisible();
      await page.unroute(LIST);
      await page.locator('#refreshBtn').click();
      await expect(page.locator('#enginePill')).toBeVisible();
      await expect(view(page).locator('.banner')).toHaveCount(0);
      await expect(view(page)).toHaveAttribute('data-view', 'me');
    });
  }

  test('the file itself cannot be read (500 on the download): says so and never falls back to example data', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: .*500/);
    await fail(page, MEDIA, 500);
    await openWith(page, guard, { wait: false });
    await expect(view(page).locator('.banner')).toHaveText('Drive error 500', { timeout: 15000 });
    await expect(page.locator('#exBanner')).toBeHidden();
  });

  test('offline on the first read: "Offline" in the page; a tab press keeps the message, not a blank page', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource|net::ERR/);
    await page.route(LIST, (route) => route.abort('internetdisconnected'));
    await openWith(page, guard, { wait: false });
    await expect(view(page).locator('.banner')).toHaveText('Offline');
    await page.locator('nav.tabs a[data-nav="decide"]').click();
    await expect(view(page).locator('.banner')).toHaveText('Offline');
    expect(await sideScroll(page)).toBe(false);
  });

  test('sign-in expired on the first read (401): asks to sign in again, no data and no example data shown', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: .*401/);
    await fail(page, LIST, 401);
    await openWith(page, guard, { wait: false });
    await expect(page.locator('#banner')).toContainText('Sign-in expired. Sign in again.');
    await expect(page.locator('#exBanner')).toBeHidden();
    await expect(page.locator('#enginePill')).toBeHidden();
  });
});

test.describe('JOB 34b Studio: slow network', () => {
  test('a slow first read: the page waits, shows no example data, then draws the real page', async ({ page, guard }) => {
    await slow(page, MEDIA, 2500);
    await openWith(page, guard, { wait: false });
    await page.waitForTimeout(800);
    await expect(page.locator('#exBanner')).toBeHidden();
    await expect(page.locator('#enginePill')).toBeHidden();
    await expect(page.locator('#enginePill')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#exBanner')).toBeHidden();
    await expect(view(page).locator('[data-hub-main="studio"] [data-hm="next"]')).toBeVisible();
  });

  // The missing "Reading…" state straight after sign-in is parked on main as J34-F84 (job34-states-slow.spec.js).

  test('a slow Read again keeps the page on screen (never blanks to Reading…)', async ({ page, guard }) => {
    await openWith(page, guard);
    await slow(page, MEDIA, 2000);
    await page.locator('#refreshBtn').click();
    await page.waitForTimeout(400);
    await expect(view(page)).not.toContainText('Reading…');
    await expect(view(page).locator('[data-hub-main="studio"] [data-hm="next"]')).toBeVisible();
  });
});

test.describe('JOB 34b Studio: empty state', () => {
  test('an empty studio-state.json ({}): every view and Kits page opens, nothing says Not found, no counts, no example banner', async ({ page, guard }) => {
    await openWith(page, guard, { text: '{}' });
    await expect(page.locator('#exBanner')).toBeHidden();
    for (const n of ['#nMe', '#nDecide', '#nDo', '#nLine', '#nKits']) await expect(page.locator(n)).toHaveText('');
    const subs = ['kits/playbooks', 'kits/packs', 'kits/kits', 'kits/bricks', 'kits/styles', 'kits/formats'];
    for (const v of HUBS.studio.views.concat(['engine'], subs)) {
      await go(page, v);
      await expect(view(page), v).toHaveAttribute('data-view', v.split('/')[0]);
      await expect(view(page), v).not.toContainText('Not found');
      await expect(view(page).locator('.banner'), v).toHaveCount(0);
      expect((await view(page).innerText()).trim().length, v + ' is not blank').toBeGreaterThan(0);
    }
    await go(page, 'me');
    await expect(view(page).locator('[data-hub-main="studio"]')).toContainText('Nothing needs you');
  });

  test('390px: the empty state fits on every view with no sideways scroll', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWith(page, guard, { text: '{}' });
    for (const v of HUBS.studio.views.concat(['engine'])) {
      await go(page, v);
      expect(await sideScroll(page), v).toBe(false);
    }
  });
});

test.describe('JOB 34b Studio: signed out', () => {
  test('a signed-out deep link (#/decide): only the sign-in shows; signing in from the page lands on Decide', async ({ page, guard }) => {
    const { build } = require('../fixtures/studio/state');
    await page.clock.setFixedTime(NOW);
    guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
    guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(build(NOW.getTime())), { parents: [ST.logsFolderId], mimeType: 'application/json' });
    await page.goto('studio/#/decide');
    await expect(view(page).locator('[data-action="signin"]')).toBeVisible();
    for (const id of ['#tabs', '#newBtn', '#refreshBtn', '#signOutBtn', '#enginePill', '#budgetPill']) await expect(page.locator(id)).toBeHidden();
    await view(page).locator('[data-action="signin"]').click();
    await expect(page.locator('#enginePill')).toBeVisible();
    await expect(view(page)).toHaveAttribute('data-view', 'decide');
    await expect(page.locator('nav.tabs a[data-nav="decide"]')).toHaveAttribute('aria-current', 'page');
  });

  test('a signed-out deep link to an item (#/asset/sa-make) opens that item after sign-in', async ({ page, guard }) => {
    await openWith(page, guard, { hash: '#/asset/sa-make' });
    await expect(view(page)).toHaveAttribute('data-view', 'asset');
    await expect(view(page)).toContainText('Sample webclass slides');
  });
});

test.describe('JOB 34b Studio: Google refuses the sign-in', () => {
  test.use({ gisMode: 'error' });
  test('Google answers with an error: "Sign-in did not complete." and the page stays locked', async ({ page, guard }) => {
    guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
    await page.goto('studio/#/me');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#banner')).toContainText('Sign-in did not complete.');
    await expect(page.locator('#tabs')).toBeHidden();
    await expect(view(page).locator('[data-action="signin"]')).toBeVisible();
  });
});

test.describe('JOB 34b Studio: the pop-up is closed', () => {
  test.use({ gisMode: 'popup-closed' });
  test('closing the Google pop-up: "Sign-in did not complete." and the Sign in button still works', async ({ page, guard }) => {
    await page.goto('studio/#/me');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#banner')).toContainText('Sign-in did not complete.');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await expect(page.locator('#tabs')).toBeHidden();
  });
});
