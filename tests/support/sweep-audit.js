// The style sweep (Lisa, 3 Nov 2026): one set of in-page checks, read back from the drawn page and its style sheets.
//  1 No fill on hover, focus, press or selected, anywhere except typing boxes (input, textarea, select, contenteditable) and the ONE
//    pale grey state fill (Lisa, 12 Nov 2026: hover, tap and selected = --hov / --sel-fill; on the dark frame --frame-hov).
//  2 Numbers side by side in one group are the same size (and weight).
//  3 No explainer lines or sub-lines that restate a label.
//  4 Nothing moves on hover or focus.
//  5 A rose count means late: every rose ring sits with something late, overdue, down or expired. A black count (.broken, Lisa
//    3 Nov 2026) means broken: it sits with something down, expired, stuck or failed, and its link (if it has a label) says the word.
// Each check returns a list of plain-words problems, so a red run says what to fix.

// Runs in the page: every style rule (inline <style> and the site's own sheets) that styles a state, and what it changes.
// Returns [{ sel, prop, value, sheet }] for rules that fill (a background) or move (a transform) in a state. Moves of the box
// (padding, margins, size) are read from the drawn page by the pointer test, since many rules pin the same box in every state.
function stateRules() {
  const STATE = /:(hover|focus|focus-visible|focus-within|active)\b|\[aria-(pressed|current|selected|expanded)(="[^"]*")?\]|\.(on|sel|active|is-on|selected|current)\b|:checked\b/;
  // Typing boxes may change their background; so may an on/off switch (a form control: its track shows on or off).
  const TYPING = /(^|[\s>+~(,])(input|textarea|select)\b|\[contenteditable|::placeholder|::-webkit|::selection|\.fin\b|\.sw\b/;
  const noNot = (x) => { let y = x, z; while ((z = y.replace(/:not\([^()]*\)/g, '')) !== y) y = z; return y; };   // :not(:hover) is the resting state
  // The one pale grey state fill (Lisa, 12 Nov 2026) is the house rule, not a fill to find.
  const OK_BG = /^(transparent|none|inherit|initial|unset|revert|var\(--(house-)?card\)|var\(--(hov|sel-fill|frame-hov)\)|rgba\(0, 0, 0, 0\))$/;
  const out = [];
  const walk = (rules, sheet) => {
    for (const r of rules) {
      if (r.cssRules && !r.selectorText) { walk(r.cssRules, sheet); continue; }
      if (!r.selectorText || !r.style) continue;
      const parts = r.selectorText.split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => STATE.test(noNot(x)) && !TYPING.test(x));
      if (!parts.length) continue;
      // The bar under a bottom tab is the tab's own marker (Lisa's tab picks): it widens and takes the tab colour, by design.
      const sel = parts.filter((x) => !/(^|\s|>)\.bar\b/.test(x)).join(', ');
      if (!sel) continue;
      for (const prop of ['background', 'background-color', 'background-image']) {
        const value = r.style.getPropertyValue(prop).trim();
        if (!value || OK_BG.test(value)) continue;
        out.push({ kind: 'fill', sel, prop, value, sheet });
      }
      for (const prop of ['transform', 'translate', 'scale']) {
        const value = r.style.getPropertyValue(prop).trim();
        if (!value || /^none$/.test(value)) continue;
        if (/svg|\.hi\b|\.ti\b|::(before|after)/.test(sel)) continue;   // an icon turning (the fold chevron) is not the control moving
        out.push({ kind: 'move', sel, prop, value, sheet });
      }
    }
  };
  for (const s of document.styleSheets) {
    let rules; try { rules = s.cssRules; } catch (e) { continue; }   // a sheet from another site (fonts) cannot be read: not ours
    const href = s.href ? new URL(s.href).pathname.replace(/^.*\//, '') : 'inline <style>';
    if (s.href && new URL(s.href).origin !== location.origin) continue;
    walk(rules, href);
  }
  // Each finding once.
  const seen = new Set();
  return out.filter((f) => { const k = f.kind + f.sel + f.prop + f.value; if (seen.has(k)) return false; seen.add(k); return true; });
}

// Runs in the page: the drawn view. Returns { selected, groups, explainers, rose, broken } problem lists.
function drawn() {
  const seen = (e) => { if (!e.getClientRects().length) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ([...e.classList].slice(0, 3).map((c) => '.' + c).join('')) + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const alpha = (c) => { if (!c || c === 'transparent') return 0; const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 1; const p = m[1].split(/[,/ ]+/).filter(Boolean); return p.length > 3 ? +p[3] : 1; };
  const bgOf = (e) => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (alpha(c) > 0.05) return c; } return 'rgb(255, 255, 255)'; };
  // Typing boxes, and on/off switches (.sw: a form control whose track shows on or off), may change their background.
  const typing = (e) => e.matches('input, textarea, select, [contenteditable="true"], [contenteditable=""], .sw, [role="switch"]');
  const out = { selected: [], groups: [], explainers: [], rose: [], broken: [] };

  // 1 Selected things carry no fill: the same background as an unselected one beside it, or as what they sit on, or the one pale
  //   grey selected fill (--sel-fill, Lisa 12 Nov 2026).
  const pr = document.createElement('span'); pr.style.background = 'var(--sel-fill, transparent)'; document.body.appendChild(pr);
  const selFill = getComputedStyle(pr).backgroundColor; pr.remove();
  const SEL = '[aria-pressed="true"], [aria-current="page"], [aria-current="true"], [aria-selected="true"], .on, .sel, .selected';
  for (const e of document.querySelectorAll(SEL)) {
    if (!seen(e) || typing(e) || e.closest('svg') || e.matches('html, body, main, #view, section, .card, li, tr, td, dialog')) continue;
    const s = getComputedStyle(e);
    const sib = [...(e.parentElement ? e.parentElement.children : [])].find((x) => x !== e && x.tagName === e.tagName && !x.matches(SEL) && seen(x));
    const want = sib ? getComputedStyle(sib).backgroundColor : (e.parentElement ? bgOf(e.parentElement) : 'rgb(255, 255, 255)');
    const got = s.backgroundColor;
    const same = got === want || got === selFill || (alpha(got) < 0.05 && !sib);
    if (!same || (s.backgroundImage !== 'none' && !/url\(/.test(s.backgroundImage))) out.selected.push(name(e) + ': selected fill ' + got + (s.backgroundImage !== 'none' ? ' ' + s.backgroundImage.slice(0, 40) : '') + ' (beside ' + want + ')');
  }

  // 2 Number groups: numbers side by side (same row, siblings of one kind) share one size and weight.
  const NUM = /^(–|-|[£$€]?\s?[\d.,]+\s?[kKmM%]?|\d+\s+of\s+\d+)$/;
  // Cheap tests first (no children, a number's text), then the drawn ones: big pages have thousands of elements.
  const leaves = [...document.querySelectorAll('body *')].filter((e) => !e.children.length && NUM.test((e.textContent || '').trim()) && seen(e) && !e.closest('nav.house-tabs, header, svg, .cnt, .n, .dpill, .date, .tag, .pill, table, time, label, button.house-fold'));
  const groups = new Map();
  for (const e of leaves) {
    // The unit that repeats: a number that is itself one of several like siblings, or the number inside one of several like siblings.
    let unit = e;
    for (let up = e, i = 0; up && i < 3; up = up.parentElement, i++) {
      const p = up.parentElement; if (!p) break;
      const like = [...p.children].filter((x) => x.tagName === up.tagName && x.className === up.className);
      if (like.length > 1) { unit = up; break; }
    }
    const p = unit.parentElement; if (!p) continue;
    const key = p;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const [p, list] of groups) {
    if (list.length < 2) continue;
    // Side by side: on one row.
    const rows = new Map();
    for (const e of list) { const t = Math.round(e.getBoundingClientRect().top / 8); if (!rows.has(t)) rows.set(t, []); rows.get(t).push(e); }
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      const sizes = row.map((e) => { const s = getComputedStyle(e); return s.fontSize + '/' + s.fontWeight; });
      if (new Set(sizes).size > 1) out.groups.push(name(p) + ': numbers side by side differ ' + row.map((e, i) => '"' + e.textContent.trim() + '" ' + sizes[i]).join(', '));
    }
  }

  // 3 Explainer lines: a sub-line that tells you how to use the page, or that repeats the label above it.
  const SUB = '.hsub, .sub, .hint, .explain, .lead, .help, p.what, .note, .ph-sub, .hint-line, small.sub';
  const norm = (t) => (t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const HOWTO = /^(tap|click|press|select|choose|use (this|the)|this (page|card|list|tab|view) (shows|lists|is)|here you can|opens? (in|the|a|your)\b)/i;
  for (const e of document.querySelectorAll(SUB)) {
    if (!seen(e) || e.closest('nav, header, dialog, form, .empty, [data-hm="empty"], [data-hm="fail"]')) continue;
    const t = (e.textContent || '').trim(); if (!t) continue;
    if (HOWTO.test(t)) { out.explainers.push(name(e) + ': how-to line'); continue; }
    let h = e.previousElementSibling; while (h && !h.textContent.trim()) h = h.previousElementSibling;
    if (!h) { const c = e.closest('.card, section'); h = c && c.querySelector('h2, h3, h4'); }
    if (h && h !== e && !h.contains(e)) { const a = norm(h.textContent), b = norm(t); if (a.length > 3 && (b === a || (b.startsWith(a) && b.length < a.length + 12))) out.explainers.push(name(e) + ': repeats "' + h.textContent.trim().slice(0, 30) + '"'); }
  }

  // 5 Rose counts: a rose ring (late) sits with something late, overdue, down or expired in its card, row or link label.
  const ROSE = '.cnt.need, .hm-v.need, .hk b.need, .n.need';
  const LATE = '.dpill.late, .date.late, .late, [data-kind="late"], .over, .overdue, .n-risk, .st-bad, .bad';
  const LATEWORD = /(?<![a-z])(late|overdue|down|expired|expires? today|past (its|their) due|stuck|blocked)(?![a-z])/i;   // "2Overdue" counts
  for (const e of document.querySelectorAll(ROSE)) {
    if (!seen(e) || e.closest('nav.house-tabs') || !(e.textContent || '').trim()) continue;
    const c = e.closest('[data-open-row], li, .hk, .hm-n, .card, section') || e.parentElement;
    const a = e.closest('a'); const label = ((a && (a.getAttribute('aria-label') || a.textContent)) || '') + ' ' + (c ? c.textContent : '');
    if (c && (c.querySelector(LATE) || LATEWORD.test(label))) continue;
    // A group heading's count (Marketplace's "Post 3"): the late thing is in the cards under it, up to the next heading of its kind.
    let sib = c && c.nextElementSibling, hit = false;
    while (sib && !(c.className && sib.className === c.className)) { if (sib.matches(LATE) || sib.querySelector(LATE)) { hit = true; break; } sib = sib.nextElementSibling; }
    if (hit) continue;
    out.rose.push(name(e) + ': rose ring with nothing late in ' + (c ? name(c) : 'its place'));
  }

  // 5b Black counts (broken): with something down, expired, stuck or failed in its card, row or link label; never also rose.
  const BROKEWORD = /(?<![a-z])(down|expired|stuck|fail(s|ed|ing)?|engine)(?![a-z])/i;
  for (const e of document.querySelectorAll('.cnt.broken, .hm-v.broken, .hk b.broken, .v.broken')) {
    if (!seen(e) || e.closest('nav.house-tabs') || !(e.textContent || '').trim()) continue;
    if (e.classList.contains('need')) out.broken.push(name(e) + ': both rose and black');
    const c = e.closest('[data-open-row], li, .hk, .hm-n, .tile, .pill, .card, section') || e.parentElement;
    const a = e.closest('a'), al = a && a.getAttribute('aria-label');
    const label = (al || (a && a.textContent) || '') + ' ' + (c ? c.textContent : '');
    if (!BROKEWORD.test(label)) out.broken.push(name(e) + ': black count with nothing broken in ' + (c ? name(c) : 'its place'));
    if (al && !BROKEWORD.test(al)) out.broken.push(name(e) + ': its label "' + al.slice(0, 40) + '" does not say what is broken');
  }
  return out;
}

// Runs in the page: the bottom tab counts that are rose (".need" = read out as "N late") or black (".broken" = "N down" ...).
// Returns [{ href, word, n, broken, label }].
function roseTabs() {
  return [...document.querySelectorAll('nav.house-tabs .ht, nav.house-tabs .house-more > a')].map((t) => {
    const n = t.querySelector(':scope > .n, :scope > .cnt'); if (!n || !(n.classList.contains('need') || n.classList.contains('broken')) || !n.textContent.trim()) return null;
    const w = t.querySelector('.htl'); return { href: t.getAttribute('href') || '', nav: t.getAttribute('data-nav') || '', word: (w ? w.textContent : t.textContent).trim(), n: n.textContent.trim(),
      broken: n.classList.contains('broken'), label: t.getAttribute('aria-label') || '' };
  }).filter(Boolean);
}

// Runs in the page: is anything late shown on the view (rows, pills, words)? brokenToo: down / expired / stuck / failed count too.
function lateShown(brokenToo) {
  const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const v = document.querySelector('#view, main') || document.body;
  if ([...v.querySelectorAll('.dpill.late, .date.late, .late, [data-kind="late"], .over, .overdue, .n-risk, .st-bad')].some(seen)) return true;
  if (brokenToo && /(?<![a-z])(stuck|fail(s|ed|ing)?|down|expired)(?![a-z])/i.test(v.innerText || '')) return true;
  return /(?<![a-z])(late|overdue|down|expired|past (its|their) due)(?![a-z])/i.test(v.innerText || '');
}

// Text contrast (Lisa, 3 Nov 2026): every piece of text holds 4.5:1 or better on what it actually sits on.
// Runs in the page: walks the visible text nodes, finds the colour behind each one (up through the parents to the first
// solid background, blending any see-through layers on the way), and returns one line per element under 4.5:1.
// Skipped: disabled controls (WCAG excuses them), aria-hidden text (decorative), text over a picture or gradient
// (no single colour behind it to measure), and text clipped to nothing (screen-reader-only labels).
function textContrast(min = 4.5) {
  const rgba = (c) => { const m = (c || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1); };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ([...e.classList].slice(0, 3).map((c) => '.' + c).join('')) + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  // The colour behind e: see-through layers are kept and laid over the first solid one; a picture or gradient means "unknown".
  const behind = (e) => {
    const layers = [];
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.backgroundImage && s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let base = layers.length && layers[layers.length - 1][3] >= 1 ? layers.pop() : rgba(getComputedStyle(document.documentElement).backgroundColor) || [255, 255, 255, 1];
    if (base[3] < 1) base = over(base, [255, 255, 255, 1]);
    while (layers.length) base = over(layers.pop(), base);
    return base;
  };
  const out = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const e = n.parentElement;
    if (!e || out.has(e) || e.closest('svg, script, style, noscript, template, [aria-hidden="true"], [hidden]')) continue;
    if (e.closest(':disabled, [aria-disabled="true"], fieldset:disabled')) continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || !e.getClientRects().length) continue;
    const s = getComputedStyle(e);
    if (s.visibility !== 'visible' || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)|inset\(50%\)/.test(s.clip + ' ' + s.clipPath)) continue;
    // A faded parent (opacity under 1) fades its text too: counted as a see-through text colour.
    let fade = 1;
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) fade *= +getComputedStyle(x).opacity;
    if (fade === 0) continue;
    // The text's own box must be on the page (a scroller's hidden part still counts: it scrolls into view).
    const range = document.createRange(); range.selectNodeContents(n);
    const tr = range.getBoundingClientRect(); if (tr.width < 1 || tr.height < 1) continue;
    const bg = behind(e); if (!bg) continue;
    const fg0 = rgba(s.color); if (!fg0 || fg0[3] === 0) continue;
    fg0[3] *= fade;
    const fg = fg0[3] < 1 ? over(fg0, bg) : fg0;
    const k = ratio(fg, bg);
    if (k < min - 1e-9) out.set(e, name(e) + ': ' + hex(fg) + ' on ' + hex(bg) + ' = ' + k.toFixed(2) + ':1');
  }
  return [...out.values()];
}

module.exports = { stateRules, drawn, roseTabs, lateShown, textContrast };
