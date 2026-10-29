// CD Hub: https://ljoyrose.github.io/dashboard/cdhub/
const { test, expect, buildWorld } = require('../support/test');
const { IDS, WANT_BLD, FIX } = require('../support/world');
const fs = require('fs');
const path = require('path');

const SECTIONS = ['map', 'work', 'shape', 'today', 'round', 'dogs', 'areas', 'litters', 'vet', 'buyers'];
const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

test.describe('CD Hub: loads', () => {
  test('page loads with HTTP 200 and asks for sign-in; no tables shown yet', async ({ page }) => {
    const res = await page.goto('cdhub/');
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(/CD Hub/);
    await expect(page.locator('h1')).toHaveText('Cobberdog Hub');
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    await expect(page.locator('#livepill')).toHaveText('signed out');
    await expect(page.locator('#nav button')).toHaveCount(0);
  });

  test('holds no table data; only the shared sign-in is kept, one key in this browser', async ({ page, context }) => {
    await page.goto('cdhub/');
    await expect(page.locator('#main')).toContainText('No data of its own');
    await signIn(page);
    const stores = await page.evaluate(() => ({ local: Object.keys(localStorage), session: sessionStorage.length, key: window.DashAuth.KEY, saved: JSON.parse(localStorage.getItem(window.DashAuth.KEY)) }));
    expect(stores.local).toEqual([stores.key]);
    expect(stores.session).toBe(0);
    expect(Object.keys(stores.saved).sort()).toEqual(['access_token', 'expires_at', 'scope']); // no refresh token, no secret
    expect(await context.cookies()).toEqual([]);
    await page.locator('#nav button[data-signout]').click();
    expect(await page.evaluate(() => sessionStorage.length + localStorage.length)).toBe(0);
  });
});

test.describe('CD Hub: sign-in and reading the BLD tables (mocked)', () => {
  test('asks for read-only Drive access only', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    const cfg = await page.evaluate(() => window.__GIS_LAST_CONFIG);
    expect(cfg.scope).toBe('https://www.googleapis.com/auth/drive.readonly');
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  test('lists the BLD-app-tables folder and reads each sample BLD-*.csv', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    // folder listing used the right folder
    const listing = guard.world.calls.find((c) => c.path === '/files' && c.query.includes(IDS.bld));
    expect(listing, 'folder listing call').toBeTruthy();
    // every sample file that exists in the pretend folder was fetched exactly once
    const sampleCount = fs.readdirSync(path.join(FIX, 'bld')).filter((f) => f.endsWith('.csv')).length;
    const reads = guard.world.calls.filter((c) => /^\/files\/bld-\d+$/.test(c.path));
    expect(reads.length).toBe(sampleCount);
  });

  test('live pill shows live, read-only, and the number of tables', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#livepill')).toContainText(/^live · read-only · \d+ tables · read \d\d:\d\d/);
    expect(WANT_BLD.length).toBeGreaterThan(40);
  });

  test('the sample CSVs are parsed into the right things on the Dogs page', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="dogs"]').click();
    const main = page.locator('#main');
    await expect(main).toContainText('Test Dog One');
    await expect(main).toContainText('Test Dog Two');
    await expect(main).toContainText('Test Pup One');
    await expect(main).toContainText('3 of 3');
  });

  test('joined tables work: cabins show their dogs, litters show dam and sire, weighings are counted @regression', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="round"]').click();
    await expect(page.locator('#main')).toContainText('Test Cabin A');
    await expect(page.locator('#main')).toContainText('Test Dog One');
    await page.locator('#nav button[data-go="litters"]').click();
    await expect(page.locator('#main')).toContainText('Test Dog One'); // dam
    await expect(page.locator('#main')).toContainText('Test Dog Two'); // sire
    await page.locator('#nav button[data-go="vet"]').click();
    await expect(page.locator('#main')).toContainText('3'); // three sample weighings
  });

  test('the Outstanding page reads BLD-WORK.csv', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="work"]').click();
    await expect(page.locator('#main')).toContainText('Sample item waiting on Lisa');
    await expect(page.locator('#main')).toContainText('Sample finished item');
  });

  test('tables missing from the folder are reported, not hidden', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#main')).toContainText(/\d+ file\(s\) not in the folder/);
  });
});

test.describe('CD Hub: navigation', () => {
  for (const id of SECTIONS) {
    test(`section button "${id}" opens that section`, async ({ page }) => {
      await page.goto('cdhub/');
      await signIn(page);
      await page.locator(`#nav button[data-go="${id}"]`).click();
      await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#main')).not.toBeEmpty();
      await expect(page.locator('#main')).not.toContainText('Sign in to see the tables');
    });
  }

  test('all ten sections plus Reread and Sign out are in the menu', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#nav button[data-go]')).toHaveCount(10);
    await expect(page.locator('#nav button[data-reload]')).toHaveCount(1);
    await expect(page.locator('#nav button[data-signout]')).toHaveCount(1);
  });

  test('the "Next:" buttons at the bottom lead to other sections', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="today"]').click();
    const next = page.locator('#next button[data-go]').first();
    const target = await next.getAttribute('data-go');
    await next.click();
    await expect(page.locator(`#nav button[data-go="${target}"]`)).toHaveAttribute('aria-current', 'page');
  });

  test('Reread reads the folder again', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    const before = guard.world.calls.filter((c) => c.path === '/files' && c.query.includes(IDS.bld)).length;
    await page.locator('#nav button[data-reload]').click();
    await expect(page.locator('#livepill')).toContainText('live');
    await expect.poll(() => guard.world.calls.filter((c) => c.path === '/files' && c.query.includes(IDS.bld)).length).toBe(before + 1);
  });

  test('Sign out forgets everything and shows the sign-in card again', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-signout]').click();
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    await expect(page.locator('#livepill')).toHaveText('signed out');
    await expect(page.locator('#main')).not.toContainText('Test Dog One');
    expect(await page.evaluate(() => window.__GIS_CALLS.revoke)).toBe(1);
  });

  test('saving is switched off and says so', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('#nav button[data-go="round"]').click();
    await expect(page.locator('#main')).toContainText('Saving off');
  });
});

test.describe('CD Hub: things that go wrong', () => {
  test('two files with the same title: refuses to guess which is current', async ({ page, guard }) => {
    const w = buildWorld({ bld: { duplicate: ['BLD-subject.csv'] } });
    guard.world.files = w.files; guard.world.drives = w.drives;
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('More than one file shares a title');
    await expect(page.locator('#main')).toContainText('BLD-subject.csv');
    await expect(page.locator('#livepill')).toHaveText('duplicate file titles');
  });

  test('Drive refuses the folder (403): shows an error card, not a blank page', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('The folder could not be read');
    await expect(page.locator('#main')).toContainText('Google refused access');
    await expect(page.locator('#livepill')).toHaveText('read failed');
  });

  test('folder not found (404) says the folder cannot be seen by this account', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 404/);
    guard.world.failWith = { status: 404, reason: 'notFound', message: 'Not found' };
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText('Folder not found, or this account cannot see it');
  });

  test.describe('Drive permission not granted', () => {
    test.use({ gisMode: 'denied-scope' });
    test('explains the tables cannot be read', async ({ page }) => {
      await page.goto('cdhub/');
      await page.locator('#signinbtn').click();
      await expect(page.locator('#main')).toContainText('Drive read access was not granted');
    });
  });
  test.describe('Sign-in window closed', () => {
    test.use({ gisMode: 'popup-closed' });
    test('explains the window was closed', async ({ page }) => {
      await page.goto('cdhub/');
      await page.locator('#signinbtn').click();
      await expect(page.locator('#main')).toContainText('The sign-in window was closed before it finished');
    });
  });
  test.describe('Sign-in window blocked', () => {
    test.use({ gisMode: 'popup-blocked' });
    test('tells the person to allow pop-ups', async ({ page }) => {
      await page.goto('cdhub/');
      await page.locator('#signinbtn').click();
      await expect(page.locator('#main')).toContainText('Allow pop-ups');
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// House look (Master design rules, LINKS-COMFORT-BRIEF v3, 28 Oct 2026) and the Bloodline screens, by computed style.
// Invented data only: the sample BLD tables, plus rows added inside a test (invented names, no real dogs or buyers).
// ---------------------------------------------------------------------------------------------------------------
const LOOK_TABS = ['map', 'work', 'shape', 'today', 'round', 'dogs', 'areas', 'litters', 'vet', 'buyers'];
const iso = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const MATINGS = () => 'id,dam_subject_id,sire_subject_id,mated_on,mating_no,method,is_first_of_season,due_from_this_mating,litter_id,produced_litter,notes\n'
  + `mat-x1,sub-test-dog-1,sub-test-dog-2,${iso(-66)},1,natural,yes,,,,invented\nmat-x2,sub-test-pup-1,sub-test-dog-2,${iso(-58)},1,natural,yes,,,,invented\n`;
const openTab = async (page, id) => {
  await page.locator(`#nav button[data-go="${id}"]`).click();
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};
// Walks every visible element and returns plain-English problems, one list per rule.
function cdAudit() {
  const rgb = (s) => { let m = /^rgba?\(([^)]+)\)/.exec(s); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; }
    m = /^color\(srgb ([^)]+)\)/.exec(s); if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] === undefined ? 1 : p[3]]; } return null; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { for (let a = el; a; a = a.parentElement) { const c = rgb(getComputedStyle(a).backgroundColor); if (c && c[3] > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 24) + '"';
  const seen = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); if (r.width <= 1 || r.height <= 1 || s.visibility !== 'visible' || s.display === 'none') return false; for (let a = el; a && a !== document.body; a = a.parentElement) { const ar = a.getBoundingClientRect(); if (ar.width <= 1 || ar.height <= 1) return false; } return true; };
  const ROUND = '.dot, .mk, .whor, .sexdot, .ic, .sw, .nose';
  const out = { small: [], weight: [], upper: [], colour: [], radius: [], line: [], text: [], ring: [] };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || /^(SCRIPT|STYLE|OPTION)$/.test(el.tagName) || el.closest('#dashSearch') || !seen(el)) continue;
    const s = getComputedStyle(el), own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      if (parseFloat(s.fontSize) < 13) out.small.push(name(el) + ' ' + s.fontSize);
      if (!['400', '600'].includes(s.fontWeight)) out.weight.push(name(el) + ' ' + s.fontWeight);
      if (s.textTransform === 'uppercase') out.upper.push(name(el));
      const c = rgb(s.color); if (c && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) > 40) out.colour.push(name(el) + ' ' + s.color);
      if (!el.disabled && !el.closest('[disabled]')) { const r = ratio(c, bgOf(el)); if (r < 4.5) out.text.push(name(el) + ' ' + r.toFixed(2)); }
    }
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(s['border' + k + 'Width']) || 0);
    if (Math.max(...bw) > 1) out.line.push(name(el) + ' ' + bw.join('/'));
    const rad = s.borderTopLeftRadius;
    const okRad = rad === '0px' || rad === '12px' || (rad === '11px' && el.matches('.cnt')) || (rad === '50%' && el.matches(ROUND)) || (rad === '12px' && el.matches('nav#nav .bar'));
    if (!okRad) out.radius.push(name(el) + ' ' + rad);
    // Rings on things you press or read as a pill: 3:1 against what they sit on.
    if (el.matches('#main button:not([disabled]), #main select, .btn, .pill, .dpill, .cnt, .achip, .sfb') && bw[0] === 1 && s.borderTopStyle !== 'none') {
      const r = ratio(rgb(s.borderTopColor), bgOf(el.parentElement)); if (r < 3) out.ring.push(name(el) + ' ' + r.toFixed(2));
    }
  }
  return out;
}

test.describe('CD Hub house look', () => {
  for (const look of ['warm', 'cool']) for (const scheme of ['light', 'dark']) {
    test(`${look} ${scheme}: every tab: nothing under 13px, weights 400/600, one 12px radius, 1px lines, no uppercase, no coloured words, text 4.5:1, rings 3:1`, async ({ page, guard }) => {
      test.setTimeout(90_000);
      setFile(guard.world, 'BLD-mating.csv', MATINGS());   // late and soon date pills on screen too
      await page.addInitScript((bg) => localStorage.setItem('dash-look', JSON.stringify({ bg })), look);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('cdhub/');
      await signIn(page);
      await expect(page.locator('html')).toHaveClass(look === 'cool' ? /look-cool/ : /^(?!.*look-cool)/);
      for (const tab of LOOK_TABS) {
        await openTab(page, tab);
        if (tab === 'dogs') await page.locator('[data-fpanel="fp-dogs"]').click(); // the open Filter panel is checked too
        const a = await page.evaluate(cdAudit);
        for (const k of Object.keys(a)) expect(a[k], `${look} ${scheme} #/${tab}: ${k}`).toEqual([]);
      }
    });
  }

  test('reads Studio\'s saved look (dash-look) and never writes it; Cool clear turns the page and the frame cool, never black', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    const frame = () => page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('header')).backgroundColor, getComputedStyle(document.querySelector('#nav')).backgroundColor]);
    const warm = await frame();
    await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(58, 54, 50)');   // warm #3A3632
    await page.evaluate(() => localStorage.setItem('dash-look', JSON.stringify({ bg: 'cool' })));
    await page.reload();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/look-cool/);
    const cool = await frame();
    const blue = (s) => { const v = s.match(/[\d.]+/g).map(Number); return v[2] - v[0]; };
    for (const c of warm) expect(blue(c), 'warm ' + c).toBeLessThan(0);
    for (const c of cool) expect(blue(c), 'cool ' + c).toBeGreaterThan(0);
    await expect(page.locator('header')).toHaveCSS('background-color', 'rgb(51, 71, 91)');   // slate #33475B
    expect(await page.evaluate(() => localStorage.getItem('dash-look'))).toBe(JSON.stringify({ bg: 'cool' }));   // untouched
    await page.evaluate(() => localStorage.setItem('dash-look', JSON.stringify({ mode: 'dark' })));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('controls: every one rests on the same clear 1px line (never ink, 3:1), 12px corners, 14px/600, 36px tall; hover = 1px ink line inside plus a pale fill, nothing moves', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('cdhub/');
    await signIn(page);
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    const lines = new Set();
    for (const tab of ['map', 'today', 'round', 'dogs', 'litters', 'areas']) {
      await openTab(page, tab);
      const ctls = page.locator('#main button:visible:not(.tile), #main select:visible, #next button:visible');
      const n = await ctls.count();
      expect(n, tab).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const el = ctls.nth(i);
        const st = await el.evaluate((e) => { const s = getComputedStyle(e); return { w: s.borderTopWidth, c: s.borderTopColor, r: s.borderTopLeftRadius, fs: s.fontSize, fw: s.fontWeight, h: e.getBoundingClientRect().height, bg: s.backgroundColor, sel: e.getAttribute('aria-pressed') === 'true' }; });
        expect(st.w).toBe('1px'); expect(st.r).toBe('12px'); expect(st.c).not.toBe(ink); expect(st.h).toBeGreaterThanOrEqual(36);
        expect(st.fs).toBe('14px'); expect(st.fw).toBe('600');
        lines.add(st.c);
        if (st.sel) continue;
        const where = () => el.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height]; });   // page position, so a scroll is not a move
        const before = await where();
        await el.hover();
        const hv = await el.evaluate((e) => { const s = getComputedStyle(e); return { ow: s.outlineWidth, os: s.outlineStyle, oo: s.outlineOffset, oc: s.outlineColor, bw: s.borderTopWidth, bg: s.backgroundColor }; });
        expect({ ow: hv.ow, os: hv.os, oo: hv.oo, oc: hv.oc, bw: hv.bw }, `${tab} control ${i}`).toEqual({ ow: '1px', os: 'solid', oo: '-1px', oc: ink, bw: '1px' });
        expect(hv.bg, `${tab} control ${i}: pale fill on hover`).not.toBe(st.bg);
        expect(await where(), `${tab} control ${i}: nothing moves`).toEqual(before);
        await page.mouse.move(0, 0);
      }
    }
    expect([...lines], 'one control line').toHaveLength(1);
    const ratio = await page.evaluate((c) => { const v = c.match(/\d+/g).map(Number), b = getComputedStyle(document.querySelector('.card') || document.body).backgroundColor.match(/\d+/g).map(Number);
      const L = (x) => { const f = (n) => { n /= 255; return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4); }; return 0.2126 * f(x[0]) + 0.7152 * f(x[1]) + 0.0722 * f(x[2]); };
      const a = L(v), d = L(b); return (Math.max(a, d) + 0.05) / (Math.min(a, d) + 0.05); }, [...lines][0]);
    expect(ratio, 'control line against the card').toBeGreaterThanOrEqual(3);
  });

  test('read-only pills, counts and checklist marks never hover; bottom tabs have no ring, only the colour bar widens, nothing moves', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    for (const sel of ['#needsCard h3 .cnt', '#summary .sum', '#checksCard .mk', '#nav .cnt']) {
      const el = page.locator(sel).first();
      await el.hover();
      expect(await el.evaluate((e) => getComputedStyle(e).outlineStyle), sel).toBe('none');
    }
    const tab = page.locator('#nav button[data-go="dogs"]');
    const before = await tab.boundingBox();
    await tab.hover();
    await expect.poll(() => tab.locator('.bar').evaluate((e) => e.getBoundingClientRect().width)).toBe(40);
    expect(await tab.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('none');
    expect(await tab.boundingBox()).toEqual(before);
    await page.mouse.move(0, 0);
    await expect.poll(() => page.locator('#nav button[data-go="map"] .bar').evaluate((e) => e.getBoundingClientRect().width)).toBe(40);   // selected
  });

  test('count pills are one fixed box: 30 x 22px for 1 and 2 digits, even with a wider font; 3 digits grow', async ({ page, guard }) => {
    const rows = ['id,area,item,status,owner,blocked_on,evidence,note'];
    for (let i = 1; i <= 12; i++) rows.push(`W1${i},sample,Invented ask ${i},BLOCKED,Lisa,,,`);
    setFile(guard.world, 'BLD-WORK.csv', rows.join('\n') + '\n');
    await page.goto('cdhub/');
    await signIn(page);
    const measure = () => page.evaluate(() => [...document.querySelectorAll('.cnt')].filter((e) => e.getBoundingClientRect().width > 1).map((e) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e); return [e.textContent, r.width, r.height, s.borderTopLeftRadius, s.whiteSpace, s.fontVariantNumeric]; }));
    for (const wide of [false, true]) {
      if (wide) await page.addStyleTag({ content: '.cnt{font-family:Verdana,"DejaVu Sans",sans-serif!important;letter-spacing:.12em!important}' });
      const sizes = await measure();
      expect(sizes.map((x) => x[0]), 'one- and two-digit counts on Live feed').toEqual(expect.arrayContaining(['12', '16', '4']));
      for (const x of sizes) expect(x.slice(1), `count ${x[0]}${wide ? ' (wider font)' : ''}`).toEqual([30, 22, '11px', 'nowrap', 'tabular-nums']);
    }
    const big = await page.evaluate(() => { const h = document.createElement('div'); h.innerHTML = cntPill(123); document.querySelector('#main').appendChild(h); const r = h.firstChild.getBoundingClientRect(); return [r.width, r.height]; });
    expect(big[0]).toBeGreaterThan(30); expect(big[1]).toBe(22);
  });

  test('no solid colour fills: counts, pills, date pills, checklist marks, summary numbers, tabs and chosen chips are rings or light tints', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-mating.csv', MATINGS());
    await page.goto('cdhub/');
    await signIn(page);
    const fills = () => page.evaluate(() => [...document.querySelectorAll('.cnt, .pill, .dpill, .mk, .sum .big, .st, .sfb, .achip, .whor, .ic, nav#nav button, .btn, .tile, .mcard, .card, .live')].filter((e) => e.getBoundingClientRect().width > 1).map((e) => {
      const v = getComputedStyle(e).backgroundColor.match(/[\d.]+/g).map(Number), a = v[3] === undefined ? 1 : v[3];
      return { el: e.className + ' ' + e.textContent.trim().slice(0, 20), a, light: (v[0] + v[1] + v[2]) / 3, spread: Math.max(v[0], v[1], v[2]) - Math.min(v[0], v[1], v[2]) };
    }).filter((x) => x.a > 0.1 && (x.light < 200 || x.spread > 40)));
    expect(await fills()).toEqual([]);
    for (const tab of ['dogs', 'today', 'round', 'work']) { await openTab(page, tab); expect(await fills(), tab).toEqual([]); }
  });

  test('a phone (390px): no sideways scroll on any tab, every control 44px tall, header uses one More menu, tab counts sit in flow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('cdhub/');
    await signIn(page);
    for (const tab of LOOK_TABS) {
      await openTab(page, tab);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, '#/' + tab).toBeLessThanOrEqual(0);
      const short = await page.evaluate(() => [...document.querySelectorAll('#main button, #main select, #next button, header .btn, #nav button')].filter((e) => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()));
      expect(short, '#/' + tab).toEqual([]);
    }
    await expect(page.locator('#backHome')).toBeHidden();
    await expect(page.locator('header .srchbtn')).toBeHidden();
    await expect(page.locator('#nav button[data-reload]')).toBeHidden();
    await page.locator('#moreBtn').click();
    await expect(page.locator('#moreMenu')).toBeVisible();
    await expect(page.locator('#moreMenu')).toContainText('Reread');
    await expect(page.locator('#moreMenu a[data-back-home]')).toHaveAttribute('href', '../');
    await page.locator('#moreMenu [data-more="search"]').click();
    await expect(page.locator('#dashSearch')).toBeVisible();
    expect(await page.locator('#nav .cnt').first().evaluate((e) => getComputedStyle(e).position)).toBe('static');
  });
});

test.describe('CD Hub Bloodline screens (built from what the page already reads)', () => {
  test('Live feed: summary strip, Next card, Needs you today, On site, Litters, Temperatures today and Data checks', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    const sums = await page.locator('#summary .sum').allInnerTexts();
    expect(sums.map((s) => s.replace(/\s+/g, ' ').trim())).toEqual(['4 On track', '5 Needs you', '0 Overdue']);
    await expect(page.locator('#nextCard .bline')).toHaveText('Next');
    await expect(page.locator('#nextCard .t')).toHaveText('Tables read needs a look');
    await expect(page.locator('#needsCard .mrow')).toHaveCount(5);
    await expect(page.locator('#needsCard h3 .cnt')).toHaveText('5');
    await expect(page.locator('#needsCard h3 .cnt')).toHaveClass(/need/);
    await expect(page.locator('#nav button[data-go="map"] .cnt')).toHaveText('5');
    await expect(page.locator('#nav button[data-go="work"] .cnt')).toHaveText('1');
    await expect(page.locator('#onSiteCard .big')).toHaveText('3');
    await expect(page.locator('#littersCard .okempty')).toHaveText('No litters on the go');
    await expect(page.locator('#tempsCard')).toContainText('0 of 2');
    await expect(page.locator('#tempsCard')).toContainText('No outdoor reading on file for today');
    await expect(page.locator('#checksCard h3 .cnt')).toHaveText('4');
    await expect(page.locator('#checksCard .mk.bad')).toHaveCount(4);
    // ONE action per row: the waiting item opens Outstanding
    await page.locator('#needsCard .mrow', { hasText: 'Sample item waiting on Lisa' }).locator('button').click();
    await expect(page.locator('#nav button[data-go="work"]')).toHaveAttribute('aria-current', 'page');
  });

  test('Needs you today: date pills ring by urgency (late rose, soon amber), late first, Overdue counts it, Next is the most urgent; Litters card shows both', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-mating.csv', MATINGS());
    await page.goto('cdhub/');
    await signIn(page);
    const rows = page.locator('#needsCard .mrow');
    await expect(rows.nth(0)).toContainText('Test Dog One in whelp');
    await expect(rows.nth(0).locator('.dpill')).toHaveClass(/late/);
    await expect(rows.nth(1)).toContainText('Test Pup One in whelp');
    await expect(rows.nth(1).locator('.dpill')).toHaveClass(/soon/);
    await expect(rows.nth(2).locator('.dpill')).toHaveCount(0);   // undated rows carry no date pill
    const due = iso(-66 + 63).split('-');
    await expect(rows.nth(0).locator('.dpill')).toContainText(`${due[2]}/${due[1]}/${due[0].slice(2)}`);
    await expect(page.locator('#summary .sum.over .big')).toHaveText('1');
    await expect(page.locator('#nextCard .t')).toHaveText('Test Dog One in whelp');
    await expect(page.locator('#littersCard h3 .cnt')).toHaveText('2');
    await expect(page.locator('#littersCard .dpill.late')).toHaveCount(1);
    await expect(page.locator('#littersCard .dpill.soon')).toHaveCount(1);
    const ring = (sel) => page.locator(sel).first().evaluate((e) => { const s = getComputedStyle(e); return [s.borderTopWidth, s.borderTopColor, s.backgroundColor]; });
    const late = await ring('#needsCard .dpill.late'), soon = await ring('#needsCard .dpill.soon');
    expect(late[0]).toBe('1px'); expect(late[1]).toBe(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ljr-2').trim() && getComputedStyle(document.querySelector('.cnt.need')).borderTopColor));
    expect(soon[1]).not.toBe(late[1]);
    // a date that is neither late nor soon still wears a plain 1px ring, no fill
    const plain = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = dpill('2026-01-01', ''); document.querySelector('#main').appendChild(d); const s = getComputedStyle(d.firstChild); return [s.borderTopWidth, s.borderTopStyle, s.backgroundColor]; });
    expect(plain).toEqual(['1px', 'solid', 'rgba(0, 0, 0, 0)']);
    await page.locator('#nextCard button').click();
    await expect(page.locator('#nav button[data-go="today"]')).toHaveAttribute('aria-current', 'page');
  });

  test('Needs you today shows at most 7 rows; Show all opens the rest', async ({ page, guard }) => {
    const rows = ['id,area,item,status,owner,blocked_on,evidence,note'];
    for (let i = 1; i <= 6; i++) rows.push(`W2${i},sample,Invented waiting ask ${i},BLOCKED,Lisa,,,`);
    setFile(guard.world, 'BLD-WORK.csv', rows.join('\n') + '\n');
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#needsCard .mrow:visible')).toHaveCount(7);
    await expect(page.locator('#needsCard .mfoot')).toContainText('Showing 7 of 10');
    await page.locator('#needsCard [data-needall]').click();
    await expect(page.locator('#needsCard .mrow:visible')).toHaveCount(10);
  });

  test('Temperatures today shows today\'s outdoor reading; a data check\'s Show opens its list on Today', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-outdoor_temp.csv', `on_date,reading_kind,min_temp,max_temp,phrase,captured_at,source\n${iso(0)},forecast,8,14,invented mild day,${iso(0)}T07:00:00Z,invented\n`);
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#tempsCard')).toContainText('8–14 °C');
    await expect(page.locator('#tempsCard')).toContainText('invented mild day');
    await page.locator('#checksCard button[data-list="nochip"]').click();
    await expect(page.locator('#nav button[data-go="today"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#tpanel')).toContainText('No microchip recorded');
  });

  test('Today checklist: one line per check on the round, a tick or a cross, and how many are done', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'today');
    const card = page.locator('#todayChecklist');
    await expect(card.locator('.mrow')).toHaveCount(6);
    await expect(card).toContainText('1 of 6 done');
    await expect(card.locator('.mrow', { hasText: 'No cabin over its headcount' }).locator('.mk')).toHaveText('✓');
    await expect(card.locator('.mrow', { hasText: 'Morning temperature in every cabin' }).locator('.mk')).toHaveText('✗');
    await expect(card.locator('.mrow', { hasText: 'Morning temperature' })).toContainText('0 of 2 cabins');
  });

  test('The round names each place "Step N: name" in words', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'round');
    await expect(page.locator('.card[data-area] .step').first()).toHaveText('Step 1:');
    await expect(page.locator('.card[data-area]').first()).toContainText('Step 1: Test Cabin A');
  });

  test('Dogs: one filter row (Search, Filter panel, Sort, removable chips); record cards have a name line, title, 44px thumbnail and who-has-it ring', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'dogs');
    await expect(page.locator('#fp-dogs')).toBeHidden();
    await page.locator('[data-fpanel="fp-dogs"]').click();
    await expect(page.locator('[data-fpanel="fp-dogs"]')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#fa').selectOption('j');
    await expect(page.locator('#cnt')).toHaveText('1 of 3');
    await expect(page.locator('#ach-dogs .achip')).toHaveText(/Age: 6m to 12m/);
    await expect(page.locator('[data-fpanel="fp-dogs"] .cnt')).toHaveText('1');
    await page.locator('#ach-dogs .achip').click();
    await expect(page.locator('#cnt')).toHaveText('3 of 3');
    await expect(page.locator('#ach-dogs .achip')).toHaveCount(0);
    await page.locator('.sfb[data-code="ST"]').click();
    await expect(page.locator('#ach-dogs .achip')).toHaveText(/Status: Stud/);
    await page.locator('#ach-dogs .achip').click();
    await expect(page.locator('.sfb[data-code=""]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#dsort').selectOption('young');
    await expect(page.locator('.dc .nm').first()).toHaveText('Test Pup One');
    await page.locator('#dsort').selectOption('name');
    expect(await page.locator('.dc .nm').allInnerTexts()).toEqual(['Test Dog One', 'Test Dog Two', 'Test Pup One']);
    const card = page.locator('.dc').first();
    await expect(card.locator('.nl')).toContainText('Bitch');
    const ph = await card.locator('.ph').boundingBox();
    expect([ph.width, ph.height]).toEqual([44, 44]);
    await expect(card.locator('.whor')).toHaveAttribute('aria-label', 'On site, Test Cabin A');
    const r = await card.evaluate((e) => { const c = e.getBoundingClientRect(), w = e.querySelector('.whor').getBoundingClientRect(); return [Math.round(c.right - w.right), Math.round(c.bottom - w.bottom)]; });
    expect(r[0]).toBeLessThanOrEqual(14); expect(r[1]).toBeLessThanOrEqual(14);   // bottom-right
    expect(await card.locator('.nm').evaluate((e) => getComputedStyle(e).webkitLineClamp)).toBe('2');
  });

  test('Litters: the same filter row; Sort changes the order', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-litter.csv', 'id,dam_subject_id,sire_subject_id,dob,pairing,status,notes\nlit-a,sub-test-dog-1,sub-test-dog-2,2025-02-01,Alpha pairing,born,invented\nlit-b,sub-test-dog-1,sub-test-dog-2,2026-02-01,Beta pairing,born,invented\n');
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'litters');
    await expect(page.locator('#lrows tr').first()).toContainText('Beta pairing');
    await page.locator('#lsort').selectOption('old');
    await expect(page.locator('#lrows tr').first()).toContainText('Alpha pairing');
    await page.locator('[data-fpanel="fp-litters"]').click();
    await page.locator('#ly').selectOption('2025');
    await expect(page.locator('#lcnt')).toHaveText('1 of 2');
    await expect(page.locator('#ach-litters .achip')).toHaveText(/Year: 2025/);
  });
});

test.describe('CD Hub: In whelp reads the parsed mating rows (the #111 fix), invented fixture data', () => {
  test('build() keeps the parsed matings; the fixture mating that produced a litter is not a pregnancy', async ({ page }) => {
    // The sample fixture's only mating (mat-test-1) produced lit-test-1, so nobody is in whelp.
    await page.goto('cdhub/');
    await signIn(page);
    const before = await page.evaluate(() => ({ keys: Object.keys(CD.matings[0]), n: inWhelp().length }));
    expect(before.keys).toContain('dam');                 // parsed shape...
    expect(before.keys).not.toContain('dam_subject_id');  // ...not the raw rows
    expect(before.n).toBe(0);
  });

  test('an open mating added to the fixture file is found, from the parsed rows and from raw rows alike', async ({ page, guard }) => {
    const fixture = fs.readFileSync(path.join(FIX, 'bld', 'BLD-mating.csv'), 'utf8').trimEnd();
    setFile(guard.world, 'BLD-mating.csv', fixture + `\nmat-test-2,sub-test-dog-1,sub-test-dog-2,${iso(-40)},1,natural,yes,,,,invented open mating\n`);
    await page.goto('cdhub/');
    await signIn(page);
    const r = await page.evaluate(() => {
      const parsed = inWhelp().map((x) => [x.dam, x.day, x.matings]);
      const keep = CD.matings;
      CD.matings = T['BLD-mating.csv'];                 // raw column names are still read
      const raw = inWhelp().map((x) => [x.dam, x.day, x.matings]);
      CD.matings = keep;
      return { parsed, raw };
    });
    expect(r.parsed).toEqual([['sub-test-dog-1', 40, 1]]);
    expect(r.raw).toEqual(r.parsed);
    await openTab(page, 'today');
    await expect(page.locator('#main')).toContainText('In whelp');
    await expect(page.locator('#main')).toContainText('day 40');
  });
});

test.describe('CD Hub: screens that need data CD Hub does not hold say which Bloodline table will feed them', () => {
  const WANT = [
    ['dogs', 'media', 'Photos', 'media', 'media'], ['dogs', 'person', 'Who has it, by name', 'person', 'person'],
    ['work', 'due', 'Due dates on Outstanding', 'work item', 'work_item'], ['round', 'reading', 'Temperatures that are kept', 'reading', 'reading'],
    ['litters', 'stage', 'Litter stage', 'litter stage', 'birth_group_stage']];
  test('each empty state names its Bloodline table, in words, on its own tab', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    for (const [tab, k, title, words, table] of WANT) {
      await openTab(page, tab);
      const card = page.locator(`#arrive-${k}`);
      await expect(card).toBeVisible();
      await expect(card.locator('h3')).toHaveText(title);
      await expect(card.locator('.arrives')).toHaveText(`Arrives with Bloodline: ${words}`);
      await expect(card).toHaveAttribute('data-arrives', table);
      const smallest = await card.evaluate((e) => Math.min(...[e, ...e.querySelectorAll('*')].map((x) => parseFloat(getComputedStyle(x).fontSize))));
      expect(smallest).toBeGreaterThanOrEqual(13);
    }
  });
});
