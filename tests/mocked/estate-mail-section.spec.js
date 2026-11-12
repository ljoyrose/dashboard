// Web Estate "DNS & Email" section (#/mail, JOB 6.3). Pretend Google; every domain and address is invented
// (example.com, example.net, example.org, example.test). Read only: every request must be a GET.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');
const M = require('../../estate/mail.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const HEADER = F.HEADER.concat(['mx']);
const ROWS = [
  { key: 'example.com', kind: 'site', company: 'Sample Co', url_or_domain: 'https://example.com', live_status: 'live', ssl_expires: day(6) },
  { key: 'email-domain:example.com', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'example.com', spf: 'broken', dkim: 'found (google)', dmarc: 'reject', mx: 'Namecheap email forwarding' },
  { key: 'email-domain:example.net', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'example.net', spf: 'pass', dkim: 'missing (google)', dmarc: 'weak', mx: 'Google Workspace' },
  { key: 'email-domain:example.org', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'example.org', spf: 'two records', dkim: 'found (google)', dmarc: 'missing', mx: 'none' },
  { key: 'email-domain:example.test', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'example.test', spf: 'pass', dkim: 'found (s1)', dmarc: 'quarantine', mx: 'WebWave' },
  { key: 'email-domain:fine.example.org', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'fine.example.org', spf: 'pass', dkim: 'found (google)', dmarc: 'reject', mx: 'Google Workspace' },
  { key: 'email-domain:blank.example.net', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'blank.example.net' },
];
const MAP = [M.MAIL_MAP_COLUMNS,
  ['a@example.com', 'forward', 'Namecheap', 'b@example.test', 'bot'],
  ['b@example.test', 'forward', 'iCloud', 'c@example.test', 'bot'],
  ['c@example.test', 'mailbox', 'Gmail', '', 'bot'],
  ['x@example.com', 'forward', 'Namecheap', 'y@example.com', 'bot'],
  ['y@example.com', 'forward', 'Namecheap', 'x@example.com', 'bot'],
];
const step = (domain, cls, n) => [domain, cls].concat(Array.from({ length: 10 }, (_, i) => (i < n ? 'done' : 'todo')), ['', '', '']);
const SWITCH = [M.MAIL_SWITCH_COLUMNS, step('example.com', 'brand alias', 4), step('fine.example.org', 'brand alias', 9), step('example.test', 'keep own mail', 0)];

async function open(page, tabs, hash) {
  const seen = [];
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => {
    const url = decodeURIComponent(route.request().url());
    seen.push(route.request().method());
    if (!/\/values\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sheets: Object.keys(tabs).filter((t) => tabs[t]).map((title) => ({ properties: { title } })) }) });
    const tab = /\/values\/([^?]+)/.exec(url)[1];
    const v = tabs[tab];
    if (!v) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unable to parse range: ' + tab } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: v }) });
  });
  await page.goto('estate/' + (hash || '#/mail'));
  await page.locator('#view [data-action="signin"]').click();
  return seen;
}

test.describe('Web Estate DNS & Email', () => {
  test('ACCEPT: every invented domain shows, faults first, with checks, hops, step N of 10 and the Lisa-only fix', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const seen = await open(page, { Properties: F.values(HEADER, ROWS), 'Mail map': MAP, 'Mail switch': SWITCH });
    const cards = page.locator('[data-mail-domain]');
    await expect(cards).toHaveCount(6);
    await expect(page.locator('[data-mail-domain="example.com"] [data-hop="x@example.com"]')).toContainText('forward loop');
    const faults = await cards.evaluateAll((els) => els.map((e) => +e.getAttribute('data-faults')));
    const firstClear = faults.indexOf(0);
    expect(faults.slice(firstClear).every((n) => n === 0)).toBe(true);

    const com = page.locator('[data-mail-domain="example.com"]');
    await expect(com.locator('[data-check="cert"]')).toHaveAttribute('data-level', 'bad');
    await expect(com.locator('[data-check="spf"]')).toHaveAttribute('data-level', 'bad');
    await expect(com.locator('[data-hop="a@example.com"]')).toContainText('2 hops');
    await expect(com.locator('[data-switch]')).toContainText('step 5 of 10: Switch MX to Google');
    await expect(com.locator('[data-fix]')).toContainText('Lisa-only DNS change');

    const net = page.locator('[data-mail-domain="example.net"]');
    await expect(net.locator('[data-check="dkim"]')).toHaveAttribute('data-level', 'bad');
    await expect(net.locator('[data-check="dmarc"]')).toContainText('weak');
    await expect(net.locator('[data-switch]')).toContainText('not on the Mail switch tab');

    const org = page.locator('[data-mail-domain="example.org"]');
    await expect(org.locator('[data-check="spf"]')).toContainText('two records');
    await expect(org.locator('[data-check="mx"]')).toHaveAttribute('data-level', 'ok');
    await expect(page.locator('[data-mail-domain="example.test"] [data-check="mx"]')).toContainText('present · WebWave');
    await expect(page.locator('[data-mail-domain="example.test"] [data-switch]')).toContainText('keeps its own mail');
    await expect(page.locator('[data-mail-domain="fine.example.org"] [data-switch]')).toContainText('all steps done');
    await expect(page.locator('[data-mail-domain="blank.example.net"] [data-check="spf"]')).toContainText('not yet read');

    // 360px: no sideways scroll and nothing under 13px inside the view
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const small = await page.locator('#view').evaluate((v) => [...v.querySelectorAll('*')].filter((e) => e.offsetParent !== null && (e.textContent || '').trim() && parseFloat(getComputedStyle(e).fontSize) < 13).map((e) => e.tagName + ':' + getComputedStyle(e).fontSize));
    expect(small).toEqual([]);
    expect(seen.every((m) => m === 'GET')).toBe(true);
  });

  test('a domain opens on its own in the URL and the back button returns to the list', async ({ page }) => {
    await open(page, { Properties: F.values(HEADER, ROWS), 'Mail map': MAP, 'Mail switch': SWITCH });
    await page.locator('[data-mail-domain="example.net"] a.addr').click();
    await expect(page).toHaveURL(/#\/mail\?d=example\.net$/);
    await expect(page.locator('[data-mail-domain]')).toHaveCount(1);
    await page.goBack();
    await expect(page).toHaveURL(/#\/mail$/);
    await expect(page.locator('[data-mail-domain]')).toHaveCount(6);
  });

  test('ACCEPT: a renamed Mail map header fails closed and the page says so', async ({ page }) => {
    const bad = [M.MAIL_MAP_COLUMNS.map((c) => (c === 'next_hop' ? 'next hop' : c))].concat(MAP.slice(1));
    await open(page, { Properties: F.values(HEADER, ROWS), 'Mail map': bad, 'Mail switch': null });
    await expect(page.locator('[data-mail-tab="Mail map"]')).toHaveAttribute('data-state', 'bad-header');
    await expect(page.locator('[data-mail-tab="Mail map"]')).toContainText('missing next_hop');
    await expect(page.locator('[data-mail-tab="Mail switch"]')).toContainText('not set up yet');
    await expect(page.locator('[data-hop]')).toHaveCount(0);
    await expect(page.locator('[data-mail-domain="example.com"] [data-check="forward"]')).toContainText('Mail map not read');
  });
});
