// One line, drawn inside (Lisa, 3 Nov 2026): every line is 1px and sits INSIDE the element. Hover, focus, press and selected
// change the colour of the existing line, or draw a 1px line inside (outline-offset -1px). Never a second line, a 2px ring
// or a ring outside the box, so nothing looks thicker or jumps.
// On all 8 pages, every tab and More page, at 1280 and 390 (warm light): every interactive element is keyboard-focused
// (focus-visible) and hovered, and must keep its box, draw an outline of 1px or less at offset 0 or below, and add no
// box-shadow ring. Typing boxes may only change their border colour on focus. Pretend Google, Drive and Sheets.
//
// LINES_AUDIT=<file> adds every finding to that file (one per line) instead of failing: the before / after list in the pull request.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { HUBS, setLook, go, settle } = require('../support/hubs');

const AUDIT = process.env.LINES_AUDIT;
const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const PAGES = {
  ...HUBS,
  estate: {
    url: 'estate/', views: ['home', 'all', 'shops', 'unchecked', 'access'],
    async open(page) {
      const F = require('../fixtures/estate/rows.js');
      await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
      await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(F.HEADER, F.ROWS) }) }));
      await page.goto('estate/#/home');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#view [data-hub-main]')).toBeVisible();
    },
  },
};

const CONTROLS = 'a[href], button, summary, input:not([type="hidden"]), textarea, select, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, select, [contenteditable="true"]';

// Runs in the page: what a state may change, read off one element.
function readOne(e) {
  const s = getComputedStyle(e), r = e.getBoundingClientRect(), p = (e.parentElement || e).getBoundingClientRect();
  return {
    box: [r.x - p.x, r.y - p.y, r.width, r.height].map((n) => Math.round(n * 2) / 2).join(','),
    ow: s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth) || 0, oo: parseFloat(s.outlineOffset) || 0,
    shadow: s.boxShadow, border: ['Top', 'Right', 'Bottom', 'Left'].map((k) => s['border' + k + 'Width'] + ' ' + s['border' + k + 'Style']).join('/'),
  };
}
// The problems between a resting read and a state read.
function judge(rest, now, typing) {
  const bad = [];
  if (now.box !== rest.box) bad.push('moves (' + rest.box + ' > ' + now.box + ')');
  if (now.border !== rest.border) bad.push('border changes width (' + rest.border + ' > ' + now.border + ')');
  if (now.shadow !== rest.shadow) bad.push('adds a box-shadow (' + now.shadow.slice(0, 50) + ')');
  if (typing && now.ow > 0) bad.push('typing box draws an outline (' + now.ow + 'px): change only the border colour');
  else {
    if (now.ow > 1) bad.push(now.ow + 'px outline');
    if (now.ow > 0 && now.oo > 0) bad.push('ring outside the box (offset ' + now.oo + 'px)');
  }
  return bad;
}

// Runs in the page: keyboard-focus every interactive element in turn (focus-visible, as after a Tab); returns each resting and
// focused read, one per kind of control (tag and classes), so one bad rule is one line, not a hundred.
function focusAll() {
  const read = (e) => {
    const s = getComputedStyle(e), r = e.getBoundingClientRect(), p = (e.parentElement || e).getBoundingClientRect();
    return {
      box: [r.x - p.x, r.y - p.y, r.width, r.height].map((n) => Math.round(n * 2) / 2).join(','),
      ow: s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth) || 0, oo: parseFloat(s.outlineOffset) || 0,
      shadow: s.boxShadow, border: ['Top', 'Right', 'Bottom', 'Left'].map((k) => s['border' + k + 'Width'] + ' ' + s['border' + k + 'Style']).join('/'),
    };
  };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 3).map((c) => '.' + c).join('') + ' "' + (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"';
  const seen = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility === 'visible'; };
  const out = [];
  for (const e of document.querySelectorAll(CONTROLS)) {
    // A skip link is meant to appear on focus (it rests off screen): its move is the point.
    if (!seen(e) || e.disabled || e.matches('.skip, .skip-link')) continue;
    const typing = e.matches(TYPING);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const rest = read(e);
    e.focus({ preventScroll: true });
    if (document.activeElement !== e || !e.matches(':focus-visible')) continue;
    out.push({ what: name(e), kind: e.tagName + '.' + [...e.classList].sort().join('.'), typing, rest, now: read(e) });
    e.blur();
  }
  return out;
}

for (const [hub, P] of Object.entries(PAGES)) {
  test.describe(hub, () => {
    for (const W of [1280, 390]) {
      test(`${W}: focus and hover keep one 1px line inside (no ring outside, no 2px, no shadow, nothing moves)`, async ({ page, guard }) => {
        test.setTimeout(480_000);   // every control on every view; the shared Mac is slow under a full run
        await page.setViewportSize({ width: W, height: W > 600 ? 900 : 844 });
        await setLook(page, { bg: 'warm', mode: 'device', scheme: 'light' });
        await P.open(page, guard);
        const bad = [], hovered = new Set();
        for (const v of P.views) {
          await go(page, v);
          // A key press first, so programmatic focus counts as keyboard focus (:focus-visible), as a Tab would.
          await page.keyboard.press('Shift');
          const kinds = new Set();
          for (const f of await page.evaluate(`(${focusAll.toString().replace('CONTROLS', JSON.stringify(CONTROLS)).replace('TYPING', JSON.stringify(TYPING))})()`)) {
            const b = judge(f.rest, f.now, f.typing);
            if (b.length && !kinds.has(f.kind + b.join())) { kinds.add(f.kind + b.join()); bad.push(`#/${v} ${f.what}: focus ${b.join(', ')}`); }
          }
          // Hover: one of each kind of control (tag and classes) on the page, on the first view that shows it: hover rules go by kind,
          // and once per kind keeps the suite inside the CI time limit.
          const picks = await page.evaluate((done) => {
            document.querySelectorAll('[data-hl]').forEach((e) => e.removeAttribute('data-hl'));
            const kinds = new Map();
            for (const e of document.querySelectorAll('a[href], button, summary, input:not([type="hidden"]), textarea, select, [role="button"], [role="tab"], [role="switch"], [tabindex="0"]')) {
              const r = e.getBoundingClientRect();
              if (!(r.width > 0 && r.height > 0) || e.disabled || getComputedStyle(e).visibility !== 'visible') continue;
              const k = e.tagName + '.' + [...e.classList].sort().join('.');
              if (!kinds.has(k) && !done.includes(k)) kinds.set(k, e);
            }
            return [...kinds.entries()].map(([k, e], i) => { e.setAttribute('data-hl', String(i)); return { k, sel: '[data-hl="' + i + '"]', what: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 3).map((c) => '.' + c).join('') + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24) + '"' }; });
          }, [...hovered]);
          for (const p of picks) {
            hovered.add(p.k);
            const el = page.locator(p.sel);
            await page.mouse.move(1, 1);
            let rest;
            try { await el.scrollIntoViewIfNeeded({ timeout: 1000 }); rest = await el.evaluate(readOne); await el.hover({ timeout: 1000 }); } catch (e) { continue; }
            await settle(el);
            const now = await el.evaluate(readOne).catch(() => null);
            if (!now) continue;
            const b = judge(rest, now, false);
            if (b.length) bad.push(`#/${v} ${p.what}: hover ${b.join(', ')}`);
          }
          await page.mouse.move(1, 1);
        }
        const list = [...new Set(bad)];
        const where = `${hub} ${W}`;
        if (AUDIT) { if (list.length) fs.appendFileSync(AUDIT, list.map((x) => where + ': ' + x + '\n').join('')); return; }
        expect(list, where).toEqual([]);
      });
    }
  });
}
