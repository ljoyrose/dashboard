// Every button, tile and link on every page and route: it has a label, and clicking it does something
// (goes somewhere, opens a tab, changes the page, or asks a question). No dead clicks, no missing pages, no errors.
// Uses the pretend Google and Drive only. External links are checked (https, new tab) but not opened.
const { test, expect } = require('../support/test');

const ROUTES = [
  ['./', ['#/map', '#/drives', '#/drives/shared', '#/drives/readfirst', '#/drives/shared/drv-alpha1', '#/drives/work', '#/drives/personal-drive', '#/drives/usb', '#/bin', '#/changes', '#/changes/24h', '#/changes/7d', '#/changes/totals'], '#signInBtn'],
  ['money/', ['#/now', '#/money', '#/dates', '#/todo', '#/accountant', '#/control', '#/e/TESTCO', '#/register/R001'], '#signInBtn'],
  ['cdhub/', ['#/map', '#/work', '#/shape', '#/today', '#/round', '#/dogs', '#/areas', '#/litters', '#/vet', '#/buyers'], '#signinbtn'],
];
// Not clicked here (each has its own test): signing out ends the session for the rest of the crawl.
const SKIP = '[data-action="signout"], [data-signout], #signOutBtn, [data-skip], .skip';

async function ready(page, base) {
  if (base === 'cdhub/') await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  else await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  await page.waitForTimeout(250);
}

// Tag every visible clickable thing in a fixed order so the same index means the same thing after a reload.
function tag(withChrome) {
  const sel = 'a[href], button, [data-action], [data-go], [role="button"], summary';
  const seen = [];
  document.querySelectorAll('[data-audit]').forEach((e) => e.removeAttribute('data-audit'));
  Array.from(document.querySelectorAll(sel)).forEach((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') return;
    if (el.closest('[hidden], .hidden')) return;
    // The header and menus are the same on every screen of a page: crawl them on the first screen only.
    if (!withChrome && el.closest('header, #nav, #next, nav')) return;
    el.setAttribute('data-audit', String(seen.length));
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    const item = { i: seen.length, tag: el.tagName.toLowerCase(), name, href: el.getAttribute('href'), target: el.getAttribute('target'), disabled: !!el.disabled };
    item.sig = [item.tag, item.name, item.href || '', el.getAttribute('data-action') || '', el.getAttribute('data-go') || '', el.getAttribute('data-list') || ''].join('|');
    item.k = seen.filter((x) => x.sig === item.sig).length; // which copy of the same thing
    seen.push(item);
  });
  return seen;
}

for (const [base, hashes, signBtn] of ROUTES) {
  for (const hash of hashes) {
    test(`${base}${hash}: every button, tile and link is labelled and does something`, async ({ page, context, guard }) => {
      test.setTimeout(240_000);
      guard.allowedConsole = guard.allowedConsole || [];
      // The Drive check opens the computer's folder picker; here it answers "not allowed" so the page shows its message.
      await page.addInitScript(() => { window.showDirectoryPicker = () => Promise.reject(Object.assign(new Error('test'), { name: 'NotAllowedError' })); });
      page.on('dialog', (d) => { page.__dialog = (page.__dialog || 0) + 1; d.dismiss().catch(() => {}); });
      await page.goto(base);
      await expect(page.locator(signBtn)).toBeEnabled();
      await page.locator(signBtn).click();
      await ready(page, base);
      const url = base + hash;
      await page.goto(url); await ready(page, base);
      const chrome = hash === hashes[0];
      const items = await page.evaluate(tag, chrome);
      const dead = [], unlabelled = [], badLinks = [];
      for (const it of items) {
        if (!it.name) unlabelled.push(`${it.tag} #${it.i} ${it.href || ''}`);
        if (it.tag === 'a' && it.href) {
          if (/^https?:/.test(it.href) && !it.href.startsWith('http://127.0.0.1')) {
            if (!/^https:\/\//.test(it.href)) badLinks.push(`${it.name}: not https (${it.href})`);
            if (it.target !== '_blank') badLinks.push(`${it.name}: outside link does not open a new tab (${it.href})`);
            continue;
          }
          if (/^(mailto|tel):/.test(it.href)) continue;
          const abs = new URL(it.href, page.url());
          if (abs.origin === new URL(page.url()).origin && it.href !== '#') {
            const res = await page.request.get(abs.origin + abs.pathname);
            if (res.status() !== 200) badLinks.push(`${it.name}: ${it.href} is ${res.status()}`);
          }
        }
      }
      for (const it of items) {
        if (it.disabled) continue;
        if (it.tag === 'a' && it.href && /^(https?:|mailto|tel)/.test(it.href) && !it.href.startsWith('http://127.0.0.1')) continue;
        // A fresh copy of the starting screen for each click (a click may have changed screen or opened a box).
        await page.goto('about:blank'); await page.goto(url); await ready(page, base);
        const now = await page.evaluate(tag, chrome);
        const same = now.find((x) => x.sig === it.sig && x.k === it.k); // the same thing, even if the screen drew in a different order
        if (!same) continue;
        const el = page.locator(`[data-audit="${same.i}"]`);
        if (!(await el.count()) || await el.evaluate((e, s) => !!e.closest(s), SKIP)) continue;
        if (!(await el.isVisible())) continue;
        const before = page.url();
        await page.evaluate(() => { window.__mut = 0; window.__obs && window.__obs.disconnect(); window.__obs = new MutationObserver((m) => { window.__mut += m.length; }); window.__obs.observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); });
        const dialogs = page.__dialog || 0;
        // A link that opens a new tab (target="_blank", like "Sample task ready now" -> Money Hub) MUST open one: wait for that
        // tab's own event for as long as it takes (with 4 workers it can take well over a second), never a guessed short window.
        const opensTab = await el.evaluate((e) => { const a = e.closest('a[href]'); return !!a && a.getAttribute('target') === '_blank'; });
        if (opensTab) {
          const [p] = await Promise.all([context.waitForEvent('page', { timeout: 15_000 }), el.click({ timeout: 3000 })]);
          await p.close();
          continue;
        }
        const popup = context.waitForEvent('page', { timeout: 700 }).catch(() => null);
        const nav = page.waitForEvent('framenavigated', { timeout: 700 }).catch(() => null);
        let failed = false;
        await el.click({ timeout: 3000 }).catch((e) => { failed = true; dead.push(`${it.tag} "${it.name}": could not be clicked (${String(e.message).split('\n')[0]})`); });
        if (failed) continue;
        const [p, n] = await Promise.all([popup, nav]);
        if (p) { await p.close(); continue; }
        const moved = page.url() !== before || !!n;
        const mut = moved ? 1 : await page.evaluate(() => window.__mut).catch(() => 1);
        if (!moved && !mut && (page.__dialog || 0) === dialogs) dead.push(`${it.tag} "${it.name}"${it.href ? ' (' + it.href + ')' : ''}: click does nothing`);
      }
      expect(unlabelled, 'no label').toEqual([]);
      expect(badLinks, 'links that go nowhere').toEqual([]);
      expect(dead, 'dead clicks').toEqual([]);
    });
  }
}

test('CD Hub Today: the temperature tile opens The round, where temperatures are entered @regression', async ({ page }) => {
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.goto('cdhub/#/today');
  const tile = page.locator('button.tile', { hasText: 'cabins with a temperature' });
  await expect(tile).toBeVisible();
  await tile.click();
  await expect(page).toHaveURL(/#\/round$/);
  await expect(page.locator('h2', { hasText: 'The round' })).toBeVisible();
  await expect(page.locator('.tmin').first()).toBeVisible();
});
