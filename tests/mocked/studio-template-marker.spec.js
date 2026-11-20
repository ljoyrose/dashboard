// Template marker (Lisa's Q3 = A, engine v0.2.28): every piece is a one-off unless marked. A marked piece shows a
// 'Template candidate' chip, is listed under Kits > Kits, and the details carry a One-off / Template toggle that sends one
// 'set reuse' request. Client material can never be a template. Invented data only.
// the real state renders; tabs, find bar, Review write-back with Undo, Tools warnings, phone width, dark mode, text size.
// Pretend Google and Drive only; the data is tests/fixtures/studio/state.js (invented) or the page's own example.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');
const { build } = require('../fixtures/studio/state');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const ST = ctx.window.DASH_CONFIG.studio; // folder ids and file name come from config.js, so the tests follow a change there
const NOW = new Date('2026-10-28T10:10:00'); // fixed clock: the Undo window (until the engine's next run) is then known
const TABS = ['me', 'decide', 'do', 'line', 'ideas', 'assets', 'review', 'brands', 'library', 'kits', 'tools', 'new'];
const KIT_SUBS = ['kits/playbooks', 'kits/packs', 'kits/kits', 'kits/bricks', 'kits/styles', 'kits/formats'];
const UPLOAD = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/;

async function open(page, guard, hash, { state = true, change } = {}) {
  await page.clock.setFixedTime(NOW);
  if (state) {
    const s = build(NOW.getTime());
    if (change) change(s);
    guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
    guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(s), { parents: [ST.logsFolderId], mimeType: 'application/json' });
  }
  await page.goto('studio/' + (hash || '#/me'));
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#enginePill')).not.toHaveClass(/\bhidden\b/); // drawn: Studio has read its state
  if (page.viewportSize().width > 600) await expect(page.locator('#enginePill')).toBeVisible(); // the pill shows on a desktop only (no room in the 56px phone bar)
}
// Pretend Drive upload: records each request file and adds it to the pretend Drive, so Undo (PATCH trashed) can find it.
async function uploads(page, guard) {
  const got = [];
  await page.route(UPLOAD, (route) => {
    const parts = route.request().postData().split(/\r\n--st\d+(?:--)?/).map((p) => p.slice(p.indexOf('\r\n\r\n') + 4)).filter((p) => p.trim().startsWith('{'));
    const meta = JSON.parse(parts[0]), body = JSON.parse(parts[1]), id = 'req-' + (got.length + 1);
    got.push({ meta, body, id });
    guard.world.file(id, meta.name, parts[1], { parents: meta.parents, mimeType: 'application/json' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id, name: meta.name }) });
  });
  return got;
}
const rows = (page) => page.locator('#view .crow');
// Calm rows (28 Oct 2026): chips, preview and small tools sit in the item's details, opened from its title.
const details = async (page, id) => {
  const d = page.locator(`[data-more="${id}"]`);
  if (await page.locator('#fpanel').count()) await page.keyboard.press('Escape'); // the Filter panel would cover the rows
  if (!(await d.count())) await page.locator(`.crow[data-row="${id}"] .ttl`).first().click();
  await expect(d).toBeVisible();
  return d;
};
// The find bar is one row (Search · Filter · Sort); every filter group sits in the Filter panel.
const openFilters = async (page) => { await page.locator('#filtersBtn').click(); await expect(page.locator('#fpanel')).toBeVisible(); };
// Old tab names are now pages under the five bottom tabs (Me, Decide, Do, Line, Kits): open them by address.

const go = async (page, key) => { await page.evaluate((k) => { location.hash = '#/' + k; }, key); await expect(page.locator('#view')).toHaveAttribute('data-view', key.split('/')[0]); };

test.describe('Studio: template marker', () => {
  test('older state (no reuse field): no chip, no candidates list, the toggle shows One-off', async ({ page, guard }) => {
    await open(page, guard, '#/assets');
    await expect(page.locator('[data-chip="template"]')).toHaveCount(0);
    await details(page, 'sa-rev1');
    await expect(page.locator('[data-rights="sa-rev1"] [data-set="reuse"][data-val="one-off"]')).toHaveAttribute('aria-pressed', 'true');
    await go(page, 'kits/kits');
    await expect(page.locator('[data-template-candidates]')).toHaveCount(0);
  });

  test('a marked piece shows the chip and is listed under Kits > Kits', async ({ page, guard }) => {
    await open(page, guard, '#/assets', { change: (s) => { s.assets.filter((a) => a.id === 'sa-rev1')[0].reuse = 'template'; } });
    await expect(page.locator('.crow[data-row="sa-rev1"] [data-chip="template"]')).toHaveText('Template candidate');
    await go(page, 'kits/kits');
    const tc = page.locator('[data-template-candidates]');
    await expect(tc).toBeVisible();
    await expect(tc.locator('a[href="#/asset/sa-rev1"]')).toHaveCount(1);
  });

  test('the toggle sends one set reuse request and shows the chip at once', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/assets');
    await details(page, 'sa-rev1');
    await page.locator('[data-rights="sa-rev1"] [data-set="reuse"][data-val="template"]').click();
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].body).toMatchObject({ kind: 'set', assetId: 'sa-rev1', reuse: 'template' });
    await expect(page.locator('.crow[data-row="sa-rev1"] [data-chip="template"]')).toHaveText('Template candidate');
  });

  test('client material: the Template choice is switched off', async ({ page, guard }) => {
    await open(page, guard, '#/assets', { change: (s) => { s.assets.filter((a) => a.id === 'sa-client')[0].clientMaterial = 'yes'; } });
    await details(page, 'sa-client');
    await expect(page.locator('[data-rights="sa-client"] [data-set="reuse"][data-val="template"]')).toBeDisabled();
  });
});
