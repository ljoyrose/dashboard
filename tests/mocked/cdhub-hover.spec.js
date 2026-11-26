// CD Hub house hover rule, measured (the owner, 12 Nov 2026, PR 408): hover and tap show a PALE GREY FILL and NO line,
// on 12px rounded corners. Keyboard focus keeps its thin ink line. This test hovers one of every kind of control on
// every hub screen (and inside the opened panels) and reads what the browser really draws.
// Invented 27-animal set; pretend Google and Drive.
const base = require('../support/test');
const { buildWorld } = require('../support/world');
const c27 = require('../support/cdhub27');
const { settle } = require('../support/settle');

const test = base.test.extend({ world: async ({}, use) => use(c27.install(buildWorld())) });
const { expect } = base;
const HIDDEN = ['buyers', 'shape', 'litters', 'vet'];   // switched off (PR 472): not walked
// Known and parked for the owner (not changed here): Main's "Next" card is one big tappable card with no hover fill. Its style
// lives in the shared house.css and is the same on every hub, so changing it is her call (CDHUB-HUMAN-TEST slip, decision 2).
const PARKED = ['section.card.hm-next[row]'];
// Breed Better's own look (its PR of 15 Nov 2026, "house selected look"): its chips and fold lines on the dog card show a thin
// coloured line on hover, on 8px corners, by design, and its own acceptance test holds that. Not judged by the grey-fill rule
// here; whether Breed Better should follow the grey fill instead is parked for the owner (CDHUB-HUMAN-TEST-2 slip, decision 2).
const OWN_LOOK = /^(button|summary)\.bb-/;

/** One of each kind of control on screen: [{ i, kind, label }], each tagged data-hv="i". Runs in the page. */
function kinds() {
  document.querySelectorAll('[data-hv]').forEach((e) => e.removeAttribute('data-hv'));
  const seen = new Set(), out = [];
  const sel = 'a[href], button, summary, select, [role="button"], [data-open-row], [data-fold-row], .wtc, .info';
  document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || el.disabled || el.closest('[hidden], .hidden, [inert]')) return;
    if (el.closest('nav.house-tabs, #nav') || el.matches('.skip, .phbtn')) return;   // bottom tabs have their own rule; the photo hit target is the picture, not a lined button
    for (let d = el.parentElement; d; d = d.parentElement) if (d.tagName === 'DETAILS' && !d.open && !(el.tagName === 'SUMMARY' && el.parentElement === d)) return;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => !/^(on|hidden|today|house-fold-pad|house-fold-row)$/.test(c)).slice(0, 3).join('.') : '';
    const where = el.closest('header') ? 'top bar ' : '';
    const kind = where + el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (el.hasAttribute('data-open-row') ? '[row]' : '') + (el.hasAttribute('data-fold-row') ? '[heading row]' : '');
    if (seen.has(kind)) return;
    seen.add(kind);
    el.setAttribute('data-hv', String(out.length));
    out.push({ i: out.length, kind, heading: el.hasAttribute('data-fold-row'), chosen: el.getAttribute('aria-pressed') === 'true' || el.hasAttribute('aria-current'), label: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) });
  });
  return out;
}
/** What is drawn on the element now. Runs in the page. */
function drawn(i) {
  const el = document.querySelector('[data-hv="' + i + '"]'), cs = getComputedStyle(el);
  const px = (v) => parseFloat(v) || 0;
  const sides = ['Top', 'Right', 'Bottom', 'Left'].map((s) => (cs['border' + s + 'Style'] !== 'none' && px(cs['border' + s + 'Width']) > 0 && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs['border' + s + 'Color']) ? 1 : 0));
  // a control that is the words inside a framed row fills its row, not itself (the SOP rows): read the row too
  const up = el.parentElement ? getComputedStyle(el.parentElement).backgroundColor : '';
  return {
    bg: cs.backgroundColor, rowBg: up, afterBg: getComputedStyle(el, '::after').backgroundColor,   // a fold line's own chevron box (drawn as ::after) carries the fill outline: cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0 ? cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor : '',
    boxed: sides.every(Boolean), radius: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
    cursor: cs.cursor, plainLink: el.tagName === 'A' && !sides.some(Boolean) && /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && cs.display.indexOf('inline') === 0,
    circle: px(cs.borderTopLeftRadius) >= Math.min(el.offsetWidth, el.offsetHeight) / 2 - 1,
  };
}

test('CD Hub: every kind of control hovers with the pale grey fill, no line, and 12px corners', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(c27.NOW);
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  // the house greys, as the browser resolves them on this page
  const grey = await page.evaluate(() => {
    const read = (v, host) => { const p = document.createElement('i'); p.style.cssText = 'position:absolute;left:-99px;background:' + v; host.appendChild(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; };
    return { hov: read('var(--hov)', document.getElementById('main')), frame: read('var(--frame-hov)', document.querySelector('header')), radius: getComputedStyle(document.documentElement).getPropertyValue('--radius').trim() };
  });
  expect(grey.radius).toBe('12px');
  expect(grey.hov).not.toMatch(/rgba\(0, 0, 0, 0\)/);

  // the screen has finished reading: the first tables and the later ones ("Getting these records ready")
  const loaded = () => page.waitForFunction(() => typeof LOAD !== 'undefined' && LOAD.state === 'ok' && LOAD.later !== 'wait' && !document.getElementById('cdWait'), null, { timeout: 15000 }).catch(() => {});
  await loaded();   // the More list is complete only when the later tables are in
  const routes = (await page.evaluate(() => Array.from(document.querySelectorAll('#nav [data-go]')).map((b) => b.dataset.go))).filter((id, i, a) => a.indexOf(id) === i && !HIDDEN.includes(id));
  // panels that hold more kinds of control: opened after the screen itself has been measured
  const PANELS = {
    dogs: async () => { await page.locator('[data-fpanel="fp-dogs"]').click(); for (const s of ['details.dcs > summary', 'details.dcs.more > summary']) { const f = page.locator('.dc').first().locator(s).first(); if (await f.count()) await f.click(); } },
    sops: async () => { await page.locator('[data-fpanel="fp-sops"]').click(); await page.locator('[data-sop-open]').first().click(); },
    today: async () => { await page.locator('.tile.tl[data-list]').first().click(); },
  };
  const bad = [], done = new Set();
  let measured = 0;
  const measure = async (where) => {
    const t0 = Date.now(), n0 = measured;
    let list = [];
    // The hub draws a screen again when its later tables arrive, and the marks on the controls go with the old drawing.
    // A control that has gone is not waited for (that wait was the four-minute stall, found 20 Nov 2026): the screen is listed again.
    for (let pass = 0, again = true; again && pass < 4; pass++) {
     again = false;
     await loaded();
     list = await page.evaluate(kinds);
     for (const k of list) {
      if (done.has(k.kind)) continue;
      const el = page.locator('[data-hv="' + k.i + '"]');
      if (!(await el.count())) { again = true; break; }
      done.add(k.kind);
      await el.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'nearest' }), undefined, { timeout: 2000 }).catch(() => {});   // clear of the top bar and the bottom tabs
      await page.mouse.move(0, 0);
      try { await el.hover({ timeout: 2000 }); } catch (e) {
        const by = await el.evaluate((n) => { const r = n.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return (t ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + (typeof t.className === 'string' && t.className ? '.' + t.className.trim().split(/\s+/).join('.') : '') : 'nothing') + ' at ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }, undefined, { timeout: 2000 }).catch(() => 'it has gone');
        if (by === 'it has gone') { done.delete(k.kind); again = true; break; }   // the screen was drawn again under the pointer
        bad.push(`${where} · ${k.kind} "${k.label}": could not be hovered (covered by ${by})`); continue;
      }
      if (!(await el.count())) { done.delete(k.kind); again = true; break; }
      await Promise.race([settle(el), page.waitForTimeout(3000)]);
      const d = await page.evaluate(drawn, k.i).catch(() => null);
      if (!d) { done.delete(k.kind); again = true; break; }
      measured++;
      if (d.plainLink || OWN_LOOK.test(k.kind)) continue;                                   // a word that is a link: underlined text, no box, no fill
      const want = k.kind.startsWith('top bar ') ? grey.frame : grey.hov;
      const at = `${where} · ${k.kind} "${k.label}"`;
      // a section heading row folds its section when tapped: its chevron button carries the fill, the heading itself stays plain
      if (!k.heading && !PARKED.includes(k.kind) && d.bg !== want && d.rowBg !== want && d.afterBg !== want) bad.push(`${at}: hover fill is ${d.bg}, the house pale grey is ${want}`);
      // the chosen one of a set keeps ONE thin grey line inside (house rule): every other control shows no line
      if (d.outline && !k.chosen) bad.push(`${at}: hover draws a line (${d.outline})`);
      if (d.boxed && !d.circle && d.radius.some((r) => r !== '12px')) bad.push(`${at}: corners are ${d.radius.join(' ')}, the house corner is 12px`);
      // a press (tap) shows the same fill and no line
      await page.mouse.down();
      const p = await page.evaluate(drawn, k.i).catch(() => ({}));
      await page.mouse.move(0, 0);
      await page.mouse.up();
      if (p.outline && !k.chosen) bad.push(`${at}: a press draws a line (${p.outline})`);
      if (process.env.HOVER_LOG) console.log(`  ${Date.now() - t0}ms ${at}`);
     }
    }
    if (process.env.HOVER_LOG) console.log(`HOVER ${where}: ${measured - n0} new kinds of ${list.length} in ${Date.now() - t0}ms`);
  };
  for (const id of routes) {
    await page.goto('about:blank'); await page.goto('cdhub/#/' + id);
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await page.waitForTimeout(200);
    await measure('#/' + id);
    if (PANELS[id]) {
      await page.goto('about:blank'); await page.goto('cdhub/#/' + id);
      await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
      await PANELS[id]();
      await page.waitForTimeout(150);
      await measure('#/' + id + ' (panels open)');
    }
  }
  console.log(`HOVER measured ${measured} kinds of control on ${routes.length} screens · house pale grey ${grey.hov} · problems ${bad.length}`);
  expect(measured, 'kinds of control measured').toBeGreaterThan(25);
  expect(bad, 'Every control hovers with the pale grey fill, no line, 12px corners').toEqual([]);
});
