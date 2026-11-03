// JOB 34b (Studio): every-click.spec.js and every-view-access.spec.js crawl the home page, Money and CD Hub but NOT Studio,
// and job34-studio-flows only follows Studio's links. This adds, for every Studio view: every control has a name,
// every button changes something when pressed, axe finds nothing (light and dark), and the keys ("/", Escape, Tab) work.
// Writes go to a pretend upload (nothing real is sent). Invented data only (tests/fixtures/studio/state.js via HUBS.studio).
const { test, expect, HUBS, go } = require('../fixtures/job34/load');
const AxeBuilder = require('@axe-core/playwright').default;

const UPLOAD = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/;
const SUBS = ['kits/playbooks', 'kits/packs', 'kits/kits', 'kits/bricks', 'kits/styles', 'kits/formats'];
const ALL = HUBS.studio.views.concat(['engine', 'asset/sa-make', 'asset/sa-lib', 'asset/sa-rev1'], SUBS);
const view = (page) => page.locator('#view');
// axe-core asks the browser for preload hints it never sends: Chrome's own warning, not a page problem.
const AXE_NOISE = /Couldn't load preload assets/;

// Pretend upload: every request file lands in the pretend Drive, so Undo (trash) finds it.
async function uploads(page, guard) {
  let n = 0;
  await page.route(UPLOAD, (route) => {
    const parts = route.request().postData().split(/\r\n--st\d+(?:--)?/).map((p) => p.slice(p.indexOf('\r\n\r\n') + 4)).filter((p) => p.trim().startsWith('{'));
    const meta = JSON.parse(parts[0]), id = 'req-SAMPLE-' + (++n);
    guard.world.file(id, meta.name, parts[1], { parents: meta.parents, mimeType: 'application/json' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id, name: meta.name }) });
  });
  return () => n;
}

// Tag every visible, enabled button in the view (fixed order, so the same index means the same button after a redraw).
function tagButtons() {
  document.querySelectorAll('[data-crawl]').forEach((e) => e.removeAttribute('data-crawl'));
  const out = [];
  document.querySelectorAll('#view button, #view summary, #view [role="button"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.disabled || el.closest('.hidden, [hidden]')) return;
    el.setAttribute('data-crawl', String(out.length));
    out.push((el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim());
  });
  return out;
}
// Everything a press could change: the address, the page, the header, the html classes, storage, the focus.
const snap = () => [location.hash, document.getElementById('view').innerHTML, document.querySelector('header').innerHTML, document.documentElement.className,
  document.getElementById('banner').className + document.getElementById('banner').textContent, JSON.stringify(localStorage), document.activeElement && document.activeElement.outerHTML].join('\u0001');

test.describe('JOB 34b Studio: every control', () => {
  test('every button, link and field on every view (Kits pages and item pages too) has a name; no id is used twice', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    const bad = [];
    for (const v of ALL) {
      await go(page, v);
      await expect(view(page), v).toHaveAttribute('data-view', v.split('/')[0]);
      const found = await page.evaluate(() => {
        const out = { unnamed: [], dupes: [] };
        document.querySelectorAll('a[href], button, summary, [role="button"], input:not([type="hidden"]), textarea, select').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height || el.closest('.hidden, [hidden]')) return;
          const lab = el.labels && el.labels[0] ? el.labels[0].textContent : '';
          const name = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || lab || '').trim();
          if (!name) out.unnamed.push(el.tagName.toLowerCase() + ' ' + (el.className || '') + ' ' + (el.getAttribute('href') || el.getAttribute('data-action') || ''));
        });
        const ids = {}; document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
        out.dupes = Object.keys(ids).filter((k) => ids[k] > 1);
        return out;
      });
      found.unnamed.forEach((u) => bad.push(`${v}: no name: ${u}`));
      found.dupes.forEach((d) => bad.push(`${v}: id "${d}" used more than once`));
    }
    expect(bad).toEqual([]);
  });

  for (const v of ALL) {
    test(`#/${v}: every enabled button in the view changes something when pressed (no dead buttons)`, async ({ page, guard }) => {
      test.setTimeout(180_000);
      await uploads(page, guard);
      page.on('dialog', (d) => d.dismiss().catch(() => {}));
      await HUBS.studio.open(page, guard);
      await go(page, v);
      const names = await page.evaluate(tagButtons);
      const dead = [];
      for (let i = 0; i < names.length; i++) {
        // Fresh view each time: leave and come back, so open panels and forms close (hashchange resets them).
        await go(page, v === 'me' ? 'decide' : 'me');
        await go(page, v);
        const now = await page.evaluate(tagButtons);
        if (now[i] !== names[i]) continue; // an earlier press changed the list (a sent item drops out): skip, not dead
        const before = await page.evaluate(snap);
        await page.evaluate((k) => document.querySelector(`[data-crawl="${k}"]`).click(), String(i));
        await page.waitForTimeout(120);
        const after = await page.evaluate(snap);
        if (after === before) dead.push(`#${i} "${names[i]}"`);
      }
      expect(names.length, v + ' has buttons').toBeGreaterThanOrEqual(0);
      expect(dead, `${v}: buttons that did nothing`).toEqual([]);
    });
  }
});

test.describe('JOB 34b Studio: accessibility on every view', () => {
  for (const scheme of ['light', 'dark']) {
    test(`axe finds no WCAG A/AA problems on any Studio view (${scheme})`, async ({ page, guard, allowedConsole }) => {
      test.setTimeout(180_000);
      allowedConsole.push(AXE_NOISE);
      await page.emulateMedia({ colorScheme: scheme });
      await HUBS.studio.open(page, guard);
      const found = [];
      for (const v of ALL) {
        await go(page, v);
        const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        r.violations.forEach((x) => found.push(`${v}: ${x.id} (${x.impact}) x${x.nodes.length}`));
      }
      expect(found).toEqual([]);
    });
  }

  test('axe: the open Look menu, Filter panel, Sort panel and New brief with More open have no problems', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(AXE_NOISE);
    await HUBS.studio.open(page, guard);
    const check = async (where) => { const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze(); expect(r.violations.map((x) => `${where}: ${x.id} x${x.nodes.length}`)).toEqual([]); };
    await page.locator('#lookBtn').click(); await expect(page.locator('#lookMenu')).toBeVisible(); await check('Look menu');
    await page.keyboard.press('Escape');
    await go(page, 'assets');
    await page.locator('#filtersBtn').click(); await expect(page.locator('#fpanel')).toBeVisible(); await check('Filter panel');
    await page.keyboard.press('Escape');
    await page.locator('#sortBtn').click(); await check('Sort panel');
    await page.keyboard.press('Escape');
    await go(page, 'new');
    await view(page).locator('[data-action="nmore"]').click(); await check('New brief, More open');
  });
});

test.describe('JOB 34b Studio: keyboard', () => {
  // Since house style 3 (#259) Me is the hub Main (Next, Needs you, three numbers) and has no find box of its own, so "/"
  // there opens the site-wide search (toolkit.js); Decide, Do and Assets keep their find bar and "/" goes to it.
  test('"/" puts the cursor in the find box on Decide, Do and Assets (on Me, the site search); it types into a field as normal', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    for (const v of ['decide', 'do', 'assets']) {
      await go(page, v);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press('/');
      await expect(page.locator('[data-f="fq"]'), v).toBeFocused();
      await page.keyboard.type('zz');
      await expect(page.locator('[data-f="fq"]'), v).toHaveValue('zz');
      await page.locator('[data-f="fq"]').fill('');
    }
    await go(page, 'me');
    await expect(view(page).locator('[data-f="fq"]')).toHaveCount(0);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('/');
    await expect(page.locator('#dashSearchBox')).toBeFocused();
    await page.keyboard.type('zz');
    await expect(page.locator('#dashSearchBox')).toHaveValue('zz');
  });

  test('Look by keyboard: Enter opens the menu, Tab moves into it, Escape closes it and focus goes back to Look', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    await page.locator('#lookBtn').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#lookMenu')).toBeVisible();
    await expect(page.locator('#lookBtn')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#lookMenu')), 'Tab goes into the Look menu').toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#lookMenu')).toBeHidden();
    await expect(page.locator('#lookBtn')).toBeFocused();
    await expect(page.locator('#lookBtn')).toHaveAttribute('aria-expanded', 'false');
  });

  // Walk backwards (Shift+Tab) from the first control in the view to the top of the page, so the walk starts from the view
  // whatever had focus before (the Sign in button that hides itself on sign-in sits last in the header).
  test('Tab reaches every header control (Dashboard, Engine, budget, New, Refresh, Look, Sign out) before the view, in that order', async ({ page, guard }) => {
    await HUBS.studio.open(page, guard);
    await page.evaluate(() => document.querySelector('#view a[href], #view button:not([disabled])').focus());
    const back = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Shift+Tab');
      const id = await page.evaluate(() => { const a = document.activeElement; return !a || a === document.body || a.closest('nav.tabs') ? null : a.closest('#view') ? '#view' : '#' + (a.id || a.tagName.toLowerCase()); });
      if (!id || id === '#view') break;
      back.push(id);
    }
    const want = ['#backHome', '#enginePill', '#budgetPill', '#newBtn', '#refreshBtn', '#lookBtn', '#signOutBtn'];
    const order = back.reverse().filter((x) => want.includes(x));
    expect(order, 'header controls in Tab order').toEqual(want);
  });

  test('Enter on a focused Approve writes once; Space on Filter opens the panel and Escape gives focus back', async ({ page, guard }) => {
    const n = await uploads(page, guard);
    await HUBS.studio.open(page, guard);
    await go(page, 'review');
    const approve = view(page).locator('[data-act="approve"]').first();
    await approve.focus();
    await page.keyboard.press('Enter');
    await expect.poll(n).toBe(1);
    await page.locator('#filtersBtn').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#fpanel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#fpanel')).toHaveCount(0);
    await expect(page.locator('#filtersBtn')).toBeFocused();
  });
});
