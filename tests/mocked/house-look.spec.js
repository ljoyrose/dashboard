// House look on EVERY hub (Lisa, 28 Oct 2026): the same rules, read back by computed style, on every view of every hub.
// The rules live once in tokens.css (numbers) and house.css (the shared parts); this one spec holds every hub to them:
// one 12px radius (dots round), 1px lines (3px left colour bars), Lexend 400/600 at 13px or more, sentence case, no coloured
// words, one control line, 36px buttons (44px on a phone), counts a fixed 30 x 22 pill, date pills ringed, deep frame top and
// bottom with light tab buttons, 12px card padding and gaps, no solid fills, and the hover rule (a meaning colour keeps its own
// colour; neutral = 1px ink line + muted tint; nothing moves; read-only pills never hover; bottom tabs only widen their bar).
// Pretend Google, Drive and Sheets; every row is invented (tests/support/hubs.js).
//
// HOUSE_AUDIT=<file.json> runs every combination (light/dark x warm/cool x 1280/390, plus Look > Dark) and writes every
// deviation to that file instead of failing: that is the audit table in the pull request.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, setLook, go, settle } = require('../support/hubs');
const { RULES, audit, hoverRead } = require('../support/house-audit');

const AUDIT = process.env.HOUSE_AUDIT;
const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const PAGES = { home: 'index.html', money: 'money/index.html', cdhub: 'cdhub/index.html', food: 'food/index.html', marketplace: 'marketplace/index.html', factory: 'factory/index.html', studio: 'studio/index.html' };

// Hover the first few controls of each kind on the view and check the hover rule. Returns problems like audit().
async function hoverRule(page, phone) {
  if (phone) return []; // a phone has no hover
  const picks = await page.evaluate(() => {
    document.querySelectorAll('[data-hq]').forEach((e) => e.removeAttribute('data-hq'));
    const rgb = (c) => { const m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(c); if (m) return [m[1] * 255, m[2] * 255, m[3] * 255]; return (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number); };
    const chroma = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
    const seen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight - 90 && getComputedStyle(e).visibility !== 'hidden'; };
    const nav = [...document.querySelectorAll('nav')].find((n) => getComputedStyle(n).position === 'fixed');
    const head = document.querySelector('header');
    const all = [...document.querySelectorAll('main button, main a.btn, main a.pill, main a.chip, main summary, #view button, #view a.btn, #view a.pill, #view a.chip, #view summary')]
      .filter((e, i, a) => a.indexOf(e) === i && seen(e) && !(nav && nav.contains(e)) && !(head && head.contains(e)) && !e.disabled && !(e.matches('summary') && e.querySelector('h1, h2, h3, h4, h5')) && !e.matches('.ttl, [data-house="text"], .on, .sel, [aria-pressed="true"], [aria-current="page"], [aria-selected="true"], [aria-expanded="true"], details[open] > summary'));
    // A meaning-coloured control carries its colour in --mc (house.css) or is a yes / no / delete / AI button.
    const isMeaning = (e) => e.matches('.btn.yes, .btn.no, .btn.danger, .btn.ai') || !!getComputedStyle(e).getPropertyValue('--hmc').trim() || chroma(rgb(getComputedStyle(e).borderTopColor)) > 45;
    const neutral = all.filter((e) => !isMeaning(e)).slice(0, 3);
    const meaning = all.filter(isMeaning).slice(0, 2);
    const ro = [...document.querySelectorAll('.cnt, .dpill, .datep, span.pill, span.tag, .stamp')].filter(seen).slice(0, 2);
    const tabs = nav ? [...nav.querySelectorAll('a, button')].filter((e) => e.getBoundingClientRect().width > 0 && e.getAttribute('aria-current') !== 'page' && !e.matches('.on, [aria-selected="true"]')).slice(0, 1) : [];
    let n = 0; const tag = (e, kind) => { e.setAttribute('data-hq', String(++n)); return { sel: '[data-hq="' + n + '"]', kind, ink: getComputedStyle(document.body).color }; };
    return [...neutral.map((e) => tag(e, 'neutral')), ...meaning.map((e) => tag(e, 'meaning')), ...ro.map((e) => tag(e, 'readonly')), ...tabs.map((e) => tag(e, 'tab'))];
  });
  const out = [];
  const chroma = (c) => { const m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(c); const x = m ? [m[1] * 255, m[2] * 255, m[3] * 255] : (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number); return Math.max(x[0], x[1], x[2]) - Math.min(x[0], x[1], x[2]); };
  const near = (a, b) => { const p = (c) => { const m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(c); return m ? [m[1] * 255, m[2] * 255, m[3] * 255] : (c.match(/[\d.]+/g) || []).map(Number); }; const x = p(a), y = p(b); return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) <= 10; };
  for (const p of picks) {
    const loc = page.locator(p.sel);
    if (!(await loc.count())) continue;
    await page.mouse.move(0, 0);
    const bar = p.kind === 'tab' ? await loc.evaluate((e) => { const b = e.querySelector('.bar'); return b ? b.getBoundingClientRect().width : null; }) : null;
    const before = await page.evaluate(hoverRead, p.sel);
    if (!before) continue;
    try { await loc.hover({ timeout: 1500 }); } catch (e) { continue; }
    await settle(loc);
    const after = await page.evaluate(hoverRead, p.sel);
    const what = p.kind + ' ' + p.sel + ' ' + (await loc.evaluate((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.') + ' "' + e.textContent.trim().slice(0, 20) + '"'));
    const add = (rule, got) => out.push({ rule, what, got });
    if (!after) continue;
    // Moved = the box changes on hover and comes back when the pointer leaves (a scroll that brought it into view is not a move).
    const differs = (a, b) => Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || Math.abs(a.w - b.w) > 0.5 || Math.abs(a.h - b.h) > 0.5 || a.transform !== b.transform;
    if (differs(after, before)) {
      await page.mouse.move(0, 0); await settle(loc);
      const back = await page.evaluate(hoverRead, p.sel);
      if (back && differs(after, back)) add('hover moves', `${back.x},${back.y} ${back.w}x${back.h} -> ${after.x},${after.y} ${after.w}x${after.h}`);
      await loc.hover({ timeout: 1500 }).catch(() => {}); await settle(loc);
    }
    if (p.kind === 'neutral' || p.kind === 'meaning') {
      if (after.os === 'none' || after.ow !== '1px' || after.offset !== '-1px') add('hover line', after.outline + ' offset ' + after.offset);
      if (p.kind === 'neutral' && after.os !== 'none' && !near(after.oc, p.ink)) add('hover line', 'neutral line not ink: ' + after.oc);
      if (p.kind === 'meaning' && after.os !== 'none' && near(after.oc, p.ink)) add('hover line', 'meaning control turned ink');
      if (p.kind === 'meaning' && after.os !== 'none' && !(chroma(after.oc) > 45)) add('hover line', 'meaning line ' + after.oc + ' is not a colour');
      if (p.kind === 'meaning' && after.os !== 'none' && !near(after.oc, before.border)) add('hover line', 'meaning hover line ' + after.oc + ' is not its resting line ' + before.border);
      if (after.bg === before.bg) add('hover tint', 'no tint: ' + after.bg);
    }
    if (p.kind === 'readonly' && (after.os !== 'none' && after.ow !== '0px') && after.outline !== before.outline) add('read-only hover', after.outline);
    if (p.kind === 'tab') {
      if ((after.os !== 'none' && after.ow !== '0px') || after.shadow !== 'none') add('tabs exempt', 'tab hover draws ' + after.outline + ' / ' + after.shadow);
      const bar2 = await loc.evaluate((e) => { const b = e.querySelector('.bar'); return b ? b.getBoundingClientRect().width : null; });
      if (bar === null) add('tabs exempt', 'no colour bar above the label');
      else if (!(bar2 > bar)) add('tabs exempt', `bar does not widen on hover (${bar} -> ${bar2})`);
    }
  }
  await page.mouse.move(0, 0);
  return out;
}

// HOUSE_SHOTS=<folder> (audit mode only): also save each hub's first view as house-<hub>-<width>-<look>.png.
const SHOTS = process.env.HOUSE_SHOTS;
async function runAll(page, guard, hub, look, phone) {
  const H = HUBS[hub], found = [];
  await H.open(page, guard);
  for (const v of H.views) {
    await go(page, v);
    await page.mouse.move(0, 0);
    if (SHOTS && AUDIT && v === H.views[0]) await page.screenshot({ path: path.join(SHOTS, `house-${hub}-${phone ? 390 : 1280}-${look}.png`) });
    const got = await page.evaluate(audit, { look, phone, rules: RULES });
    got.push(...(await hoverRule(page, phone)));
    for (const g of got) found.push({ hub, view: v, look, width: phone ? 390 : 1280, ...g });
  }
  return found;
}

test.describe('House look: one set of rules, every hub', () => {
  test('house.css is loaded right after tokens.css on every hub, and tokens.css holds the house numbers once', () => {
    const tok = read('tokens.css');
    for (const v of ['--house-radius: 12px', '--house-line: 1px', '--house-bar: 3px', '--house-press: #8A7F70', '--house-frame: #3A3632', '--house-foot: #46413B', '--house-tint: 14%', '--house-btn: 36px', '--house-btn-phone: 44px']) expect(tok, 'tokens.css ' + v).toContain(v);
    expect(tok, 'tokens.css answers Look > Dark ([data-theme="dark"])').toMatch(/:root\[data-theme="dark"\]/);
    for (const [hub, f] of Object.entries(PAGES)) {
      const t = read(f), pre = f.includes('/') ? '../' : '';
      const a = t.indexOf(`<link rel="stylesheet" href="${pre}tokens.css">`), b = t.indexOf(`<link rel="stylesheet" href="${pre}house.css">`);
      expect(a, hub + ' loads tokens.css').toBeGreaterThan(-1);
      expect(b, hub + ' loads house.css after tokens.css').toBeGreaterThan(a);
      expect(t.indexOf('<style'), hub + ': house.css comes before the page style').toBeGreaterThan(b);
      // The dark spine is written once, in tokens.css: no page repeats it.
      expect(t, hub + ' repeats the dark LJR7 spine').not.toMatch(/\[data-theme="dark"\][^{]*\{[^}]*--ljr-0-tint:/);
    }
    const house = read('house.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(house, 'house.css holds no colour of its own (colours live in tokens.css)').not.toMatch(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/i);
  });

  if (AUDIT) {
    // Audit mode: every hub x light/dark x warm/cool x 1280/390, plus Look > Dark; writes the table, never fails.
    const all = [];
    for (const hub of Object.keys(HUBS)) {
      for (const [bg, scheme, mode] of [['warm', 'light', 'device'], ['cool', 'light', 'device'], ['warm', 'dark', 'device'], ['cool', 'dark', 'device'], ['warm', 'light', 'dark']]) {
        for (const phone of [false, true]) {
          if (mode === 'dark' && phone) continue;
          test(`audit ${hub} ${bg} ${scheme}/${mode} ${phone ? 390 : 1280}`, async ({ page, guard, allowedConsole }) => {
            test.setTimeout(240_000);
            allowedConsole.push(/./);
            await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1280, height: 900 });
            await setLook(page, { bg, mode, scheme });
            const look = bg + '-' + (mode === 'dark' || scheme === 'dark' ? 'dark' : 'light');
            const f = await runAll(page, guard, hub, look, phone);
            fs.appendFileSync(AUDIT, f.map((x) => JSON.stringify({ ...x, mode })).join('\n') + (f.length ? '\n' : ''));
          });
        }
      }
    }
    return;
  }

  // The suite: every view of every hub, desktop warm light and phone cool dark (the two ends), plus Look > Dark on desktop.
  for (const hub of Object.keys(HUBS)) {
    for (const [bg, scheme, mode, phone] of [['warm', 'light', 'device', false], ['cool', 'dark', 'device', true], ['cool', 'light', 'dark', false]]) {
      test(`${hub}: ${bg} ${mode === 'dark' ? 'Look › Dark' : scheme} at ${phone ? '390' : '1280'}px follows every house rule on every view`, async ({ page, guard }) => {
        test.setTimeout(180_000);
        await page.setViewportSize(phone ? { width: 390, height: 844 } : { width: 1280, height: 900 });
        await setLook(page, { bg, mode, scheme });
        const found = await runAll(page, guard, hub, bg + '-' + (mode === 'dark' || scheme === 'dark' ? 'dark' : 'light'), phone);
        expect(found.map((f) => `${f.view}: ${f.rule}: ${f.what}: ${f.got}`)).toEqual([]);
      });
    }
  }
});
