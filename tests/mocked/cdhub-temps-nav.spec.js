// Temperature pages share the hub's tab list (cdhub/hub-nav.js).
// Pretend Google and Drive only. The rows here are invented.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Menu option A (Lisa 14 Nov 2026): Main, the starting sections, then More with every other view in colour order.
const PRIMARY = [
  ['Main', './index.html#/map'],
  ['Compliance', './index.html#/compliance'],
  ['Ops', './index.html#/dogs'],
  ['People', './index.html#/staff'],
];
const MORE = [
  ['Today', './index.html#/today'],
  ['Do', './index.html#/work'],
  ['Litters', './index.html#/litters'],
  ['Areas', './index.html#/areas'],
  ['The round', './index.html#/round'],
  ['SOPs', './index.html#/sops'],
  ['Temps', './history.html'],
  ['Enquiries', './index.html#/enquiries'],
];

test('one list draws hub buttons and history links, with Temps and without Breed Better', () => {
  const nav = read('cdhub/hub-nav.js');
  for (const file of ['cdhub/index.html', 'cdhub/history.html', 'cdhub/history-archive.html']) {
    expect(read(file), file).toContain('src="hub-nav.js"');
    expect(read(file), file).toContain('HubNav.html(');
  }
  expect(read('cdhub/history.html')).toContain("HubNav.html({links:'href',current:'temps'})");
  expect(read('cdhub/history-archive.html')).toContain("HubNav.html({links:'href'})");
  const ctx = {
    DashKit: {
      icon: (name) => '<svg class="hi"><use href="#hi-' + name + '"/></svg>',
      tabs: {
        tab: (t) => (t.href
          ? '<a class="ht" href="' + t.href + '" data-nav="' + t.nav + '">'
          : '<button type="button" class="ht" data-go="' + t.go + '">') + t.label + (t.href ? '</a>' : '</button>'),
        more: (id, items) => '<div id="' + id + '">' + items + '</div>',
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(nav, ctx);
  expect(ctx.HubNav.VIEWS.temps.href).toBe('./history.html');
  const hub = ctx.HubNav.html({ counts: { map: 2 }, late: { map: true }, has: () => true });
  const hist = ctx.HubNav.html({ links: 'href', current: 'temps' });
  const arch = ctx.HubNav.html({ links: 'href' });
  expect(hub).toContain('data-go="map"');
  expect(hub).toContain('href="./history.html"');
  expect(hub).toContain('data-go="breed"');
  expect(hub).not.toContain('data-go="temps"');
  expect(hub).not.toMatch(/href="#i-/);
  for (const html of [hist, arch]) {
    expect(html).not.toContain('data-go=');
    expect(html).not.toContain('Breed Better');
    expect(html).not.toMatch(/href="#i-/);
    expect(html).toMatch(/href="#hi-/);
    for (const [label, href] of PRIMARY.concat(MORE)) expect(html, label).toContain('href="' + href + '"');
  }
  expect(hist).toMatch(/href="\.\/history\.html"[^>]*aria-current="page"/);
  expect(hist).toMatch(/data-section="ops"[^>]*aria-current="page"/);   // Temps sits in Ops
  expect(arch).not.toContain('aria-current');
});

async function bar(page, url, signedIn) {
  if (signedIn) {
    await page.addInitScript(() => localStorage.setItem('ljr-dash-auth', JSON.stringify({ access_token: 'FAKE-TEST-TOKEN', expires_at: Date.now() + 1800000, scope: 'https://www.googleapis.com/auth/drive.readonly' })));
    await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/csv', body: 'on_date\n' }));
  }
  await page.goto(url);
  const nav = page.locator('#nav.house-tabs');
  await expect(nav).toHaveAttribute('aria-label', 'Sections');
  await expect(nav.locator(':scope > a.ht .htl')).toHaveText(PRIMARY.map((p) => p[0]));
  const tabs = nav.locator(':scope > a.ht');
  await expect(tabs).toHaveCount(PRIMARY.length);
  for (let i = 0; i < PRIMARY.length; i++) {
    await expect(tabs.nth(i)).toHaveAttribute('href', PRIMARY[i][1]);
    await expect(tabs.nth(i)).not.toHaveAttribute('data-go', /.+/);
  }
  await expect(nav.locator('[data-go]')).toHaveCount(0);
  await nav.locator('[data-house-more]').click();
  const menu = nav.locator('#houseMore');
  await expect(menu.locator(':scope > a .htl')).toHaveText(MORE.map((m) => m[0]));
  const items = menu.locator(':scope > a');
  for (let i = 0; i < MORE.length; i++) await expect(items.nth(i)).toHaveAttribute('href', MORE[i][1]);
  const uses = await nav.locator('use').evaluateAll((els) => els.map((e) => e.getAttribute('href') || ''));
  expect(uses.length).toBeGreaterThan(0);
  expect(uses.every((h) => h.startsWith('#hi-'))).toBe(true);
  return nav;
}

test('history.html: the bar is links, Temps is the current page, and the bar stays clear of the page', async ({ page }) => {
  const nav = await bar(page, 'cdhub/history.html', true);
  await expect(nav.locator('#houseMore a[href="./history.html"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('header a.house-ib')).toHaveAttribute('href', './index.html');
  const pad = () => page.locator('.wrap').evaluate((e) => getComputedStyle(e).paddingBottom);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await pad()).toBe('140px');
  await page.setViewportSize({ width: 544, height: 800 });
  expect(await pad()).toBe('170px');
  await page.setViewportSize({ width: 545, height: 800 });
  expect(await pad()).toBe('140px');
});

test('history-archive.html: same links, Temps is not the current page, home returns to the hub', async ({ page }) => {
  const nav = await bar(page, 'cdhub/history-archive.html');
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(nav.locator('#houseMore a[href="./history.html"]')).not.toHaveAttribute('aria-current', 'page');
  await expect(page.locator('header a.house-ib')).toHaveAttribute('href', './index.html');
  await expect(page.locator('header a.house-ib')).toHaveAttribute('aria-label', 'CD Hub');
});

test('the hub More menu includes the same Temps link, and it opens the history page', async ({ page }) => {
  await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/csv', body: 'on_date\n' }));
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.locator('#nav [data-house-more]').click();
  const temps = page.locator('#houseMore a[href="./history.html"]');
  await expect(temps).toHaveText('Temps');
  await expect(temps).not.toHaveAttribute('data-go', /.+/);
  const uses = await page.locator('#houseMore use').evaluateAll((els) => els.map((e) => e.getAttribute('href') || ''));
  expect(uses.every((h) => h.startsWith('#hi-'))).toBe(true);
  await temps.click();
  await expect(page).toHaveURL(/\/history\.html$/);
  await expect(page.locator('#houseMore a[href="./history.html"]')).toHaveAttribute('aria-current', 'page');
});
