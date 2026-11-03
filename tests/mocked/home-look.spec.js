// Home (the Dashboard) in the house look (LINKS-COMFORT-BRIEF v3, 28 Oct 2026): 1px lines, hover never moves anything,
// nothing under 13px, two weights, no coloured words, no solid colour fills, dark frame, phone without sideways scroll,
// dark mode contrast. Plus the home improvements: Needs you split, the Next card and the green-tick empty state.
const { test, expect, buildWorld } = require('../support/test');
const { tabClick } = require('../support/tabs');
const { settle } = require('../support/settle');

const SHOTS = process.env.HOME_SHOTS; // folder for screenshots (optional; off in CI)

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  await expect(page.locator('#homeTop')).toBeVisible();
};
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};
const VIEWS = [['map', 'Dashboard'], ['money', 'Money'], ['drives', 'Drives'], ['bin', 'Bin'], ['changes', 'Changes · Recent']]; // Money moved off Main into More (Lisa, 2 Nov)
const goTab = async (page, key, title) => {
  await tabClick(page, `#mainNav a[data-nav="${key}"]`);
  await expect(page.locator('#hereTitle')).toHaveText(title);
};

// Shared page helpers: colour parsing and WCAG contrast, run inside the browser.
const HELPERS = () => {
  const rgb = (s) => { s = String(s); const srgb = /^color\(srgb/.test(s); const m = s.replace(/^color\(srgb/, '').match(/[\d.]+/g); if (!m) return null; // color-mix() computes to color(srgb 0-1 ...)
    const k = srgb ? 255 : 1; const a = srgb ? (s.includes('/') ? +m[3] : 1) : (m[3] == null ? 1 : +m[3]); return { r: +m[0] * k, g: +m[1] * k, b: +m[2] * k, a }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const visibleText = () => Array.from(document.querySelectorAll('body *')).filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
    .filter((e) => !e.closest('.sr, [aria-hidden="true"]') && getComputedStyle(e).visibility !== 'hidden')
    .filter((e) => Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim()))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; });
  window.__look = { rgb, lum, ratio, bgOf, visibleText };
};

test.describe('Home: house look', () => {
  test('hover only turns the 1px edge ink: no element grows, shrinks or moves', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    // Drives, Bin and Changes sit under More now (Lisa's tab picks, 2 Nov): the bottom-bar check uses More itself.
    const sels = ['a.hometile >> nth=0', 'a.keytile >> nth=0', '#urgentOne a.btn', 'header #refreshBtn', '#mainNav [data-house-more]'];
    for (const sel of sels) {
      const el = page.locator(sel);
      if (!(await el.count())) continue;
      await page.mouse.move(2, 400);
      const before = await el.evaluate((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { x: r.x, y: r.y, w: r.width, h: r.height, b: [c.borderTopWidth, c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth].join(' '), p: c.padding }; });
      await el.hover();
      await settle(el);
      const after = await el.evaluate((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { x: r.x, y: r.y, w: r.width, h: r.height, b: [c.borderTopWidth, c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth].join(' '), p: c.padding, ow: parseFloat(c.outlineWidth) || 0, os: c.outlineStyle }; });
      expect({ x: after.x, y: after.y, w: after.w, h: after.h, b: after.b, p: after.p }, sel + ' moved or changed size on hover').toEqual(before);
      if (after.os !== 'none') expect(after.ow, sel + ': hover line').toBeLessThanOrEqual(1);
      expect(after.b.split(' ').every((v) => parseFloat(v) <= 1), sel + ': borders are 1px at most').toBe(true);
    }
    // Bottom tab: no outline; the colour bar under the label widens instead (same height).
    const tab = page.locator('#mainNav [data-house-more]');
    await page.mouse.move(2, 400);
    await settle(tab); // the hover from the loop above has gone and the line is back to its resting width
    const bar0 = await tab.locator('.bar').boundingBox();
    expect(bar0.width, 'short grey line at rest').toBeCloseTo(18, 0);
    await tab.hover(); await settle(tab); // the bar's width transition has finished
    const bar1 = await tab.locator('.bar').boundingBox();
    expect(bar1.width).toBeGreaterThan(bar0.width);
    expect(bar1.height).toBe(bar0.height);
    expect(await tab.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('none');
  });

  // Lisa's extra rules (28 Oct): 1) every pressable rests on the same clear line (warm #8A7F70 / cool #7A8692, 3:1 on the page and tints), 1px, 12px radius,
  // 36px desktop, 14px/600, never starts out ink, and hover = 1px ink outline offset -1px; read-only pills have no hover.
  // 2) date pills: plain 1px ring + muted words; late = rose ring + tint; soon = amber ring + tint. 3) 13px floor, 400/600. 4) one radius.
  for (const [look, line] of [['warm', 'rgb(138, 127, 112)'], ['cool', 'rgb(122, 134, 146)']]) {
    test(`${look}: every pressable rests on the same clear line and hover turns it ink; read pills have no hover`, async ({ page }) => {
      if (look === 'cool') await page.addInitScript(() => localStorage.setItem('dash-look', JSON.stringify({ bg: 'cool' })));
      await page.goto('./');
      await signIn(page);
      for (const [key, title] of VIEWS) {
        await goTab(page, key, title);
        const bad = await page.evaluate((line) => {
          const out = [];
          const ink = getComputedStyle(document.body).color;
          const PRESS = 'main .btn:not([disabled]):not(.danger):not(.ai), header .btn:not([disabled]), .subnav a, input.find, .picker select, a.hometile, a.keytile, a.card, a.ment:not(.bad)';
          document.querySelectorAll(PRESS).forEach((e) => {
            if (e.offsetParent === null) return;
            const c = getComputedStyle(e), n = (e.className || e.tagName) + ' "' + e.textContent.trim().slice(0, 20) + '"';
            const sides = [c.borderTopWidth, c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth];
            if (sides.some((w) => w !== '1px')) out.push(n + ' border ' + sides.join(' '));
            if ([c.borderTopColor, c.borderRightColor, c.borderBottomColor, c.borderLeftColor].some((x) => x !== line)) out.push(n + ' line ' + c.borderTopColor);
            if (c.borderTopColor === ink) out.push(n + ' starts out ink');
            if (c.borderTopLeftRadius !== '12px') out.push(n + ' radius ' + c.borderTopLeftRadius);
            if (/\bbtn\b/.test(e.className) || e.matches('.subnav a')) {
              const h = e.getBoundingClientRect().height;
              if (Math.round(h) < 36) out.push(n + ' height ' + h);
              if (c.fontSize !== '14px' || c.fontWeight !== '600') out.push(n + ' type ' + c.fontSize + '/' + c.fontWeight);
            }
          });
          return out.slice(0, 6);
        }, line);
        expect(bad, `${look} ${title}`).toEqual([]);
      }
      await goTab(page, 'map', 'Dashboard');
      // Hover: the same 1px edge turns ink (an outline over it), on a button, a tile and a link card.
      for (const sel of ['#urgentOne a.btn', 'a.hometile >> nth=0', 'a.keytile >> nth=0']) {
        const el = page.locator(sel);
        if (!(await el.count())) continue;
        await el.hover(); await settle(el);
        const o = await el.evaluate((e) => { const c = getComputedStyle(e); return [c.outlineStyle, c.outlineWidth, c.outlineOffset, c.outlineColor === getComputedStyle(document.body).color]; });
        expect(o, sel + ' hover').toEqual(['solid', '1px', '-1px', true]);
      }
      // Read-only pills: hovering changes nothing.
      for (const sel of ['#needsToday .mtag >> nth=0']) {
        const el = page.locator(sel);
        if (!(await el.count())) continue;
        const before = await el.evaluate((e) => { const c = getComputedStyle(e); return [c.outlineStyle, c.borderTopColor, c.backgroundColor].join('|'); });
        await el.hover(); await settle(el);
        const after = await el.evaluate((e) => { const c = getComputedStyle(e); return [c.outlineStyle, c.borderTopColor, c.backgroundColor].join('|'); });
        expect(after, sel + ' changed on hover').toBe(before);
      }
      // The Needs you pills open what they count (Lisa, 2 Nov): each is a link to Do for its group; hover = 1px line inside
      // (rose for urgent, ink for the plain ones), never thicker, never moves.
      for (const el of await page.locator('#needsSplit .cnt').all()) {
        expect(await el.evaluate((e) => e.tagName)).toBe('A');
        await expect(el).toHaveAttribute('href', /^#\/do\/(urgent|soon|todo)$/);
        const box = await el.boundingBox();
        await el.hover(); await settle(el);
        const o = await el.evaluate((e) => { const c = getComputedStyle(e); return { o: [c.outlineStyle, c.outlineWidth, c.outlineOffset].join(' '), ink: c.outlineColor === getComputedStyle(document.body).color, risk: e.classList.contains('k-risk') }; });
        expect(o.o).toBe('solid 1px -1px');
        expect(o.ink, 'urgent keeps its rose line; the others turn ink').toBe(!o.risk);
        expect(await el.boundingBox()).toEqual(box);
      }
    });
  }

  // House hover rule (28 Oct): a meaning-coloured control keeps its own colour on hover (1px line inside + pale tint of it), never ink;
  // a neutral control gets the 1px ink line + a pale muted tint. Checked in light and dark.
  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: hover keeps a coloured control in its own colour (line, never ink); neutral = ink line; never a fill (Lisa\'s sweep, 3 Nov)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('./');
      await signIn(page);
      await page.evaluate(HELPERS);
      const check = async (sel, coloured) => {
        const el = page.locator(sel).first();
        await expect(el, sel).toBeVisible();
        await el.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0); await settle(el);
        const rest = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
        await el.hover(); await settle(el);
        return el.evaluate((e, [coloured, rest]) => {
          const L = window.__look, c = getComputedStyle(e), root = getComputedStyle(document.documentElement);
          const col = (v) => { const d = document.createElement('i'); d.style.color = v; document.body.appendChild(d); const x = getComputedStyle(d).color; d.remove(); return x; };
          const ink = getComputedStyle(document.body).color, card = col(root.getPropertyValue('--card').trim());
          const hc = col(c.getPropertyValue('--hc').trim() || 'transparent');
          return { outline: c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineOffset, oc: c.outlineColor, ink, bg: c.backgroundColor, card, hc,
            rest, coloured };
        }, [coloured, rest]);
      };
      // Stage 2c: the home tiles and the More tab are gone, so the coloured and neutral checks use what remains.
      const coloured = [['a.ment.bad', 'rose money entity'], ['a.ment:not(.bad)', 'copper money entity']];
      const run = async (list) => { for (const [sel, name] of list) {
        const r = await check(sel, true);
        expect(r.outline, name).toBe('solid 1px -1px');
        expect(r.oc, name + ': hover line is not ink').not.toBe(r.ink);
        expect(r.bg, name + ': no fill on hover').toBe(r.rest);
      } };
      for (const sel of ['#urgentOne a.btn']) {
        const r = await check(sel, false);
        expect([r.outline, r.oc], sel + ': neutral hover = ink line').toEqual(['solid 1px -1px', r.ink]);
        expect(r.bg, sel + ': no fill on hover').toBe(r.rest);
      }
      // A hub tile's links (its name and its 3 numbers) take the tile's own colour on hover: a 1px ring only, no fill (Lisa, 2 Nov).
      for (const sel of ['.hubtile a.hgo', '.hubtile a.hk']) {
        const el = page.locator(sel).first();
        await el.scrollIntoViewIfNeeded();
        await el.hover(); await settle(el);
        const r = await el.evaluate((e) => {
          const c = getComputedStyle(e), d = document.createElement('i');
          d.style.color = getComputedStyle(e.closest('.hubtile')).getPropertyValue('--sc').trim() || getComputedStyle(document.body).color;
          document.body.appendChild(d); const sc = getComputedStyle(d).color; d.remove();
          return { outline: c.outlineStyle + ' ' + c.outlineWidth + ' ' + c.outlineOffset, oc: c.outlineColor, sc, bg: c.backgroundColor };
        });
        expect([r.outline, r.oc], sel + ': hover = 1px ring in the tile colour').toEqual(['solid 1px -1px', r.sc]);
        expect(r.bg, sel + ': no fill on hover').toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
      }
      await goTab(page, 'money', 'Money'); // the money entity cards moved off Main into More (Lisa, 2 Nov)
      await run(coloured);
      await goTab(page, 'bin', 'Bin');
      const allow = page.locator('[data-action="grantwrite"]');
      if (await allow.count()) { await page.locator('#view details.fold > summary').first().click().catch(() => {}); }
      if (await allow.isVisible()) await run([['[data-action="grantwrite"]', 'rose Allow Bin actions']]);
    });
  }

  test('date pills: plain 1px ring with muted words; late = rose ring + tint, soon = amber ring + tint; one 12px radius', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const pills = await page.locator('.mtag:visible').evaluateAll((els) => els.map((e) => {
      const c = getComputedStyle(e), r = getComputedStyle(document.documentElement);
      const col = (v) => { const d = document.createElement('i'); d.style.color = r.getPropertyValue(v).trim(); document.body.appendChild(d); const x = getComputedStyle(d).color; d.remove(); return x; };
      const kind = e.classList.contains('risk') ? 'late' : e.classList.contains('fin') ? 'soon' : 'plain';
      return { kind, t: e.textContent.trim(), w: c.borderTopWidth, ring: c.borderTopColor, bg: c.backgroundColor, ink: c.color, rad: c.borderTopLeftRadius, h: e.getBoundingClientRect().height,
        want: kind === 'late' ? [col('--ljr-2'), col('--ljr-2-tint'), col('--ink')] : kind === 'soon' ? [col('--ljr-3-text'), col('--ljr-3-tint'), col('--ink')] : [col('--ctl'), 'rgba(0, 0, 0, 0)', col('--muted')] };
    }));
    expect(pills.length).toBeGreaterThan(0);
    for (const p of pills) {
      expect([p.ring, p.bg, p.ink], `${p.kind} pill "${p.t}"`).toEqual(p.want);
      expect([p.w, p.rad, p.h], `"${p.t}" ring, radius, height`).toEqual(['1px', '12px', 24]);
    }
    expect(pills.some((p) => p.kind === 'late') || pills.some((p) => p.kind === 'soon'), 'sample data has a late or soon date').toBe(true);
  });

  test('one radius: every boxed thing on the home views has a 12px corner (circles only for status dots and the tick ring)', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    for (const [key, title] of VIEWS) {
      await goTab(page, key, title);
      const bad = await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter((e) => {
        if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return false;
        if (e.matches('.shape, .okring, .info, nav.main .bar, svg, svg *, .note.fail, .res.bad, .cnt, nav.main .n, nav.house-tabs .hic')) return false; // counts: their own fixed size; the tab icon ring is round (Lisa's tab picks)
        const c = getComputedStyle(e);
        const boxed = parseFloat(c.borderTopWidth) > 0 && c.borderTopStyle !== 'none' && c.borderTopColor !== 'rgba(0, 0, 0, 0)' && parseFloat(c.borderRightWidth) > 0;
        return boxed && c.borderTopLeftRadius !== '12px';
      }).map((e) => e.className + ' ' + getComputedStyle(e).borderTopLeftRadius).slice(0, 6));
      expect(bad, title).toEqual([]);
    }
  });

  test('every count pill is one fixed size: 1 and 2 digits match exactly (30 x 24, line 22px, radius 12px, 14px number), even in a wider font; tab counts are the 24 x 24 corner ring', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    // Fonts are not loaded in tests, so CI's fallback can be wider than Lexend: probe in the page font AND in a forced wide font.
    for (const font of ['', 'Verdana, "DejaVu Sans", sans-serif']) {
      const sizes = await page.evaluate((font) => {
        const probe = (txt, cls) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; if (font) { s.style.fontFamily = font; s.style.letterSpacing = '0.5px'; }
          const box = document.createElement('div'); box.appendChild(s); (/\bn\b/.test(cls) ? document.querySelector('#mainNav a') : document.getElementById('homeTop')).appendChild(/\bn\b/.test(cls) ? s : box);
          const r = s.getBoundingClientRect(), c = getComputedStyle(s); const o = [r.width, r.height, c.lineHeight, c.borderTopLeftRadius]; s.remove(); box.remove(); return o; };
        return { c1: probe('1', 'cnt'), c2: probe('88', 'cnt'), n1: probe('1', 'n need'), n2: probe('88', 'n need'), c3: probe('888', 'cnt wide'), n3: probe('888', 'n need wide') };
      }, font);
      for (const k of ['c1', 'c2']) expect(sizes[k], (font || 'page font') + ' ' + k).toEqual([30, 24, '22px', '12px']);
      // Tab counts (Lisa's tab picks, 2 Nov) hold a 14px number (pick A): one 24 x 24 box for 1 and 2 digits, 22px line, 12px ends.
      for (const k of ['n1', 'n2']) expect(sizes[k], (font || 'page font') + ' ' + k).toEqual([24, 24, '22px', '12px']);
      expect(sizes.c3[0], '3 digits may grow').toBeGreaterThan(30);
      expect(sizes.n3[0], '3 digits may grow').toBeGreaterThan(sizes.n1[0]);
    }
    // The real tab count gets .wide only at 3+ digits.
    const n = page.locator('#n-map');
    if ((await n.textContent()).trim().length <= 2) await expect(n).not.toHaveClass(/\bwide\b/);
  });

  test('every home view: sizes 14 / 15 / 18px only, weights 400 / 500 / 600 only, no uppercase labels, line height 1.5', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await page.evaluate(HELPERS);
    expect(await page.evaluate(() => getComputedStyle(document.body).lineHeight)).toBe('22.5px'); // 15px body (Lisa's type, 2 Nov) x 1.5
    for (const [key, title] of VIEWS) {
      await goTab(page, key, title);
      const bad = await page.evaluate(() => window.__look.visibleText().map((e) => { const c = getComputedStyle(e); return { t: e.textContent.trim().slice(0, 30), px: parseFloat(c.fontSize), w: c.fontWeight, u: c.textTransform }; })
        .filter((x) => ![14, 15, 18].includes(x.px) || !['400', '500', '600'].includes(x.w) || x.u === 'uppercase').slice(0, 5));
      expect(bad, title).toEqual([]);
    }
  });

  test('no coloured words and no solid colour fills on markers (counts, tags, buttons, tab counts)', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    await page.evaluate(HELPERS);
    for (const [key, title] of VIEWS) {
      await goTab(page, key, title);
      const res = await page.evaluate(() => {
        const L = window.__look, root = getComputedStyle(document.documentElement);
        const v = (n) => { const d = document.createElement('i'); d.style.color = root.getPropertyValue(n).trim(); document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
        const allowed = new Set([v('--ink'), v('--muted'), v('--frame-ink')]);
        const fills = new Set(['--ljr-2', '--ljr-3', '--ljr-4', '--ljr-5', '--ljr-6', '--ljr-7', '--ljr-8', '--ljr-2-solid', '--ljr-7-solid', '--ljr-8-solid', '--ljr-2-text', '--ljr-7-text'].map(v));
        const words = L.visibleText().filter((e) => !allowed.has(getComputedStyle(e).color)).map((e) => getComputedStyle(e).color + ' "' + e.textContent.trim().slice(0, 30) + '"');
        const solid = Array.from(document.querySelectorAll('.mtag, .cnt, .chip, .btn, nav.main .n, .stat, a.hometile, a.keytile, .ment, .banner'))
          .filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
          .filter((e) => fills.has(getComputedStyle(e).backgroundColor)).map((e) => e.className + ' ' + getComputedStyle(e).backgroundColor);
        return { words: words.slice(0, 5), solid: solid.slice(0, 5) };
      });
      expect(res.words, title + ': coloured words').toEqual([]);
      expect(res.solid, title + ': solid colour fills').toEqual([]);
    }
  });

  test('dark frame top and bottom; light tab buttons; the Main tab count is a ring with no fill: rose only when one is late, else grey (Lisa\'s tab picks; sweep 3 Nov)', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const head = await page.locator('header').evaluate((e) => getComputedStyle(e).backgroundColor);
    const foot = await page.locator('#mainNav').evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(head).toBe('rgb(58, 54, 50)'); // #3A3632 warm charcoal, never black
    expect(foot).toBe('rgb(70, 65, 59)'); // #46413B one step lighter
    const tab = await page.locator('#mainNav a[data-nav="map"]').evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(tab).toBe('rgb(255, 254, 251)');
    const n = page.locator('#n-map');
    if ((await n.textContent()).trim()) {
      const c = await n.evaluate((e) => { const s = getComputedStyle(e); return { b: s.borderTopWidth, bc: s.borderTopColor, bg: s.backgroundColor, h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width }; });
      expect(c.b).toBe('1px');
      // Rose = late only (Lisa's sweep, 3 Nov 2026): a rose count is read out as "N late", so it is rose only when it says late.
      const late = await n.evaluate((e) => e.classList.contains('need'));
      expect(c.bc).toBe(late ? 'rgb(230, 68, 61)' : 'rgb(138, 127, 112)'); // rose ring (late) or the grey read-only ring
      await expect(page.locator('#mainNav a[data-nav="map"]')).toHaveAttribute('aria-label', late ? /late$/ : /waiting$/);
      expect(c.bg).toBe('rgba(0, 0, 0, 0)'); // ring only, no fill (Lisa's tab picks, 2 Nov)
      expect([c.h, c.w], 'tab count 24 x 24 (a 14px number, Lisa\'s pick A)').toEqual([24, 24]);
    }
  });

  test('Next card: white, 1px ink edge, one button; Needs you shows its urgency split', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const next = page.locator('#urgentOne');
    const total = Number((await page.locator('.needsline').textContent()).match(/\d+/)[0]);
    test.skip(!total, 'sample data has nothing that needs you');
    await expect(next.locator('h3')).toHaveText('Next');
    await expect(next.locator('a.btn')).toHaveCount(1);
    const st = await next.evaluate((e) => { const c = getComputedStyle(e); return { w: c.borderTopWidth, c: c.borderTopColor, ink: getComputedStyle(document.body).color, bg: c.backgroundColor }; });
    expect(st.w).toBe('1px');
    expect(st.c).toBe(st.ink);
    expect(st.bg).toBe('rgb(255, 254, 251)');
    const split = page.locator('#needsSplit .cnt');
    const sum = (await split.allTextContents()).reduce((a, t) => a + Number(t.match(/^\d+/)[0]), 0);
    expect(sum, 'urgent + due soon + to do = Needs you').toBe(total);
    // "+N more" is one short link to Do (Lisa, 2 Nov).
    if (total > 1) {
      const more = next.locator('a.more');
      await expect(more).toHaveText('+' + (total - 1) + ' more');
      await expect(more).toHaveAttribute('href', '#/do');
      const mb = await more.evaluate((e) => { const c = getComputedStyle(e); return [c.borderTopWidth, c.textDecorationLine]; });
      expect(mb, '+N more is a plain text link, not a box').toEqual(['0px', 'underline']);
    }
    await expect(next).not.toContainText('in Needs you, below');
    // Each pill opens Do showing exactly the rows it counted.
    for (const el of await split.all()) {
      const [n, word] = (await el.textContent()).match(/^(\d+) (.+)$/).slice(1);
      await el.click();
      await expect(page.locator('#view')).toHaveAttribute('data-view', 'do');
      await expect(page.locator('#todoGroupTitle')).toHaveText('Do · ' + word);
      await expect(page.locator('#todoGroup ol > li')).toHaveCount(Number(n));
      await page.evaluate(() => { location.hash = '#/map'; });
      await expect(page.locator('#view')).toHaveAttribute('data-view', 'map');
    }
  });

  test('nothing needs you: a friendly empty state with a small green-ring tick', async ({ page, guard }) => {
    guard.world.email = buildWorld({ email: 'someone.else@example.test' }).email;
    await page.goto('./');
    await signIn(page);
    const total = Number((await page.locator('.needsline').textContent()).match(/\d+/)[0]);
    test.skip(total > 0, 'this sample still has something that needs you');
    await expect(page.locator('#urgentOne h3')).toHaveText('Nothing needs you');
    const ring = page.locator('#urgentOne .okring');
    await expect(ring).toHaveText('✓');
    const c = await ring.evaluate((e) => getComputedStyle(e).borderTopColor);
    expect(c).toBe('rgb(81, 173, 87)'); // green ring
    await expect(page.locator('#needsToday .okring')).toHaveText('✓');
  });

  test('follows the Look saved in Studio: Cool clear gives the slate frame; Mode dark darkens the page', async ({ page }) => {
    await page.addInitScript(() => { if (!localStorage.getItem('dash-look')) localStorage.setItem('dash-look', JSON.stringify({ bg: 'cool', mode: 'dark' })); });
    await page.goto('./');
    await expect(page.locator('html')).toHaveClass(/look-cool/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(22, 25, 28)');
    await page.evaluate(() => localStorage.setItem('dash-look', JSON.stringify({ bg: 'cool', mode: 'light' })));
    await page.reload();
    expect(await page.locator('header').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(51, 71, 91)'); // #33475B slate
  });
});

for (const scheme of ['light', 'dark']) {
  test.describe(`Home: contrast in ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    test(`${scheme}: every text 4.5:1 on its background, every control edge 3:1`, async ({ page }) => {
      await page.goto('./');
      await signIn(page);
      await page.evaluate(HELPERS);
      for (const [key, title] of VIEWS) {
        await goTab(page, key, title);
        const res = await page.evaluate(() => {
          const L = window.__look;
          const text = L.visibleText().map((e) => ({ e, r: L.ratio(L.rgb(getComputedStyle(e).color), L.bgOf(e)) }))
            .filter((x) => x.r < 4.5).map((x) => x.r.toFixed(2) + ' "' + x.e.textContent.trim().slice(0, 30) + '"');
          const edges = Array.from(document.querySelectorAll('.btn:not([disabled]), .mtag, .cnt, nav.main .n:not(:empty), input.find, .picker select'))
            .filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
            .map((e) => ({ e, r: L.ratio(L.rgb(getComputedStyle(e).borderTopColor), L.bgOf(e.parentElement)) }))
            .filter((x) => x.r < 3).map((x) => x.r.toFixed(2) + ' ' + x.e.className + ' "' + x.e.textContent.trim().slice(0, 20) + '"');
          return { text: text.slice(0, 6), edges: edges.slice(0, 6) };
        });
        expect(res.text, `${title}: text below 4.5:1`).toEqual([]);
        expect(res.edges, `${title}: control edges below 3:1`).toEqual([]);
      }
    });
  });
}

test.describe('Home: phone (390 x 844)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('no sideways scroll on any view; tab counts are a dot at the icon\'s top right; press targets 44px', async ({ page }) => {
    await page.goto('./');
    await noSidewaysScroll(page, 'signed out');
    await signIn(page);
    for (const [key, title] of VIEWS) {
      await goTab(page, key, title);
      await noSidewaysScroll(page, title);
    }
    await goTab(page, 'map', 'Dashboard');
    const n = page.locator('#n-map');
    // Lisa's pick b (2 Nov): on a phone the count is an 8px dot just off the icon's top-right corner, inside the tab.
    const c = await n.evaluate((e) => { const r = e.getBoundingClientRect(), t = e.parentElement.getBoundingClientRect(), i = e.parentElement.querySelector('.hic').getBoundingClientRect();
      return { pos: getComputedStyle(e).position, w: r.width, h: r.height, gap: r.left - i.right, top: r.top - i.top, inside: r.right <= t.right }; });
    expect(c.pos).toBe('absolute');
    expect([c.w, c.h]).toEqual([8, 8]);
    expect(c.gap).toBeGreaterThanOrEqual(0);
    expect(c.gap).toBeLessThanOrEqual(3);
    expect(Math.abs(c.top)).toBeLessThanOrEqual(2);
    expect(c.inside).toBe(true);
    // On a phone Sign out leaves the top bar for the Look menu (Lisa's pick A, 2 Nov); both are 44px there.
    await expect(page.locator('header #signOutBtn')).toBeHidden();
    await page.locator('header #houseLookBtn').click();
    for (const sel of ['header #refreshBtn', 'header #houseLookBtn', '#houseLook [data-house-menu-signout]', '#urgentOne a.btn']) {
      const el = page.locator(sel);
      if (await el.count()) expect((await el.boundingBox()).height, sel).toBeGreaterThanOrEqual(44);
    }
  });
});

if (SHOTS) {
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    for (const scheme of ['light', 'dark']) {
      test(`screenshot ${w} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('./');
        await signIn(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/hub-home-${w}-${scheme}.png`, fullPage: true });
        await goTab(page, 'drives', 'Drives');
        await page.screenshot({ path: `${SHOTS}/hub-home-${w}-${scheme}-drives.png`, fullPage: false });
      });
    }
  }
}
