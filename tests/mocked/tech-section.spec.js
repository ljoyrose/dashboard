// Dashboard › More › Tech (TECH-HUB-1c/1d/1e): one tile per paid tool, read once per page load from the tools tab Studio already
// reads (config.js studio.ownedTools), with the Tech columns added. Pretend Google and Drive only; every row is the invented
// sample in tests/fixtures/tech-tools.js (Example Tool A..., EXAMPLE-ID-n). Set TECH_SHOTS=<folder> to save screenshots.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');
const FX = require('../fixtures/tech-tools');

const ROOT = path.resolve(__dirname, '..', '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), ctx);
const CONF = ctx.window.DASH_CONFIG;
const TAB = CONF.studio.ownedTools.tab;
const SHEETS = new RegExp('^https://sheets\\.googleapis\\.com/v4/spreadsheets/[^/]+/values/' + TAB);
const SHOTS = process.env.TECH_SHOTS;
const GROUP_ORDER = ['AI', 'Design and assets', 'Money and admin', 'Comms', 'Dev and hosting', 'Data and automation', 'Other'];

// Answer the tools tab read with these rows (or a status), and remember every call with whether it carried the sign-in token.
async function tab(page, values, status = 200) {
  const calls = [];
  await page.route(SHEETS, (route) => {
    const req = route.request();
    calls.push({ url: req.url(), auth: /^Bearer \S+/.test(req.headers().authorization || '') });
    return route.fulfill({ status, contentType: 'application/json', body: status === 200 ? JSON.stringify({ range: TAB, majorDimension: 'ROWS', values }) : '{"error":{"code":' + status + ',"status":"PERMISSION_DENIED"}}' });
  });
  return calls;
}
async function config(page, extra) {
  await page.route(/\/config\.js$/, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + '\n' + extra });
  });
}
async function open(page, how = 'menu') {
  await page.goto('./');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  if (how === 'menu') {
    await page.locator('#mainNav [data-house-more]').click();
    await page.locator('#houseMore a[href="#/tech"]').click();
  } else await page.evaluate(() => { location.hash = '#/tech'; });
  await expect(page.locator('#view')).toHaveAttribute('data-view', 'tech');
  const sec = page.locator('#techSec');
  await expect(sec).not.toHaveAttribute('data-tech', 'loading');
  return sec;
}
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
}
const tile = (sec, key) => sec.locator('.ttile[data-tool="' + key + '"]');

test.describe('Dashboard: Tech section', () => {
  test('signed out: Tech shows only the sign-in card and never reads the tab', async ({ page }) => {
    const calls = await tab(page, FX.values());
    await page.goto('./#/tech');
    await expect(page.locator('#view [data-action="signin"]').first()).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator('#techSec')).toHaveCount(0);
    expect(calls).toEqual([]);
  });

  test('the tab has only Studio columns: invented Example tiles with the Example stamp, and no review links', async ({ page }) => {
    const sec = await open(page); // the harness answers the tab with Studio's five columns
    await expect(sec).toHaveAttribute('data-tech', 'example');
    await expect(sec.locator('[data-example]')).toHaveText('Example');
    await expect(sec.locator('[data-tech-note="example"]')).toContainText('Example tiles');
    await expect(sec.locator('.ttile')).toHaveCount(6);
    await expect(sec.locator('.ttile h5').first()).toHaveText('Example Tool A');
    await expect(sec.locator('a[data-review]')).toHaveCount(0);
    await shot(page, 'tech-example-desktop');
  });

  test('reads the tab once, with the sign-in token; every row with a name and a plan draws one tile, grouped in the fixed order', async ({ page }) => {
    const calls = await tab(page, FX.values());
    const sec = await open(page);
    await expect(sec).toHaveAttribute('data-tech', 'live');
    expect(calls.length).toBe(1);
    expect(calls[0].auth).toBe(true);
    expect(decodeURIComponent(calls[0].url)).toContain('/values/' + TAB + '?');
    await expect(sec.locator('[data-example]')).toHaveCount(0);
    // A..I draw (I is a half row and fails closed); J (expired) and K (no plan) do not; the blank-name row is skipped.
    await expect(sec.locator('.ttile')).toHaveCount(9);
    await expect(sec.locator('[data-tech-note="hidden"]')).toHaveText('2 not shown: ended, or no plan.');
    await expect(sec.locator('[data-tech-note="skipped"]')).toHaveText('1 row skipped: no name.');
    await expect(sec.locator('.tgroup .tg-h')).toHaveText(GROUP_ORDER.map((g) => new RegExp('^' + g)));
    // Colour comes from the group: a 3px bar (--sc) and a dot, never a fill. Dev and hosting reads the one config value.
    await expect(tile(sec, 'example-c')).toHaveAttribute('style', /--sc:var\(--ljr-7\)/);
    await expect(tile(sec, 'example-e')).toHaveAttribute('style', new RegExp('--sc:var\\(--ljr-' + CONF.tech.devHostingSlot + '\\)'));
    await expect(tile(sec, 'example-h')).toHaveAttribute('data-group', 'other');
    const bg = await tile(sec, 'example-a').evaluate((el) => getComputedStyle(el).backgroundColor);
    const card = await page.evaluate(() => { const d = document.createElement('div'); d.style.background = 'var(--card)'; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
    expect(bg).toBe(card);
    // Within a group, sheet order (sort_order), then name.
    expect(await sec.locator('.tgroup[data-group="ai"] .ttile').evaluateAll((els) => els.map((e) => e.dataset.tool))).toEqual(['example-b', 'example-a']);
    await shot(page, 'tech-live-desktop');
  });

  test('a new sheet row is a new tile with no code change', async ({ page }) => {
    await tab(page, FX.values(Date.now(), [{ tool: 'Example Tool Z', tool_key: 'example-z', group: 'Comms', plan_or_tier: 'Tier 9', period: 'month', status: 'live', verified: 'VERIFIED', last_updated: FX.iso(Date.now(), -1) }]));
    const sec = await open(page, 'hash');
    await expect(tile(sec, 'example-z')).toContainText('Example Tool Z');
    await expect(sec.locator('.tgroup[data-group="comms"] .ttile')).toHaveCount(3);
  });

  test('common fields: logo or initials first, status ring, allowance, used, left, renewal or lifetime, unverified, stale, review link', async ({ page }) => {
    await tab(page, FX.values());
    const sec = await open(page, 'hash');
    const a = tile(sec, 'example-a');
    await expect(a.locator('.tt-head > :first-child')).toHaveAttribute('src', 'https://example.com/logo-a.png');
    await expect(tile(sec, 'example-b').locator('.tt-head > .bav')).toHaveText('EB');
    await expect(a.locator('.tt-stat')).toHaveText('Live');
    await expect(tile(sec, 'example-c').locator('.tt-stat')).toHaveText('Trial');
    await expect(a.locator('[data-num="allowance"] b')).toHaveText('100 credits');
    await expect(a.locator('[data-num="used"] b')).toHaveText('0 credits');
    await expect(a.locator('[data-num="left"] b')).toHaveText('100 credits');
    await expect(tile(sec, 'example-d').locator('[data-num="allowance"] b')).toHaveText('2,000 messages');
    await expect(tile(sec, 'example-d').locator('[data-num="left"] b')).toHaveText('500 messages');
    await expect(a.locator('[data-date="next"]')).toHaveText(/^Renews \d{1,2} \w{3} \d{4} · 18d$/);
    await expect(tile(sec, 'example-c').locator('[data-date="next"]')).toHaveText(/^Trial ends /);
    await expect(tile(sec, 'example-b').locator('[data-date="lifetime"]')).toHaveText('Lifetime');
    await expect(tile(sec, 'example-g').locator('[data-date="past"]')).toHaveText(/^Ended /);
    // Unknown figures say "unknown", never 0.
    await expect(tile(sec, 'example-b').locator('[data-nums="unknown"]')).toHaveText('Allowance unknown');
    await expect(tile(sec, 'example-e').locator('[data-date="unknown"]')).toHaveText('Renews unknown');
    // VERIFIED shows nothing extra; UNVERIFIED shows a quiet marker with the date it was checked; a stale row says so.
    await expect(a.locator('[data-verified="no"]')).toHaveCount(0);
    await expect(tile(sec, 'example-b').locator('[data-verified="no"]')).toHaveText(/^Unverified · checked \d/);
    await expect(tile(sec, 'example-d').locator('[data-stale]')).toHaveText(/^Not updated since \d/);
    // The one review file: https, new tab, the word Review; the id never shows as words.
    const rev = a.locator('a[data-review]');
    await expect(rev).toHaveText('Review');
    await expect(rev).toHaveAttribute('href', 'https://drive.google.com/file/d/EXAMPLE-ID-1/view');
    await expect(rev).toHaveAttribute('target', '_blank');
    await expect(rev).toHaveAttribute('rel', /noopener/);
    expect(await sec.innerText()).not.toMatch(/EXAMPLE-ID-\d/);
    // A half-filled row fails closed for that tile only, in plain words.
    await expect(tile(sec, 'example-i').locator('[data-tile-state="broken"]')).toHaveText('Row not complete: status.');
    await expect(tile(sec, 'example-i').locator('[data-nums], [data-review]')).toHaveCount(0);
  });

  test('flags: unused this month, needs review, duplicate reviews; AI-only lines only where the row has them', async ({ page }) => {
    await tab(page, FX.values());
    const sec = await open(page, 'hash');
    await expect(tile(sec, 'example-a').locator('[data-flag="unused"]')).toHaveText('Unused this month');
    await expect(sec.locator('[data-flag="unused"]')).toHaveCount(1); // D used some, G used it all, B has no cap
    await expect(tile(sec, 'example-b').locator('[data-flag="needs"]')).toHaveText('Needs review');
    await expect(tile(sec, 'example-c').locator('[data-flag="dup"]')).toHaveText('Duplicate reviews');
    await expect(sec.locator('[data-flag="needs"]')).toHaveCount(1);
    await expect(sec.locator('[data-flag="dup"]')).toHaveCount(1);
    await expect(tile(sec, 'example-a').locator('.tt-ai li')).toHaveText([/Paid allowance used this week\s*40%/, /Outputs in Drive\s*12/, /Outputs waiting review\s*3/, /Right-first-time builds\s*5/]);
    await expect(tile(sec, 'example-b').locator('.tt-ai')).toHaveCount(0);
    await expect(tile(sec, 'example-e').locator('.tt-ai')).toHaveCount(0); // a count with words in it is never drawn
  });

  test('find bar: search, group and flag filters, sort, and Clear', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.removeItem('dash-tech'); } catch (e) {} });
    await tab(page, FX.values());
    const sec = await open(page, 'hash');
    const q = sec.locator('#techQ');
    await q.fill('starter');
    await expect(sec.locator('.ttile')).toHaveCount(1);
    await expect(sec.locator('.ttile')).toHaveAttribute('data-tool', 'example-d');
    await expect(q).toBeFocused(); // typing never redraws the box
    await q.fill('');
    await expect(sec.locator('.ttile')).toHaveCount(9);
    const fbtn = sec.locator('[data-action="techfilter"]');
    if ((await fbtn.getAttribute('aria-expanded')) !== 'true') await fbtn.click();
    await sec.locator('[data-action="techchip"][data-k="group"][data-v="comms"]').click();
    await expect(sec.locator('.ttile')).toHaveCount(2);
    await expect(sec.locator('#techNF')).toHaveText('1');
    await sec.locator('[data-action="techchip"][data-k="group"][data-v="comms"]').click();
    await sec.locator('[data-action="techchip"][data-k="flag"][data-v="needs"]').click();
    await expect(sec.locator('.ttile')).toHaveCount(1);
    await expect(sec.locator('.ttile')).toHaveAttribute('data-tool', 'example-b');
    await sec.locator('[data-action="techchip"][data-k="flag"][data-v="needs"]').click();
    await sec.locator('[data-action="techchip"][data-k="sort"][data-v="name"]').click();
    expect(await sec.locator('.tgroup[data-group="ai"] .ttile').evaluateAll((els) => els.map((e) => e.dataset.tool))).toEqual(['example-a', 'example-b']);
    await q.fill('nothing like this');
    await expect(sec.locator('[data-tech-state="nomatch"]')).toHaveText('Nothing matches.');
    await sec.locator('#techList [data-action="techclear"]').click();
    await expect(sec.locator('.ttile')).toHaveCount(9);
    await expect(sec.locator('#techQ')).toHaveValue('');
  });

  test('read once per page load: other screens and the 5-minute refresh do not read it again; Refresh does', async ({ page }) => {
    const calls = await tab(page, FX.values());
    const sec = await open(page, 'hash');
    await expect(sec.locator('.ttile').first()).toBeVisible();
    await page.evaluate(() => { location.hash = '#/map'; });
    await page.evaluate(() => { location.hash = '#/tech'; });
    await expect(page.locator('#techSec .ttile').first()).toBeVisible();
    expect(calls.length).toBe(1);
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // Only the full load (sign-in, Refresh) clears the Tech read; the timed refresh keeps it. No timer reads the tab.
    expect(src).toMatch(/if \(!timed\) \{[^\n]*S\.tech = blank\(\)/);
    expect(src).not.toMatch(/setInterval\([^)]*loadTech/);
    await page.locator('#refreshBtn').click();
    await expect.poll(() => calls.length).toBe(2);
  });

  test('header changed: the section fails closed in plain words and the rest of the Dashboard still works', async ({ page }) => {
    const v = FX.values();
    v[0] = v[0].map((h) => (h === 'status' ? 'state' : h));
    await tab(page, v);
    const sec = await open(page, 'hash');
    await expect(sec).toHaveAttribute('data-tech', 'header');
    await expect(sec.locator('[data-tech-state="header"]')).toHaveText('The tools tab is missing columns: status. Nothing shown until they are back.');
    await expect(sec.locator('.ttile, .tbar')).toHaveCount(0);
    await page.locator('#mainNav a[href="#/map"]').click();
    await expect(page.locator('#hubTiles')).toBeVisible();
  });

  test('tab missing or no access: one plain line, no tiles, no error payload', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    await tab(page, null, 403);
    const sec = await open(page, 'hash');
    await expect(sec).toHaveAttribute('data-tech', 'err');
    await expect(sec.locator('[data-tech-state="err"]')).toHaveText('Could not read the tools tab: Access refused by Google.');
    await expect(sec.locator('.ttile')).toHaveCount(0);
    expect(await sec.innerText()).not.toMatch(/PERMISSION_DENIED|"error"/);
  });

  test('empty tab (header only): a plain empty state and Add tech still there', async ({ page }) => {
    await tab(page, [FX.HEADER]);
    const sec = await open(page, 'hash');
    await expect(sec.locator('[data-tech-state="empty"]')).toHaveText('No tools on the list yet. Add tech to start.');
    await expect(sec.locator('[data-action="techadd"]')).toBeVisible();
  });

  test('Add tech: checks the entry, says Not saved while it is switched off, and sends nothing', async ({ page }) => {
    await tab(page, FX.values());
    const uploads = [];
    await page.route(/googleapis\.com\/upload\/drive\/v3\/files/, (route) => { uploads.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"FAKE-UPLOAD-1"}' }); });
    const sec = await open(page, 'hash');
    await sec.locator('[data-action="techadd"]').click();
    const form = sec.locator('[data-techform]');
    await expect(form.locator('[data-tf="tool_name"]')).toBeFocused();
    await form.locator('[data-action="techsave"]').click();
    await expect(form.locator('[data-err="tool_name"]')).toHaveText('Name it.');
    await expect(form.locator('[data-err="group"]')).toHaveText('Pick a group.');
    await form.locator('[data-tf="tool_name"]').fill('Example Tool A');
    await form.locator('[data-action="techsave"]').click();
    await expect(form.locator('[data-err="tool_name"]')).toHaveText('Already on the list.');
    await form.locator('[data-tf="tool_name"]').fill('Example Tool Y');
    await form.locator('[data-action="techpick"][data-f="group"][data-v="Comms"]').click();
    await form.locator('[data-tf="plan_or_tier"]').fill('Tier 1');
    await form.locator('[data-action="techpick"][data-f="status"][data-v="live"]').click();
    await form.locator('[data-action="techpick"][data-f="period"][data-v="month"]').click();
    await form.locator('[data-action="techsave"]').click();
    await expect(form.locator('[data-tech-result="notsaved"]')).toHaveText('Not saved: Add tech is not switched on yet. Your entry is kept here.');
    await expect(form.locator('[data-tf="tool_name"]')).toHaveValue('Example Tool Y');
    expect(uploads).toEqual([]);
  });

  test('Add tech appends a row: one TECH-ROW-REQUEST_ file through the Drive write path, then Saved', async ({ page }) => {
    await config(page, "window.DASH_CONFIG.tech.requestsFolderId = 'FAKE_TECH_REQUESTS';");
    await tab(page, FX.values());
    const uploads = [];
    await page.route(/googleapis\.com\/upload\/drive\/v3\/files/, (route) => { uploads.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"FAKE-UPLOAD-1","name":"x"}' }); });
    const sec = await open(page, 'hash');
    await sec.locator('[data-action="techadd"]').click();
    const form = sec.locator('[data-techform]');
    await form.locator('[data-tf="tool_name"]').fill('Example Tool Y');
    await form.locator('[data-action="techpick"][data-f="group"][data-v="Dev and hosting"]').click();
    await form.locator('[data-tf="plan_or_tier"]').fill('Tier 1');
    await form.locator('[data-action="techpick"][data-f="status"][data-v="trial"]').click();
    await form.locator('[data-action="techpick"][data-f="period"][data-v="lifetime"]').click();
    await expect(form.locator('[data-tf="renewal_or_expiry"]')).toHaveCount(0); // lifetime: no date box
    await form.locator('[data-tf="allowance_amount"]').fill('1,000');
    await form.locator('[data-tf="allowance_unit"]').fill('credits');
    await form.locator('[data-action="techsave"]').click();
    // First press asks Google for Drive saving (the same grant the Bin uses); the second press saves.
    await expect(form.locator('[data-tech-result="notsaved"]')).toContainText('allow Drive saving');
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await form.locator('[data-action="techsave"]').click();
    await expect(form.locator('[data-tech-result="saved"]')).toHaveText('Saved. Example Tool Y shows as a tile once the engine adds the row; then press Refresh.');
    expect(uploads.length).toBe(1);
    expect(uploads[0]).toMatch(/"name":"TECH-ROW-REQUEST_\d{4}-\d{2}-\d{2}-\d{4}\.json"/);
    expect(uploads[0]).toContain('"parents":["FAKE_TECH_REQUESTS"]');
    const json = JSON.parse(uploads[0].split('\r\n\r\n')[2].split('\r\n--')[0]);
    expect(json).toMatchObject({ kind: 'tech-row', v: 1, row: { tool_key: 'example-tool-y', tool_name: 'Example Tool Y', group: 'Dev and hosting', plan_or_tier: 'Tier 1',
      status: 'trial', period: 'lifetime', renewal_or_expiry: 'lifetime', allowance_amount: '1000', allowance_unit: 'credits', verified: 'UNVERIFIED', review_count: '0' } });
  });

  test('Add tech: a failed Drive save says Not saved and keeps the entry', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    await config(page, "window.DASH_CONFIG.tech.requestsFolderId = 'FAKE_TECH_REQUESTS';");
    await tab(page, FX.values());
    await page.route(/googleapis\.com\/upload\/drive\/v3\/files/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
    const sec = await open(page, 'hash');
    await sec.locator('[data-action="techadd"]').click();
    const form = sec.locator('[data-techform]');
    await form.locator('[data-tf="tool_name"]').fill('Example Tool Y');
    await form.locator('[data-action="techpick"][data-f="group"][data-v="AI"]').click();
    await form.locator('[data-tf="plan_or_tier"]').fill('Tier 1');
    await form.locator('[data-action="techpick"][data-f="status"][data-v="live"]').click();
    await form.locator('[data-action="techpick"][data-f="period"][data-v="week"]').click();
    await form.locator('[data-action="techsave"]').click();
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await form.locator('[data-action="techsave"]').click();
    await expect(form.locator('[data-tech-result="notsaved"]')).toHaveText(/^Not saved: .+ Your entry is kept here\.$/);
    await expect(form.locator('[data-tf="tool_name"]')).toHaveValue('Example Tool Y');
  });

  test('a logo that will not load swaps to the initials', async ({ page, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource/);
    await page.route('https://example.com/logo-a.png', (route) => route.fulfill({ status: 404, body: '' }));
    await tab(page, FX.values());
    const sec = await open(page, 'hash');
    await expect(tile(sec, 'example-a').locator('.tt-head > .bav')).toHaveText('EA');
  });

  test('no hash traps: every link in the section goes somewhere real; icons grey at rest', async ({ page }) => {
    await tab(page, FX.values());
    const sec = await open(page, 'hash');
    const hrefs = await sec.locator('a').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h, 'link ' + h).toMatch(/^https:\/\//);
    const rest = await tile(sec, 'example-c').locator('.tt-date svg').evaluate((el) => getComputedStyle(el).color);
    const grey = await page.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--ljr-0-icon)'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    expect(rest).toBe(grey);
  });

  test('public repo: the page holds no tool data and no Tech id; fixtures are invented', () => {
    const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tech', 'core.js'), 'utf8');
    expect(page).toMatch(/CFG\.studio && CFG\.studio\.ownedTools/); // the id is read from config.js, never written in the page
    expect(page).not.toContain(CONF.studio.ownedTools.sheetId);
    const fx = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'tech-tools.js'), 'utf8');
    const names = [...fx.matchAll(/tool: '([^']*)'/g)].map((m) => m[1]).filter(Boolean);
    expect(names.length).toBeGreaterThan(5);
    for (const n of names) expect(n).toMatch(/^Example Tool [A-Z]$/);
    expect(fx).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // no emails
    expect(fx).not.toMatch(/(docs|drive)\.google\.com/);
    expect(fx).not.toMatch(/\b(?=[\w-]*\d)(?=[\w-]*[A-Z])(?=[\w-]*[a-z])[\w-]{25,}\b/); // nothing shaped like a real Drive id
    const ids = [...fx.matchAll(/review_file_id: '([^']*)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) expect(id).toMatch(/^EXAMPLE-ID-\d+$/);
    for (const m of fx.matchAll(/logo_url: '([^']*)'/g)) expect(m[1]).toMatch(/^https:\/\/example\.com\//);
  });
});
