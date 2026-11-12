const { test, expect, buildWorld } = require('../support/test');
const { tabClick, tabTo } = require('../support/tabs');
const { IDS, WANT_BLD, FIX } = require('../support/world');
const fs = require('fs');
const path = require('path');

const SECTIONS = ['map', 'work', 'today', 'round', 'dogs', 'areas', 'sops', 'compliance'];
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
    await expect(page.locator('#main')).toContainText('Read-only. One sign-in for the whole site.');
    await expect(page.locator('#main')).not.toContainText(/from Drive|live from/i);
    await signIn(page);
    const stores = await page.evaluate(() => ({ local: Object.keys(localStorage), session: sessionStorage.length, key: window.DashAuth.KEY, saved: JSON.parse(localStorage.getItem(window.DashAuth.KEY)) }));
    expect(stores.local).toEqual([stores.key]);
    expect(stores.session).toBe(0);
    expect(Object.keys(stores.saved).sort()).toEqual(['access_token', 'expires_at', 'scope']); // no refresh token, no secret
    expect(await context.cookies()).toEqual([]);
    await page.locator('header button[data-signout]').click();
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

  test('live pill shows live and read-only, without a table count or a folder name', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#livepill')).toContainText(/^live · read-only · read \d\d:\d\d/);
    const leak = await page.evaluate(() => {
      const p = document.getElementById('livepill');
      const blob = (p.textContent || '') + ' ' + (p.getAttribute('title') || '');
      const folder = (window.DASH_CONFIG.cdhub && window.DASH_CONFIG.cdhub.folderName) || '';
      return /from Drive|\d+ tables|BLD-/i.test(blob) || (folder && blob.indexOf(folder) !== -1);
    });
    expect(leak).toBe(false);
    expect(WANT_BLD.length).toBeGreaterThan(40);
  });

  // Load stays concurrent (READ_AT_ONCE in cdhub/index.html). One-by-one reads, or naming files on the boot line, fail this.
  test('boot stays friendly and present files are read together @regression', async ({ page }) => {
    await page.goto('cdhub/');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await page.evaluate(() => {
      const orig = window.fetch;
      let inflight = 0;
      window.__cdReads = { max: 0, n: 0 };
      window.fetch = function (url) {
        const u = String(url || '');
        const read = /\/files\/[^/?]+/.test(u) && /alt=media|\/export/.test(u);
        const self = this, args = arguments;
        if (!read) return orig.apply(self, args);
        window.__cdReads.n++;
        inflight++;
        window.__cdReads.max = Math.max(window.__cdReads.max, inflight);
        return new Promise((res) => setTimeout(res, 250)).then(() => orig.apply(self, args)).finally(() => { inflight--; });
      };
    });
    await page.locator('#signinbtn').click();
    const boot = page.locator('#boot');
    await expect(boot).toBeVisible();
    await expect(boot.locator('.bootline')).toHaveText('Getting things ready…');
    await expect(boot.locator('.bootspin')).toBeVisible();
    await expect(boot.locator('#bootrows .bootdots i')).toHaveCount(3);
    const bootText = await boot.innerText();
    expect(bootText).not.toMatch(/Drive|BLD-|\.csv/i);
    await expect(page.locator('header button[data-reload]')).toHaveAttribute('title', 'Refresh');
    await expect(page.locator('#livepill')).toContainText('live', { timeout: 20_000 });
    const stats = await page.evaluate(() => window.__cdReads);
    expect(stats.n).toBeGreaterThan(6);
    expect(stats.max).toBeGreaterThan(1);
    expect(stats.max).toBeLessThanOrEqual(6);
    await expect(page.locator('#boot')).toHaveCount(0);
  });

  test('the sample CSVs are parsed into the right things on the Dogs page', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="dogs"]');
    const main = page.locator('#main');
    await expect(main).toContainText('Test Dog One');
    await expect(main).toContainText('Test Dog Two');
    await expect(main).toContainText('Test Pup One');
    await expect(main).toContainText('3 of 3');
  });

  test('joined tables work: cabins show their dogs, litters show dam and sire, weighings are counted @regression', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="round"]');
    await expect(page.locator('#main')).toContainText('Test Cabin A');
    await expect(page.locator('#main')).toContainText('Test Dog One');
    // Litters is hidden. The dam and sire join stays in the data the page already read.
    const pairing = await page.evaluate(() => (CD.litters || []).map((l) => nameOf(l.dam_subject_id) + ' \u00d7 ' + nameOf(l.sire_subject_id)));
    expect(pairing.join('\n')).toContain('Test Dog One');
    expect(pairing.join('\n')).toContain('Test Dog Two');
  });

  test('the Outstanding page reads BLD-WORK.csv', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="work"]');
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
      await tabClick(page, `#nav button[data-go="${id}"]`);
      await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#main')).not.toBeEmpty();
      await expect(page.locator('#main')).not.toContainText('Sign in to see the tables');
    });
  }

  test('eight sections are in the bar: five tabs, then three under More (Assocs, Table map, Litters and Vet link hidden); Refresh and Sign out sit in the top bar', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#nav button[data-go]')).toHaveCount(8);
    await expect(page.locator('#nav > button.ht[data-go]')).toHaveCount(5);
    await expect(page.locator('#nav .house-more button[data-go]')).toHaveCount(3);
    await expect(page.locator('#nav button[data-reload], #nav button[data-signout]')).toHaveCount(0);
    await expect(page.locator('header button[data-reload]')).toHaveCount(1);
    await expect(page.locator('header button[data-signout]')).toHaveCount(1);
  });

  test('bottom bar and More never show Assocs, Table map, Litters or Vet link', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#nav > button.ht .htl')).toHaveText(['Main', 'Do', 'Today', 'Dogs', 'SOPs']);
    const hiddenGo = page.locator('#nav button[data-go="buyers"], #nav button[data-go="shape"], #nav button[data-go="litters"], #nav button[data-go="vet"]');
    await expect(hiddenGo).toHaveCount(0);
    await page.locator('nav.house-tabs [data-house-more]').click();
    await expect(page.locator('#houseMore button .htl')).toHaveText(['Compliance', 'The round', 'Areas']);
    const words = await page.locator('#nav').innerText();
    for (const word of ['Assocs', 'Table map', 'Litters', 'Vet link']) expect(words).not.toContain(word);
  });

  test('next and previous from every visible page never land on a hidden section', async ({ page }) => {
    const hidden = new Set(['buyers', 'shape', 'litters', 'vet']);
    const headings = ['Assocs', 'Table map', 'Litters', 'Vet link'];
    await page.goto('cdhub/');
    await signIn(page);
    const ids = await page.locator('#nav button[data-go]').evaluateAll((bs) => bs.map((b) => b.dataset.go));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      await tabClick(page, `#nav button[data-go="${id}"]`);
      const targets = await page.locator('#next button[data-go]').evaluateAll((bs) => bs.map((b) => b.dataset.go));
      expect(targets.length, id).toBeGreaterThan(0);
      for (const t of targets) expect(hidden.has(t), id + ' next ' + t).toBe(false);
      for (let i = 0; i < targets.length; i++) {
        await tabClick(page, `#nav button[data-go="${id}"]`);
        await page.locator('#next button[data-go]').nth(i).click();
        const landed = await page.locator('#nav [aria-current="page"]').getAttribute('data-go');
        expect(hidden.has(landed), id + ' landed ' + landed).toBe(false);
        for (const word of headings) await expect(page.locator('#main h2', { hasText: word })).toHaveCount(0);
      }
    }
  });

  test('hidden hashes fall back to Main and never show the hidden heading', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    for (const id of ['map', 'work']) {
      await tabClick(page, `#nav button[data-go="${id}"]`);
      const hops = await page.locator('#main [data-go], #main a[href^="#/"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-go') || e.getAttribute('href') || ''));
      for (const hop of hops) expect(hop, id + ' ' + hop).not.toMatch(/(^|#\/)(buyers|shape|litters|vet)(\/|$)/);
    }
    for (const [hash, word] of [['#/buyers', 'Assocs'], ['#/shape', 'Table map'], ['#/litters', 'Litters'], ['#/vet', 'Vet link']]) {
      await page.goto('cdhub/' + hash);
      await expect(page.locator('#nav button[data-go="map"]')).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('#main h2', { hasText: word })).toHaveCount(0);
    }
    await page.locator('[data-search-open]').click();
    await page.locator('#dashSearchBox').fill('lit-test');
    await expect(page.locator('#dashSearchStatus')).toContainText(/for "lit-test"/);
    await expect(page.locator('[data-search-group="CD Hub litters"]')).toHaveCount(0);
  });

  test('the "Next:" buttons at the bottom lead to other sections', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="today"]');
    const next = page.locator('#next button[data-go]').first();
    const target = await next.getAttribute('data-go');
    await next.click();
    await expect(page.locator(`#nav button[data-go="${target}"]`)).toHaveAttribute('aria-current', 'page');
  });

  test('Reread reads the folder again', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    const before = guard.world.calls.filter((c) => c.path === '/files' && c.query.includes(IDS.bld)).length;
    await page.locator('header button[data-reload]').click();
    await expect(page.locator('#livepill')).toContainText('live');
    await expect.poll(() => guard.world.calls.filter((c) => c.path === '/files' && c.query.includes(IDS.bld)).length).toBe(before + 1);
  });

  test('Sign out forgets everything and shows the sign-in card again', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('header button[data-signout]').click();
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    await expect(page.locator('#livepill')).toHaveText('signed out');
    await expect(page.locator('#main')).not.toContainText('Test Dog One');
    expect(await page.evaluate(() => window.__GIS_CALLS.revoke)).toBe(1);
  });

  test('saving is off: The round loads without a saving-off notice', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await tabClick(page, '#nav button[data-go="round"]');
    await expect(page.locator('#rstat')).toHaveText('');
    await expect(page.locator('#main')).not.toContainText('Saving off');
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
    const named = await page.evaluate(() => {
      const folder = (window.DASH_CONFIG.cdhub && window.DASH_CONFIG.cdhub.folderName) || '';
      return folder && document.getElementById('main').innerText.indexOf(folder) !== -1;
    });
    expect(named).toBe(false);
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
      await expect(page.locator('#main')).toContainText('Read access was not granted');
      await expect(page.locator('#main')).not.toContainText(/Drive/i);
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
const LOOK_TABS = ['map', 'work', 'today', 'round', 'dogs', 'areas', 'sops'];
const iso = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
// Writes the three Moxiclear columns on the invented subject table. Addresses stay example.test.
const setRx = (world, byId) => {
  const f = world.files.find((x) => x.name === 'BLD-subject.csv');
  const lines = f.content.replace(/\r/g, '').replace(/\n$/, '').split('\n');
  const head = lines[0].split(',');
  const ix = { date: head.indexOf('rx_moxi_date'), exp: head.indexOf('rx_moxi_expiry'), url: head.indexOf('rx_moxi_file_url') };
  const rows = lines.slice(1).filter(Boolean).map((line) => {
    const c = line.split(',');
    while (c.length < head.length) c.push('');
    const rx = byId[c[0]];
    if (rx) { c[ix.date] = rx.date || ''; c[ix.exp] = rx.exp || ''; c[ix.url] = rx.url || ''; }
    return c.join(',');
  });
  f.content = [lines[0], ...rows].join('\n') + '\n';
  f.size = String(f.content.length);
};
const MATINGS = () => 'id,dam_subject_id,sire_subject_id,mated_on,mating_no,method,is_first_of_season,due_from_this_mating,litter_id,produced_litter,notes\n'
  + `mat-x1,sub-test-dog-1,sub-test-dog-2,${iso(-66)},1,natural,yes,,,,invented\nmat-x2,sub-test-pup-1,sub-test-dog-2,${iso(-58)},1,natural,yes,,,,invented\n`;
// Gestation timings are dated rows now (Lisa 12 Nov 2026: no hard-coded limits). Pretend values, pretend source.
const GEST = (world) => setFile(world, 'BLD-breeding_rule.csv', 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by\n'
  + ['gestation.due_days,63', 'gestation.window_from_days,57', 'gestation.window_to_days,72', 'gestation.alert_from_day,50', 'litters.recent_days,84']
    .map((kv, i) => `g${i},t,${kv},2010-01-01,Pretend source,,,`).join('\n') + '\n');
const openTab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
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
  const ROUND = '.dot, .mk, .whor, .sexdot, .ic, .sw, .nose, .gicon';
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
    const okRad = rad === '0px' || rad === '12px' || (rad === '50%' && el.matches(ROUND)) || (rad === '2px' && el.matches('nav#nav .bar')) || (rad === '50%' && el.matches('nav#nav .hic'));   // the bottom tabs (Lisa's picks, 2 Nov): a rounded line, a round count ring, the icon's round place
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
      setFile(guard.world, 'BLD-mating.csv', MATINGS()); GEST(guard.world);   // late and soon date pills on screen too
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

  // A row that opens wears the pale grey hover fill (Lisa, 12 Nov 2026); the controls on it keep their 1px line at 3:1 or more
  // against that fill, in every look (warm dark mixes less muted into --hov for this, tokens.css --house-hov-mix).
  for (const look of ['warm', 'cool']) for (const scheme of ['light', 'dark']) {
    test(`${look} ${scheme}: on a hovered row the control rings stay 3:1 against the hover fill`, async ({ page, guard }) => {
      await page.addInitScript((bg) => localStorage.setItem('dash-look', JSON.stringify({ bg })), look);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('cdhub/');
      await signIn(page);
      await openTab(page, 'work');
      const row = page.locator('#main [data-open-row]:has(.house-open), #main .mrow.go:has(button)').first();
      await expect(row).toBeVisible();
      await row.scrollIntoViewIfNeeded();
      const b = await row.boundingBox();
      await page.mouse.move(b.x + 4, b.y + b.height / 2);   // on the row, off its buttons
      const r = await row.evaluate((e) => {
        const rgb = (s) => { let m = /^rgba?\(([^)]+)\)/.exec(s); if (m) return m[1].split(/[ ,/]+/).filter(Boolean).map(Number).slice(0, 3);
          m = /^color\(srgb ([^)]+)\)/.exec(s); return m ? m[1].split(/[ /]+/).filter(Boolean).slice(0, 3).map((x) => x * 255) : null; };
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const pr = document.createElement('span'); pr.style.background = 'var(--hov)'; e.parentElement.appendChild(pr); const hov = getComputedStyle(pr).backgroundColor; pr.remove();
        const bg = getComputedStyle(e).backgroundColor;
        const rings = [...e.querySelectorAll('button, a.btn')].filter((c) => c.getBoundingClientRect().width > 0).map((c) => ratio(rgb(getComputedStyle(c).borderTopColor), rgb(bg)));
        return { hovered: bg === hov, rings };
      });
      expect(r.hovered, 'the row wears the pale grey hover fill').toBe(true);
      expect(r.rings.length).toBeGreaterThan(0);
      for (const x of r.rings) expect(x, `${look} ${scheme}: control ring on the hovered row`).toBeGreaterThanOrEqual(3);
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

  test('controls: every one rests on the same clear 1px line (never ink, 3:1), 12px corners, 14px/600, 36px tall; hover = the pale grey fill and no line, nothing moves', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('cdhub/');
    await signIn(page);
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    const lines = new Set();
    for (const tab of ['map', 'today', 'round', 'dogs', 'areas']) {
      await openTab(page, tab);
      const ctls = page.locator('#main button:visible:not(.tile), #main select:visible, #next button:visible');
      const n = await ctls.count();
      expect(n, tab).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const el = ctls.nth(i);
        const st = await el.evaluate((e) => { const s = getComputedStyle(e); return { w: s.borderTopWidth, c: s.borderTopColor, r: s.borderTopLeftRadius, fs: s.fontSize, fw: s.fontWeight, h: e.getBoundingClientRect().height, bg: s.backgroundColor, sel: e.getAttribute('aria-pressed') === 'true' }; });
        expect(st.w).toBe('1px'); expect(st.r).toBe('12px'); expect(st.c).not.toBe(ink); expect(st.h).toBeGreaterThanOrEqual(36);
        // A select is a typing box: 16px on every page so a phone never zooms in on it (Lisa, 3 Nov 2026); every other control is 14px.
        expect(st.fs).toBe((await el.evaluate((e) => e.tagName)) === 'SELECT' ? '16px' : '14px'); expect(st.fw).toBe('600');
        lines.add(st.c);
        if (st.sel) continue;
        const where = () => el.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height]; });   // page position, so a scroll is not a move
        const before = await where();
        await el.hover();
        const hv = await el.evaluate((e) => { const s = getComputedStyle(e), pr = document.createElement('span'); pr.style.background = 'var(--hov)'; e.parentElement.appendChild(pr); const hov = getComputedStyle(pr).backgroundColor; pr.remove();
          return { os: s.outlineStyle, bw: s.borderTopWidth, bg: s.backgroundColor, hov }; });
        // Lisa (12 Nov 2026): "purple outline on hover/click is a lot". Every control, the fold chevron too, hovers with the pale
        // grey fill and no line.
        expect({ os: hv.os, bw: hv.bw }, `${tab} control ${i}`).toEqual({ os: 'none', bw: '1px' });
        expect(hv.bg, `${tab} control ${i}: the pale grey fill on hover`).toBe(hv.hov);
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
    // Main's three numbers open what they count (Lisa, 2 Nov), so they are links and do hover; see hub-main-others.spec.js.
    await expect(page.locator('[data-hub-main] a.hm-n')).toHaveCount(3);
    // Needs you in full now sits on Do and the data checks on Tables (Hub Mains, 2 Nov 2026).
    for (const [tab, sel] of [['work', '#needsCard h3 .cnt'], ['compliance', '#checksCard .mk'], ['map', '#nav .ht .n']]) {
      await openTab(page, tab);
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

  test('count pills are one fixed box: 30 x 24px for 1 and 2 digits (a 14px number), even with a wider font; 3 digits grow', async ({ page, guard }) => {
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
      expect(sizes.map((x) => x[0]), 'one- and two-digit counts on Main').toEqual(expect.arrayContaining(['18']));
      // The tab counts are the corner ring (tab picks, 2 Nov) holding a 14px number (pick A): 24 x 24 whatever the font, the two digits on one line.
      const tc = await page.locator('#nav button[data-go="work"] .n').evaluate((e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return [e.textContent, r.width, r.height, s.borderTopLeftRadius, s.whiteSpace, s.fontSize]; });
      expect(tc, 'the Do tab count' + (wide ? ' (wider font)' : '')).toEqual(['12', 24, 24, '12px', 'nowrap', '14px']);
      for (const x of sizes) expect(x.slice(1), `count ${x[0]}${wide ? ' (wider font)' : ''}`).toEqual([30, 24, '12px', 'nowrap', 'tabular-nums']);
    }
    const big = await page.evaluate(() => { const h = document.createElement('div'); h.innerHTML = cntPill(123); document.querySelector('#main').appendChild(h); const r = h.firstChild.getBoundingClientRect(); return [r.width, r.height]; });
    expect(big[0]).toBeGreaterThan(30); expect(big[1]).toBe(24);
  });

  test('no solid colour fills: counts, pills, date pills, checklist marks, summary numbers, tabs and chosen chips are rings or light tints', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-mating.csv', MATINGS()); GEST(guard.world);
    await page.goto('cdhub/');
    await signIn(page);
    const fills = () => page.evaluate(() => [...document.querySelectorAll('.cnt, .pill, .dpill, .mk, .sum .big, .st, .sfb, .achip, .whor, .ic, nav#nav button, .btn, .tile, .mcard, .card, .live')].filter((e) => e.getBoundingClientRect().width > 1).map((e) => {
      const v = getComputedStyle(e).backgroundColor.match(/[\d.]+/g).map(Number), a = v[3] === undefined ? 1 : v[3];
      return { el: e.className + ' ' + e.textContent.trim().slice(0, 20), a, light: (v[0] + v[1] + v[2]) / 3, spread: Math.max(v[0], v[1], v[2]) - Math.min(v[0], v[1], v[2]) };
    }).filter((x) => x.a > 0.1 && (x.light < 200 || x.spread > 40)));
    expect(await fills()).toEqual([]);
    for (const tab of ['dogs', 'today', 'round', 'work']) { await openTab(page, tab); expect(await fills(), tab).toEqual([]); }
  });

  test('a phone (390px): no sideways scroll on any tab, every control 44px tall, the one 56px top bar (Look holds Sign out), tab counts in the top-right corner', async ({ page }) => {
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
    // The top bar (Lisa's pick A): one 56px row with Home, Search, Refresh and Look; Sign out and the read time sit inside Look.
    expect(Math.round((await page.locator('header').boundingBox()).height)).toBe(56);
    await expect(page.locator('#backHome')).toBeVisible();
    await expect(page.locator('#backHome')).toHaveAttribute('href', '../');
    await expect(page.locator('#nav button[data-reload]')).toBeHidden();
    await expect(page.locator('header button[data-reload]')).toHaveAttribute('aria-label', 'Refresh');
    await expect(page.locator('header button[data-reload]')).toBeVisible();
    await expect(page.locator('header button[data-signout]')).toBeHidden();
    await page.locator('#houseLookBtn').click();
    await expect(page.locator('#houseLook')).toBeVisible();
    await expect(page.locator('#houseLook [data-house-mread]')).toHaveText(/^Read \d\d:\d\d$/);
    await expect(page.locator('#houseLook').getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#houseLook')).toBeHidden();
    await expect(page.locator('header .srchbtn')).toBeVisible();
    await page.locator('header .srchbtn').click();
    await expect(page.locator('#dashSearch')).toBeVisible();
    expect(await page.locator('#nav .ht .n').first().evaluate((e) => getComputedStyle(e).position)).toBe('absolute');   // Lisa's tab picks: the count sits in the tab's top-right corner
  });
});

test.describe('CD Hub Bloodline screens (built from what the page already reads)', () => {
  test('Main: Next, Needs you (5) and Temps · Unplaced · Bitches; the old Live cards sit on Do, Today and Tables', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#summary')).toHaveCount(0);   // the On track / Needs you / Overdue trio became the 3 numbers
    await expect(page.locator('[data-hm="next"] .hm-what')).toHaveText('Tables read needs a look');
    await expect(page.locator('[data-hm="needs"] .hm-row')).toHaveCount(5);
    await expect(page.locator('[data-hm="needs"] .hm-head .cnt')).toHaveText('7');   // + Breeding rules not set (8 Nov 2026)
    await expect(page.locator('[data-hm="nums"] .hm-n[data-k="Temps"] .hm-v')).toHaveText('0 of 2');
    await expect(page.locator('#nav button[data-go="map"] .n')).toHaveText('7');
    await expect(page.locator('#nav button[data-go="work"] .n')).toHaveText('1');
    // Each row carries its action: unset breeding rules open Compliance (8 Nov 2026); the waiting item now sits on Do (Outstanding).
    await page.locator('[data-hm="needs"] .hm-row', { hasText: 'Breeding rules' }).locator('a[data-hm-act]').click();
    await expect(page.locator('#nav button[data-go="compliance"]')).toHaveAttribute('aria-current', 'page');
    await openTab(page, 'work');
    await expect(page.locator('#needsCard .mrow')).toHaveCount(7);
    await expect(page.locator('#needsCard')).toContainText('Sample item waiting on Lisa');
    // Rose = late only (Lisa's sweep, 3 Nov 2026): the count is rose exactly when one of its rows is late.
    const anyLate = (await page.locator('#needsCard .mrow .ic.late').count()) > 0;
    if (anyLate) await expect(page.locator('#needsCard h3 .cnt')).toHaveClass(/need/); else await expect(page.locator('#needsCard h3 .cnt')).not.toHaveClass(/need/);
    await openTab(page, 'today');
    await expect(page.locator('#onSiteCard .big')).toHaveText('3');
    await expect(page.locator('#tempsCard')).toContainText('0 of 2');
    await expect(page.locator('#tempsCard')).toContainText('No reading today');
    await openTab(page, 'compliance');
    await expect(page.locator('#checksCard h3 .cnt')).toHaveText('6');
    await expect(page.locator('#checksCard .mk.bad')).toHaveCount(6);
    // Failed checks are broken: the black badge, never rose, read out as "6 failed" (Lisa, 3 Nov 2026).
    await expect(page.locator('#checksCard h3 .cnt')).toHaveClass(/\bbroken\b/);
    await expect(page.locator('#checksCard h3 .cnt')).not.toHaveClass(/\bneed\b/);
    await expect(page.locator('#checksCard h3')).toContainText('6 failed');
  });

  test('Needs you: late first, then soon; Next is the most urgent and opens Today; Do keeps the date pills', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-mating.csv', MATINGS()); GEST(guard.world);
    await page.goto('cdhub/');
    await signIn(page);
    const main = page.locator('[data-hm="needs"] .hm-row');
    await expect(main.nth(0)).toContainText('Test Dog One in whelp');
    await expect(main.nth(0)).toHaveAttribute('data-kind', 'late');
    await expect(page.locator('[data-hm="next"] .hm-what')).toHaveText('Test Dog One in whelp');
    await openTab(page, 'work');
    const rows = page.locator('#needsCard .mrow');
    await expect(rows.nth(0)).toContainText('Test Dog One in whelp');
    await expect(rows.nth(0).locator('.dpill')).toHaveClass(/late/);
    await expect(rows.nth(1)).toContainText('Test Pup One in whelp');
    await expect(rows.nth(1).locator('.dpill')).toHaveClass(/soon/);
    await expect(rows.nth(2).locator('.dpill')).toHaveCount(0);   // undated rows carry no date pill
    const due = iso(-66 + 63).split('-');
    await expect(rows.nth(0).locator('.dpill')).toContainText(`${due[2]}/${due[1]}/${due[0].slice(2)}`);
    const ring = (sel) => page.locator(sel).first().evaluate((e) => { const s = getComputedStyle(e); return [s.borderTopWidth, s.borderTopColor, s.backgroundColor]; });
    const late = await ring('#needsCard .dpill.late'), soon = await ring('#needsCard .dpill.soon');
    expect(late[0]).toBe('1px'); expect(late[1]).toBe(await page.evaluate(() => getComputedStyle(document.querySelector('.cnt.need')).borderTopColor));
    expect(soon[1]).not.toBe(late[1]);
    // a date that is neither late nor soon still wears a plain 1px ring, no fill
    const plain = await page.evaluate(() => { const d = document.createElement('div'); d.innerHTML = dpill('2026-01-01', ''); document.querySelector('#main').appendChild(d); const s = getComputedStyle(d.firstChild); return [s.borderTopWidth, s.borderTopStyle, s.backgroundColor]; });
    expect(plain).toEqual(['1px', 'solid', 'rgba(0, 0, 0, 0)']);
    await openTab(page, 'map');
    await page.locator('[data-hm="next"] a[data-hm-act]').click();
    await expect(page.locator('#nav button[data-go="today"]')).toHaveAttribute('aria-current', 'page');
  });

  test('Main shows 5 and "+N more" opens Do, where Needs you shows 7 and Show all opens the rest', async ({ page, guard }) => {
    const rows = ['id,area,item,status,owner,blocked_on,evidence,note'];
    for (let i = 1; i <= 6; i++) rows.push(`W2${i},sample,Invented waiting ask ${i},BLOCKED,Lisa,,,`);
    setFile(guard.world, 'BLD-WORK.csv', rows.join('\n') + '\n');
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('[data-hm="needs"] .hm-row')).toHaveCount(5);
    await page.locator('[data-hm-more]').click();
    await expect(page.locator('#needsCard .mrow:visible')).toHaveCount(7);
    await expect(page.locator('#needsCard .mfoot')).toContainText('Showing 7 of 12');
    await page.locator('#needsCard [data-needall]').click();
    await expect(page.locator('#needsCard .mrow:visible')).toHaveCount(12);
  });

  test('Temperatures today: no saving-off notice, and Temperature history opens history.html @regression', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'today');
    const card = page.locator('#tempsCard');
    await expect(card).not.toContainText('Saving off');
    await expect(page.locator('#todayChecklist')).not.toContainText('Saving off');
    await expect(card).toHaveAttribute('data-open-row', '');
    const foot = card.locator('.mfoot');
    await expect(foot).toHaveCount(1);
    const link = foot.getByRole('link', { name: 'Temperature history' });
    await expect(link).toHaveAttribute('href', /^\.?\/?history\.html$/);
    await expect(link).not.toHaveAttribute('data-skip');
    await expect(foot.getByRole('button', { name: 'The round' })).toHaveClass(/house-open/);
    await expect(foot.getByRole('button', { name: 'The round' })).toHaveAttribute('data-go', 'round');
    expect(await page.locator('[data-skip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-skip')))).toEqual(['main']);
    // The history page reads a spreadsheet CSV export. Answer it here so the click is a real navigation.
    await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/csv', body: 'on_date\n' }));
    await link.click();
    await expect(page).toHaveURL(/\/history\.html$/);
    await expect(page.locator('h1')).toHaveText('Temperatures');
    await expect(page.locator('h1')).not.toContainText(/outdoor/i);
  });

  // Lisa 11 Nov 2026: "+ Thermometer" on the owner's hub (signed in with Google) opens the owner print page at Add
  // thermometer. The staff page never shows it, and only an OWNER code can save on the print page.
  test('Temperatures today has "+ Thermometer", which opens the print page in add mode', async ({ page }) => {
    await page.goto('cdhub/');
    await expect(page.locator('#addThermo')).toHaveCount(0);   // nothing before the owner signs in
    await signIn(page);
    await openTab(page, 'today');
    const add = page.locator('#tempsCard .mfoot').getByRole('link', { name: '+ Thermometer' });
    await expect(add).toHaveAttribute('href', './staff/print/?add=thermometer');
    const box = await add.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(36);
  });

  test('Temperatures today shows the next 6 outdoor days across, with words for cold, rain and wind', async ({ page, guard }) => {
    const head = 'on_date,reading_kind,min_temp,max_temp,rain_value,wind_kmh,phrase,cloud_cover_pct,source';
    const line = (days, kind, min, max, rain, wind, phrase) =>
      `${iso(days)},${kind},${min},${max},${rain},${wind},${phrase},40,invented`;
    setFile(guard.world, 'BLD-outdoor_temp.csv', [
      head,
      line(-3, 'forecast', 1, 2, 0, 10, 'old forecast phrase'),
      line(2, 'forecast', 1, 2, 0, 5, 'stale twin phrase'),
      line(0, 'forecast', 8, 10, 1.2, 23, 'invented long phrase for outside only'),
      line(1, 'forecast', 20, 29, 0, 10, 'hot day phrase'),
      line(2, 'forecast', 12, 18, 15, 41, 'wet windy phrase'),
      line(3, 'forecast', 11, 16, 4, 39, 'light day phrase'),
      line(4, 'forecast', 10, 14, 0, 0, 'dry day phrase'),
      line(5, 'forecast', 9, 12, 9.9, 40, 'edge day phrase'),
      line(6, 'forecast', 10, 13, 10, 39, 'ten mm phrase'),
      line(7, 'forecast', 1, 2, 0, 99, 'eighth day phrase'),
    ].join('\n') + '\n');
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'today');
    const card = page.locator('#tempsCard');
    const strip = card.locator('.wk');
    const cells = strip.locator('.wkday');
    await expect(cells).toHaveCount(6);
    await expect(card.locator('.mrow')).toHaveCount(3);
    await expect(card.locator('.mrow', { hasText: 'Outside' })).toContainText('invented long phrase for outside only');
    await expect(card.locator('.mrow', { hasText: 'Morning' })).toBeVisible();
    await expect(card.locator('.mrow', { hasText: 'Evening' })).toBeVisible();
    const wd = (days) => new Date(`${iso(days)}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
    await expect(cells.nth(0)).toContainText(wd(1));
    await expect(cells.nth(0)).toContainText('20–29°');
    await expect(cells.nth(0)).not.toContainText('Hot');
    await expect(cells.nth(0)).not.toContainText('none');
    await expect(cells.nth(0)).not.toContainText('Windy');
    await expect(cells.nth(1)).toContainText('12–18°');
    await expect(cells.nth(1)).not.toContainText('OK');
    // Lisa, 8 Nov 2026: the rain amount in mm is removed from the week strip; the drop icon alone says it is wet.
    await expect(cells.nth(1).locator('.wr svg')).toHaveCount(1);
    await expect(cells.nth(1)).not.toContainText('mm');
    await expect(cells.nth(1)).toContainText('Windy');
    await expect(cells.nth(2)).not.toContainText('light');
    await expect(cells.nth(2)).not.toContainText('Windy');
    await expect(cells.nth(3)).not.toContainText('none');
    await expect(cells.nth(3)).not.toContainText('OK');
    await expect(cells.nth(4)).not.toContainText('Cold');
    await expect(cells.nth(4)).not.toContainText('light');
    await expect(cells.nth(4)).toContainText('Windy');
    await expect(cells.nth(5).locator('.wr svg')).toHaveCount(1);
    await expect(cells.nth(5)).not.toContainText('mm');
    await expect(cells.nth(5)).not.toContainText('Windy');
    await expect(strip).not.toContainText('old forecast phrase');
    await expect(strip).not.toContainText('stale twin phrase');
    await expect(strip).not.toContainText('eighth day phrase');
    await expect(strip).not.toContainText('invented long phrase');
    await expect(strip).not.toContainText('invented');
    await expect(strip).not.toContainText('Saving off');
    await expect(strip).not.toContainText('forecast');
    await expect(card).not.toContainText(/\bactual/i);
    await expect(card).not.toContainText('Source');
    const foot = card.locator('.mfoot');
    await expect(foot.getByRole('link', { name: 'Temperature history' })).toHaveAttribute('href', /^\.?\/?history\.html$/);
    await expect(foot.getByRole('button', { name: 'The round' })).toHaveAttribute('data-go', 'round');
    const box = await cells.first().boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(true);
    await expect(strip).toHaveAttribute('tabindex', '0');
    await strip.focus();
    await expect(strip).toBeFocused();
  });

  test('Temperatures today (on Today) shows today\'s outdoor reading; a data check\'s Show (on Compliance) opens its list on Today', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-outdoor_temp.csv', `on_date,reading_kind,min_temp,max_temp,phrase,captured_at,source\n${iso(0)},forecast,8,14,invented mild day,${iso(0)}T07:00:00Z,invented\n`);
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'today');
    await expect(page.locator('#tempsCard')).toContainText('8–14 °C');
    await expect(page.locator('#tempsCard')).toContainText('invented mild day');
    await expect(page.locator('#tempsCard')).not.toContainText(/\bactual/i);
    await expect(page.locator('#tempsCard')).not.toContainText('Source');
    await openTab(page, 'compliance');
    await page.locator('#checksCard button[data-list="nochip"]').click();
    await expect(page.locator('#nav button[data-go="today"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#tpanel')).toContainText('No microchip recorded');
  });

  test('Outside today does not show the reading kind when the phrase is empty @regression', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-outdoor_temp.csv', `on_date,reading_kind,min_temp,max_temp,phrase,captured_at,source\n${iso(0)},actual,8,14,,${iso(0)}T07:00:00Z,invented\n`);
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'today');
    const outside = page.locator('#tempsCard .mrow', { hasText: 'Outside' });
    await expect(outside).toContainText('8–14 °C');
    await expect(outside).not.toContainText(/\bactual/i);
    await expect(page.locator('#tempsCard')).not.toContainText(/source/i);
    await expect(page.locator('#tempsCard .wk')).toHaveCount(0);
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
    await expect(page.locator('.card[data-area] .step').first()).toHaveText('1.');
    await expect(page.locator('.card[data-area]').first()).toContainText('1. Test Cabin A');
  });

  test('Dogs: one filter row (Search, Filter panel, Sort, removable chips); record cards have a name line, title, 72px thumbnail and who-has-it ring', async ({ page }) => {
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
    expect([ph.width, ph.height]).toEqual([72, 72]);
    await expect(card.locator('.whor')).toHaveAttribute('aria-label', 'On site, Test Cabin A');
    const r = await card.evaluate((e) => { const c = e.getBoundingClientRect(), w = e.querySelector('.whor').getBoundingClientRect(); return [Math.round(c.right - w.right), Math.round(c.bottom - w.bottom)]; });
    expect(r[0]).toBeLessThanOrEqual(14); expect(r[1]).toBeLessThanOrEqual(14);   // bottom-right
    expect(await card.locator('.nm').evaluate((e) => getComputedStyle(e).webkitLineClamp)).toBe('2');
  });

  test('Dogs: Moxiclear Rx expiry and the Rx link are read from the subject table', async ({ page, guard }) => {
    setRx(guard.world, {
      'sub-test-dog-1': { date: '2026-10-01', exp: '2026-11-06', url: 'https://example.test/rx/sample-one' },
      'sub-test-dog-2': { exp: '', url: 'https://example.test/rx/sample-two' },
      'sub-test-pup-1': { exp: '2026-03-02', url: '' },
    });
    await page.goto('cdhub/');
    await signIn(page);
    await openTab(page, 'dogs');
    const card = (name) => page.locator('.dc', { has: page.locator('.nm', { hasText: name }) });
    // Rx sits behind More (layout A, Lisa 12 Nov 2026)
    for (const n of ['Test Dog One', 'Test Dog Two', 'Test Pup One']) await card(n).locator('details.more > summary').click();
    const one = card('Test Dog One');
    await expect(one.locator('.wt', { hasText: 'Moxiclear' })).toContainText('6 Nov 2026');
    const rx = one.getByRole('link', { name: 'Rx' });
    await expect(rx).toHaveAttribute('href', 'https://example.test/rx/sample-one');
    await expect(rx).toHaveAttribute('target', '_blank');
    await expect(rx).toHaveAttribute('rel', 'noopener');
    const look = await rx.evaluate((e) => {
      const s = getComputedStyle(e);
      return { h: e.getBoundingClientRect().height, fs: s.fontSize, fw: s.fontWeight, r: s.borderTopLeftRadius, bw: s.borderTopWidth };
    });
    expect(look).toEqual({ h: 36, fs: '14px', fw: '600', r: '12px', bw: '1px' });
    const two = card('Test Dog Two');
    await expect(two.getByRole('link', { name: 'Rx' })).toHaveAttribute('href', 'https://example.test/rx/sample-two');
    await expect(two.locator('.wt', { hasText: 'Moxiclear' })).not.toContainText(/\d/);
    const pup = card('Test Pup One');
    await expect(pup.locator('.wt', { hasText: 'Moxiclear' })).toContainText('2 Mar 2026');
    await expect(pup.getByRole('link', { name: 'Rx' })).toHaveCount(0);

    setRx(guard.world, {
      'sub-test-dog-1': { exp: '', url: '' },
      'sub-test-dog-2': { exp: '', url: 'javascript:alert(1)' },
      'sub-test-pup-1': { exp: 'not-a-date', url: 'not a url' },
    });
    await page.locator('header button[data-reload]').click();
    await expect(page.locator('#nav button[data-go="dogs"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.dc a', { hasText: 'Rx' })).toHaveCount(0);
    await expect(page.locator('#rows')).not.toContainText('Moxiclear');
    await expect(page.locator('#rows')).not.toContainText('javascript:');
  });

  test('Litters stays off the menu, and its address does not open the filter', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#nav button[data-go="litters"]')).toHaveCount(0);
    await page.goto('cdhub/#/litters');
    await expect(page.locator('#lrows, #lsort, [data-fpanel="fp-litters"]')).toHaveCount(0);
    await expect(page.locator('#main h2', { hasText: 'Litters' })).toHaveCount(0);
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
    GEST(guard.world);
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

test('CD Hub: gestation and adult age come from dated rows; no row = not set, judged on the mating date', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-mating.csv', MATINGS());
  await page.goto('cdhub/');
  await signIn(page);
  // No gestation rows: no due date is invented, Today says not set.
  await openTab(page, 'today');
  await expect(page.locator('#main')).toContainText('gestation timings');
  await expect(page.locator('#main')).not.toContainText('working due (+63)');
  const r = await page.evaluate(() => {
    const unset = inWhelp().map((x) => !!x.unset);
    // A rule that starts AFTER the mating does not apply to it; one in force on the mating date does.
    const m = inWhelp()[0].on;
    T['BLD-breeding_rule.csv'] = [
      { id: 'a', rule_key: 'gestation.due_days', value: '60', effective_from: '2010-01-01', source: 'Old pretend' },
      { id: 'b', rule_key: 'gestation.window_from_days', value: '55', effective_from: '2010-01-01', source: 'Old pretend' },
      { id: 'c', rule_key: 'gestation.window_to_days', value: '70', effective_from: '2010-01-01', source: 'Old pretend' },
      { id: 'd', rule_key: 'gestation.due_days', value: '65', effective_from: addDays(m, 1), source: 'New pretend' },
    ];
    const g = inWhelp()[0];
    const adultNone = adultMonths();
    T['BLD-breeding_rule.csv'].push({ id: 'e', rule_key: 'dog.adult_from_months', value: '6', effective_from: '2010-01-01', source: 'Pretend' });
    return { unset, due: g.due, want: addDays(m, 60), adultNone, adult: adultMonths(), pup: isPupM(3), grown: isAdultM(7) };
  });
  expect(r.unset.every(Boolean)).toBe(true);
  expect(r.due).toBe(r.want);
  expect(r.adultNone).toBeNull();
  expect([r.adult, r.pup, r.grown]).toEqual([6, true, true]);
});

test('CD Hub: The round shows a Kept readings card (from BLD-area_reading.csv), not a Bloodline placeholder', async ({ page }) => {
  await page.goto('cdhub/');
  await signIn(page);
  await openTab(page, 'round');
  await expect(page.locator('#kept-readings h3')).toHaveText('Kept readings');
  await expect(page.locator('#arrive-reading')).toHaveCount(0);
  await page.locator('#rdate').fill('2026-01-15');
  await page.locator('#rdate').dispatchEvent('change');
  const rows = page.locator('#kept-readings tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('td').nth(1).locator('.ic')).toHaveClass(/cold/);   // 8.50 min: blue
  await expect(rows.nth(0).locator('td').nth(2).locator('.ic')).toHaveClass(/late/);   // 28.50 max: red
  await expect(rows.nth(1).locator('td').nth(1).locator('.ic')).toHaveClass(/ok/);     // 12-20: green
});

test('CD Hub: temperature limits come from the band rows; puppies use their own row; no row is unknown', async ({ page }) => {
  await page.goto('cdhub/');
  await signIn(page);
  await openTab(page, 'round');
  const r = await page.evaluate(() => {
    const out = {};
    out.adult26 = tempState('15', '26.0');
    out.adultHot = tempState('15', '26.1');
    out.adultCold = tempState('9.9', '20');
    CD._byId.tpup = { id: 'tpup', dob: '2026-01-01' };
    CD.dogs.push({ id: 'tpup', area_id: 'test-pup-room', dob: '2026-01-01' });
    const pup = roomBand('test-pup-room', '2026-01-10');
    out.pupOk = tempState('26.5', '27.5', pup);
    out.pupCold = tempState('22', '24', pup);
    CD.dogs.push({ id: 'tnodob', area_id: 'test-nodob-room', dob: '' });
    CD._byId.tnodob = { id: 'tnodob', dob: '' };
    out.noDob = tempState('15', '20', roomBand('test-nodob-room', '2026-01-10'));
    CD.tempBands = [];
    out.noRows = tempState('15', '20');
    return out;
  });
  expect(r).toEqual({ adult26: 'ok', adultHot: 'hot', adultCold: 'cold', pupOk: 'ok', pupCold: 'cold', noDob: 'unknown', noRows: 'unknown' });
});

test.describe('CD Hub: no placeholder boxes or build notes on live tabs; dates are DD/MM/YY', () => {
  test('Dogs and Do carry no "Arrives with Bloodline" boxes', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    for (const tab of ['dogs', 'work']) {
      await openTab(page, tab);
      await expect(page.locator('#main .arrives, #main [data-arrives]')).toHaveCount(0);
      await expect(page.locator('#main')).not.toContainText('BLD-WORK.csv');
    }
    expect(await page.evaluate(() => [dmy('2026-11-12'), plural(1, 'row'), plural(2, 'row')])).toEqual(['12/11/26', '1 row', '2 rows']);
  });
});

