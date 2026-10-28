// The house rules (Lisa, 28 Oct 2026), as numbers, and one in-page check that reads them back by computed style.
// Used by tests/mocked/house-look.spec.js on every hub. Plain words in every problem, so a red run says what to fix.
//
// The numbers here are the agreed rules themselves (not copies of tokens.css): the check would catch tokens.css drifting.
const RULES = {
  radius: 12, line: 1, bar: 3, marker: [3, 18], minFont: 13, weights: ['400', '600'],
  count: { w: 30, h: 22, r: 11, lh: 20, pad: 3 },
  button: { desktop: 36, phone: 44 },
  // Control line, frame top and frame bottom, per background (warm/cool) and mode (light/dark).
  press: { 'warm-light': '#8A7F70', 'cool-light': '#7A8692', 'warm-dark': '#857B6E', 'cool-dark': '#7A8691' },
  frame: { 'warm-light': '#3A3632', 'cool-light': '#33475B', 'warm-dark': '#2A2622', 'cool-dark': '#24323F' },
  foot: { 'warm-light': '#46413B', 'cool-light': '#405569', 'warm-dark': '#34302B', 'cool-dark': '#2D3D4C' },
};

// Runs in the page. `o` = { look: 'warm-light'..., phone, hover: true|false, rules }. Returns a list of { rule, what, got }.
function audit(o) {
  const R = o.rules, out = [], seenWhat = new Set();
  const add = (rule, el, got) => { const what = name(el); const k = rule + '|' + what + '|' + got; if (!seenWhat.has(k)) { seenWhat.add(k); out.push({ rule, what, got: String(got) }); } };
  const name = (e) => { if (!e || !e.tagName) return String(e); const cls = typeof e.className === 'string' ? e.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (cls ? '.' + cls : '') + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22) + '"'; };
  const rgb = (c) => { c = String(c); const m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/.exec(c); if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
    const n = (c.match(/[\d.]+/g) || []).map(Number); if (!n.length) return [0, 0, 0, 0]; return [n[0], n[1], n[2], n[3] === undefined ? 1 : n[3]]; };
  const hex = (h) => { const d = document.createElement('i'); d.style.color = h; document.body.appendChild(d); const v = rgb(getComputedStyle(d).color); d.remove(); return v; };
  const near = (a, b, t = 6) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= t;
  const chroma = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
  const light = (c) => (Math.max(c[0], c[1], c[2]) + Math.min(c[0], c[1], c[2])) / 510;
  const seen = (e) => { if (!e.getClientRects().length) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const px = (v) => parseFloat(v) || 0;
  const icon = (e) => e.closest('svg, .ti, [class^="ti-"], .ico-font, canvas, img, video');
  const hex6 = (c) => '#' + c.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();

  // The bottom tab bar: a fixed nav along the bottom of the screen. The frame top: the first header.
  const navs = [...document.querySelectorAll('nav')].filter((n) => seen(n) && getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().bottom >= innerHeight - 2);
  const tabbar = navs[0] || null;
  const header = [...document.querySelectorAll('header')].find(seen) || null;
  const inTabs = (e) => tabbar && tabbar.contains(e);
  const PRESS = 'button, summary, select, a.btn, a.pill, a.chip, a.lk, a.tag, [role="button"], input[type="button"], input[type="submit"], label.date';
  const controls = [...document.querySelectorAll(PRESS)].filter((e) => seen(e) && !inTabs(e) && !e.closest('.sr, [aria-hidden="true"], .gsi, #credential_picker_container') && getComputedStyle(e).display !== 'contents');
  // A "bare" control is laid out as text: a row title you click, or a card's own title row (a summary holding a heading).
  const bare = (e) => { const s = getComputedStyle(e); if (e.matches('summary') && e.querySelector('h1, h2, h3, h4, h5')) return true; return e.matches('.ttl, [data-house="text"]') && rgb(s.backgroundColor)[3] < 0.05 && ['Top', 'Right', 'Bottom', 'Left'].every((k) => s['border' + k + 'Style'] === 'none' || px(s['border' + k + 'Width']) === 0 || rgb(s['border' + k + 'Color'])[3] < 0.05); };
  const press = hex(R.press[o.look]);
  // Status pills that are also links (dates, needs-you, stuck) keep their status ring: the ring is the information.
  const STATUS = '.date, .dpill, .datep, label.date, .need, .stuck, .alert, .stat, .late, .soon, .over, [data-house="status"]';
  const lines = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); const tops = [...rg.getClientRects()].filter((q) => q.height > 8 && q.width > 1).map((q) => q.top + q.height / 2).sort((a, b) => a - b);
    return tops.reduce((n, t, i) => n + (i && t - tops[i - 1] > 10 ? 1 : 0), tops.length ? 1 : 0); };

  // 1 radius, 2 lines, 9 solid fills, 10 bars: every element (and its ::before / ::after).
  for (const e of document.querySelectorAll('body *')) {
    if (!seen(e) || e.closest('svg, #credential_picker_container')) continue;
    const r = e.getBoundingClientRect(), w = r.width, h = r.height;
    for (const pseudo of [null, '::before', '::after']) {
      const s = getComputedStyle(e, pseudo);
      if (pseudo && (s.content === 'none' || s.content === 'normal' || s.display === 'none')) continue;
      const pw = pseudo ? px(s.width) : w, ph = pseudo ? px(s.height) || (s.position === 'absolute' ? h - px(s.top) - px(s.bottom) : 0) : h;
      if (pseudo && (!pw || !ph)) continue;
      const tag = pseudo ? { tagName: e.tagName, id: e.id, className: (typeof e.className === 'string' ? e.className : '') + ' ' + pseudo, textContent: '' } : e;
      const isBar = Math.min(pw, ph) <= 4 && Math.max(pw, ph) >= 8;
      // Radius: 12px, or round (a dot / ring), or the count pill's 11px; thin bars may round their ends.
      const rad = Math.max(px(s.borderTopLeftRadius), px(s.borderTopRightRadius), px(s.borderBottomLeftRadius), px(s.borderBottomRightRadius));
      if (rad > 0 && !isBar && !e.matches('.bmark') && Math.abs(rad - R.radius) > 0.5 && rad < Math.min(pw, ph) / 2 - 0.5 && !(Math.abs(rad - R.count.r) < 0.5 && Math.abs(ph - R.count.h) < 1.5)) add('radius', tag, rad + 'px');
      // Lines: every border is 1px; a 3px left colour bar is the one wider edge.
      const bw = ['Top', 'Right', 'Bottom', 'Left'].map((k) => (s['border' + k + 'Style'] === 'none' ? 0 : px(s['border' + k + 'Width'])));
      bw.forEach((v, i) => { if (v > 0 && Math.abs(v - R.line) > 0.01 && !(i === 3 && Math.abs(v - R.bar) < 0.01)) add('line', tag, ['top', 'right', 'bottom', 'left'][i] + ' ' + v + 'px'); });
      if (bw[3] > 1.01 && Math.abs(bw[3] - R.bar) > 0.01) add('bar', tag, 'left edge ' + bw[3] + 'px');
      // Box-shadow used as a thick line (inset spread over 1px).
      for (const m of s.boxShadow.matchAll(/inset\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+([\d.]+)px|(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+([\d.]+)px\s+inset/g)) {
        const spread = +(m[4] || m[8]), dx = Math.abs(+(m[1] || m[5])), dy = Math.abs(+(m[2] || m[6]));
        if (spread > 1.01 || (dx > 1.01 && !(dx === 3 && !dy)) || dy > 1.01) add('line', tag, 'inset shadow ' + m[0]);
      }
      // Solid fills: a strong colour behind something bigger than a dot. Allowed: small status dots, switch knobs, bars.
      const bg = rgb(s.backgroundColor);
      if (bg[3] >= 0.5 && chroma(bg) > 70 && light(bg) > 0.2 && light(bg) < 0.82 && Math.min(pw, ph) > 12 && !e.closest('img, picture, video, canvas, .qr, .sws, .swwrap, [data-house="swatch"]')) add('solid fill', tag, hex6(bg) + ' ' + Math.round(pw) + 'x' + Math.round(ph));
      // Bars: a thin upright colour strip is 3px wide.
      if (pw <= 6 && pw > 0 && ph >= 10 && bg[3] >= 0.5 && chroma(bg) > 40 && Math.abs(pw - R.bar) > 0.6) add('bar', tag, Math.round(pw * 10) / 10 + 'x' + Math.round(ph) + 'px');
    }
  }
  // 10b the column-title stage marker is exactly 3 x 18.
  for (const e of document.querySelectorAll('.col-head .sbar, .house-marker')) {
    if (!seen(e)) continue;
    const r = e.getBoundingClientRect();
    if (Math.abs(r.width - R.marker[0]) > 0.5 || Math.abs(r.height - R.marker[1]) > 0.5) add('bar', e, 'stage marker ' + r.width + 'x' + r.height);
  }
  // 3 type and 4 no coloured words: every element that holds words.
  for (const e of document.querySelectorAll('body *')) {
    if (!seen(e) || icon(e) || e.closest('#credential_picker_container, .sr')) continue;
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e);
    if (!/lexend/i.test(s.fontFamily.split(',')[0])) add('font', e, s.fontFamily.split(',')[0]);
    if (!R.weights.includes(s.fontWeight)) add('weight', e, s.fontWeight);
    if (px(s.fontSize) < R.minFont - 0.01) add('size', e, s.fontSize);
    if (s.textTransform !== 'none') add('case', e, s.textTransform);
    if (/small-caps/.test(s.fontVariant)) add('case', e, s.fontVariant);
    const c = rgb(s.color);
    if (c[3] > 0.3 && chroma(c) > 45) add('coloured text', e, hex6(c));
  }
  // 5 one control line, 6 button height (36 / 44), on everything you press (not the bottom tabs).
  const want = o.phone ? R.button.phone : R.button.desktop;
  for (const e of controls) {
    if (bare(e)) continue;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    const inHead = header && header.contains(e);
    // A control that wraps its words onto more lines may grow past the minimum; a one-line control is exactly 36 / 44.
    if (!e.matches('input[type="checkbox"], input[type="radio"], #backHome') && (r.height < want - 0.6 || (r.height > want + 0.6 && lines(e) <= 1))) add('button height', e, Math.round(r.height * 10) / 10 + 'px (want ' + want + ')');
    if (inHead) continue; // frame buttons use the frame's own light line
    const bc = rgb(s.borderTopColor), bwid = s.borderTopStyle === 'none' ? 0 : px(s.borderTopWidth);
    if (!bwid || bc[3] < 0.3) { add('control line', e, 'no line'); continue; }
    if (chroma(bc) > 45) { if (!e.matches(STATUS)) add('control line', e, 'rests on a meaning colour ' + hex6(bc) + ' (one control line; the colour shows on hover)'); continue; }
    if (!near(bc, press, 8)) add('control line', e, hex6(bc) + ' (want ' + hex6(press) + ')');
  }
  // 7 counts: a small ringed box holding only a number. 30 x 22, radius 11, line-height 20, padding 0 3px; .wide for 3+ digits.
  for (const e of document.querySelectorAll('body *')) {
    if (!seen(e) || e.children.length || e.matches(PRESS)) continue;
    const t = (e.textContent || '').trim(), s = getComputedStyle(e), r = e.getBoundingClientRect();
    const ringed = s.borderTopStyle !== 'none' && px(s.borderTopWidth) > 0 && rgb(s.borderTopColor)[3] > 0.3;
    if (!/^\d{1,4}\+?$/.test(t) || !ringed || r.height > 26 || r.width > 60) continue; // bigger ringed numbers are summary figures, not count pills
    if (t === '0') { add('count', e, '0 shows a ring'); continue; }
    const wide = t.replace('+', '').length >= 3;
    if (Math.abs(r.height - R.count.h) > 0.6) add('count', e, 'height ' + r.height);
    if (!wide && Math.abs(r.width - R.count.w) > 0.6) add('count', e, 'width ' + r.width);
    if (wide && !e.classList.contains('wide')) add('count', e, t.length + ' digits without .wide');
    if (s.boxSizing !== 'border-box') add('count', e, s.boxSizing);
    if (Math.abs(px(s.borderTopLeftRadius) - R.count.r) > 0.5) add('count', e, 'radius ' + s.borderTopLeftRadius);
    if (Math.abs(px(s.lineHeight) - R.count.lh) > 0.5) add('count', e, 'line-height ' + s.lineHeight);
    if (!wide && Math.abs(px(s.paddingLeft) - R.count.pad) > 0.5) add('count', e, 'padding ' + s.paddingLeft);
    if (o.phone && inTabs(e) && s.position === 'absolute') add('count', e, 'phone tab count not in the flow');
  }
  for (const e of document.querySelectorAll('.cnt, .n, .count, .badge')) {
    const t = (e.textContent || '').trim(), s = getComputedStyle(e);
    if (seen(e) && (t === '' || t === '0') && s.borderTopStyle !== 'none' && px(s.borderTopWidth) > 0 && rgb(s.borderTopColor)[3] > 0.3) add('count', e, 'empty or 0 shows a ring');
  }
  // 8 date pills: always ringed; rose for late, amber for soon.
  const tok = (n, f) => hex(getComputedStyle(document.documentElement).getPropertyValue(n).trim() || getComputedStyle(document.documentElement).getPropertyValue(f).trim());
  const rose = tok('--house-late', '--ljr-2'), amber = tok('--house-soon', '--ljr-3-text');
  for (const e of document.querySelectorAll('.dpill, .datep, .date, label.date, .due')) {
    if (!seen(e) || !(e.textContent || '').trim()) continue;
    const s = getComputedStyle(e), bc = rgb(s.borderTopColor);
    if (s.borderTopStyle === 'none' || px(s.borderTopWidth) === 0 || bc[3] < 0.3) { add('date pill', e, 'no ring'); continue; }
    const late = e.matches('.late, .over, .overdue, .bad'), soon = e.matches('.soon, .warn, .due-soon');
    if (late && !near(bc, rose, 12)) add('date pill', e, 'late ring ' + hex6(bc));
    if (soon && !near(bc, amber, 12)) add('date pill', e, 'soon ring ' + hex6(bc));
  }
  // 11 frame: deep top and bottom, light tab buttons.
  if (header) { const bg = rgb(getComputedStyle(header).backgroundColor); if (!near(bg, hex(R.frame[o.look]), 8)) add('frame', header, 'top ' + hex6(bg) + ' (want ' + R.frame[o.look] + ')'); }
  if (tabbar) {
    const bg = rgb(getComputedStyle(tabbar).backgroundColor);
    if (!near(bg, hex(R.foot[o.look]), 8)) add('frame', tabbar, 'bottom ' + hex6(bg) + ' (want ' + R.foot[o.look] + ')');
    for (const a of tabbar.querySelectorAll(':scope > a, :scope > button, :scope > * > a, :scope > * > button')) {
      if (!seen(a)) continue;
      const tb = rgb(getComputedStyle(a).backgroundColor);
      if (tb[3] < 0.5 || (/light/.test(o.look) && light(tb) < 0.8)) add('frame', a, 'tab button not light: ' + hex6(tb));
      const s = getComputedStyle(a);
      if (s.outlineStyle !== 'none' && px(s.outlineWidth) > 0 && document.activeElement !== a) add('tabs', a, 'outline at rest');
    }
  }
  // 12 gaps: 12px between cards that stack in one column; 12px padding inside a card.
  for (const c of document.querySelectorAll('.card')) {
    if (!seen(c)) continue;
    const s = getComputedStyle(c);
    if (Math.abs(px(s.paddingTop) - 12) > 0.5 || Math.abs(px(s.paddingLeft) - 12) > 0.5) add('card padding', c, s.paddingTop + ' ' + s.paddingLeft);
    const n = c.nextElementSibling;
    if (n && n.matches('.card') && seen(n)) {
      const a = c.getBoundingClientRect(), b = n.getBoundingClientRect();
      if (b.top >= a.bottom - 1 && Math.abs(b.left - a.left) < 2) { const g = Math.round(b.top - a.bottom); if (Math.abs(g - 12) > 1) add('card gap', n, g + 'px'); }
    }
  }
  return out;
}

// Runs in the page: hover one control and read what changed. Returns { before, after } of the box and the drawn line.
function hoverRead(sel) {
  const e = document.querySelector(sel); if (!e) return null;
  const s = getComputedStyle(e), r = e.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, outline: s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor, offset: s.outlineOffset, ow: s.outlineWidth, os: s.outlineStyle, oc: s.outlineColor, bg: s.backgroundColor, border: s.borderTopColor, shadow: s.boxShadow, transform: s.transform };
}

module.exports = { RULES, audit, hoverRead };
