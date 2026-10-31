// Stage 6 App Factory bridge (page side, mocked specs): at Step 7 Launch the Factory card has ONE "Ask Studio for a launch pack"
// button that writes ONE Studio request (kind idea, playbook P1, appRef) into Studio's requests folder; Studio shows "From app".
// Pretend Google and Drive only; invented data. The engine side (STUDIO-ENGINE making the idea) is not in this repo.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const factoryState = require('../fixtures/factory/state').build;
const studioState = require('../fixtures/studio/state').build;

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const CONF = ctx.window.DASH_CONFIG;
const UPLOAD = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/;

async function uploads(page) {
  const got = [];
  await page.route(UPLOAD, (route) => {
    const parts = route.request().postData().split(/\r\n--[a-z]+\d+(?:--)?/).map((p) => p.slice(p.indexOf('\r\n\r\n') + 4)).filter((p) => p.trim().startsWith('{'));
    got.push({ meta: JSON.parse(parts[0]), body: JSON.parse(parts[1]) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'req-' + got.length }) });
  });
  return got;
}
async function openFactory(page, guard, status) {
  const s = factoryState(Date.now());
  s.lists.apps.filter((t) => t.id === '869fjxpc2')[0].status = status;
  guard.world.folder(CONF.factory.logsFolderId, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(s), { parents: [CONF.factory.logsFolderId], mimeType: 'application/json' });
  await page.goto('factory/#/rooms');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#appPick')).toBeVisible();
  await page.evaluate(() => { location.hash = '#/card/869fjxpc2'; });
  await expect(page.locator('.hero h2')).toBeVisible();
}

test.describe('App Factory bridge (Stage 6)', () => {
  test('Factory: at Step 7 Launch, one button writes exactly one Studio request with appRef and playbook P1', async ({ page, guard }) => {
    const got = await uploads(page);
    await openFactory(page, guard, '7 launch');
    const btn = page.locator('[data-action="launchpack"]');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveText('Ask Studio for a launch pack');
    await btn.dblclick();
    await expect(page.locator('[data-launch="869fjxpc2"] .sent')).toHaveText('Asked Studio for a launch pack');
    await expect(page.locator('[data-action="launchpack"]')).toHaveCount(0);
    expect(got).toHaveLength(1);
    expect(got[0].meta.parents).toEqual([CONF.studio.requestsFolderId]);
    expect(got[0].meta.name).toMatch(/^idea-\d+\.json$/);
    expect(got[0].body).toMatchObject({ kind: 'idea', type: 'pack', playbookId: 'P1', appRef: { id: '869fjxpc2', slug: 'sample' }, from: 'factory' });
    expect(got[0].body.appRef.slug).toHaveLength(6);
    // Reload: still asked, still no second button.
    await page.reload();
    if (await page.locator('#signInBtn').isVisible()) { await expect(page.locator('#signInBtn')).toBeEnabled(); await page.locator('#signInBtn').click(); }
    await expect(page.locator('[data-launch="869fjxpc2"] .sent')).toBeVisible();
    expect(got).toHaveLength(1);
  });

  test('Factory: an app name with no letters or digits still sends a 6-character slug (from the app id)', async ({ page, guard }) => {
    const got = await uploads(page);
    const s = factoryState(Date.now());
    const app = s.lists.apps.filter((t) => t.id === '869fjxpc2')[0];
    app.status = '7 launch'; app.name = '!!! ???';
    guard.world.folder(CONF.factory.logsFolderId, 'AF logs (sample)');
    guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(s), { parents: [CONF.factory.logsFolderId], mimeType: 'application/json' });
    await page.goto('factory/#/rooms');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#appPick')).toBeVisible();
    await page.evaluate(() => { location.hash = '#/card/869fjxpc2'; });
    await page.locator('[data-action="launchpack"]').click();
    await expect(page.locator('[data-launch="869fjxpc2"] .sent')).toHaveText('Asked Studio for a launch pack');
    expect(got).toHaveLength(1);
    expect(got[0].body.appRef).toEqual({ id: '869fjxpc2', slug: '869fjx' });
  });

  test('Factory: no launch-pack button before Step 7', async ({ page, guard }) => {
    await openFactory(page, guard, '4 schema');
    await expect(page.locator('[data-action="launchpack"]')).toHaveCount(0);
  });

  test('Studio: a piece with appRef shows "From app: <alias>" and never the App Factory id', async ({ page, guard }) => {
    const NOW = new Date('2026-10-28T10:10:00');
    await page.clock.setFixedTime(NOW);
    const s = studioState(NOW.getTime());
    s.ideas[0].appRef = { id: 'af-9999zz', slug: 'sample', alias: 'APP-A' };
    guard.world.folder(CONF.studio.logsFolderId, 'Studio logs (sample)');
    guard.world.file('studio-state-sample', CONF.studio.stateFile, JSON.stringify(s), { parents: [CONF.studio.logsFolderId], mimeType: 'application/json' });
    await page.goto('studio/#/ideas');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#enginePill')).toBeVisible();
    const chip = page.locator('.crow[data-row="si-1"] [data-chip="from-app"]');
    await expect(chip).toHaveText('From app: APP-A');
    await expect(page.locator('[data-chip="from-app"]')).toHaveCount(1);
    expect(await page.locator('body').innerText()).not.toContain('af-9999zz');
    await page.evaluate(() => { location.hash = '#/asset/si-1'; });
    await expect(page.locator('#view [data-chip="from-app"]')).toHaveText('From app: APP-A');
  });
});
