// Factory house look (Lisa's rules, 28 Oct 2026), checked by computed style on every view, light and dark.
// 1 no solid colour fills (tint inside a 1px line; the new-comment dot and the switch knob are the two allowed solids)
// 2 no coloured words   3 1px lines; every pressable rests on one clear control line (3:1)   4 one 12px radius
// 5 dark frame top and bottom; light tabs with no ring, a colour bar that widens   6 counts are a fixed 30 x 22 pill
// 7 Lexend 400/600, nothing under 13px   9 date pills always ringed   10 hover: neutral = ink line + tint; meaning = own colour
// 13 friendly empty states. Plus: no colour written in the page. Pretend Google and Drive; invented data only.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { settle } = require('../support/settle');
const { build } = require('../fixtures/factory/state');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'factory', 'index.html'), 'utf8');
const LOGS = require('../support/world').IDS.factoryLogs;
const VIEWS = ['rooms', 'me', 'decide', 'do', 'docs', 'today', 'card/869fjxpc2', 'room/rig', 'item/869fk9d1r', 'app/links', 'health', 'all', 'stuck', 'new'];
const PRESS = '#view .btn, #view button.pill, #view a.pill, #view .fbtn, #view .ch, #view .more, #view .copy, #view .undo, #view label.date, #view a.chip, #view a.need, ' +
  '#view .ico, #view .flagb, #view .mark, #view .plus, #view a.lk, #view button.lk, #view .sbox, #appMenu a.pill';
// Meaning buttons (Yes / No / Off) and status pills that are links rest on their own colour line (Lisa's approved picture, 28 Oct).
const MEANING = '.btn.yes, .btn.no, .lk.off, a.need, a.chip.stuck, a.pill.alert.has, label.date.over, label.date.soon, .stat';

// A comment newer than "seen" (the unread dot), a due date tomorrow (amber) and one overdue (rose) are added to the sample data.
async function open(page, guard, hash, { scheme, change } = {}) {
  const st = build(Date.now());
  st.lists.decisions[0].cm = [{ by: 'Claude', at: Date.now(), text: 'A sample note' }];
  st.lists.work[1].due = Date.now() + 864e5;
  if (change) change(st);
  guard.world.folder(LOGS, 'AF logs (sample)');
  guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(st), { parents: [LOGS], mimeType: 'application/json' });
  if (scheme) await page.emulateMedia({ colorScheme: scheme });
  await page.goto('factory/' + (hash || '#/rooms'));
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#appPick')).toBeVisible();
}
async function go(page, v) {
  await page.evaluate((h) => { location.hash = '#/' + h; }, v);
  await expect(page.locator('#view > *').first()).toBeVisible();
}
// Shared helpers, run in the page.
const HELP = () => {
  window.__fx = {
    norm: (c) => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; },
    tok: (n) => window.__fx.norm(getComputedStyle(document.documentElement).getPropertyValue(n).trim()),
    rgb: (c) => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); const m = v.match(/[\d.]+/g).map(Number); return /^color\(/.test(v) ? m.slice(0, 3).map((x) => x * 255).concat(m[3] === undefined ? 1 : m[3]) : m; },
    L: (c) => { const [r, g, b] = window.__fx.rgb(c).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; },
    ratio: (a, b) => { const x = window.__fx.L(a), y = window.__fx.L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); },
    seen: (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden',
    what: (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className).replace(/\s+/g, '.')) + ' "' + (e.textContent || '').trim().slice(0, 24) + '"',
    bgOf: (e) => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor, a = window.__fx.rgb(c); if (a.length < 4 || a[3] > 0.5) return c; } return getComputedStyle(document.body).backgroundColor; },
  };
};

test('colours come only from tokens.css: no colour is written in the page style', () => {
  const css = /<style>([\s\S]*?)<\/style>/.exec(SRC)[1].replace(/\/\*[\s\S]*?\*\//g, ''); // comments may name a colour
  expect(SRC).toContain('<link rel="stylesheet" href="../tokens.css">');
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  expect(css).not.toMatch(/\b(rgba?|hsla?)\(/i);
  expect(css).not.toMatch(/:\s*(white|black|red|green|blue|grey|gray|orange|yellow|purple)\b/i);
  expect(SRC).toContain('family=Lexend:wght@400;600&');
});

test.describe('Factory look: rules by computed style on every view', () => {
  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: type, colour, radius, pressables, counts and dates`, async ({ page, guard }) => {
      test.setTimeout(120_000);
      await open(page, guard, '#/rooms', { scheme });
      await page.evaluate(HELP);
      for (const v of VIEWS) {
        await go(page, v);
        if (v === 'do') { await page.locator('#filtersBtn').click(); await page.mouse.move(0, 0); }
        if (v === 'rooms') { await page.locator('#appPick').click(); await page.mouse.move(0, 0); }
        const bad = await page.evaluate(({ PRESS, MEANING }) => {
          const F = window.__fx, out = [];
          const ink = F.tok('--ink'), muted = F.tok('--muted'), frameInk = F.tok('--frame-ink'), ctl = F.tok('--ctl');
          const meaning = ['--r-risk', '--r-warn', '--r-ok', '--r-ops'].map(F.tok);
          // 2 + 7: every element that holds words: 13px or more, weight 400 or 600, ink / grey (frame ink on the frame).
          document.querySelectorAll('body *').forEach((e) => {
            if (!F.seen(e) || e.closest('svg')) return;
            if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
            const cs = getComputedStyle(e);
            if (parseFloat(cs.fontSize) < 13) out.push('under 13px: ' + F.what(e) + ' ' + cs.fontSize);
            if (!['400', '600'].includes(cs.fontWeight)) out.push('weight ' + cs.fontWeight + ': ' + F.what(e));
            if (![ink, muted, frameInk].includes(cs.color)) out.push('coloured words ' + cs.color + ': ' + F.what(e));
            if (cs.textTransform === 'uppercase') out.push('uppercase: ' + F.what(e));
          });
          // 4: one radius. 12px; round only on dots and rings; count pills 11px; the thin colour bars 2px.
          document.querySelectorAll('body *').forEach((e) => {
            if (!F.seen(e) || e.closest('svg')) return;
            const r = getComputedStyle(e).borderTopLeftRadius;
            if (r === '0px') return;
            const ok = r === '12px' || (r === '50%' && e.matches('.dot, .info, .new, .stage .n, .sw > i, .req')) || (r === '11px' && e.matches('.cnt, .n')) || (r === '2px' && e.matches('.bar'));
            if (!ok) out.push('radius ' + r + ': ' + F.what(e));
          });
          // 3 + 12: pressables rest on ONE clear 1px line (the control line, or their own meaning colour), 12px, 36px.
          document.querySelectorAll(PRESS).forEach((e) => {
            if (!F.seen(e)) return;
            const cs = getComputedStyle(e), b = e.getBoundingClientRect();
            if (cs.borderTopWidth !== '1px') out.push('press line ' + cs.borderTopWidth + ': ' + F.what(e));
            if (cs.borderTopLeftRadius !== '12px') out.push('press radius ' + cs.borderTopLeftRadius + ': ' + F.what(e));
            if (b.height < 35.5) out.push('press height ' + b.height + ': ' + F.what(e));
            if (parseFloat(cs.fontSize) < 14) out.push('press type ' + cs.fontSize + ': ' + F.what(e));
            const want = e.matches(MEANING) ? meaning : [ctl];
            if (!e.matches('.stat') && !want.includes(cs.borderTopColor)) out.push('press line colour ' + cs.borderTopColor + ' (want ' + want.join(' or ') + '): ' + F.what(e));
          });
          // 6: count pills one fixed size; tab counts an amber ring with no fill; no empty count rings.
          document.querySelectorAll('.cnt, nav.tabs .n, .fbtn .n').forEach((e) => {
            if (!F.seen(e)) return;
            const r = e.getBoundingClientRect(), cs = getComputedStyle(e), t = e.textContent.trim();
            if (!t) out.push('empty count ring: ' + F.what(e.parentElement));
            if (Math.round(r.height) !== 22 || (t.length <= 2 && Math.round(r.width * 100) / 100 !== 30)) out.push('count size ' + r.width + 'x' + r.height + ': ' + F.what(e));
            if (cs.boxSizing !== 'border-box' || cs.lineHeight !== '20px' || cs.borderTopWidth !== '1px') out.push('count box ' + cs.boxSizing + ' ' + cs.lineHeight + ': ' + F.what(e));
          });
          document.querySelectorAll('nav.tabs .n').forEach((e) => {
            if (!F.seen(e)) return;
            const cs = getComputedStyle(e);
            if (cs.borderTopColor !== F.tok('--r-warn') || cs.backgroundColor !== 'rgba(0, 0, 0, 0)') out.push('tab count not an amber ring only: ' + cs.borderTopColor + ' / ' + cs.backgroundColor);
          });
          // 9: every date pill wears a 1px ring: rose late, amber soon, the grey control line otherwise (grey words).
          document.querySelectorAll('label.date').forEach((e) => {
            if (!F.seen(e)) return;
            const cs = getComputedStyle(e), want = e.classList.contains('over') ? F.tok('--r-risk') : e.classList.contains('soon') ? F.tok('--r-warn') : ctl;
            if (cs.borderTopWidth !== '1px' || cs.borderTopColor !== want) out.push('date ring ' + cs.borderTopWidth + ' ' + cs.borderTopColor + ' (want ' + want + '): ' + F.what(e));
            if (!e.matches('.over, .soon') && cs.color !== muted) out.push('plain date not grey: ' + F.what(e));
          });
          return out.slice(0, 12);
        }, { PRESS, MEANING });
        expect(bad, `#/${v} (${scheme})`).toEqual([]);
      }
    });
  }

  test('the sample has what the rules talk about: rose and amber dates, Yes / No, an unread dot, the Factory switch', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    await expect(page.locator('#view label.date.over')).toHaveCount(1);
    await expect(page.locator('#view label.date.soon')).toHaveCount(1);
    await expect(page.locator('#view .btn.yes').first()).toBeVisible();
    await expect(page.locator('#view .btn.no').first()).toBeVisible();
    await expect(page.locator('#view .ico .new')).toHaveCount(1);
  });

  test('no solid colour fills on markers (counts, pills, dates, steps, strip, rooms, codes)', async ({ page, guard }) => {
    await open(page, guard, '#/rooms', { scheme: 'light' });
    await page.evaluate(HELP);
    for (const v of ['rooms', 'me', 'card/869fjxpc2', 'item/869fk6k00', 'health']) {
      await go(page, v);
      const solid = await page.evaluate(() => {
        const F = window.__fx, out = [];
        const fills = [0, 2, 3, 4, 5, 6, 7, 8].map((k) => F.tok('--ljr-' + k));
        document.querySelectorAll('.cnt, nav.tabs .n, span.pill, .gate, .codes .cd, .age, .strip i, .stage .n, .room, label.date, .card, .sw, .banner, .empty').forEach((e) => {
          const bg = getComputedStyle(e).backgroundColor;
          if (/, 0\)$/.test(bg) || bg === 'transparent') return;
          if (fills.includes(bg) || F.L(bg) < 0.6) out.push(e.className + ' "' + e.textContent.trim().slice(0, 20) + '" ' + bg);
        });
        return out;
      });
      expect(solid, '#/' + v).toEqual([]);
    }
  });

  test('the two allowed solids stay visible: "Factory on" switch knob and the new-message dot', async ({ page, guard }) => {
    await open(page, guard, '#/rooms');
    await page.evaluate(HELP);
    const sw = page.locator('#view [data-action="factory"]');
    await expect(sw).toContainText('Factory on');
    const knob = await sw.locator('.sw.on > i').evaluate((e) => { const b = e.getBoundingClientRect(), c = getComputedStyle(e); return { w: b.width, bg: c.backgroundColor, ring: getComputedStyle(e.parentElement).borderTopColor, page: window.__fx.bgOf(e.parentElement) }; });
    expect(knob.w).toBeGreaterThanOrEqual(10);
    expect(knob.bg).toMatch(/^rgb\(/); // solid, no transparency
    expect(await page.evaluate((k) => window.__fx.ratio(k.bg, k.page), knob), 'knob against the button').toBeGreaterThanOrEqual(3);
    await go(page, 'me');
    const dot = page.locator('#view .ico .new');
    await expect(dot).toBeVisible();
    const d = await dot.evaluate((e) => { const b = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect(); return { w: b.width, inside: b.left >= p.left && b.right <= p.right && b.top >= p.top && b.bottom <= p.bottom, bg: getComputedStyle(e).backgroundColor, under: window.__fx.bgOf(e.parentElement) }; });
    expect(d.w).toBeGreaterThanOrEqual(8);
    expect(d.inside, 'the dot sits inside its button').toBe(true);
    expect(await page.evaluate((x) => window.__fx.ratio(x.bg, x.under), d), 'dot against the button').toBeGreaterThanOrEqual(3);
  });
});

test.describe('Factory look: frame', () => {
  const close = (got, hex) => { const want = hex.match(/../g).map((x) => parseInt(x, 16)); const g0 = got.match(/[\d.]+/g).map(Number), g = /^color\(/.test(got) ? g0.map((x) => x * 255) : g0; return want.every((v, i) => Math.abs(v - g[i]) <= 4); };
  test('dark top and bottom frame (Deep 3A3632 / 46413B), light tab buttons with no ring, bar widens on hover and when selected', async ({ page, guard }) => {
    await open(page, guard, '#/me');
    const bg = (sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor);
    const top = await bg('header'), foot = await bg('nav.tabs');
    expect(close(top, '3A3632'), 'top frame ' + top).toBe(true);
    expect(close(foot, '46413B'), 'bottom frame ' + foot).toBe(true);
    const tabs = page.locator('nav.tabs a');
    await expect(tabs).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      const t = tabs.nth(i);
      const s = await t.evaluate((e) => { const c = getComputedStyle(e); return [c.borderTopStyle, c.outlineStyle, c.boxShadow, c.backgroundColor]; });
      expect(s.slice(0, 3), 'tab has no ring').toEqual(['none', 'none', 'none']);
      expect(s[3]).not.toBe(foot);
    }
    await expect(page.locator('nav.tabs a[aria-current="page"] .bar')).toHaveCSS('width', '40px');
    const docs = page.locator('nav.tabs a[data-nav="docs"]');
    await expect(docs.locator('.bar')).toHaveCSS('width', '18px');
    const b0 = await docs.boundingBox();
    await docs.hover();
    await expect(docs.locator('.bar')).toHaveCSS('width', '40px');
    await expect(docs).toHaveCSS('outline-style', 'none'); // tabs are exempt from the hover line
    expect(await docs.boundingBox()).toEqual(b0);
    // Every word on the frame reads clearly.
    await page.evaluate(HELP);
    const worst = await page.evaluate(() => {
      const F = window.__fx;
      let min = 99, at = '';
      document.querySelectorAll('header .top *').forEach((e) => {
        if (!e.getClientRects().length || !Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const r = F.ratio(getComputedStyle(e).color, getComputedStyle(document.querySelector('header')).backgroundColor); if (r < min) { min = r; at = e.textContent.trim(); }
      });
      return { min, at };
    });
    expect(worst.min, `"${worst.at}" on the frame`).toBeGreaterThanOrEqual(4.5);
  });

  test('cool look (Studio\'s Look setting) and dark mode keep a dark frame', async ({ page, guard }) => {
    await page.addInitScript(() => { try { localStorage.setItem('dash-look', JSON.stringify({ bg: 'cool' })); } catch (e) {} });
    await open(page, guard, '#/me');
    await expect(page.locator('html')).toHaveClass(/look-cool/);
    const lum = (sel) => page.locator(sel).first().evaluate((e) => { const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; });
    expect(await lum('header')).toBeLessThan(0.35);
    expect(await lum('nav.tabs')).toBeLessThan(0.4);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await lum('header')).toBeLessThan(0.2);
    expect(await lum('header')).toBeLessThan(await lum('nav.tabs') + 0.001);
  });

  test('signed out: the dark bar keeps Sign in and Dashboard only, both on the right', async ({ page }) => {
    await page.goto('factory/');
    await expect(page.locator('html')).toHaveClass(/dash-locked/);
    await expect(page.locator('header')).toHaveCSS('visibility', 'visible');
    for (const sel of ['#signInBtn', '#backHome']) {
      const b = await page.locator(sel).boundingBox();
      expect(b.x, sel).toBeGreaterThan(page.viewportSize().width / 2);
    }
    await expect(page.locator('nav.tabs')).not.toBeVisible();
  });
});

test.describe('Factory look: hover = a 1px line inside + a pale tint; nothing moves', () => {
  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: neutral controls turn an ink line and a muted tint; meaning controls keep their own colour`, async ({ page, guard }) => {
      await open(page, guard, '#/me', { scheme });
      await page.evaluate(HELP);
      const ink = await page.evaluate(() => getComputedStyle(document.body).color);
      const look = (el) => el.evaluate((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e), i = e.querySelector('.ti');
        const p = document.createElement('i'); p.style.color = c.getPropertyValue('--mc').trim(); e.appendChild(p); const mc = getComputedStyle(p).color; p.remove();
        return { box: [r.x, r.y, r.width, r.height], ow: c.outlineWidth, os: c.outlineStyle, oo: c.outlineOffset, oc: c.outlineColor, bc: c.borderTopColor, bg: c.backgroundColor, mc, icon: i ? getComputedStyle(i).color : '' }; });
      const neutral = { chip: '#view [data-fx="app"]:not(.on)', filter: '#filtersBtn', icon: '#view .crow .ico', flag: '#view .crow .flagb', mark: '#view .crow .mark', date: '#view label.date:not(.over):not(.soon)', search: '#view .sbox' };
      const meaning = { yes: '#view .btn.yes', no: '#view .btn.no', late: '#view label.date.over', soon: '#view label.date.soon' };
      for (const [k, sel] of Object.entries({ ...neutral, ...meaning })) {
        const el = page.locator(sel).first();
        await expect(el, 'the sample has a ' + k).toHaveCount(1, { timeout: 1 }).catch(() => {});
        expect(await el.count(), 'the sample has a ' + k).toBeGreaterThan(0);
        await el.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        const a = await look(el);
        await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
        await page.mouse.move(0, 0);
        const a2 = await look(el);
        await page.mouse.move(a2.box[0] + a2.box[2] / 2, a2.box[1] + a2.box[3] / 2); // a plain mouse move: nothing scrolls
        await settle(el);
        const b = await look(el);
        a.box = a2.box;
        expect(b.box, `${k} must not move`).toEqual(a.box);
        expect([b.ow, b.os, b.oo], `${k} hover line`).toEqual(['1px', 'solid', '-1px']);
        expect(b.bg, `${k} hover adds a tint`).not.toBe(a.bg);
        if (k in meaning) {
          expect(b.oc, `${k} keeps its own colour`).toBe(a.mc);
          expect(a.bc, `${k} rests on its own colour line`).toBe(a.mc);
          expect(b.oc, `${k} never turns ink`).not.toBe(ink);
          expect(b.icon, `${k} icon keeps its colour`).toBe(a.icon);
          // The tint is that colour mixed into the card: lighter than the line in light mode, darker in dark mode.
          const [tl, ll] = await page.evaluate(([bg, line]) => [window.__fx.L(bg), window.__fx.L(line)], [b.bg, b.bc]);
          const ml = await page.evaluate((c) => window.__fx.L(c), b.oc);
          if (scheme === 'light') expect(tl, `${k} pale tint`).toBeGreaterThan(ml); else expect(tl, `${k} dark tint`).toBeLessThan(ml);
        } else {
          expect(b.oc, `${k} hover line is ink`).toBe(ink);
        }
      }
    });
  }

  test('selected looks the same as hover; keyboard focus is a 2px ink ring', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    const ink = await page.evaluate(() => getComputedStyle(document.body).color);
    await page.mouse.move(0, 0);
    const on = page.locator('#view [data-fx="app"].on');
    expect(await on.evaluate((e) => { const c = getComputedStyle(e); return [c.outlineWidth, c.outlineStyle, c.outlineOffset, c.outlineColor]; })).toEqual(['1px', 'solid', '-1px', ink]);
    await page.locator('#filtersBtn').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return [c.outlineWidth, c.outlineStyle, c.outlineColor]; });
    expect(f).toEqual(['2px', 'solid', ink]);
  });

  test('read-only pills (counts, Test, missing lines, codes, age) have no hover', async ({ page, guard }) => {
    await open(page, guard, '#/item/869fk6k00');
    for (const sel of ['#view .cnt', '#view span.pill', '#view .gate', '#view .age', '#stamp']) {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      await el.scrollIntoViewIfNeeded();
      await el.hover();
      expect(await el.evaluate((e) => getComputedStyle(e).outlineStyle), sel).toBe('none');
      expect(await el.evaluate((e) => getComputedStyle(e).cursor), sel).not.toBe('pointer');
    }
    await page.goto('factory/#/card/869fjxpc2');
    const cd = page.locator('#codes .cd').first();
    if (await cd.count()) { await cd.hover(); await expect(cd).toHaveCSS('outline-style', 'none'); }
  });
});

test.describe('Factory look: contrast (words 4.5:1, lines 3:1)', () => {
  for (const [scheme, lookBg] of [['light', 'warm'], ['dark', 'warm'], ['light', 'cool'], ['dark', 'cool']]) {
    test(`${lookBg} ${scheme}: words, control lines and pill rings pass`, async ({ page, guard }) => {
      test.setTimeout(60_000);
      if (lookBg === 'cool') await page.addInitScript(() => { try { localStorage.setItem('dash-look', JSON.stringify({ bg: 'cool' })); } catch (e) {} });
      await open(page, guard, '#/rooms', { scheme });
      await page.evaluate(HELP);
      for (const v of ['rooms', 'me', 'card/869fjxpc2', 'item/869fk6k00']) {
        await go(page, v);
        const bad = await page.evaluate((PRESS) => {
          const F = window.__fx, out = [];
          document.querySelectorAll('#view *, header *, nav.tabs *').forEach((e) => {
            if (!F.seen(e) || e.closest('svg')) return;
            if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
            const r = F.ratio(getComputedStyle(e).color, F.bgOf(e));
            if (r < 4.5) out.push('text ' + r.toFixed(2) + ': ' + F.what(e));
          });
          document.querySelectorAll(PRESS + ', #view .cnt, #view span.pill, #view .gate, #view .age, nav.tabs .n').forEach((e) => {
            if (!F.seen(e) || e.matches('.stat')) return;
            const r = F.ratio(getComputedStyle(e).borderTopColor, F.bgOf(e.parentElement));
            if (r < 3) out.push('line ' + r.toFixed(2) + ': ' + F.what(e));
          });
          const ctl = F.tok('--ctl');
          for (const n of ['--bg', '--surface']) { const r = F.ratio(ctl, F.tok(n)); if (r < 3) out.push('control line on ' + n + ' ' + r.toFixed(2)); }
          return out.slice(0, 10);
        }, PRESS);
        expect(bad, `#/${v} (${lookBg} ${scheme})`).toEqual([]);
      }
    });
  }
});

test.describe('Factory look: counts and empty states', () => {
  test('count pills are one fixed box for 1 and 2 digits, even with a much wider fallback font; 3+ digits grow', async ({ page, guard }) => {
    await open(page, guard, '#/do');
    await page.addStyleTag({ content: '* { font-family: "DejaVu Sans Mono", "Courier New", monospace !important; letter-spacing: .08em !important; }' });
    const sizes = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.innerHTML = '<span class="cnt">7</span><span class="cnt need">88</span><span class="cnt wide">999</span>';
      document.getElementById('view').appendChild(probe);
      return Array.from(probe.children).concat(Array.from(document.querySelectorAll('#view .cnt, nav.tabs .n:not(:empty)'))).filter((e) => e.getClientRects().length)
        .map((e) => ({ t: e.textContent, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
    });
    expect(sizes.length).toBeGreaterThan(5);
    for (const s of sizes) {
      expect(s.h, `count "${s.t}" height`).toBe(22);
      if (s.t.length <= 2) expect(s.w, `count "${s.t}" width`).toBe(30);
    }
    expect(sizes.find((s) => s.t === '999').w).toBeGreaterThan(30);
  });

  test('a tab with nothing waiting shows no count ring', async ({ page, guard }) => {
    await open(page, guard, '#/rooms', { change: (st) => { st.lists.decisions = []; } });
    await expect(page.locator('#nDecide')).toHaveText('');
    await expect(page.locator('#nDecide')).toBeHidden();
    await expect(page.locator('#nDo')).toBeVisible();
  });

  test('an empty list says so in plain words with a small green-ring check', async ({ page, guard }) => {
    await open(page, guard, '#/decide', { change: (st) => { st.lists.decisions = []; } });
    const e = page.locator('#view .empty');
    await expect(e).toHaveText('Nothing waiting here. All clear.');
    await expect(page.locator('#view [data-empty] [data-action="clearf"]')).toHaveCount(0);
    const ring = await e.evaluate((x) => { const c = getComputedStyle(x, '::before'); return [c.content, c.borderTopWidth, c.borderTopColor, c.borderTopLeftRadius]; });
    expect(ring[0]).toBe('"✓"');
    expect(ring[1]).toBe('1px');
    expect(ring[2]).toBe(await page.evaluate(() => { const d = document.createElement('i'); d.style.color = getComputedStyle(document.documentElement).getPropertyValue('--r-ok'); document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; }));
    expect(ring[3]).toBe('50%');
  });
});

test('find bar: Search, Factory on/off and Filter in one row; Filter is open by default at 900px and wider', async ({ page, guard }) => {
  await open(page, guard, '#/rooms');
  await expect(page.locator('details.fdet')).toHaveAttribute('open', '');
  const top = (sel) => page.locator(sel).first().evaluate((e) => Math.round(e.getBoundingClientRect().top));
  expect(await top('#filterSum')).toBe(await top('.srow .sbox'));
  expect(await top('.srow [data-action="factory"]')).toBe(await top('.srow .sbox'));
  await expect(page.locator('#filterSum')).toContainText('Filter');
  await expect(page.locator('#filterSum .n')).toBeHidden(); // nothing on: no empty ring
  await page.locator('[data-fx="app"][data-val="links"]').click();
  await expect(page.locator('#nFilters')).toHaveText('1');
  await page.locator('#filterSum').click();
  await expect(page.locator('[data-fx="app"]').first()).toBeHidden();
  await page.locator('nav.tabs a[data-nav="do"]').click();
  await expect(page.locator('details.fdet')).not.toHaveAttribute('open', ''); // your choice is kept
});
