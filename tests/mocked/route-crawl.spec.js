// Clicks every top-level page and the hash routes under it (SOP rows, tabs, chips, cards, menus).
// Each target must stay on this origin, answer, paint a heading, and not throw or hang.
// Invented rows only. The optional live host is not called.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');

const ROOT = path.resolve(__dirname, '..', '..');
const SHIPPED = ['index.html', 'toolkit.js', 'auth.js', 'config.js', 'sw.js', 'cdhub', 'money', 'studio', 'factory', 'food', 'marketplace', 'estate', 'enquiries', 'breed-better'];
const PAGES = [
  ['', 'h1, h2'],
  ['cdhub/', 'h1'],
  ['cdhub/checks/', 'h1'],
  ['cdhub/history.html', 'h1, h2'],
  ['cdhub/history-archive.html', 'h1, h2'],
  ['cdhub/meds-print.html', 'body'],
  ['cdhub/staff/', 'h1, #screen'],
  ['cdhub/staff/print/', 'h1'],
  ['cdhub/staff/guest/', 'h1, body'],
  ['cdhub/staff/inspect/', 'h1, body'],
  ['cdhub/staff/vault/', 'h1, body'],
  ['money/', 'h1'],
  ['studio/', 'h1'],
  ['factory/', 'h1'],
  ['food/', 'h1'],
  ['marketplace/', 'h1'],
  ['marketplace/privacy.html', 'h1'],
  ['estate/', 'h1'],
  ['enquiries/', 'h1'],
];
const RENDER_MS = 8000;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === 'tests' || name === 'docs') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(name)) out.push(p);
  }
}

test('shipped files do not point internal links at the old host or a /dashboard/ root', () => {
  const files = [];
  SHIPPED.forEach((rel) => {
    const p = path.join(ROOT, rel);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else files.push(p);
  });
  const bad = [];
  files.forEach((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    const staffOnly = text.split('https://ljoyrose.github.io/dashboard/cdhub/staff/').join('');
    if (staffOnly.includes('https://ljoyrose.github.io')) bad.push(rel + ' still links the old host');
    const hrefs = text.match(/(?:href|src)\s*=\s*["']\/dashboard\//g) || [];
    hrefs.forEach(() => bad.push(rel + ' has a root /dashboard/ link'));
  });
  expect(bad).toEqual([]);
});

test('an old-host SOP address stays on this site and opens that SOP @regression', async ({ page }) => {
  test.setTimeout(60_000);
  const crashes = [];
  page.on('crash', () => crashes.push('crashed'));
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  const origin = new URL(page.url()).origin;
  await page.evaluate(() => {
    const a = document.createElement('a');
    a.id = 'old-sop';
    a.textContent = 'Old SOP';
    a.href = 'https://ljoyrose.github.io/dashboard/cdhub/index.html#/sops/Accident%20Report';
    document.body.appendChild(a);
  });
  const rewritten = await page.evaluate(() => {
    const a = document.getElementById('old-sop');
    a.click();
    return { href: a.getAttribute('href'), hash: location.hash };
  });
  expect(rewritten.href).toBe('#/sops/Accident%20Report');
  expect(rewritten.hash).toBe('#/sops/Accident%20Report');
  await expect(page.locator('#main h2')).toHaveText('SOPs', { timeout: RENDER_MS });
  await expect(page.locator('[data-sop-open="Accident Report"]')).toHaveAttribute('aria-expanded', 'true');
  expect(new URL(page.url()).origin).toBe(origin);
  expect(page.url()).not.toContain('github.io');
  expect(page.url()).toContain('#/sops/Accident%20Report');
  expect(crashes).toEqual([]);
  const alive = await page.evaluate(() => ({ uses: document.querySelectorAll('use').length, rows: document.querySelectorAll('[data-sop]').length }));
  expect(alive.uses).toBeGreaterThan(0);
  expect(alive.uses).toBeLessThan(2000);
  expect(alive.rows).toBeGreaterThan(0);
});

test('every SOP detail, tab and chip renders on this origin', async ({ page }) => {
  test.setTimeout(180_000);
  const crashes = [];
  page.on('crash', () => crashes.push('crashed'));
  await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/csv', body: 'on_date\n' }));
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  const origin = new URL(page.url()).origin;
  const names = await page.evaluate(() => (SOP.rows || []).map((r) => r.short_name));
  expect(names.length).toBeGreaterThan(10);
  expect(names).toContain('Accident Report');

  async function openHash(hash) {
    const t0 = Date.now();
    await page.goto('cdhub/' + hash);
    await expect(page.locator('#main h2, #main h1').first()).toBeVisible({ timeout: RENDER_MS });
    expect(Date.now() - t0, hash).toBeLessThan(RENDER_MS);
    expect(new URL(page.url()).origin, hash).toBe(origin);
    expect(page.url(), hash).not.toContain('github.io');
    const alive = await page.evaluate(() => document.querySelectorAll('use').length);
    expect(alive, hash).toBeLessThan(2000);
  }

  for (const name of names) await openHash('#/sops/' + encodeURIComponent(name));
  for (const hash of ['#/map', '#/work', '#/today', '#/round', '#/dogs', '#/areas', '#/litters', '#/sops', '#/compliance', '#/yearly', '#/items']) {
    await openHash(hash);
  }

  await page.goto('cdhub/#/sops');
  await expect(page.locator('[data-sop-open]').first()).toBeVisible();
  const count = await page.locator('[data-sop-open]').count();
  for (let i = 0; i < count; i++) {
    const row = page.locator('[data-sop-open]').nth(i);
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(new URL(page.url()).origin).toBe(origin);
    await row.click();
  }
  const tabs = page.locator('#nav [data-go], #chips [data-go], #nav a[href], #chips a[href]');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible())) continue;
    const href = await tab.getAttribute('href');
    if (href && /^https?:/i.test(href)) continue;
    await tab.click();
    await expect(page.locator('h1:visible, h2:visible').first()).toBeVisible({ timeout: RENDER_MS });
    expect(new URL(page.url()).origin).toBe(origin);
  }
  expect(crashes).toEqual([]);
});

test('each top-level page loads, and its links stay on this origin or are https in a new tab', async ({ page }) => {
  test.setTimeout(180_000);
  const crashes = [];
  page.on('crash', () => crashes.push('crashed'));
  await page.route(/https:\/\/docs\.google\.com\/spreadsheets\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/csv', body: 'on_date\n' }));
  // A tap on Food or Marketplace signs in and reads a sheet. Answer it here so the crawl never calls out.
  await page.route(/https:\/\/sheets\.googleapis\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"values":[],"valueRanges":[]}' }));
  const bad = [];
  for (const [url, heading] of PAGES) {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded' });
    expect(res.status(), url).toBeLessThan(400);
    await expect(page.locator(heading).first(), url).toBeVisible({ timeout: RENDER_MS });
    const here = new URL(page.url());
    const links = await page.locator('a[href]').evaluateAll((as) => as.map((a) => ({
      href: a.getAttribute('href') || '',
      target: a.getAttribute('target') || '',
      text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    })));
    for (const link of links) {
      if (!link.href || link.href.startsWith('#') || /^(mailto|tel|sms):/i.test(link.href)) continue;
      let abs;
      try { abs = new URL(link.href, page.url()); } catch (e) { bad.push(url + ' bad href ' + link.href); continue; }
      if (abs.origin !== here.origin) {
        if (!/^https:$/.test(abs.protocol)) bad.push(url + ' leaves the site: ' + link.text + ' -> ' + link.href);
        if (/github\.io$/i.test(abs.hostname)) bad.push(url + ' old host ' + link.href);
        continue;
      }
      if (/github\.io/i.test(abs.hostname)) bad.push(url + ' old host ' + link.href);
      const got = await page.request.get(abs.origin + abs.pathname);
      if (got.status() >= 400) bad.push(url + ' ' + link.href + ' is ' + got.status());
    }
    const buttons = page.locator('button, [role="tab"], summary');
    const bn = await buttons.count();
    for (let i = 0; i < bn && i < 40; i++) {
      const b = buttons.nth(i);
      if (!(await b.isVisible().catch(() => false))) continue;
      const label = ((await b.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      if (/sign out/i.test(label)) continue;
      await b.click({ timeout: 3000 }).catch(() => {});
      if (page.url() && new URL(page.url()).origin !== here.origin) bad.push(url + ' button left the site: ' + label);
      if (!page.url().includes(url.split('#')[0].replace(/index\.html$/, '')) && !page.url().startsWith(here.origin)) bad.push(url + ' lost the page on ' + label);
    }
    if (!page.url().startsWith(here.origin) || new URL(page.url()).pathname !== here.pathname) await page.goto(url);
  }
  expect(bad).toEqual([]);
  expect(crashes).toEqual([]);
});

test('staff hash routes render', async ({ page, allowedConsole }) => {
  test.setTimeout(60_000);
  allowedConsole.push(/404/, /Failed to load resource/);
  const crashes = [];
  page.on('crash', () => crashes.push('crashed'));
  await page.goto('cdhub/staff/#home');
  const origin = new URL(page.url()).origin;
  for (const hash of ['#home', '#m/jobs', '#m/temperature', '#m/where', '#m/moves', '#scan', '#device']) {
    await page.goto('cdhub/staff/' + hash);
    await expect(page.locator('#screen, h1').first()).toBeVisible({ timeout: RENDER_MS });
    expect(new URL(page.url()).origin).toBe(origin);
    expect(page.url()).not.toContain('github.io');
    expect(page.url()).toContain(hash.split('/')[0] === '#m' ? '#m/' : hash);
  }
  await page.goto('cdhub/history.html#report');
  await expect(page.locator('h1, h2, #main').first()).toBeVisible({ timeout: RENDER_MS });
  expect(page.url()).not.toContain('github.io');
  expect(crashes).toEqual([]);
  expect(origin).toBeTruthy();
});
