// Studio page (28 Oct 2026): the asset hub shell. Example data until the engine writes studio-state.json;
// the real state renders; tabs, find bar, Review write-back with Undo, Tools warnings, phone width, dark mode, text size.
// Pretend Google and Drive only; the data is tests/fixtures/studio/state.js (invented) or the page's own example.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const { build } = require('../fixtures/studio/state');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const ST = ctx.window.DASH_CONFIG.studio; // folder ids and file name come from config.js, so the tests follow a change there
const NOW = new Date('2026-10-28T10:10:00'); // fixed clock: the Undo window (until the engine's next run) is then known
const TABS = ['me', 'ideas', 'assets', 'review', 'brands', 'library', 'tools', 'new'];
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
  await expect(page.locator('#enginePill')).toBeVisible();
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
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('Studio page', () => {
  test('no studio-state.json yet: the example banner, example brands, and every write switched off', async ({ page, guard }) => {
    await open(page, guard, '#/me', { state: false });
    await expect(page.locator('#exBanner')).toBeVisible();
    await expect(page.locator('#exBanner')).toHaveText('Example data. The Studio engine is not running yet.');
    await expect(page.locator('#stamp')).toHaveText('TEST');
    await expect(page.locator('#enginePill')).toContainText('Off');
    await page.locator('nav.tabs a[data-nav="brands"]').click();
    await expect(page.locator('[data-brandcard]')).toHaveCount(3); // two owner brands, one client brand
    await expect(page.locator('[data-brandcard="ex-a"]')).toContainText('Example Brand A');
    await page.locator('nav.tabs a[data-nav="review"]').click();
    await expect(page.locator('[data-act="approve"]').first()).toBeDisabled();
    await page.locator('nav.tabs a[data-nav="new"]').click();
    await expect(page.locator('[data-action="sendidea"]')).toBeDisabled();
    // Read by folder + exact name, and never written to in example mode.
    expect(guard.world.calls.some((c) => c.query.includes(`'${ST.logsFolderId}' in parents`) && c.query.includes(`name = '${ST.stateFile}'`))).toBe(true);
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  test('the real state renders: TEST stamp, engine on with its last run, budget, and Me lists Review, Gates and Hand jobs', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    await expect(page.locator('#exBanner')).toBeHidden();
    await expect(page.locator('#stamp')).toHaveText('TEST');
    await expect(page.locator('#enginePill')).toContainText('On · 10:00');
    await expect(page.locator('#budgetPill')).toHaveText('£20 / £50');
    await expect(page.locator('#budgetPill')).toHaveAttribute('href', '#/tools');
    await expect(page.locator('[data-sect="review"] .crow')).toHaveCount(2);
    await expect(page.locator('[data-sect="gate"] .crow[data-row="sa-gate"]')).toContainText('Lock the spec?');
    await expect(page.locator('[data-sect="hand"] .crow[data-row="sa-hand"]')).toBeVisible();
    await expect(page.locator('#nMe')).toHaveText('4');
    // TEST items stay out of lists and counts until the TEST switch is on.
    await page.locator('nav.tabs a[data-nav="assets"]').click();
    await expect(page.locator('.crow[data-row="sa-test"]')).toHaveCount(0);
    await page.locator('#filtersBtn').click();
    await page.locator('[data-action="ftest"]').click();
    await expect(page.locator('.crow[data-row="sa-test"]')).toBeVisible();
  });

  test('tabs switch, light the right tab and land on their own view', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    for (const key of TABS) {
      await page.locator(`nav.tabs a[data-nav="${key}"]`).click();
      await expect(page.locator('#view')).toHaveAttribute('data-view', key);
      await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveCount(1);
      await expect(page.locator(`nav.tabs a[data-nav="${key}"]`)).toHaveAttribute('aria-current', 'page');
    }
    await expect(page.locator('[data-meter]')).toHaveCount(0); // New form, not Tools
    await page.locator('nav.tabs a[data-nav="library"]').click();
    await expect(page.locator('.crow[data-row="sa-lib"] a[href="#/new?from=sa-lib"]')).toBeVisible();
  });

  test('find bar: a brand chip filters Assets, the address carries it, All clears it, and it is remembered', async ({ page, guard }) => {
    await open(page, guard, '#/assets');
    await expect(rows(page)).toHaveCount(6);
    const south = page.locator('#view [data-fx="brand"][data-val="sb-south"]');
    await expect(south.locator('.cnt')).toHaveText('3');
    await page.locator('#view [data-fx="brand"][data-val="sb-north"]').click();
    await expect(page).toHaveURL(/#\/assets\?brand=sb-north$/);
    await expect(rows(page)).toHaveCount(3);
    await expect(page.locator('.crow[data-row="sa-gate"]')).toHaveCount(0);
    await page.reload();
    await expect(rows(page)).toHaveCount(3);
    await page.locator('#view [data-fx="brand"][data-val=""]').click();
    await expect(rows(page)).toHaveCount(6);
    await page.locator('#view [data-f="fq"]').fill('webclass');
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('.crow[data-row="sa-make"]')).toBeVisible();
  });

  test('Review: Approve writes one approve request into the requests folder, shows ✓ HH:MM · applies by HH:MM, and Undo trashes it', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/review');
    const r = page.locator('.crow[data-row="sa-rev1"]');
    await expect(r.locator('a.lk[aria-label="Preview"]')).toHaveAttribute('href', 'https://drive.google.com/file/d/1SAMPLEreviewDoc00000000000/view');
    await r.locator('[data-act="approve"]').click();
    await expect(r.locator('[data-sent]')).toHaveText('✓ 10:10 · applies by 10:19');
    expect(got).toHaveLength(1);
    expect(got[0].meta.parents).toEqual([ST.requestsFolderId]);
    expect(got[0].meta.name).toMatch(/^approve-\d+\.json$/);
    expect(got[0].body).toMatchObject({ kind: 'approve', assetId: 'sa-rev1', accountId: 'acc-owner' });
    expect(got[0].body.by).toMatch(/@/);
    await expect(page.locator('#nReview')).toHaveText('1');
    await r.locator('[data-undo]').click();
    await expect(r.locator('[data-act="approve"]')).toBeVisible();
    expect(guard.world.byId('req-1').trashed).toBe(true);
    // Redo needs a note; it goes in the same request file.
    await r.locator('[data-panel="redo"]').click();
    await r.locator('#note-sa-rev1').fill('Shorter intro');
    await r.locator('#note-sa-rev1').press('Enter');
    await expect(r.locator('[data-sent]')).toBeVisible();
    expect(got[1].body).toMatchObject({ kind: 'redo', assetId: 'sa-rev1', note: 'Shorter intro' });
  });

  test('a gate verdict and a new idea each write one request file', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/me');
    await page.locator('.crow[data-row="sa-gate"] [data-act="gate"][data-verdict="RESHAPE"]').click();
    await expect(page.locator('.crow[data-row="sa-gate"] [data-sent]')).toBeVisible();
    expect(got[0].body).toMatchObject({ kind: 'gate', assetId: 'sa-gate', verdict: 'RESHAPE' });
    await page.locator('nav.tabs a[data-nav="new"]').click();
    await page.locator('[data-action="sendidea"]').click();
    await expect(page.locator('.ferr')).toHaveCount(3); // name, brand, type
    await page.locator('[data-f="n-name"]').fill('Sample guide idea');
    await page.locator('[data-multi="brands"][data-val="sb-south"]').click();
    await page.locator('[data-pick="type"][data-val="ebook"]').click();
    await page.locator('[data-pick="provider"][data-val="Gemini"]').click();
    await page.locator('[data-action="sendidea"]').click();
    await expect(page).toHaveURL(/#\/ideas$/);
    expect(got[1].body).toMatchObject({ kind: 'idea', accountId: 'acc-owner', name: 'Sample guide idea', brandIds: ['sb-south'], type: 'ebook', provider: 'Gemini', evergreen: true });
  });

  test('accounts: owner and client kept apart; Account chips filter; an idea cannot mix two accounts', async ({ page, guard }) => {
    await open(page, guard, '#/assets');
    const acct = (v) => page.locator(`#view [data-fx="acct"][data-val="${v}"]`);
    await expect(acct('acc-client').locator('.cnt')).toHaveText('1');
    await acct('acc-client').click();
    await expect(page).toHaveURL(/acct=acc-client/);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('.crow[data-row="sa-client"]')).toContainText('Sample client ebook');
    await expect(page.locator('.crow[data-row="sa-client"] .tag[title="Product"]')).toHaveText('Sample client book');
    await acct('').click();
    await expect(rows(page)).toHaveCount(6);
    await page.locator('nav.tabs a[data-nav="brands"]').click();
    await expect(page.locator('[data-brandcard="sb-client"]')).toContainText('Sample client');
    await page.locator('nav.tabs a[data-nav="new"]').click();
    await page.locator('[data-f="n-name"]').fill('Mixed idea');
    await page.locator('[data-multi="brands"][data-val="sb-north"]').click();
    await page.locator('[data-multi="brands"][data-val="sb-client"]').click();
    await page.locator('[data-pick="type"][data-val="pdf"]').click();
    await page.locator('[data-action="sendidea"]').click();
    await expect(page.locator('.ferr')).toHaveText('One account per idea');
  });

  test('one account only: no Account chips', async ({ page, guard }) => {
    await open(page, guard, '#/assets', { change: (s) => { s.accounts = s.accounts.slice(0, 1); s.brands = s.brands.slice(0, 2); s.assets = s.assets.filter((a) => a.accountId === 'acc-owner'); } });
    await expect(rows(page)).toHaveCount(5);
    await expect(page.locator('#view [data-frow="acct"]')).toHaveCount(0);
  });

  test('example data shows the owner and one client account apart', async ({ page, guard }) => {
    await open(page, guard, '#/assets', { state: false });
    await expect(page.locator('#view [data-fx="acct"][data-val="ex-owner"]')).toContainText('Example owner');
    await expect(page.locator('#view [data-fx="acct"][data-val="ex-client"]')).toContainText('Example client');
    await expect(page.locator('.crow[data-row="ex-8"]')).toBeVisible();
  });

  test('Tools: a meter at 85% shows its warning, and the Tools tab counts it', async ({ page, guard }) => {
    await open(page, guard, '#/tools');
    await expect(page.locator('[data-meter]')).toHaveCount(2);
    await expect(page.locator('[data-meter="high"]')).toContainText('85% used');
    await expect(page.locator('[data-meter="ok"]')).toBeVisible();
    await expect(page.locator('#nTools')).toHaveText('1');
  });

  test('390px phone: every tab fits with no sideways scroll', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard, '#/me');
    for (const key of TABS) {
      await page.evaluate((h) => { location.hash = h; }, '#/' + key);
      await expect(page.locator('#view')).toHaveAttribute('data-view', key);
      await noSidewaysScroll(page, key);
    }
    await page.evaluate(() => { location.hash = '#/assets'; });
    await page.locator('#filtersBtn').click();
    await noSidewaysScroll(page, 'assets with filters open');
    await expect(page.locator('#backHome')).toBeVisible();
  });

  test('dark mode: dark page, light text, and the words read clearly on every tab', async ({ page, guard }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page, guard, '#/me', { state: false });
    for (const key of TABS) {
      await page.evaluate((h) => { location.hash = h; }, '#/' + key);
      await expect(page.locator('#view')).toHaveAttribute('data-view', key);
      const worst = await page.evaluate(() => {
        const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
        const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
        const bgOf = (e) => { for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return rgb(c); } return [255, 255, 255]; };
        let min = 99, at = '';
        document.querySelectorAll('#view *, header *').forEach((e) => {
          if (!e.offsetParent || !Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
          const a = lum(rgb(getComputedStyle(e).color)), b = lum(bgOf(e)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          if (r < min) { min = r; at = e.textContent.trim().slice(0, 30); }
        });
        const body = rgb(getComputedStyle(document.body).backgroundColor);
        return { min, at, body: body[0] + body[1] + body[2] };
      });
      expect(worst.body, 'page background should be dark').toBeLessThan(150);
      expect(worst.min, `${key}: "${worst.at}" is hard to read`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('no text smaller than 13px on any tab', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    for (const key of TABS.concat(['engine', 'asset/sa-make'])) {
      await page.evaluate((h) => { location.hash = h; }, '#/' + key);
      await expect(page.locator('#view')).toHaveAttribute('data-view', key.split('/')[0]);
      if (key === 'assets') await page.locator('#filtersBtn').click();
      const small = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('body *').forEach((e) => {
          if (!e.offsetParent) return;
          if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
          const px = parseFloat(getComputedStyle(e).fontSize);
          if (px < 13) bad.push(`${px}px "${e.textContent.trim().slice(0, 30)}"`);
        });
        return bad.slice(0, 5);
      });
      expect(small, `${key}: text smaller than 13px`).toEqual([]);
    }
  });
});
