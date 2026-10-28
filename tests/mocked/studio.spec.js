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
const TABS = ['me', 'decide', 'do', 'line', 'ideas', 'assets', 'review', 'brands', 'library', 'kits', 'tools', 'new'];
const KIT_SUBS = ['kits/playbooks', 'kits/packs', 'kits/kits', 'kits/styles', 'kits/formats'];
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
// The find bar is one row (Search · Filter · Sort); every filter group sits in the Filter panel.
const openFilters = async (page) => { await page.locator('#filtersBtn').click(); await expect(page.locator('#fpanel')).toBeVisible(); };
// Old tab names are now pages under the five bottom tabs (Me, Decide, Do, Line, Kits): open them by address.
const go = async (page, key) => { await page.evaluate((k) => { location.hash = '#/' + k; }, key); await expect(page.locator('#view')).toHaveAttribute('data-view', key.split('/')[0]); };
const NAV = { me: 'me', decide: 'decide', do: 'do', line: 'line', ideas: 'line', assets: 'line', review: 'decide', brands: 'kits', library: 'line', kits: 'kits', tools: 'kits', new: 'line' };
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('Studio page', () => {
  test('no studio-state.json yet: the example banner, example brands, and every write switched off', async ({ page, guard }) => {
    await open(page, guard, '#/me', { state: false });
    await expect(page.locator('#exBanner')).toBeVisible();
    await expect(page.locator('#exBanner')).toHaveText('Example data · engine off');
    await expect(page.locator('#stamp')).toHaveText('TEST');
    await expect(page.locator('#enginePill')).toContainText('Off');
    await go(page, 'brands');
    await expect(page.locator('[data-brandcard]')).toHaveCount(3); // two owner brands, one client brand
    await expect(page.locator('[data-brandcard="ex-a"]')).toContainText('Example Brand A');
    await go(page, 'review');
    await expect(page.locator('[data-act="approve"]').first()).toBeDisabled();
    await go(page, 'new');
    await expect(page.locator('[data-action="sendidea"]')).toBeDisabled();
    // Read by folder + exact name, and never written to in example mode.
    expect(guard.world.calls.some((c) => c.query.includes(`'${ST.logsFolderId}' in parents`) && c.query.includes(`name = '${ST.stateFile}'`))).toBe(true);
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  test('the real state renders: TEST stamp, engine on with its last run, budget, and Me lists Review, Gates and Tasks', async ({ page, guard }) => {
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
    await go(page, 'assets');
    await expect(page.locator('.crow[data-row="sa-test"]')).toHaveCount(0);
    await page.locator('#filtersBtn').click();
    await page.locator('[data-action="ftest"]').click();
    await expect(page.locator('.crow[data-row="sa-test"]')).toBeVisible();
  });

  test('five bottom tabs (Me, Decide, Do, Line, Kits) light up; every old page opens under its tab with a sub-row', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    await expect(page.locator('nav.tabs a')).toHaveCount(5);
    for (const key of ['me', 'decide', 'do', 'line', 'kits']) {
      await page.locator(`nav.tabs a[data-nav="${key}"]`).click();
      await expect(page.locator('#view')).toHaveAttribute('data-view', key);
      await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveCount(1);
      await expect(page.locator(`nav.tabs a[data-nav="${key}"]`)).toHaveAttribute('aria-current', 'page');
    }
    for (const key of TABS) {
      await go(page, key);
      await expect(page.locator(`nav.tabs a[data-nav="${NAV[key]}"]`)).toHaveAttribute('aria-current', 'page');
    }
    await expect(page.locator('[data-meter]')).toHaveCount(0); // New form, not Tools
    await go(page, 'library');
    await expect(page.locator('.subnav a[data-sub="library"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.crow[data-row="sa-lib"] a[href="#/new?from=sa-lib"]')).toBeVisible();
    await page.locator('.subnav a[data-sub="ideas"]').click();
    await expect(page.locator('#view')).toHaveAttribute('data-view', 'ideas');
    await page.locator('nav.tabs a[data-nav="decide"]').click();
    await expect(page.locator('[data-sect="gate"] .crow[data-row="sa-gate"]')).toBeVisible();
    await page.locator('nav.tabs a[data-nav="do"]').click();
    await expect(page.locator('[data-sect="hand"] .crow[data-row="sa-hand"]')).toBeVisible();
  });

  test('find bar: a brand chip filters Assets, the address carries it, All clears it, and it is remembered', async ({ page, guard }) => {
    await open(page, guard, '#/assets');
    await expect(rows(page)).toHaveCount(6);
    await openFilters(page);
    const south = page.locator('#view [data-fx="brand"][data-val="sb-south"]');
    await expect(south.locator('.cnt')).toHaveText('3');
    await page.locator('#view [data-fx="brand"][data-val="sb-north"]').click();
    await expect(page).toHaveURL(/#\/assets\?brand=sb-north$/);
    await expect(rows(page)).toHaveCount(3);
    await expect(page.locator('.crow[data-row="sa-gate"]')).toHaveCount(0);
    await page.reload();
    await expect(rows(page)).toHaveCount(3);
    await openFilters(page);
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
    await expect(page.locator('.subnav a[data-sub="review"] .cnt')).toHaveText('1');
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
    await go(page, 'new');
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
    await openFilters(page);
    await expect(acct('acc-client').locator('.cnt')).toHaveText('1');
    await acct('acc-client').click();
    await expect(page).toHaveURL(/acct=acc-client/);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('.crow[data-row="sa-client"]')).toContainText('Sample client ebook');
    await expect(page.locator('.crow[data-row="sa-client"] .tag[title="Product"]')).toHaveText('Sample client book');
    await acct('').click();
    await expect(rows(page)).toHaveCount(6);
    await go(page, 'brands');
    await expect(page.locator('[data-brandcard="sb-client"]')).toContainText('Sample client');
    await go(page, 'new');
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
    await openFilters(page);
    await expect(page.locator('#view [data-frow="acct"]')).toHaveCount(0);
  });

  test('example data shows the owner and one client account apart', async ({ page, guard }) => {
    await open(page, guard, '#/assets', { state: false });
    await openFilters(page);
    await expect(page.locator('#view [data-fx="acct"][data-val="ex-owner"]')).toContainText('Example owner');
    await expect(page.locator('#view [data-fx="acct"][data-val="ex-client"]')).toContainText('Example client');
    await expect(page.locator('.crow[data-row="ex-8"]')).toBeVisible();
  });

  test('Tools: a meter at 85% shows its warning, and the Tools tab counts it', async ({ page, guard }) => {
    await open(page, guard, '#/tools');
    await expect(page.locator('[data-meter]')).toHaveCount(2);
    await expect(page.locator('[data-meter="high"]')).toContainText('85% used');
    await expect(page.locator('[data-meter="ok"]')).toBeVisible();
    await expect(page.locator('#nKits')).toHaveText('1');
  });

  test('390px phone: every tab fits with no sideways scroll', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard, '#/me');
    for (const key of TABS) {
      await page.evaluate((h) => { location.hash = h; }, '#/' + key);
      await expect(page.locator('#view')).toHaveAttribute('data-view', key);
      await noSidewaysScroll(page, key);
    }
    for (const key of KIT_SUBS) {
      await page.evaluate((h) => { location.hash = h; }, '#/' + key);
      await expect(page.locator(`#view [data-kits="${key.split('/')[1]}"]`)).toBeVisible();
      await noSidewaysScroll(page, key);
    }
    await page.evaluate(() => { location.hash = '#/tools'; });
    await page.locator('[data-action="addtool"]').click();
    await page.locator('[data-action="tmore"]').click();
    await noSidewaysScroll(page, 'tools with Add tool and More open');
    await page.evaluate(() => { location.hash = '#/new'; });
    await page.locator('[data-action="nmore"]').click();
    await page.locator('[data-action="addsrc"]').click();
    await noSidewaysScroll(page, 'new brief with More and a source open');
    await page.evaluate(() => { location.hash = '#/assets'; });
    await page.locator('#filtersBtn').click();
    await noSidewaysScroll(page, 'assets with filters open');
    // Phone header: status pills plus one More menu (Refresh, Look, New, Sign out, Dashboard).
    await expect(page.locator('#backHome')).toBeHidden();
    await expect(page.locator('#enginePill')).toBeVisible();
    await page.locator('#moreBtn').click();
    const more = page.locator('#moreMenu');
    await expect(more).toBeVisible();
    for (const t of ['Refresh', 'Look', 'New', 'Sign out', 'Dashboard']) await expect(more).toContainText(t);
    await expect(more.locator('a[href="../"]')).toBeVisible();
    for (const b of await more.locator('button, a').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => !!document.activeElement.closest('#moreMenu')), 'focus moves into the menu').toBe(true);
    await noSidewaysScroll(page, 'More menu open');
    await page.keyboard.press('Escape');
    await expect(more).toBeHidden();
    await expect(page.locator('#moreBtn')).toBeFocused();
    await page.locator('#moreBtn').click();
    await more.locator('[data-action="lookmore"]').click();
    await expect(page.locator('#lookMenu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lookMenu')).toBeHidden();
    await expect(page.locator('#moreBtn')).toBeFocused();
    await page.locator('#moreBtn').click();
    await page.locator('#moreMenu [data-action="moredone"]').click();
    await expect(more).toBeHidden();
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
    for (const key of TABS.concat(['engine', 'asset/sa-make'], KIT_SUBS)) {
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

  /* ---------- v0.2: groups, kits, styles, formats, variants, sources, tools by capability, gaps, Done, set-up ticks ---------- */
  test('group chips: Dogs and Client services filter Assets, the address carries it; Group shows on brand cards; hidden with one group', async ({ page, guard }) => {
    await open(page, guard, '#/assets');
    const grp = (v) => page.locator(`#view [data-fx="grp"][data-val="${v}"]`);
    await openFilters(page);
    await expect(page.locator('#fpanel > :first-child [data-frow]')).toHaveAttribute('data-frow', 'grp'); // first in the Filter panel
    await expect(grp('grp-dogs').locator('.cnt')).toHaveText('5');
    await expect(grp('grp-services').locator('.cnt')).toHaveText('1');
    await expect(grp('grp-apps')).toHaveCount(0); // no items, no chip
    await grp('grp-services').click();
    await expect(page).toHaveURL(/grp=grp-services/);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('.crow[data-row="sa-client"]')).toBeVisible();
    await grp('').click();
    await expect(rows(page)).toHaveCount(6);
    await go(page, 'brands');
    await expect(page.locator('[data-brandcard="sb-client"] .stn')).toContainText('Client services');
    await expect(page.locator('[data-brandcard="sb-north"] .stn')).toContainText('Dogs');
  });

  test('one group only: no Group chips', async ({ page, guard }) => {
    await open(page, guard, '#/assets', { change: (s) => { s.brands.forEach((b) => { b.groupId = 'grp-dogs'; }); s.assets.forEach((a) => { a.groupId = null; }); } });
    await expect(rows(page)).toHaveCount(6);
    await openFilters(page);
    await expect(page.locator('#view [data-frow="grp"]')).toHaveCount(0);
  });

  test('Kits tab: playbooks by outcome, packs, kits with their needs, styles (frameworks, voices, looks), formats', async ({ page, guard }) => {
    await open(page, guard, '#/kits');
    await expect(page.locator('nav.tabs a[data-nav="kits"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view [data-kits="playbooks"] [data-outcome]')).toHaveCount(5);
    await expect(page.locator('[data-outcome]')).toHaveText([/Attract/, /Convert/, /Deliver/, /Keep/, /Reuse/]);
    const launch = page.locator('[data-outcome="convert"] [data-playbook="pb-launch"]');
    await expect(launch.locator('li')).toHaveText(['Sample webclass funnel', 'Sample email kit', 'Post the replay link']);
    await expect(page.locator('[data-outcome="attract"] [data-playbook="pb-grow"]')).toBeVisible();
    await expect(page.locator('[data-outcome="convert"] .grp .cnt')).toHaveText('1');
    await expect(page.locator('[data-kitnav="kits"] .cnt')).toHaveText('4');
    await page.locator('[data-kitnav="packs"]').click();
    await expect(page.locator('[data-pack="pk-funnel"]')).toContainText('Sample webclass kit');
    await page.locator('[data-kitnav="kits"]').click();
    await expect(page.locator('[data-kit]')).toHaveCount(4);
    await expect(page.locator('[data-kit="kit-webclass"] [data-cap="video-reformat"]')).toBeVisible();
    await expect(page.locator('[data-kit="kit-webclass"]')).toContainText('9:16');
    await page.locator('[data-kitnav="styles"]').click();
    await expect(page.locator('[data-style="framework"]')).toHaveCount(3);
    await expect(page.locator('[data-style="framework"][data-id="fw-hso"] li')).toHaveText(['Hook', 'Story', 'Offer']);
    await expect(page.locator('[data-style="framework"][data-id="fw-hso"] .when')).toHaveText('Short posts and emails');
    await expect(page.locator('[data-style="voice"]')).toHaveCount(1);
    await expect(page.locator('[data-style="look"]')).toHaveCount(2);
    await page.locator('[data-kitnav="formats"]').click();
    await expect(page.locator('[data-format]')).toHaveCount(5);
    await expect(page.locator('[data-format="fmt-reel"]')).toContainText('9:16');
    await expect(page.locator('[data-format="fmt-reel"]')).toContainText('1080x1920');
  });

  test('asset rows show framework, format and variant chips, and a master link on a variant', async ({ page, guard }) => {
    await open(page, guard, '#/review');
    const v = page.locator('.crow[data-row="sa-rev2"]');
    await expect(v.locator('[data-chip="framework"]')).toHaveText('Hook, story, offer');
    await expect(v.locator('[data-chip="format"]')).toHaveText('Email header');
    await expect(v.locator('[data-chip="purpose"]')).toHaveText('Refresh');
    await expect(v.locator('a[data-chip="master"]')).toHaveAttribute('href', '#/asset/sa-lib');
    await expect(page.locator('.crow[data-row="sa-rev1"] a[data-chip="master"]')).toHaveCount(0);
    await go(page, 'assets');
    await expect(page.locator('.crow[data-row="sa-make"] [data-chip="format"]')).toHaveText(['16:9', '9:16']);
  });

  test('New brief: group filters brands; More holds the style, formats, variant and sources; Send writes them all', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/new');
    await expect(page.locator('[data-pick="playbook"]')).toHaveCount(0); // behind More
    await page.locator('[data-f="n-name"]').fill('Sample reel brief');
    await page.locator('[data-pick="group"][data-val="grp-dogs"]').click();
    await expect(page.locator('[data-multi="brands"][data-val="sb-client"]')).toHaveCount(0);
    await page.locator('[data-multi="brands"][data-val="sb-north"]').click();
    await page.locator('[data-pick="type"][data-val="social"]').click();
    await page.locator('[data-action="nmore"]').click();
    await page.locator('[data-pick="playbook"][data-val="pb-grow"]').click();
    await expect(page.locator('[data-pick="outcome"][data-val="attract"]')).toHaveClass(/\bon\b/); // the playbook's outcome
    await page.locator('[data-pick="kit"][data-val="kit-social"]').click();
    await page.locator('[data-pick="framework"][data-val="fw-hso"]').click();
    await page.locator('[data-pick="voice"][data-val="vo-warm"]').click();
    await page.locator('[data-pick="look"][data-val="look-wordmark"]').click();
    await page.locator('[data-multi="formats"][data-val="fmt-reel"]').click();
    await page.locator('[data-multi="formats"][data-val="fmt-fb-feed"]').click();
    await page.locator('[data-pick="language"][data-val="en-GB"]').click();
    await page.locator('[data-f="n-length"]').fill('30s');
    await page.locator('[data-f="n-master"]').selectOption('sa-rev1');
    await page.locator('[data-action="addsrc"]').click();
    await page.locator('[data-f="s-0-url"]').fill('https://www.youtube.com/watch?v=sample');
    await page.locator('[data-action="addsrc"]').click();
    await page.locator('[data-src="1"] [data-key="kind"][data-val="upload"]').click();
    await expect(page.locator('[data-src="1"] a[data-inbox]')).toHaveAttribute('href', 'https://drive.google.com/drive/folders/' + ST.inboxFolderId);
    await page.locator('[data-f="s-1-fileName"]').fill('sketch.jpg');
    await page.locator('[data-src="1"] [data-key="rights"][data-val="own"]').click();
    await page.locator('[data-action="sendidea"]').click();
    await expect(page.locator('.ferr')).toHaveText('Pick why'); // a variant needs a purpose
    expect(got).toHaveLength(0);
    await page.locator('[data-pick="purpose"][data-val="rebrand"]').click();
    await page.locator('[data-action="sendidea"]').click();
    await expect(page).toHaveURL(/#\/ideas$/);
    expect(got).toHaveLength(1);
    expect(got[0].meta.name).toMatch(/^idea-\d+\.json$/);
    expect(got[0].body).toMatchObject({
      kind: 'idea', accountId: 'acc-owner', name: 'Sample reel brief', brandIds: ['sb-north'], type: 'social',
      groupId: 'grp-dogs', playbookId: 'pb-grow', outcome: 'attract', kitId: 'kit-social', frameworkId: 'fw-hso', voiceId: 'vo-warm', lookId: 'look-wordmark',
      formatIds: ['fmt-reel', 'fmt-fb-feed'], language: 'en-GB', length: '30s', masterId: 'sa-rev1', purpose: 'rebrand',
      sources: [{ kind: 'link', url: 'https://www.youtube.com/watch?v=sample', rights: 'inspiration' }, { kind: 'upload', fileName: 'sketch.jpg', rights: 'own' }]
    });
  });

  test('Tools: Add tool writes one tool request with capabilities, fit, outputs and meter fields', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/tools');
    await expect(page.locator('[data-toolform]')).toHaveCount(0);
    await page.locator('[data-action="addtool"]').click();
    await page.locator('[data-action="sendtool"]').click();
    await expect(page.locator('[data-toolform] .ferr')).toHaveCount(2); // product, capability
    await page.locator('[data-f="t-product"]').fill('Sample reel tool');
    await page.locator('[data-tmulti="caps"][data-val="video-reformat"]').click();
    await page.locator('[data-tmulti="caps"][data-val="video-captions"]').click();
    await page.locator('[data-tpick="fit"][data-val="BANNED:client"]').click();
    await page.locator('[data-tmulti="outputs"][data-val="fmt-reel"]').click();
    await page.locator('[data-action="tmore"]').click();
    await page.locator('[data-f="t-allowance"]').fill('30');
    await page.locator('[data-f="t-unit"]').fill('min');
    await page.locator('[data-tpick="period"][data-val="month"]').click();
    await page.locator('[data-f="t-cost"]').fill('0.5');
    await page.locator('[data-f="t-audit"]').fill('https://example.com/audit');
    await page.locator('[data-action="sendtool"]').click();
    await expect(page.locator('[data-toolform]')).toHaveCount(0);
    expect(got).toHaveLength(1);
    expect(got[0].meta.name).toMatch(/^tool-\d+\.json$/);
    expect(got[0].meta.parents).toEqual([ST.requestsFolderId]);
    expect(got[0].body).toMatchObject({ kind: 'tool', accountId: 'acc-owner', product: 'Sample reel tool', capabilities: ['video-reformat', 'video-captions'], fit: 'BANNED:client',
      outputs: ['fmt-reel'], allowance: 30, unit: 'min', period: 'month', costPerUnit: 0.5, audit: 'https://example.com/audit' });
    expect(got[0].body.by).toMatch(/@/);
  });

  test('Tools: gaps list what no owned tool can do; capability and fit chips; a tool we do not own has no meter', async ({ page, guard }) => {
    await open(page, guard, '#/tools');
    await expect(page.locator('[data-gaps] .sect .cnt')).toHaveText('2');
    const g = page.locator('[data-gap="video-reformat|fmt-reel"]');
    await expect(g).toContainText('Resize video');
    await expect(g).toContainText('9:16');
    await expect(g.locator('a.cnt')).toHaveAttribute('href', '#/asset/sa-make');
    await expect(page.locator('[data-gap="video-reformat|fmt-youtube"]')).toContainText('16:9');
    await expect(page.locator('[data-tool="Sample image tool"] [data-cap="image-generate"]')).toBeVisible();
    await expect(page.locator('[data-tool="Sample writing tool"] [data-fit="HAND"]')).toBeVisible();
    const nope = page.locator('[data-tool="Sample video tool"]');
    await expect(nope.locator('[data-fit="NOT_OWNED"]')).toHaveText('Not owned');
    await expect(nope).not.toHaveAttribute('data-meter', /.*/);
    await expect(page.locator('#nKits')).toHaveText('1');
  });

  test('Me: Done on a Task writes done with creditsUsed (tool + units); Undo is offered', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/me');
    const r = page.locator('[data-sect="hand"] .crow[data-row="sa-hand"]');
    await r.locator('[data-panel="done"]').click();
    await expect(r.locator('[data-dtool="Sample video tool"]')).toHaveCount(0); // not owned
    await r.locator('[data-dtool="Sample image tool"]').click();
    await r.locator('#units-sa-hand').fill('3');
    await r.locator('[data-act="done"]').click();
    await expect(r.locator('[data-sent]')).toHaveText('✓ 10:10 · applies by 10:19');
    await expect(r.locator('[data-undo]')).toBeVisible();
    expect(got).toHaveLength(1);
    expect(got[0].meta.name).toMatch(/^done-\d+\.json$/);
    expect(got[0].body).toMatchObject({ kind: 'done', assetId: 'sa-hand', accountId: 'acc-owner', creditsUsed: { product: 'Sample image tool', units: 3 } });
  });

  test('Brands: ticking a set-up item writes one check request and shows at once', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/brands');
    const item = page.locator('[data-check="sb-north"][data-item="Email list"]');
    await expect(item).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-brandcard="sb-north"] .sect .cnt')).toHaveText('2/3');
    await item.click();
    await expect(item).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-brandcard="sb-north"] .sect .cnt')).toHaveText('3/3');
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].meta.name).toMatch(/^check-\d+\.json$/);
    expect(got[0].body).toMatchObject({ kind: 'check', accountId: 'acc-owner', brandId: 'sb-north', item: 'Email list', ok: true });
  });

  test('hardening: a javascript: link is made dead, and a double tap on Approve writes one file', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/review', { change: (s) => { s.assets.filter((a) => a.id === 'sa-rev1')[0].reviewLink = 'javascript:alert(1)'; } });
    const r = page.locator('.crow[data-row="sa-rev1"]');
    await expect(r.locator('a.lk[aria-label="Preview"]')).toHaveAttribute('href', '#');
    await r.locator('[data-act="approve"]').dblclick();
    await expect(r.locator('[data-sent]')).toBeVisible();
    expect(got).toHaveLength(1);
  });

  test('hardening: an engine last run over an hour ago turns the pill red; a failed refresh keeps the page', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource|ERR_FAILED|net::/);
    await open(page, guard, '#/me', { change: (s) => { s.health.lastRun = new Date(NOW.getTime() - 3 * 36e5).toISOString(); } });
    await expect(page.locator('#enginePill')).toHaveClass(/bad/);
    await page.route(/googleapis\.com\/drive\/v3\/files\?/, (route) => route.abort());
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#banner')).toContainText('Offline');
    await expect(page.locator('[data-sect="review"] .crow')).toHaveCount(2);
  });

  test('clients: Ask on a client item writes ask (sent by the owner account); Deliver on a client library item; owner items have neither; chips show', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/assets', { change: (s) => {
      const c = s.assets.filter((a) => a.id === 'sa-client')[0];
      c.delivery = null; c.ask = { question: 'Which cover photo?', at: s.generated_at, status: 'link ready (not sent)' };
      s.assets.push(Object.assign({}, c, { id: 'sa-client-done', title: 'Sample client video', type: 'video', stage: 8, ask: null, delivery: { status: 'ready (not sent)', at: s.generated_at, mode: 'file', link: 'https://drive.google.com/file/d/1SAMPLEout/view' } }));
    } });
    const r = page.locator('.crow[data-row="sa-client"]');
    await expect(r.locator('[data-chip="ask"]')).toContainText('Ask ready');
    await expect(page.locator('.crow[data-row="sa-rev1"] [data-panel="ask"]')).toHaveCount(0);
    await r.locator('[data-panel="ask"]').click();
    await r.locator('#askq-sa-client').fill('Which cover photo do you prefer?');
    await r.locator('#askq-sa-client').press('Enter');
    await expect(r.locator('[data-sent]')).toBeVisible();
    expect(got[0].body).toMatchObject({ kind: 'ask', assetId: 'sa-client', accountId: 'acc-owner', question: 'Which cover photo do you prefer?' });
    await go(page, 'library');
    const d = page.locator('.crow[data-row="sa-client-done"]');
    await expect(d.locator('[data-chip="delivery"]')).toContainText('Ready');
    await expect(d.locator('[data-chip="delivery"]')).toHaveAttribute('href', 'https://drive.google.com/file/d/1SAMPLEout/view');
    await d.locator('[data-act="deliver"]').click();
    await expect(d.locator('[data-sent]')).toBeVisible();
    expect(got[1].body).toMatchObject({ kind: 'deliver', assetId: 'sa-client-done', accountId: 'acc-owner' });
  });

  test('results: Add results on a library item checks channel and numbers, then writes one result request; the results chip shows totals', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/library', { change: (s) => { const l = s.assets.filter((a) => a.stage === 8)[0]; l.results = { views: 1200, clicks: 40, leads: 6, sales: 2, revenue: 90, last: '2026-10-27', channels: ['facebook'] }; } });
    const r = page.locator('#view .crow').first();
    await expect(r.locator('[data-chip="results"]')).toContainText('1200');
    await r.locator('[data-panel="result"]').click();
    await r.locator('.rform [type="submit"]').click();
    await expect(r.locator('.rform .ferr')).toHaveText('Pick a channel');
    await r.locator('[data-rch="facebook"]').click();
    await r.locator('[data-rf="views"]').fill('350');
    await r.locator('[data-rf="sales"]').fill('1');
    await r.locator('.rform [type="submit"]').click();
    await expect(r.locator('[data-sent]')).toBeVisible();
    expect(got).toHaveLength(1);
    expect(got[0].body).toMatchObject({ kind: 'result', accountId: 'acc-owner', channel: 'facebook', date: '2026-10-28', views: 350, sales: 1 });
    expect(got[0].body.clicks).toBeUndefined();
  });

  test('spec: an early item with no legal set shows Legal?; the Where panel sets destination and legal set (same company only) with one set request each', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/me', { change: (s) => {
      s.legalSets = [{ id: 'LS-N', name: 'North website', kind: 'brand website', entity: 'Sample Ltd', brandIds: ['sb-north'], status: 'live' },
        { id: 'LS-APP', name: 'Sample app', kind: 'app', entity: 'Sample Ltd', brandIds: [], status: 'live' },
        { id: 'LS-X', name: 'Other company', kind: 'brand website', entity: 'Other Ltd', brandIds: ['sb-other'], status: 'live' }];
      const g = s.assets.filter((a) => a.id === 'sa-gate')[0]; g.brandIds = ['sb-north']; g.legal = { entity: 'Sample Ltd', setId: null };
    } });
    const r = page.locator('[data-sect="gate"] .crow[data-row="sa-gate"]');
    await expect(r.locator('[data-chip="legal-missing"]')).toBeVisible();
    await r.locator('[data-panel="where"]').click();
    await expect(r.locator('[data-set="legalSetId"]')).toHaveCount(2);
    await r.locator('[data-set="destination"][data-val="funnel"]').click();
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].body).toMatchObject({ kind: 'set', assetId: 'sa-gate', destination: 'funnel' });
    await expect(r.locator('[data-chip="dest"]')).toContainText('Funnel');
    await r.locator('[data-panel="where"]').click();
    await r.locator('[data-set="legalSetId"][data-val="LS-APP"]').click();
    await expect.poll(() => got.length).toBe(2);
    expect(got[1].body).toMatchObject({ kind: 'set', assetId: 'sa-gate', legalSetId: 'LS-APP' });
    await expect(r.locator('[data-chip="legal"]')).toContainText('Sample app');
  });

  test('brand kit: swatches, fonts, Canva kit and Brand sheet links on the brand card; Canva preview label and thumbnail on an item', async ({ page, guard }) => {
    await page.route(/^https:\/\/drive\.google\.com\/thumbnail/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    await open(page, guard, '#/brands', { change: (s) => {
      const b = s.brands.filter((x) => x.id === 'sb-north')[0];
      b.kit = { colours: ['#A570D1', 'javascript:x', '#129FE7'], fontHeading: 'Lexend', fontBody: 'Inter', canvaKitUrl: 'https://www.canva.com/brand/sample', designRoute: 'Google templates + Canva by Claude' };
      b.sheetRowUrl = 'https://docs.google.com/spreadsheets/d/1SAMPLEbrands/edit#gid=1&range=A2';
      const a = s.assets.filter((x) => x.id === 'sa-rev1')[0]; a.reviewLink = 'https://www.canva.com/design/SAMPLE/view'; a.linkKind = 'canva'; a.thumbUrl = 'https://drive.google.com/thumbnail?id=1SAMPLEthumb0000000000000&sz=w400';
    } });
    const c = page.locator('[data-brandcard="sb-north"]');
    await expect(c.locator('.sw')).toHaveCount(2);
    await expect(c.locator('.kit')).toContainText('Lexend · Inter');
    await expect(c.locator('[data-kit="canva"]')).toHaveAttribute('href', 'https://www.canva.com/brand/sample');
    await expect(c.locator('[data-kit="sheet"]')).toHaveAttribute('href', /spreadsheets\/d\/1SAMPLEbrands/);
    await go(page, 'review');
    const r = page.locator('.crow[data-row="sa-rev1"]');
    await expect(r.locator('a.lk')).toHaveAttribute('title', 'Open in Canva');
    await r.locator('.ttl').click();
    await expect(r.locator('img.thumb')).toHaveAttribute('src', /thumbnail\?id=1SAMPLEthumb/);
  });

  test('books: a Large item shows part progress, Add part writes part with order; Assemble appears when every part is approved', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/line', { change: (s) => {
      const b = s.assets.filter((a) => a.id === 'sa-make')[0]; b.size = 'L'; b.stage = 5; b.parts = { total: 2, approved: 1, inProgress: 1, words: 9000, targetWords: 20000 };
      s.assets.push(Object.assign({}, b, { id: 'sa-ch1', title: 'Sample chapter 1', size: 'M', stage: 8, parentId: 'sa-make', order: 1, parts: null }));
    } });
    const r = page.locator('.crow[data-row="sa-make"]');
    await expect(r.locator('[data-chip="parts"]')).toContainText('1/2 · 9k/20k');
    await r.locator('[data-panel="part"]').click();
    await r.locator('#pname-sa-make').fill('Chapter 3: settling in');
    await r.locator('#pwords-sa-make').fill('4000');
    await r.locator('#pname-sa-make').press('Enter');
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].body).toMatchObject({ kind: 'part', parentId: 'sa-make', accountId: 'acc-owner', name: 'Chapter 3: settling in', order: 2, targetWords: 4000 });
    await expect(r.locator('[data-act="assemble"]')).toHaveCount(0);
  });

  test('feedback: stars and reasons go with Approve; suggestions on Decide accept with one suggestion request', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/decide', { change: (s) => { s.suggestions = [{ id: 'sg-1', kind: 'prompt', targetId: 'br-prompt-chapter', reason: 'length', proposal: 'Draft version 2 of the chapter prompt: shorter', at: s.generated_at }]; } });
    const r = page.locator('[data-sect="review"] .crow[data-row="sa-rev1"]');
    await r.locator('[data-panel="fb"]').click();
    await r.locator('[data-star="4"]').click();
    await r.locator('[data-reason="length"]').click();
    await r.locator('[data-act="approve"]').click();
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].body).toMatchObject({ kind: 'approve', assetId: 'sa-rev1', stars: 4, reasons: ['length'] });
    const g = page.locator('[data-suggest="sg-1"]');
    await expect(g).toContainText('Draft version 2 of the chapter prompt');
    await g.locator('[data-sug][data-val="accepted"]').click();
    await expect.poll(() => got.length).toBe(2);
    expect(got[1].body).toMatchObject({ kind: 'suggestion', id: 'sg-1', status: 'accepted', accountId: 'acc-owner' });
    await expect(page.locator('[data-suggest="sg-1"]')).toHaveCount(0);
  });

  test('Tools: Edit fills the form from the tool and Send writes one tool request for the same product', async ({ page, guard }) => {
    const got = await uploads(page, guard);
    await open(page, guard, '#/tools');
    const name = await page.locator('[data-edittool]').first().getAttribute('data-edittool');
    await page.locator('[data-edittool]').first().click();
    await expect(page.locator('[data-toolform] .grp')).toContainText('Edit ' + name.split('|')[0]);
    await expect(page.locator('[data-f="t-product"]')).toHaveValue(name.split('|')[0]);
    await page.locator('[data-action="sendtool"]').click();
    await expect.poll(() => got.length).toBe(1);
    expect(got[0].body).toMatchObject({ kind: 'tool', product: name.split('|')[0] });
  });

  test('search and sort everywhere: Decide and Do have the find bar; Tools, Kits and Brands have a search box; new sorts and Where/Series/Kit filters', async ({ page, guard }) => {
    await open(page, guard, '#/decide');
    await expect(page.locator('[data-bar="decide"] [data-f="fq"]')).toBeVisible();
    await page.locator('[data-bar="decide"] [data-f="fq"]').fill('checklist');
    await expect(page.locator('[data-sect="review"] .crow')).toHaveCount(1);
    await go(page, 'do');
    await expect(page.locator('[data-bar="do"]')).toBeVisible();
    await go(page, 'line');
    await page.locator('#sortBtn').click();
    await expect(page.locator('[data-frow="sort"] [data-val="due"]')).toBeVisible();
    await expect(page.locator('[data-frow="sort"] [data-val="priority"]')).toBeVisible();
    await go(page, 'tools');
    const before = await page.locator('[data-tool]').count();
    await page.locator('[data-lq="tools"]').fill('zzzz-nothing');
    await expect(page.locator('[data-tool]')).toHaveCount(0);
    await page.locator('[data-lq="tools"]').fill('');
    await expect(page.locator('[data-tool]')).toHaveCount(before);
    await page.locator('[data-tsort="reset"]').click();
    await expect(page.locator('[data-tsort="reset"]')).toHaveAttribute('aria-pressed', 'true');
    await go(page, 'brands');
    await page.locator('[data-lq="brands"]').fill('north');
    await expect(page.locator('[data-brandcard]')).toHaveCount(1);
    await go(page, 'kits/kits');
    await expect(page.locator('[data-lq="kits"]')).toBeVisible();
  });

  test('example data has groups, kits, styles, formats, a variant and a gap (fictional), and sends nothing', async ({ page, guard }) => {
    await open(page, guard, '#/kits', { state: false });
    await expect(page.locator('[data-playbook="ex-pb1"]')).toBeVisible();
    await page.locator('[data-kitnav="styles"]').click();
    await expect(page.locator('[data-style="framework"]')).toHaveCount(3);
    await go(page, 'tools');
    await expect(page.locator('[data-gap]')).toHaveCount(1);
    await page.locator('[data-action="addtool"]').click();
    await expect(page.locator('[data-action="sendtool"]')).toBeDisabled();
    await go(page, 'assets');
    await expect(page.locator('.crow[data-row="ex-9"] a[data-chip="master"]')).toHaveAttribute('href', '#/asset/ex-5');
    await go(page, 'brands');
    await expect(page.locator('[data-check="ex-a"]').first()).toBeDisabled();
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  /* ---------- Clear board look (28 Oct 2026): columns per stage, Board/List switch, Look menu ---------- */
  test('board: Line has a column per stage that scrolls inside itself; details open on the right; the page itself does not scroll', async ({ page, guard }) => {
    await open(page, guard, '#/line');
    await expect(page.locator('.bwrap[data-board="line"]')).toBeVisible(); // desktop starts on Board
    await expect(page.locator('[data-vmode="board"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.col[data-stage]')).toHaveCount(7);
    await expect(page.locator('.col[data-stage="5"] .col-head')).toContainText('Make');
    await expect(rows(page)).toHaveCount(6);
    for (const c of await page.locator('.col-list').all()) await expect(c).toHaveCSS('overflow-y', 'auto');
    // One even 1px border round each column; the stage colour is a short tab inside the head, clear of the corners.
    await expect(page.locator('.col[data-stage="5"]')).toHaveCSS('border-top-width', '1px');
    await expect(page.locator('.col[data-stage="5"]')).toHaveCSS('overflow', 'hidden');
    await expect(page.locator('.col[data-stage="5"] .col-head')).toHaveCSS('box-shadow', 'none');
    const tabBar = await page.locator('.col[data-stage="5"] .col-head').evaluate((e) => { const c = getComputedStyle(e, '::before'); return { h: c.height, l: c.left, r: c.right }; });
    expect(tabBar).toEqual({ h: '3px', l: '14px', r: '14px' });
    // One spacing step: 16px from the head line to the first card, 12px to the sides, between cards, between columns, and inside cards.
    const gaps = await page.evaluate(() => {
      const r = (e) => e.getBoundingClientRect(), cols = [...document.querySelectorAll('.col')], two = cols.find((c) => c.querySelectorAll('.col-list .crow').length >= 2) || null;
      const c = cols.find((x) => x.querySelector('.col-list .crow')), list = c.querySelector('.col-list'), card = list.querySelector('.crow'), head = c.querySelector('.col-head');
      const out = { top: Math.round(r(card).top - r(head).bottom), side: Math.round(r(card).left - r(list).left), right: Math.round(r(list).right - r(card).right),
        cols: Math.round(r(cols[1]).left - r(cols[0]).right), pad: getComputedStyle(card).padding };
      if (two) { const cs = two.querySelectorAll('.col-list .crow'); out.between = Math.round(r(cs[1]).top - r(cs[0]).bottom); }
      return out;
    });
    expect(gaps).toMatchObject({ top: 16, side: 12, right: 12, cols: 12, pad: '12px' });
    // An empty column is one short "Empty" line, not a tall blank; full columns keep the full height.
    const empty = page.locator('.col.empty').first(), full = page.locator('.col:not(.empty)').first();
    await expect(empty.locator('.col-list')).toHaveText('Empty');
    const eh = (await empty.boundingBox()).height, fh = (await full.boundingBox()).height;
    expect(eh).toBeLessThan(160);
    expect(fh).toBeGreaterThan(eh + 100);
    expect((await empty.boundingBox()).width).toBe(280);
    if (gaps.between !== undefined) expect(gaps.between).toBe(12);
    await expect(page.locator('.col[data-stage="1"] .col-foot')).toContainText('need you');
    await expect(page.locator('.col[data-stage="1"] .col-foot')).toContainText('AI');
    const h = await page.evaluate(() => ({ doc: document.documentElement.scrollHeight, screen: innerHeight }));
    expect(h.doc, 'the page should not scroll up and down on a desktop board').toBeLessThanOrEqual(h.screen + 1);
    const r = page.locator('.crow[data-row="sa-make"]');
    // Brand on its own small line above the title; the title is the title only.
    await expect(r.locator('.bline')).toHaveText('Sample Brand North');
    await expect(r.locator('.ttl')).toHaveText('Sample webclass slides');
    expect((await r.locator('.bline').boundingBox()).y).toBeLessThan((await r.locator('.ttl').boundingBox()).y);
    await r.locator('.ttl').click();
    await expect(page.locator('.side[data-side="sa-make"] .kv')).toContainText('Stage');
    // Details sit straight on the white panel: no grey box; rows split by a 1px line, none above the first.
    const box = await page.locator('.side .panel').evaluate((e) => { const c = getComputedStyle(e); return [c.backgroundColor, c.borderTopStyle]; });
    expect(box).toEqual(['rgba(0, 0, 0, 0)', 'none']);
    await expect(page.locator('.side .kv dt').first()).toHaveCSS('border-top-style', 'none');
    await expect(page.locator('.side .kv dt').nth(1)).toHaveCSS('border-top-width', '1px');
    await expect(r).toHaveClass(/\bsel\b/);
    await expect(r.locator('.panel')).toHaveCount(0); // not under the card on a desktop
    // Hover and selected never move or resize anything; stage names are ink (colour only in the ring and the top line).
    const other = page.locator('.crow[data-row="sa-gate"]');
    await other.scrollIntoViewIfNeeded();
    const box0 = await other.boundingBox();
    await other.hover();
    expect(await other.boundingBox()).toEqual(box0);
    await expect(other).toHaveCSS('outline-style', 'solid');
    const lab = await page.locator('.col[data-stage="5"] .col-head .lab').evaluate((e) => getComputedStyle(e).color);
    expect(lab).toBe(await page.evaluate(() => getComputedStyle(document.body).color));
    // Keyboard focus is an ink ring like hover, never the browser blue.
    await page.locator('[data-vmode="list"]').focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => { const e = document.activeElement, c = getComputedStyle(e); return { o: c.outlineColor, w: c.outlineWidth, ink: getComputedStyle(document.body).color }; });
    expect(ring.o).toBe(ring.ink);
    expect(ring.w).toBe('2px');
    await page.locator('.side [aria-label="Close details"]').click();
    await expect(page.locator('.side')).toHaveCount(0);
    // Bottom tabs: no ring; the colour bar above the label grows on the selected tab and on hover, and nothing moves.
    const cur = page.locator('nav.tabs a[data-nav="line"]'), me = page.locator('nav.tabs a[data-nav="me"]');
    await expect(cur).toHaveCSS('outline-style', 'none');
    await expect(cur).toHaveCSS('box-shadow', 'none');
    await expect(cur.locator('.bar')).toHaveCSS('width', '40px');
    await expect(me.locator('.bar')).toHaveCSS('width', '18px');
    const tb = await me.boundingBox();
    await me.hover();
    await expect(me.locator('.bar')).toHaveCSS('width', '40px');
    await expect(me).toHaveCSS('outline-style', 'none');
    expect(await me.boundingBox()).toEqual(tb);
    // Decide keeps its sections as columns.
    await go(page, 'decide');
    await expect(page.locator('.bwrap[data-board="decide"] .col[data-sect="gate"] .crow[data-row="sa-gate"]')).toBeVisible();
    await expect(page.locator('.col[data-sect="review"] .crow')).toHaveCount(2);
  });

  test('Board / List switch: kept per page across a reload; the phone starts on List', async ({ page, guard }) => {
    await open(page, guard, '#/line');
    await page.locator('[data-vmode="list"]').click();
    await expect(page.locator('.bwrap')).toHaveCount(0);
    await expect(page.locator('#view .card.appcard').first()).toBeVisible();
    await page.reload(); // still signed in (saved token)
    await expect(page.locator('#enginePill')).toBeVisible();
    await expect(page.locator('[data-vmode="list"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.bwrap')).toHaveCount(0);
    await go(page, 'decide');
    await expect(page.locator('.bwrap[data-board="decide"]')).toBeVisible(); // Decide kept its own (default) choice
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('st-view')))).toEqual({ line: 'list' });
    await page.evaluate(() => localStorage.removeItem('st-view'));
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, 'line');
    await expect(page.locator('[data-vmode="list"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.bwrap')).toHaveCount(0);
  });

  test('phone board: one column per screen, details open under the card (never on top), no sideways scroll in either view', async ({ page, guard }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, guard, '#/line');
    await noSidewaysScroll(page, 'line list');
    await page.locator('[data-vmode="board"]').click();
    await expect(page.locator('.bwrap[data-board="line"]')).toBeVisible();
    const w = await page.locator('.col').first().evaluate((e) => e.getBoundingClientRect().width);
    expect(w).toBeGreaterThan(300);
    await noSidewaysScroll(page, 'line board');
    const r = page.locator('.crow[data-row="sa-make"]');
    await r.locator('.ttl').click();
    await expect(r.locator('.panel .kv')).toContainText('Stage');
    await expect(page.locator('.side')).toHaveCount(0);
    await noSidewaysScroll(page, 'line board with details open');
    // Tab counts sit in the top-right corner of the tab, clear of the label; the selected bar is 26px on the phone.
    const tab = page.locator('nav.tabs a[data-nav="me"]'), tb = await tab.boundingBox(), nb = await tab.locator('.n').boundingBox(), lb = await tab.locator('span:not(.n):not(.bar)').boundingBox();
    expect(nb.x + nb.width).toBeLessThanOrEqual(tb.x + tb.width);
    expect(nb.y).toBeGreaterThanOrEqual(tb.y);
    const apart = nb.x >= lb.x + lb.width || nb.y + nb.height <= lb.y; // never on top of the label
    expect(apart, 'the count should not sit on the label').toBe(true);
    await expect(page.locator('nav.tabs a[data-nav="line"] .bar')).toHaveCSS('width', '26px');
    await go(page, 'decide');
    await noSidewaysScroll(page, 'decide list');
    await page.locator('[data-vmode="board"]').click();
    await expect(page.locator('.bwrap[data-board="decide"]')).toBeVisible();
    await noSidewaysScroll(page, 'decide board');
  });

  test('frame: dark top bar and a step-lighter bottom bar (never black); light tab buttons; every word on the frame reads clearly', async ({ page, guard }) => {
    await open(page, guard, '#/line');
    const bg = (sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(await bg('header')).toBe('rgb(58, 54, 50)'); // #3A3632
    expect(await bg('nav.tabs')).toBe('rgb(70, 65, 59)'); // #46413B
    expect(await bg('nav.tabs a')).toBe('rgb(255, 254, 251)'); // card
    const band = await page.locator('nav.tabs').boundingBox();
    expect(band.x).toBe(0);
    expect(band.width).toBe(page.viewportSize().width); // edge to edge on a desktop, like the top bar
    const gap = await page.evaluate(() => { const d = document.querySelector('.top h1 .dot').getBoundingClientRect(), a = document.querySelector('.top h1 a'), r = document.createRange(); r.selectNodeContents(a); const t = Array.from(r.getClientRects()).pop(); return Math.round(t.left - d.right); });
    expect(gap, 'dot to "Studio"').toBe(8);
    const worst = await page.evaluate(() => {
      const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const frame = rgb(getComputedStyle(document.querySelector('header')).backgroundColor);
      let min = 99, at = '';
      document.querySelectorAll('header .top > *, header .top > * *').forEach((e) => {
        if (!e.offsetParent || e.closest('#lookMenu') || !Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const r = ratio(rgb(getComputedStyle(e).color), frame); if (r < min) { min = r; at = e.textContent.trim().slice(0, 20); }
      });
      const ok = ratio(rgb(getComputedStyle(document.querySelector('#enginePill')).borderTopColor), frame);
      return { min, at, ok, cls: document.querySelector('#enginePill').className };
    });
    expect(worst.min, `"${worst.at}" on the frame`).toBeGreaterThanOrEqual(4.5);
    expect(worst.cls).toContain('ok');
    expect(worst.ok, 'the green On outline on the frame').toBeGreaterThanOrEqual(3);
    await page.locator('#lookBtn').click();
    await page.locator('#lookMenu [data-look="bg"][data-val="cool"]').click();
    expect(await bg('header')).toBe('rgb(51, 71, 91)'); // #33475B
    expect(await bg('nav.tabs')).toBe('rgb(64, 85, 105)'); // #405569
    await page.locator('#lookMenu [data-look="mode"][data-val="dark"]').click();
    expect(await bg('header')).toBe('rgb(36, 50, 63)'); // #24323F, still a frame in dark mode
  });

  test('find bar is one row: Search · Filter · Sort; the panel holds the groups; chips remove filters; focus and typing are kept', async ({ page, guard }) => {
    await open(page, guard, '#/assets');
    const bar = page.locator('#view .fbar > .srow');
    expect((await bar.boundingBox()).height, 'one row, no taller than 44px').toBeLessThanOrEqual(44);
    await expect(page.locator('#view [data-frow]')).toHaveCount(0); // no stacked filter rows
    await expect(page.locator('#view [data-f="fq"]')).toHaveAttribute('placeholder', 'Search');
    await expect(page.locator('#filtersBtn')).toContainText('Filter'); // words, so it never shows empty if the icons fail
    await expect(page.locator('#sortBtn')).toContainText('Sort');
    await openFilters(page);
    await expect(page.locator('#filtersBtn')).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => !!document.activeElement.closest('#fpanel')), 'focus moves into the panel').toBe(true);
    for (const k of ['grp', 'acct', 'brand', 'type']) await expect(page.locator(`#fpanel [data-frow="${k}"]`)).toBeVisible();
    await page.locator('#fpanel [data-fx="brand"][data-val="sb-north"]').click();
    await page.locator('#fpanel [data-fx="type"][data-val="pdf"]').click();
    await expect(page.locator('#filtersBtn .n')).toHaveText('2');
    await page.keyboard.press('Escape');
    await expect(page.locator('#fpanel')).toHaveCount(0);
    await expect(page.locator('#filtersBtn')).toBeFocused();
    const chip = page.locator('.achip[data-fxoff="brand"][data-val="sb-north"]');
    await expect(chip).toContainText('Brand: Sample Brand North');
    await chip.click();
    await expect(page.locator('.achip[data-fxoff="brand"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/brand=/);
    await page.locator('.achip[data-fxoff="type"]').click();
    await expect(rows(page)).toHaveCount(6);
    // Typing in Search: the page redraws on every letter but the box keeps its focus and text.
    await page.locator('#view [data-f="fq"]').click();
    await page.keyboard.type('webclass', { delay: 20 });
    await expect(page.locator('#view [data-f="fq"]')).toBeFocused();
    await expect(page.locator('#view [data-f="fq"]')).toHaveValue('webclass');
    await expect(rows(page)).toHaveCount(1);
    // Sort opens its own small panel; Done and a click outside close the Filter panel.
    await page.locator('#sortBtn').click();
    await page.locator('#sortpanel [data-fx="sort"][data-val="name"]').click();
    await expect(page.locator('#sortBtn')).toContainText('Sort: Name');
    await openFilters(page);
    await page.locator('#fpanel [data-action="fdone"]').click();
    await expect(page.locator('#fpanel')).toHaveCount(0);
    await openFilters(page);
    await page.locator('h1').click();
    await expect(page.locator('#fpanel')).toHaveCount(0);
    // Phone: the row wraps, the panel is a sheet above the bottom tabs, and nothing scrolls sideways.
    await page.setViewportSize({ width: 390, height: 844 });
    await noSidewaysScroll(page, 'find bar on the phone');
    await openFilters(page);
    await expect(page.locator('#fpanel')).toHaveCSS('position', 'fixed');
    const sheet = await page.locator('#fpanel').boundingBox(), tabs = await page.locator('nav.tabs').boundingBox();
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(tabs.y + 1);
    await noSidewaysScroll(page, 'Filter panel on the phone');
  });

  test('one line rule: every control type hovers with its 1px edge turning ink, and nothing moves', async ({ page, guard }) => {
    await open(page, guard, '#/line');
    await openFilters(page);
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    const kinds = { pill: '#fpanel [data-fx="brand"][data-val="sb-north"]', button: '.crow[data-row="sa-gate"] [data-act="gate"]', subnav: '.subnav a[data-sub="ideas"]', switch: '[data-vmode="list"]',
      card: '.crow[data-row="sa-make"]', icon: '.crow[data-row="sa-make"] [data-panel="flag"]', filter: '#sortBtn' };
    for (const [k, sel] of Object.entries(kinds)) {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      const b0 = await el.boundingBox();
      await el.hover();
      const st = await el.evaluate((e) => { const c = getComputedStyle(e); return { w: c.outlineWidth, o: c.outlineOffset, c: c.outlineColor, s: c.outlineStyle }; });
      expect(st, `${k} hover`).toEqual({ w: '1px', o: '-1px', c: ink, s: 'solid' });
      expect(await el.boundingBox(), `${k} must not move`).toEqual(b0);
      if (k === 'pill') await page.mouse.move(0, 400);
    }
    // Selected is the same line.
    const sel = await page.locator('.subnav a[aria-current="page"]').evaluate((e) => getComputedStyle(e).outlineWidth);
    expect(sel).toBe('1px');
  });

  test('numbers: every standalone count wears the same 1px ink ring; needs-you tab counts add a rose edge and tint; steps keep their stage circle', async ({ page, guard }) => {
    await open(page, guard, '#/line?brand=sb-north');
    await openFilters(page);
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    const look = (sel) => page.locator(sel).first().evaluate((e) => { const c = getComputedStyle(e); return { b: c.borderTopWidth + ' ' + c.borderTopStyle, bc: c.borderTopColor, bg: c.backgroundColor, w: c.fontWeight, r: c.borderTopLeftRadius, num: c.fontVariantNumeric }; });
    for (const [k, sel] of Object.entries({ column: '.col-head .cnt', subnav: '.subnav .cnt', chip: '#fpanel [data-fx] .cnt', filter: '#filtersBtn .n', tab: 'nav.tabs #nLine' })) {
      const l = await look(sel);
      expect(l, k).toMatchObject({ b: '1px solid', bc: ink, w: '600', num: 'tabular-nums' });
      expect(parseFloat(l.r), `${k} is a pill`).toBeGreaterThan(9);
    }
    const need = await look('nav.tabs #nMe');
    expect(need).toMatchObject({ b: '1px solid', bc: 'rgb(230, 68, 61)', bg: 'rgb(252, 228, 224)', w: '600' }); // rose edge (--ljr-2) and tint, never solid
    // Steps are words, not ringed numbers: the only ringed number in a column head is its count.
    await expect(page.locator('.col[data-stage="5"] .col-head .step')).toHaveText('Step 5:');
    await expect(page.locator('.col[data-stage="5"] .col-head .cnt')).toHaveAttribute('aria-label', /^\d+ items$/);
    await expect(page.locator('.col-head .num')).toHaveCount(0);
    await expect(page.locator('#fpanel [data-fx="st"]').first()).toContainText('Step ');
    await expect(page.locator('.col-foot b').first()).toHaveCSS('border-top-style', 'none'); // inside a sentence: bold text
  });

  test('no solid colour fills: asset-page steps are outlined (done ✓ green tint, current purple tint, future grey ring); small markers are tint + 1px ring', async ({ page, guard }) => {
    await open(page, guard, '#/asset/sa-make');
    const st = (sel) => page.locator(sel).first().evaluate((e) => { const c = getComputedStyle(e); return { bc: c.borderTopColor, bg: c.backgroundColor, color: c.color, w: c.borderTopWidth, text: e.textContent }; });
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    const done = await st('.stage.d .n'), cur = await st('.stage.c .n'), fut = await st('.stage:not(.d):not(.c) .n');
    expect(done).toMatchObject({ w: '1px', color: ink, text: '✓' });
    await expect(page.locator('.stage.c')).toContainText('Step 5:');
    await expect(page.locator('.hero .step')).toHaveText('Step 5:');
    expect(done.bg).not.toBe('rgba(0, 0, 0, 0)'); // light green tint
    expect(cur).toMatchObject({ w: '1px', color: ink });
    expect(fut).toMatchObject({ w: '1px', bg: 'rgba(0, 0, 0, 0)' });
    await expect(page.locator('.stage.c')).toHaveCSS('font-weight', '600');
    // Nothing small is a solid stage colour: every marker's fill is lighter than its own ring colour.
    const solid = await page.evaluate(() => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number), k = /^color\(/.test(c) ? 255 : 1; return (m[3] === 0) ? 999 : (m[0] + m[1] + m[2]) * k; };
      const bad = [];
      document.querySelectorAll('.stage .n, .disc, .strip i, .row .bar, .meter .bar, .meter .track i, .sw i').forEach((e) => {
        const c = getComputedStyle(e), ring = c.borderTopWidth !== '0px' ? c.borderTopColor : (c.boxShadow.match(/rgba?\([^)]*\)/) || ['rgb(0,0,0)'])[0];
        if (c.backgroundColor !== 'rgba(0, 0, 0, 0)' && ring && lum(c.backgroundColor) <= lum(ring)) bad.push(e.className + ' ' + c.backgroundColor + ' vs ' + ring);
      });
      return bad;
    });
    expect(solid).toEqual([]);
  });

  test('two pill sizes only (24px to read, 36px / 44px to press) and one 12px corner radius', async ({ page, guard }) => {
    await open(page, guard, '#/line');
    await openFilters(page);
    const h = (sel) => page.locator(sel).first().evaluate((e) => Math.round(e.getBoundingClientRect().height));
    for (const sel of ['.col-head .cnt', '.subnav .cnt', '.crow .tag', '#stamp', 'nav.tabs #nLine']) expect(await h(sel), sel).toBe(24);
    for (const sel of ['#newBtn', '#fpanel [data-fx]', '#filtersBtn', '#sortBtn', '.subnav a', '[data-vmode="list"]', '.crow .ico', '.crow .btn', '#enginePill']) expect(await h(sel), sel).toBe(36);
    // One corner radius (12px) on everything; circles only for status dots.
    const r = (sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
    for (const sel of ['.col', '.col-list .crow', '#fpanel', '#newBtn', '#fpanel [data-fx]', '.subnav a', 'nav.tabs a', '.col-head .cnt', '.fbar .sbox', '.crow .tag']) expect(await r(sel), sel).toBe('12px');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const sel of ['#moreBtn', '#filtersBtn', '.subnav a', '.crow .ico']) expect(await h(sel), sel + ' on the phone').toBe(44);
    expect(await h('nav.tabs #nLine'), 'tab count on the phone').toBe(24);
  });

  test('two font weights only (400 and 600) on every tab', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    for (const key of TABS.concat(['engine', 'asset/sa-make'], KIT_SUBS)) {
      await page.evaluate((h) => { location.hash = h; }, '#/' + key);
      await expect(page.locator('#view')).toHaveAttribute('data-view', key.split('/')[0]);
      const odd = await page.evaluate(() => {
        const bad = new Set();
        document.querySelectorAll('body *').forEach((e) => {
          if (!e.offsetParent || !Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
          const w = getComputedStyle(e).fontWeight; if (w !== '400' && w !== '600') bad.add(w + ' "' + e.textContent.trim().slice(0, 20) + '"');
        });
        return [...bad].slice(0, 5);
      });
      expect(odd, key).toEqual([]);
    }
  });

  test('Look menu: background, selected, words, text, spacing and mode change the page and survive a reload', async ({ page, guard }) => {
    await open(page, guard, '#/line');
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/look-cool/);
    const bg0 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg0).toBe('rgb(238, 232, 223)'); // Warm clear
    await page.locator('#lookBtn').click();
    await expect(page.locator('#lookMenu')).toBeVisible();
    for (const [k, v] of [['bg', 'cool'], ['sel', 'soft'], ['words', 'light'], ['text', 'lg'], ['space', 'roomy']]) await page.locator(`#lookMenu [data-look="${k}"][data-val="${v}"]`).click();
    await expect(page.locator('#lookMenu [data-look="bg"][data-val="cool"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(html).toHaveClass(/look-cool/);
    await expect(html).toHaveClass(/sel-soft/);
    await expect(html).toHaveClass(/words-light/);
    await expect(html).toHaveClass(/text-lg/);
    await expect(html).toHaveClass(/space-roomy/);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(242, 244, 246)'); // Cool clear
    await page.locator('#lookMenu [data-look="mode"][data-val="dark"]').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.locator('h1').click(); // a click outside closes it
    await expect(page.locator('#lookMenu')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dash-look')))).toEqual({ bg: 'cool', sel: 'soft', words: 'light', text: 'lg', space: 'roomy', mode: 'dark' });
    await page.reload();
    await expect(html).toHaveClass(/look-cool/);
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const d = await page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).reduce((t, x) => t + +x, 0));
    expect(d, 'Mode Dark gives a dark page').toBeLessThan(150);
    await page.locator('#lookBtn').click();
    await page.locator('#lookMenu [data-look="mode"][data-val="device"]').click();
    await expect(html).not.toHaveAttribute('data-theme', /./);
  });
});
