// Money Hub house look (LINKS-COMFORT-BRIEF v3 + Lisa's 28 Oct rules), checked by computed style on every view.
// 1 everything you press: the same clear 1px line (never ink at rest), 12px corners, 36px high, 14px 600; hover = 1px ink outline, nothing moves
// 2 every date pill: a plain 1px ring; late = rose ring + tint, soon = amber ring + tint
// 3 no text under 13px, weights 400 and 600 only, no coloured words
// 4 one radius (12px); circles only for status dots; count pills one fixed size (30 x 22, radius 11px)
// plus: no solid colour fills on markers, and 3:1 lines / 4.5:1 text in light and dark. Pretend Google and Drive.
const { test, expect } = require('../support/test');

const VIEWS = ['now', 'money', 'dates', 'todo', 'todo/others', 'accountant', 'control', 'e/TESTCO', 'e/TESTPERS', 'register/R001'];
const PRESS = 'main .btn, main details > summary, main .subnav a, main a.ent, header .btn';
const READ = '.tag, .chip, .date, .cnt, nav.main .n:not(:empty), .readstamp';

async function open(page, scheme) {
  if (scheme) await page.emulateMedia({ colorScheme: scheme });
  await page.goto('money/');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
}
async function go(page, v) {
  await page.evaluate((h) => { location.hash = '#/' + h; }, v);
  await expect(page.locator('#view')).toHaveAttribute('data-view', v.split('/')[0]);
}
const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';

test.describe('Money Hub look: rules 1-4 by computed style', () => {
  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: every view keeps the type, radius, colour and pressable rules`, async ({ page }) => {
      test.setTimeout(90_000);
      await open(page, scheme);
      for (const v of VIEWS) {
        await go(page, v);
        const bad = await page.evaluate(({ PRESS, READ }) => {
          const out = [], seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
          const root = getComputedStyle(document.documentElement);
          const norm = (c) => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
          const ink = norm(root.getPropertyValue('--ink')), muted = norm(root.getPropertyValue('--muted')), frameInk = norm(root.getPropertyValue('--frame-ink')), ctl = norm(root.getPropertyValue('--ctl'));
          const what = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className).replace(/\s+/g, '.')) + ' "' + (e.textContent || '').trim().slice(0, 24) + '"';
          // 3: text size, weight and colour (no coloured words) on every element that holds text.
          document.querySelectorAll('body *').forEach((e) => {
            if (!seen(e) || e.closest('svg')) return;
            if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
            const cs = getComputedStyle(e);
            if (parseFloat(cs.fontSize) < 13) out.push('under 13px: ' + what(e) + ' ' + cs.fontSize);
            if (!['400', '600'].includes(cs.fontWeight)) out.push('weight ' + cs.fontWeight + ': ' + what(e));
            if (![ink, muted, frameInk].includes(cs.color)) out.push('coloured words ' + cs.color + ': ' + what(e));
          });
          // 4: one radius. Corners are 12px; circles (50%) only on status dots / the (i) ring; count pills 11px.
          document.querySelectorAll('body *').forEach((e) => {
            if (!seen(e) || e.closest('svg')) return;
            const r = getComputedStyle(e).borderTopLeftRadius;
            if (r === '0px') return;
            const cls = e.classList;
            const ok = r === '12px' || (r === '50%' && (cls.contains('dot') || cls.contains('info'))) || (r === '11px' && (cls.contains('cnt') || cls.contains('n')));
            if (!ok) out.push('radius ' + r + ': ' + what(e));
          });
          // 1: pressables rest on the same clear line, 1px, 12px, 36px+, 14px 600; never ink at rest.
          document.querySelectorAll(PRESS).forEach((e) => {
            if (!seen(e)) return;
            const cs = getComputedStyle(e), inHeader = !!e.closest('header');
            if (cs.borderTopWidth !== '1px') out.push('press line ' + cs.borderTopWidth + ': ' + what(e));
            if (cs.borderTopLeftRadius !== '12px') out.push('press radius ' + cs.borderTopLeftRadius + ': ' + what(e));
            if (!e.matches('a.ent')) {
              if (e.getBoundingClientRect().height < 35.5) out.push('press height ' + e.getBoundingClientRect().height + ': ' + what(e));
              if (cs.fontSize !== '14px' || cs.fontWeight !== '600') out.push('press type ' + cs.fontSize + '/' + cs.fontWeight + ': ' + what(e));
            }
            if (!inHeader && cs.borderTopColor !== ctl) out.push('press line colour ' + cs.borderTopColor + ' (want ' + ctl + '): ' + what(e));
            if (!inHeader && cs.borderTopColor === ink) out.push('press starts out ink: ' + what(e));
          });
          // Count pills: one fixed size so 1 and 2 digits match.
          document.querySelectorAll('.cnt, nav.main .n:not(:empty)').forEach((e) => {
            if (!seen(e)) return;
            const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
            if (Math.round(r.height) !== 22 || (e.textContent.trim().length <= 2 && Math.round(r.width) !== 30)) out.push('count size ' + r.width + 'x' + r.height + ': ' + what(e));
            if (cs.borderTopWidth !== '1px') out.push('count line: ' + what(e));
          });
          // 2: date pills wear a 1px ring; late = rose, soon = amber, plain = the control line.
          const rose = norm(root.getPropertyValue('--r-risk')), amber = norm(root.getPropertyValue('--r-warn'));
          document.querySelectorAll('.date').forEach((e) => {
            if (!seen(e)) return;
            const cs = getComputedStyle(e), want = e.classList.contains('late') ? rose : e.classList.contains('soon') ? amber : ctl;
            if (cs.borderTopWidth !== '1px' || cs.borderTopColor !== want) out.push('date ring ' + cs.borderTopWidth + ' ' + cs.borderTopColor + ' (want ' + want + '): ' + what(e));
            if (!e.classList.contains('late') && !e.classList.contains('soon') && cs.color !== muted) out.push('plain date not grey: ' + what(e));
          });
          return out.slice(0, 12);
        }, { PRESS, READ });
        expect(bad, `#/${v} (${scheme})`).toEqual([]);
      }
    });
  }

  test('no solid colour fills on markers (flags, dates, counts, summary numbers, stats, bars, minus amounts)', async ({ page }) => {
    await open(page, 'light');
    for (const v of ['now', 'e/TESTCO', 'control', 'dates']) {
      await go(page, v);
      const solid = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement), out = [];
        const norm = (c) => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
        const fills = [0, 2, 3, 4, 5, 6, 7, 8].map((k) => norm(root.getPropertyValue('--ljr-' + k).trim()));
        const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
        document.querySelectorAll('.tag, .chip, .date, .cnt, .neg, .sum .num, .stat, .bar.in, .bar.out, nav.main .n, .banner').forEach((e) => {
          const bg = getComputedStyle(e).backgroundColor;
          if (/rgba\(.*, 0\)$/.test(bg) || bg === 'transparent') return;
          if (fills.includes(bg) || lum(bg) < 0.75) out.push(e.className + ' "' + e.textContent.trim().slice(0, 20) + '" ' + bg);
        });
        return out;
      });
      expect(solid, '#/' + v).toEqual([]);
    }
  });

  test('a negative amount keeps its minus sign and wears a rose ring, never red words', async ({ page }) => {
    await open(page, 'light');
    await go(page, 'e/TESTCO');
    const negs = page.locator('#view .neg');
    const n = await negs.count();
    for (let i = 0; i < n; i++) {
      await expect(negs.nth(i)).toContainText('−');
      const cs = await negs.nth(i).evaluate((e) => ({ c: getComputedStyle(e).color, b: getComputedStyle(e).borderTopWidth }));
      expect(cs.b).toBe('1px');
      expect(cs.c).toBe(await page.evaluate(() => getComputedStyle(document.body).color));
    }
  });
});

test.describe('Money Hub look: house hover rule (hover = selected; nothing ever moves)', () => {
  // Neutral controls: 1px ink line inside + muted tint. Coloured controls (the section tabs) keep their own colour:
  // 1px line in that colour inside + a pale tint of it, never ink. Header buttons sit on the dark frame: its ink + its tint.
  const CASES = [
    ['light', 'now', 'main .btn', 'neutral'], ['light', 'now', 'main details > summary', 'neutral'], ['light', 'now', 'a.ent', 'neutral'],
    ['light', 'todo', '.subnav a:not([aria-current])', 'neutral'], ['light', 'now', 'header .btn', 'frame'],
    ['light', 'now', 'nav.main a[data-nav="dates"]', 'own'], ['light', 'now', 'nav.main a[data-nav="accountant"]', 'own'],
    ['dark', 'now', 'main .btn', 'neutral'], ['dark', 'now', 'nav.main a[data-nav="todo"]', 'own'],
  ];
  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: buttons, Details, entity cards, sub-tabs, header buttons and section tabs`, async ({ page }) => {
      await open(page, scheme);
      for (const [sch, v, sel, kind] of CASES.filter((c) => c[0] === scheme)) {
        await go(page, v);
        const el = page.locator(sel).first();
        await el.scrollIntoViewIfNeeded();
        const before = await el.evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
        await el.hover();
        await page.waitForTimeout(250);
        const got = await el.evaluate((e, kind) => {
          const r = e.getBoundingClientRect(), cs = getComputedStyle(e), root = getComputedStyle(document.documentElement);
          // Expected colours, resolved by the browser itself through a probe element.
          const probe = (prop, val, host) => { const d = document.createElement('i'); d.style[prop] = val; (host || document.body).appendChild(d); const out = getComputedStyle(d)[prop]; d.remove(); return out; };
          const want = kind === 'own'
            ? { line: probe('color', 'var(--c)', e), fill: probe('backgroundColor', 'color-mix(in srgb, var(--c) 14%, var(--card))', e) }
            : kind === 'frame'
              ? { line: probe('color', 'var(--frame-ink)'), fill: probe('backgroundColor', 'color-mix(in srgb, var(--frame-ink) 14%, var(--frame))') }
              : { line: probe('color', 'var(--ink)'), fill: probe('backgroundColor', 'color-mix(in srgb, var(--muted) 14%, var(--card))') };
          return { box: [r.x, r.y, r.width, r.height], ow: cs.outlineWidth, os: cs.outlineStyle, oo: cs.outlineOffset, oc: cs.outlineColor, bg: cs.backgroundColor, want, ink: probe('color', 'var(--ink)') };
        }, kind);
        const where = `${sel} (${scheme})`;
        expect(got.box, `${where} moved or resized on hover`).toEqual(before);
        expect([got.os, got.ow, got.oo], `${where} hover line`).toEqual(['solid', '1px', '-1px']);
        expect(got.oc, `${where} hover line colour`).toBe(got.want.line);
        expect(got.bg, `${where} hover tint`).toBe(got.want.fill);
        if (kind === 'own') {
          expect(got.oc, `${where} a coloured control never turns ink`).not.toBe(got.ink);
          expect(await el.locator('.bar').evaluate((e) => getComputedStyle(e).width), where).toBe('40px'); // its colour bar widens too
        }
      }
    });
  }

  test('selected = the same look as hover (section tab in its own colour, sub-tab in ink + muted tint)', async ({ page }) => {
    await open(page, 'light');
    await go(page, 'todo');
    const look = (sel) => page.locator(sel).evaluate((e) => { const cs = getComputedStyle(e); return [cs.outlineStyle, cs.outlineWidth, cs.outlineOffset, cs.outlineColor, cs.backgroundColor]; });
    const tab = await look('nav.main a[aria-current="page"]');
    const sub = await look('.subnav a[aria-current="page"]');
    const want = await page.locator('nav.main a[aria-current="page"]').evaluate((e) => {
      const p = (prop, val) => { const d = document.createElement('i'); d.style[prop] = val; e.appendChild(d); const o = getComputedStyle(d)[prop]; d.remove(); return o; };
      return { tab: [p('color', 'var(--c)'), p('backgroundColor', 'color-mix(in srgb, var(--c) 14%, var(--card))')], sub: [p('color', 'var(--ink)'), p('backgroundColor', 'color-mix(in srgb, var(--muted) 14%, var(--card))')] };
    });
    expect(tab).toEqual(['solid', '1px', '-1px', ...want.tab]);
    expect(sub).toEqual(['solid', '1px', '-1px', ...want.sub]);
  });

  test('read-only pills (flags, dates, counts, the read stamp) have no hover', async ({ page }) => {
    await open(page, 'light');
    for (const sel of ['#view .tag', '#view .date', '#view .cnt', '#readStamp']) {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      await el.hover();
      expect(await el.evaluate((e) => getComputedStyle(e).outlineStyle), sel).toBe('none');
      expect(await el.evaluate((e) => getComputedStyle(e).cursor), sel).not.toBe('pointer');
    }
  });

  test('keyboard focus is a 2px ink ring', async ({ page }) => {
    await open(page, 'light');
    await page.locator('#view a.btn').first().focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return [cs.outlineWidth, cs.outlineStyle, cs.outlineColor, getComputedStyle(document.body).color]; });
    expect(f[0]).toBe('2px');
    expect(f[1]).toBe('solid');
    expect(f[2]).toBe(f[3]);
  });
});

test.describe('Money Hub look: contrast (text 4.5:1, control lines 3:1)', () => {
  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: words, pill rings and button lines pass`, async ({ page }) => {
      await open(page, scheme);
      for (const v of ['now', 'e/TESTCO', 'control']) {
        await go(page, v);
        const bad = await page.evaluate(() => {
          const rgb = (c) => { const n = c.match(/[\d.]+/g).map(Number); return /^color\(srgb/.test(c) ? n.map((x, i) => (i < 3 ? x * 255 : x)) : n; }; // color-mix() tints come back as color(srgb 0-1)
          const L = (c) => { const [r, g, b] = rgb(c).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
          const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
          const bgOf = (e, self) => { for (let n = self ? e : e.parentElement; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; const a = rgb(c); if (a.length < 4 || a[3] > 0.5) return c; } return getComputedStyle(document.body).backgroundColor; };
          const out = [], seen = (e) => e.getClientRects().length > 0;
          document.querySelectorAll('#view *, header *, nav.main *').forEach((e) => {
            if (!seen(e) || e.closest('svg')) return;
            if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
            const r = ratio(getComputedStyle(e).color, bgOf(e, true));
            if (r < 4.5) out.push('text ' + r.toFixed(2) + ': "' + e.textContent.trim().slice(0, 24) + '"');
          });
          document.querySelectorAll('#view .btn, #view details > summary, #view .tag, #view .date, #view .cnt, #view .subnav a, #view a.ent, header .btn, header .readstamp').forEach((e) => {
            if (!seen(e)) return;
            const r = ratio(getComputedStyle(e).borderTopColor, bgOf(e, false));
            if (r < 3) out.push('line ' + r.toFixed(2) + ': ' + e.className + ' "' + e.textContent.trim().slice(0, 20) + '"');
          });
          return out.slice(0, 10);
        });
        expect(bad, `#/${v} (${scheme})`).toEqual([]);
      }
    });
  }
});

test.describe('Money Hub look: control line and count pills hold in every look', () => {
  for (const [scheme, look] of [['light', 'warm'], ['dark', 'warm'], ['light', 'cool'], ['dark', 'cool']]) {
    test(`${look} ${scheme}: the resting control line is 3:1 or better on the page and on a card`, async ({ page }) => {
      await page.addInitScript((bg) => { try { localStorage.setItem('dash-look', JSON.stringify({ bg })); } catch (e) {} }, look);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('money/');
      const r = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const norm = (c) => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
        const L = (c) => { const [a, b, d] = c.match(/[\d.]+/g).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * a + 0.7152 * b + 0.0722 * d; };
        const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const ctl = norm(root.getPropertyValue('--ctl')), page = norm(root.getPropertyValue('--paper')), card = norm(root.getPropertyValue('--card'));
        return { cool: document.documentElement.classList.contains('look-cool'), onPage: ratio(ctl, page), onCard: ratio(ctl, card) };
      });
      expect(r.cool).toBe(look === 'cool');
      expect(r.onPage, 'line on the page').toBeGreaterThanOrEqual(3);
      expect(r.onCard, 'line on a card').toBeGreaterThanOrEqual(3);
    });
  }

  test('count pills are one fixed box for 1 and 2 digits, even with a much wider fallback font', async ({ page }) => {
    await open(page, 'light');
    await page.addStyleTag({ content: '* { font-family: "DejaVu Sans Mono", "Courier New", monospace !important; letter-spacing: .08em !important; }' });
    const sizes = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.innerHTML = '<span class="cnt">7</span><span class="cnt need">88</span><span class="cnt wide">999</span>';
      document.getElementById('view').appendChild(probe);
      return Array.from(probe.children).concat(Array.from(document.querySelectorAll('#view .cnt, nav.main .n:not(:empty)'))).filter((e) => e.getClientRects().length)
        .map((e) => ({ t: e.textContent, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
    });
    for (const s of sizes) {
      expect(s.h, `count "${s.t}" height`).toBe(22);
      if (s.t.length <= 2) expect(s.w, `count "${s.t}" width`).toBe(30);
    }
    expect(sizes.find((s) => s.t === '999').w).toBeGreaterThan(30); // 3+ digits grow
  });
});

test.describe('Money Hub: summary strip, Next card and friendly empty states', () => {
  test('Now opens with On track / Needs you / Overdue and one Next card with one button', async ({ page }) => {
    await open(page, 'light');
    const three = page.locator('#view .three');
    await expect(three.locator('.sum')).toHaveText([/^\d+\s*On track/, /^\d+\s*Needs you/, /^\d+\s*Overdue/]);
    await expect(three.locator('[data-sum="over"] .num')).toHaveText('2'); // the overdue filing and the overdue tax
    await expect(three.locator('[data-sum="need"] .num')).toHaveText('2');
    const next = page.locator('#view [data-next]');
    await expect(next).toContainText('Sample overdue filing');
    await expect(next.locator('a.btn')).toHaveCount(1);
    await next.locator('a.btn').click();
    await expect(page).toHaveURL(/#\/dates$/);
  });

  test('tab counts: needs-you counts wear the rose ring, totals the grey one', async ({ page }) => {
    await open(page, 'light');
    await expect(page.locator('#nNow')).toHaveText('4');
    await expect(page.locator('#nNow')).toHaveClass(/need/);
    await expect(page.locator('#nDates')).toHaveText('2');
    await expect(page.locator('#nAcct')).toHaveText('1');
    await expect(page.locator('#nAcct')).not.toHaveClass(/need/);
    await expect(page.locator('#nControl')).toBeHidden(); // nothing failing: no count
  });

  test('an empty list says so in plain words with a green-ring check', async ({ page, guard }) => {
    const f = guard.world.files.find((x) => x.name === 'MON-REGISTER.csv');
    f.content = f.content.split('\n').filter((l, i) => i === 0 || !/^R\d/.test(l)).join('\n');
    await open(page, 'light');
    await go(page, 'todo');
    await expect(page.locator('#view .empty').first()).toContainText('Nothing here.');
    const ring = await page.locator('#view .empty').first().evaluate((e) => getComputedStyle(e, '::before').borderTopWidth);
    expect(ring).toBe('1px');
  });
});
