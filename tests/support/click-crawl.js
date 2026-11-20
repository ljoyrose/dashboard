// Click-crawler: walks a page the way a person taps it and says what every control did.
// SCRIPT (no AI at run time). Used by tests/mocked/cdhub-crawl.spec.js on invented data only.
//
// From each starting screen it taps every visible, enabled control, breadth-first. A screen is known by its
// address (#...), its main heading and the panels that are open. Each tap is filed as one of:
//   LOOP     the tap went round and came back to the same screen with nothing changed, or following one item for
//            2 to 4 taps came back to a screen already seen on the way
//   DEAD     nothing changed and nothing was said
//   ERROR    the browser logged an error, or the page threw
//   ESCAPE   the page called, or went to, an address that is not ours and not pretend
//   WORDING  empty heading, "undefined", "null", "NaN", "TODO", a raw key, a bare code as a label, a doubled word,
//            or a control with no name
// Everything else is fine and is written to the click map (screen, control, target, result).

/** Runs inside the page (added before any page script). Everything hangs off window.__cc. */
function inPage() {
  if (window.__cc) return;
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const CONTROL = 'a[href], button, summary, select, textarea, input:not([type="hidden"]), [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="switch"], [onclick], [data-go], [data-open-row], [tabindex]:not([tabindex="-1"])';
  const CHROME = 'header, nav, #nav, #tabs, .skip, [data-skip]';
  const nav = { n: 0 };
  ['pushState', 'replaceState'].forEach((k) => { const o = history[k]; history[k] = function () { nav.n++; return o.apply(this, arguments); }; });
  addEventListener('hashchange', () => { nav.n++; }, true);
  addEventListener('popstate', () => { nav.n++; }, true);
  let muts = 0, last = performance.now(), obs = null;
  const watch = () => {
    if (obs || !document.documentElement) return;
    obs = new MutationObserver((m) => { muts += m.filter((x) => !(x.type === 'attributes' && x.attributeName === 'data-cc')).length; last = performance.now(); });
    obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  if (document.documentElement) watch(); else document.addEventListener('readystatechange', watch);

  function shown(el) {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return false;
    if (el.closest('[hidden], .hidden, [inert], [aria-hidden="true"]')) return false;
    const modal = document.querySelector('dialog:modal');
    if (modal && !modal.contains(el)) return false;   // behind an open box: not reachable until it is shut
    for (let d = el.parentElement; d; d = d.parentElement) {   // inside a shut fold
      if (d.tagName === 'DETAILS' && !d.open && !(el.tagName === 'SUMMARY' && el.parentElement === d) && !d.querySelector(':scope > summary')?.contains(el)) return false;
    }
    return true;
  }
  function labelOf(el) {
    const by = el.getAttribute('aria-labelledby');
    let t = el.getAttribute('aria-label') || (by && by.split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' ')) || '';
    if (!t && el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) t = l.textContent; }
    if (!t && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const l = el.closest('label'); if (l) t = Array.from(l.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '); }
    if (!t && !/^(SELECT|INPUT|TEXTAREA)$/.test(el.tagName)) t = el.innerText || el.textContent || '';
    if (!norm(t)) t = el.getAttribute('title') || el.getAttribute('placeholder') || (el.querySelector && (el.querySelector('img[alt]') || { alt: '' }).alt) || (el.tagName === 'INPUT' && /^(button|submit)$/.test(el.type) ? el.value : '') || '';
    return norm(t);
  }
  function kindOf(el) {
    const t = el.tagName, role = el.getAttribute('role');
    if (t === 'A') return 'link';
    if (t === 'SUMMARY') return 'fold';
    if (t === 'SELECT') return 'select';
    if (t === 'TEXTAREA') return 'input:text';
    if (t === 'INPUT') return 'input:' + (el.type || 'text');
    if (t === 'BUTTON' || role === 'button') return 'button';
    if (role === 'tab') return 'tab';
    if (role === 'link') return 'link';
    if (role === 'checkbox' || role === 'switch') return 'input:checkbox';
    return 'row';   // a row, card or other block a person would tap
  }
  /** The item a control belongs to (the row or card title), so one item can be followed from screen to screen. */
  function subjectOf(el) {
    const row = el.closest('[data-open-row], .mrow, .hm-row, tr, li, article');
    const t = row && row.querySelector('.t, .hm-t a, .nm, td b, h3, h4');
    let s = t ? Array.from(t.childNodes).filter((n) => !(n.nodeType === 1 && /^(SMALL|BUTTON)$/.test(n.tagName))).map((n) => n.textContent).join(' ') : '';
    s = norm(s);
    if (s.length >= 8) return s;
    const m = /^(?:open|show[^:]*|see|view|go to)[^:]{0,24}:\s*(.{8,})$/i.exec(el.getAttribute('aria-label') || '');
    return m ? norm(m[1]) : '';
  }
  /** Tags every control on screen (data-cc="n") and describes each. */
  function controls() {
    document.querySelectorAll('[data-cc]').forEach((e) => e.removeAttribute('data-cc'));
    const set = new Set(Array.from(document.querySelectorAll(CONTROL)));
    // anything else that looks tappable: the top-most element showing the hand cursor
    document.querySelectorAll('body *').forEach((el) => {
      if (set.has(el) || el.closest('svg')) return;
      if (getComputedStyle(el).cursor !== 'pointer') return;
      const p = el.parentElement;
      if (p && getComputedStyle(p).cursor === 'pointer') return;
      set.add(el);
    });
    const out = [], count = {};
    Array.from(set).sort((a, b) => (a.compareDocumentPosition(b) & 2 ? 1 : -1)).forEach((el) => {
      if (!shown(el)) return;
      const kind = kindOf(el);
      if (kind === 'row' && el.matches('[tabindex]') && !el.matches('[data-open-row], [onclick]') && getComputedStyle(el).cursor !== 'pointer') {
        if (el.matches('[role="group"], [role="region"], [role="status"], [role="img"], [role="note"], h1, h2, h3, h4, main, section, table, dialog, .scroll')) return;   // a focus stop for reading or scrolling, not a control
      }
      if (kind === 'row' && el.querySelector('input, select, textarea') && !el.matches('[data-open-row], [onclick]')) return;   // a label wrapping a box: the box is the control
      if (kind === 'input:file') return;                                                         // opened by its own button
      const label = labelOf(el);
      const disabled = !!el.disabled || el.getAttribute('aria-disabled') === 'true';
      const href = el.getAttribute('href') || '';
      const data = Object.keys(el.dataset).filter((k) => k !== 'cc').sort().map((k) => k + '=' + el.dataset[k]).join('&');
      const sig = [kind, cut(label, 90), href, cut(data, 120), (el.id || '').replace(/\d+/g, '#') /* a made-up id is renumbered at every redraw (hfp-31, hfp-71): its number is not part of who the control is */, kind === 'row' ? el.tagName.toLowerCase() + '.' + String(el.className && el.className.baseVal == null ? el.className : '').trim().split(/\s+/).join('.') : ''].join('|');
      count[sig] = (count[sig] || 0);
      const i = out.length;
      el.setAttribute('data-cc', String(i));
      const a = el.closest('a[href]');
      out.push({ i, sig, k: count[sig]++, kind, label, href, disabled, chrome: !!el.closest(CHROME), target: (a && a.getAttribute('target')) || '', subject: subjectOf(el),
        outside: !!href && /^(https?:)?\/\//.test(href) && new URL(href, location.href).origin !== location.origin, special: /^(mailto|tel|sms):/.test(href),
        chosen: el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' || el.hasAttribute('aria-current') || /(^|\s)(on|active|selected|current)(\s|$)/.test(typeof el.className === 'string' ? el.className : ''),
        tag: el.cloneNode(false).outerHTML.replace(/\sdata-cc="\d+"/, '').slice(0, 160),
        where: (el.closest('dialog') ? 'dialog' : ''), off: (() => { const r = el.getBoundingClientRect(); return r.right <= 0 || r.left >= innerWidth; })() });
    });
    return out;
  }
  const tmpl = (s) => norm(s).replace(/\d+/g, '#');
  /** Panels that are open: folds, dialogs, things marked expanded or selected. Each as its pattern, not its copy. */
  function panels() {
    const p = new Set();
    document.querySelectorAll('dialog[open]').forEach((d) => p.add('dialog' + (d.id ? '#' + d.id : '')));
    document.querySelectorAll('details[open]').forEach((d) => { if (shown(d)) p.add('fold.' + tmpl(Array.from(d.classList).join('.') || labelOf(d.querySelector('summary') || d))); });
    document.querySelectorAll('[aria-expanded="true"]').forEach((e) => { if (shown(e) && !e.matches(window.__ccFoldSkip || 'button.house-fold')) p.add('open:' + (typeof e.className === 'string' && e.className.trim() ? e.tagName.toLowerCase() + '.' + e.className.trim().split(/\s+/).join('.') : cut(tmpl(labelOf(e)), 40))); });
    document.querySelectorAll('[role="tab"][aria-selected="true"]').forEach((e) => { if (shown(e)) p.add('tab:' + cut(tmpl(labelOf(e)), 40)); });
    // a tab or chip that is lit by its class only (no aria state): the view it shows is a screen of its own
    document.querySelectorAll('button.on, button.active, button.selected, button.current').forEach((e) => { if (shown(e) && !e.closest('header, nav')) p.add('lit:' + cut(tmpl(labelOf(e)), 40)); });
    return Array.from(p).sort();
  }
  function heading() {
    const hs = Array.from(document.querySelectorAll('main h1, main h2, [role="main"] h1, [role="main"] h2')).concat(Array.from(document.querySelectorAll('h1, h2')));
    const h = hs.find((x) => { const r = x.getBoundingClientRect(); return (r.width && r.height) || x.classList.contains('sr'); });
    return h ? norm(h.textContent) : '';
  }
  function state() {
    let hash = location.hash || '';
    if (/^#[\w-]+$/.test(hash) && document.getElementById(hash.slice(1))) hash = '';   // a jump to a place on the same screen is not another screen
    // one screen per kind of address: #/dogs/sub-a01 and #/dogs/sub-a02 are the same screen with a different dog in it
    return { path: location.pathname, hash, heading: heading(), panels: panels(), key: [location.pathname.replace(/index\.html$/, ''), tmpl(hash), tmpl(heading()), panels().join(',')].join(' | ') };
  }
  function textHash() {
    const root = document.body;
    let s = document.documentElement.className + (document.documentElement.getAttribute('data-theme') || '') + '§' + root.innerText + '§' + Array.from(document.querySelectorAll('dialog[open]')).map((d) => d.innerText).join('§')
      + '§' + Array.from(document.querySelectorAll('[aria-current], [aria-pressed], [aria-expanded], [aria-selected], details')).map((e) => (e.getAttribute('aria-current') || '') + (e.getAttribute('aria-pressed') || '') + (e.getAttribute('aria-expanded') || '') + (e.getAttribute('aria-selected') || '') + (e.open ? 'o' : '')).join('')
      + '§' + Array.from(document.querySelectorAll('button, [role="tab"], a.btn')).map((e) => (typeof e.className === 'string' ? e.className : '')).join('|')   // which chip or tab is lit
      + '§' + Array.from(document.querySelectorAll('input, select, textarea')).map((e) => (e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value)).join('|');
    let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h;
  }
  let before = null;
  /** Called just before a tap. */
  function arm(i) {
    const el = document.querySelector('[data-cc="' + i + '"]');
    muts = 0; nav.n = 0;
    before = { st: state(), hash: textHash(), y: Math.round(scrollY), x: Math.round(scrollX), focus: document.activeElement, el, title: document.title };
    return !!el;
  }
  /** Called after the page has gone quiet. Says what the tap changed. */
  function after() {
    const st = state(), b = before || { st, hash: 0, y: 0, x: 0 };
    const f = document.activeElement, el = b.el;
    const focusMoved = !!f && f !== b.focus && f !== document.body && !(el && (f === el || f.contains(el)));
    return { st, same: st.key === b.st.key, textSame: textHash() === b.hash, muts, nav: nav.n, scrolled: Math.abs(scrollY - b.y) > 4 || Math.abs(scrollX - b.x) > 4,
      focusMoved, focus: f && f !== document.body ? (f.id ? '#' + f.id : f.tagName.toLowerCase()) : '', gone: !!el && !el.isConnected };
  }
  /** Resolves when nothing has changed for `q` ms (or after `max`). */
  function quiet(q, max) {
    const t0 = performance.now();
    return new Promise((res) => { (function tick() {
      const now = performance.now();
      if ((document.readyState === 'complete' && now - last >= q && now - t0 >= q) || now - t0 >= max) return res(Math.round(now - t0));
      setTimeout(tick, 25);
    })(); });
  }
  /** Wording faults in what is on screen now. */
  function wording() {
    const out = [], add = (type, text) => out.push({ type, text: cut(norm(text), 120) });
    const roots = [document.querySelector('main') || document.body].concat(Array.from(document.querySelectorAll('header, nav, dialog[open], #next')));
    document.querySelectorAll('h1, h2, h3, h4').forEach((h) => { if ((shown(h) || h.classList.contains('sr')) && !norm(h.textContent)) add('empty heading', '<' + h.tagName.toLowerCase() + '>'); });
    const seen = new Set();
    roots.forEach((r) => {
      if (!r) return;
      const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const p = n.parentElement; if (!p || seen.has(n) || /^(SCRIPT|STYLE|TEMPLATE|OPTION)$/.test(p.tagName) || !shown(p)) continue;
        seen.add(n);
        const t = norm(n.textContent); if (!t) continue;
        let m;
        if ((m = /\b(undefined|NaN|TODO|FIXME)\b|\[object Object\]|(^|[\s:(])null([\s).,]|$)/.exec(t))) add('says "' + norm(m[0]) + '"', t);
        if ((m = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/.exec(t)) && !p.closest('code, .sel, [data-raw-ok]')) add('raw key "' + m[0] + '"', t);
        if ((m = /\b([A-Za-z]{2,})\s+\1\b/i.exec(t)) && !/^(had|that|bye|so|very)$/i.test(m[1])) add('doubled word "' + m[1] + '"', t);
      }
    });
    controls().forEach((c) => {
      if (c.disabled && !c.label) return;
      if (!c.label && c.kind !== 'row') add('control with no name', c.kind + ' ' + c.sig);
      else if (/^[A-Z]{1,3}$/.test(c.label) && !/^(OK|AM|PM|UK)$/.test(c.label) && c.kind !== 'row') add('bare code "' + c.label + '" as a label', c.kind);
    });
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) add('the page scrolls sideways', (de.scrollWidth - de.clientWidth) + 'px wider than the screen');
    return out;
  }
  /** Finds a control again after the screen was redrawn, brings it into view and gets ready for the tap. */
  function prep(sig, k) {
    const c = controls().find((x) => x.sig === sig && x.k === k) || null;
    if (c) { const el = document.querySelector('[data-cc="' + c.i + '"]'); if (!c.off) el.scrollIntoView({ block: 'center', inline: 'nearest' }); arm(c.i); }
    return { st: state(), c };
  }
  window.__cc = { controls, state, arm, after, quiet, wording, shown, prep };
}

const FLAGS = ['LOOP', 'DEAD', 'ERROR', 'ESCAPE', 'WORDING'];
const TAP_MS = 6000;   // how long a tap may wait for its control to be ready (a busy test machine is slow, not broken)
const ASK_MS = 10000;  // how long the page may take to answer one question from the walk
const SETTLE_MS = 15000;   // the longest one wait for the page to go quiet
const OPEN_MS = 45000;     // the longest one cold load of a screen
/** A promise that gives up: nothing in the walk may wait for ever. */
const capped = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('no answer in ' + ms + 'ms: ' + what)), ms); })]).finally(() => clearTimeout(t)); };
const short = (s, n = 70) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/**
 * One crawl of one site.
 * site = {
 *   name, page, guard (from tests/support/test.js),
 *   roots: [route...]                      the screens to start from
 *   open(route)                            go to that screen from cold (reload) and wait until it is ready
 *   addr(state) -> route | ''              optional: the route that opens this screen by its own address ('' = it has none).
 *                                          A screen found one tap deep is then opened by address, not by replaying the taps
 *   redraw(route)                          optional, quick way back to that screen with no reload; return false if it cannot
 *   busy()                                 optional, true while the page is still loading its data
 *   inSite(url) -> name | ''               other pages of ours a tap may open ('' = not ours)
 *   hidden(state) -> bool                  a screen that is switched off for now: reaching it is noted, not judged
 *   elsewhere(state) -> bool               optional: a screen another walk starts from; the tap is recorded, the screen is not walked here
 *   skip(control) -> reason | ''           controls left for their own check (sign out)
 *   wordingOk(w, state), deadOk(control)   optional, known and explained exceptions
 *   maxDepth, maxStates, typeText, typeDate
 * }
 * Returns { name, rows, findings, reachable, tapped, sameAddress, states, skipped, slow, missed }.
 */
async function crawl(site) {
  const { page, guard } = site;
  const maxDepth = site.maxDepth == null ? 2 : site.maxDepth, maxStates = site.maxStates || 14;
  const rows = [], findings = [], reach = new Map(), done = new Set(), skipped = [], slow = [];
  const visited = new Map();           // screen key -> how it was reached
  const sampled = new Map();           // kind of control on a screen -> how many copies were left untapped
  const wordSeen = new Set();
  let sameAddress = 0, retried = 0;
  const ev = { dialog: 0, popup: [], chooser: 0, download: 0 };
  const onDialog = (d) => { ev.dialog++; d.dismiss().catch(() => {}); };
  const onPopup = (p) => { ev.popup.push(p); };
  const onChooser = () => { ev.chooser++; };
  const onDownload = () => { ev.download++; };
  page.on('dialog', onDialog); page.on('popup', onPopup); page.on('filechooser', onChooser); page.on('download', onDownload);
  // CRAWL_LOG=<file> writes one line per tap as it happens (for working on the crawler itself); CRAWL_MAX=<n> stops after n taps.
  const fsLog = process.env.CRAWL_LOG ? require('fs') : null;
  const log = (t) => { if (fsLog) fsLog.appendFileSync(process.env.CRAWL_LOG, new Date().toISOString().slice(11, 19) + ' [' + site.name + '] ' + t + '\n'); };
  const cap = Number(process.env.CRAWL_MAX || 0);
  let taps = 0;
  let cAt = guard.consoleSeen.length, pAt = guard.problems.length, outAt = guard.outside.length;
  const newErrors = () => {
    const out = guard.consoleSeen.slice(cAt).concat(guard.problems.slice(pAt));
    cAt = guard.consoleSeen.length; pAt = guard.problems.length;
    return out.filter((t) => !/Service Worker registration blocked/.test(t) && !(site.allowConsole || []).some((re) => re.test(t)));
  };
  const newOutside = () => { const o = guard.outside.slice(outAt); outAt = guard.outside.length; return o; };
  /** Wait until the page has stopped changing (and has finished loading its data). */
  const ask = (fn, arg, what) => capped(page.evaluate(fn, arg), ASK_MS, what || 'the page');
  let waits = 0;
  const settle = async (q = 70) => {
    const t0 = Date.now();
    for (let i = 0; Date.now() - t0 < SETTLE_MS; i++) {
      try {
        await page.waitForLoadState('load', { timeout: 5000 });
        await capped(page.evaluate((ms) => window.__cc.quiet(ms, 3500), q), 6000, 'going quiet');
        if (!site.busy || !(await capped(Promise.resolve(site.busy()), 5000, 'busy'))) return Date.now() - t0;
      } catch (e) { if (i > 1) log('WAIT ' + i + ' · ' + String(e.message || e).split('\n')[0].slice(0, 90) + ' · at ' + page.url().slice(-40)); }
      await page.waitForTimeout(100);
    }
    waits++;
    log('WAIT gave up after ' + (Date.now() - t0) + 'ms · at ' + page.url().slice(-40));
    return Date.now() - t0;
  };
  const flag = (type, screen, control, detail) => { if (findings.some((f) => f.type === type && f.control === control && f.detail === detail && f.screen === screen)) return; findings.push({ type, screen, control, detail }); log('FLAG ' + type + ' · ' + screen + ' · ' + short(control, 60) + ' · ' + detail); };
  const here = () => ask(() => ({ st: window.__cc.state(), controls: window.__cc.controls() }), undefined, 'what is on screen');
  const pathOf = (u) => { try { return new URL(u).pathname; } catch (e) { return ''; } };
  const home = pathOf(page.url());
  let cold = true;

  const act = (c) => capped(act0(c), TAP_MS + 4000, 'the tap');
  async function act0(c) {
    const loc = page.locator('[data-cc="' + c.i + '"]');
    if (c.off) { await loc.focus(); return page.keyboard.press('Enter'); }   // off the side of the screen until focused (skip link): keyboard only
    if (c.kind === 'row') return loc.evaluate((e) => e.click());
    if (c.kind === 'select') return loc.evaluate((e) => { const o = Array.from(e.options).filter((x) => !x.disabled); const next = o.find((x) => x.value !== e.value && x.value !== '') || o.find((x) => x.value !== e.value); if (next) { e.value = next.value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } });
    if (/^input:(checkbox|radio|button|submit|image|reset)$/.test(c.kind)) return loc.click({ timeout: TAP_MS });
    if (/^input:/.test(c.kind)) {
      const type = c.kind.slice(6);
      const v = type === 'date' ? (site.typeDate || '2026-03-09') : type === 'number' || type === 'range' ? '18.5' : type === 'time' ? '09:30' : type === 'password' ? 'sample-code' : type === 'url' ? 'https://example.test/sample' : (site.typeText || 'a');
      await loc.fill(v, { timeout: TAP_MS });   // fill sends input and change; the page may redraw and the box may be gone
      return page.evaluate((i) => { const e = document.querySelector('[data-cc="' + i + '"]'); if (e) e.blur(); }, c.i);
    }
    return loc.click({ timeout: TAP_MS });
  }
  /** Back to a screen: its route, then the taps that opened this panel. force = reload the page first. */
  async function goto(node, force) {
    const away = pathOf(page.url()) !== home;
    let ok = false;
    // a screen with its own address is opened by that address; only a panel with no address is rebuilt by its taps
    const route = node.addr || node.route, steps = node.addr ? [] : node.path;
    if (!force && !away && !cold && site.redraw) { try { ok = (await capped(Promise.resolve(site.redraw(route)), ASK_MS, 'redraw')) !== false; } catch (e) { ok = false; } }
    if (!ok) { await capped(site.open(route), OPEN_MS, 'opening ' + route); await settle(); } else await settle(30);
    cold = false;
    for (const step of steps) {
      // A fresh page may draw the screen once more after it has gone quiet (late photos, late tables), and the marks the walk
      // put on the controls go with the old drawing. So: find the control, tap it, and if it has gone, find it again.
      let ok2 = false, why = '';
      for (let tries = 0; tries < 4 && !ok2; tries++) {
        const got = await ask(([sig, k]) => window.__cc.prep(sig, k), [step.sig, step.k], 'finding a control');
        if (!got.c) { why = 'not on ' + got.st.key; await page.waitForTimeout(250); await settle(150); continue; }
        try { await capped(page.locator('[data-cc="' + got.c.i + '"]').click({ timeout: 1500, trial: got.c.kind !== 'row' && !got.c.off && !/^(select|input:)/.test(got.c.kind) }), 3000, 'trial tap'); await act(got.c); ok2 = true; }
        catch (e) { why = String(e.message || e).split('\n')[0].slice(0, 160); await settle(150); }
      }
      if (!ok2) { if (process.env.CRAWL_DEBUG) log('  step failed: ' + step.sig + ' ¦ ' + step.k + ' · ' + why); return false; }
      await settle();
    }
    return true;
  }
  const screenOf = (st) => (st.hash || '(start)') + ' · ' + (st.heading || '(no heading)') + (st.panels.length ? ' [' + st.panels.join(', ') + ']' : '');
  async function wordingCheck(st) {
    const list = await ask(() => window.__cc.wording(), undefined, 'the wording');
    list.forEach((w) => {
      if (site.wordingOk && site.wordingOk(w, st)) return;
      const k = w.type + '|' + w.text;
      if (wordSeen.has(k)) return; wordSeen.add(k);
      flag('WORDING', screenOf(st), w.type, w.text);
    });
  }
  const subset = (a, b) => a.every((x) => b.includes(x));

  const only = (process.env.CRAWL_ROOTS || '').split(',').filter(Boolean);   // for working on the crawler: start screens to keep
  const queue = site.roots.filter((r) => !only.length || only.includes(r)).map((r) => ({ route: r, path: [], depth: 0 }));
  const perRoot = {}, rootHad = new Map();
  let chromeDone = !!site.noChrome;   // the top bar and bottom tabs are walked once: a second part of the same walk leaves them out
  while (queue.length) {
    const node = queue.shift();
    let cur = null;
    try {
      if (!(await goto(node, true))) { log('LOST screen · ' + (node.addr || node.route) + ' · its taps could not be replayed'); continue; }
      cur = await here();
      // opened by address but it is not the screen the tap showed (the address is not enough): rebuild it by its taps
      if (node.addr && node.expect && cur.st.key !== node.expect && !(cur.st.hash === node.expectSt.hash && cur.st.heading === node.expectSt.heading)) {
        log('ADDR ' + node.addr + ' opens ' + cur.st.key + ' · the tap showed ' + node.expect + ' · replaying the taps');
        node.addr = '';
        if (!(await goto(node, true))) continue;
        cur = await here();
      }
    } catch (e) { log('LOST screen · ' + (node.addr || node.route) + ' · ' + String(e.message || e).split('\n')[0].slice(0, 120)); cold = true; continue; }
    const key = cur.st.key;
    if (visited.has(key)) continue;
    visited.set(key, node);
    const screen = screenOf(cur.st);
    if (site.hidden && site.hidden(cur.st)) { rows.push({ screen, control: '(screen)', kind: '', target: '', result: 'switched off for now: not walked' }); continue; }
    perRoot[node.route] = (perRoot[node.route] || 0) + 1;
    await wordingCheck(cur.st);
    newErrors().forEach((e) => flag('ERROR', screen, '(on opening)', e));
    newOutside().forEach((u) => flag('ESCAPE', screen, '(on opening)', 'called ' + u.replace(/[?#].*$/, '')));
    // A panel opened on a screen already walked: only what the panel added is new. The rest are the same controls.
    const seg = cur.st.hash.split('/').slice(0, 2).join('/');
    const had = node.had || (node.depth ? rootHad.get(seg) : null);
    const list = cur.controls.filter((c) => !c.disabled && !(had && had.has(c.sig + ' ¦ ' + c.k)));
    const mine = new Set(cur.controls.map((c) => c.sig + ' ¦ ' + c.k));
    if (!node.depth && !rootHad.has(seg)) rootHad.set(seg, mine);
    const withChrome = !chromeDone; chromeDone = true;
    const hrefDone = new Map();
    log('SCREEN ' + screen + ' · ' + list.length + ' controls');
    const tapOne = async (c0) => {
      if (cap && taps >= cap) return;
      const id = (c0.chrome ? 'chrome' : key) + ' ¦ ' + c0.sig + ' ¦ ' + c0.k;
      if (c0.chrome && site.noChrome && !node.chromePanel) return;   // the top bar and tabs belong to the first part of this walk
      if (!reach.has(id)) reach.set(id, { screen, label: c0.label, kind: c0.kind });
      if (done.has(id)) return;
      if (c0.chrome && !withChrome && !node.chromePanel) return;
      const why = site.skip && site.skip(c0);
      if (why) { skipped.push({ screen, control: c0.label, why }); done.add(id); rows.push({ screen, control: c0.label, kind: c0.kind, target: '', result: 'not tapped here: ' + why }); return; }
      if (c0.outside || c0.special) {
        done.add(id);
        const bad = c0.outside && (!/^https:\/\//.test(c0.href) || c0.target !== '_blank');
        if (bad) flag('ESCAPE', screen, c0.label, 'outside link is not https in a new tab: ' + c0.href.replace(/[?#].*$/, ''));
        rows.push({ screen, control: c0.label, kind: c0.kind, target: c0.special ? c0.href.split(':')[0] + ' link' : 'outside link (new tab)', result: 'checked, not followed' });
        return;
      }
      // Many copies of one kind (the days of a year calendar): the first two and the last of each kind are tapped, the rest are counted apart.
      const grp = site.sample && site.sample(c0);
      if (grp) {
        const all = list.filter((x) => site.sample(x) === grp), at = all.indexOf(c0);
        if (at > 1 && at !== all.length - 1) { reach.delete(id); sampled.set(grp + ' ¦ ' + key, (sampled.get(grp + ' ¦ ' + key) || 0) + 1); return; }
      }
      // A plain link to an address already tapped on this screen goes to the same place: checked for its name, not tapped again.
      const plain = c0.kind === 'link' && /^#/.test(c0.href) && !c0.sig.split('|')[3];
      if (plain && hrefDone.has(c0.href)) {
        done.add(id); sameAddress++;
        rows.push({ screen, control: c0.label || '(no name)', kind: c0.kind, target: hrefDone.get(c0.href).target, result: 'same address as "' + short(hrefDone.get(c0.href).label, 40) + '"' });
        return;
      }
      const t0 = Date.now(); taps++;
      let got = null;
      for (const force of [false, true]) {
        if (!(await goto(node, force))) continue;
        got = await ask(([sig, k]) => window.__cc.prep(sig, k), [c0.sig, c0.k], 'finding a control');
        // the same address and heading is the same screen, even when the page remembers a fold from an earlier tap
        if (got.c && (got.st.key === key || (got.st.hash === cur.st.hash && got.st.heading === cur.st.heading))) break;
        got = null;
      }
      if (!got || got.c.disabled) { const now = await here(); log((Date.now() - t0) + 'ms LOST ' + c0.kind + ' · ' + short(c0.label, 60) + ' · screen now ' + now.st.key + ' · wanted ' + key + ' · there ' + now.controls.some((x) => x.sig === c0.sig && x.k === c0.k)); if (process.env.CRAWL_DEBUG) log('  was ' + c0.sig + ' ¦ ' + c0.k + ' · now ' + now.controls.filter((x) => x.label === c0.label || x.sig === c0.sig).map((x) => x.sig + ' ¦ ' + x.k + (x.disabled ? ' (disabled)' : '')).join(' ;; ')); return; }
      const c = got.c;
      done.add(id);
      newErrors(); newOutside();
      const evBefore = { dialog: ev.dialog, popup: ev.popup.length, chooser: ev.chooser, download: ev.download };
      let blocked = '';
      log('tap ' + c.kind + ' · ' + short(c.label, 60) + ' · ' + short(c.tag, 110));
      try { await act(c); } catch (e) {
        blocked = String(e.message || e).split('\n')[0];
        try {
          await goto(node, true); await settle(300);
          const again = await ask(([sig, k]) => window.__cc.prep(sig, k), [c0.sig, c0.k], 'finding a control');
          if (again.c) { await act(again.c); blocked = ''; retried++; }
        } catch (e2) { blocked = String(e2.message || e2).split('\n')[0]; }
      }
      const ms = await settle();
      let aft;
      try { aft = await ask(() => window.__cc.after()); } catch (e) { await settle(); aft = await ask(() => window.__cc.after()); }
      const errs = newErrors(), outs = newOutside();
      const asked = ev.dialog > evBefore.dialog, chooser = ev.chooser > evBefore.chooser, dl = ev.download > evBefore.download;
      const pops = ev.popup.slice(evBefore.popup);
      const left = pathOf(page.url()) !== home;
      let target = '', result = '';
      if (ms > 2500) slow.push({ screen, control: c.label, ms });
      errs.forEach((e) => flag('ERROR', screen, c.label, e));
      outs.forEach((u) => flag('ESCAPE', screen, c.label, 'called ' + u.replace(/[?#].*$/, '')));
      if (blocked) { flag('DEAD', screen, c.label || c.sig, 'could not be tapped: ' + short(blocked, 110)); result = 'could not be tapped'; }
      else if (pops.length) {
        const urls = [];
        for (const p of pops) { await p.waitForLoadState('domcontentloaded').catch(() => {}); urls.push(p.url()); await p.close().catch(() => {}); }
        const names = urls.map((u) => site.inSite(u) || '');
        if (names.some((n) => !n)) flag('ESCAPE', screen, c.label, 'opened ' + urls.map((u) => u.replace(/[?#].*$/, '')).join(', '));
        target = names.filter(Boolean).join(', ') || 'new tab'; result = 'opens in a new tab';
      } else if (left) {
        const name = site.inSite(page.url());
        if (!name) flag('ESCAPE', screen, c.label, 'left for ' + page.url().replace(/[?#].*$/, ''));
        else if (!(await ask(() => window.__cc.state())).heading) flag('WORDING', name, '(page)', 'the page has no heading');
        target = name || 'another site'; result = 'opens that page';
        cold = true;
      } else if (asked) { result = 'asks before doing it'; target = 'question box'; }
      else if (chooser) { result = 'opens the file picker'; target = 'file picker'; }
      else if (dl) { result = 'downloads a file'; target = 'download'; }
      else if (!aft.same) {
        target = screenOf(aft.st);
        const hid = site.hidden && site.hidden(aft.st);
        const closing = aft.st.hash === got.st.hash && aft.st.heading === got.st.heading && subset(aft.st.panels, got.st.panels);
        result = hid ? 'opens a screen that is switched off for now' : closing ? 'closes it' : 'opens it';
        const theirs = !!(site.elsewhere && site.elsewhere(aft.st));   // another start screen: walked by its own walk
        if (!hid && !closing && !theirs && !visited.has(aft.st.key) && node.depth < maxDepth && !queue.some((q) => q.expect === aft.st.key)
          && (perRoot[node.route] || 0) + queue.filter((q) => q.route === node.route && q.depth > 0).length < maxStates) {
          queue.push({ route: node.route, path: (node.addr ? [] : node.path).concat([{ sig: c.sig, k: c.k }]), depth: node.depth + 1, expect: aft.st.key, expectSt: aft.st,
            addr: (aft.st.hash !== got.st.hash && site.addr && site.addr(aft.st)) || '', from: node.addr || '',
            had: aft.st.hash === got.st.hash ? mine : null, chromePanel: c.chrome });
        }
        // follow the same item for up to 4 taps: it must not come back to a screen already seen on the way
        if (!hid && !closing && c.subject && !c.chrome) {
          const trail = [key, aft.st.key], subj = c.subject.toLowerCase(), used = new Set([c.label]);
          for (let hop = 0; hop < 3; hop++) {
            const now = await here();
            const nx = now.controls.find((x) => !x.chrome && !x.disabled && !x.outside && !x.chosen && x.kind !== 'row' && (x.subject || '').toLowerCase() === subj && !used.has(x.label) && !(site.skip && site.skip(x)));
            if (!nx) break;
            used.add(nx.label);
            await ask((i) => window.__cc.arm(i), nx.i);
            try { await act(nx); } catch (e) { break; }
            await settle();
            if (pathOf(page.url()) !== home) { cold = true; break; }
            const a2 = await ask(() => window.__cc.after());
            if (a2.same) { if (a2.textSame && !a2.focusMoved && !a2.scrolled) flag('LOOP', screenOf(now.st), nx.label, 'following "' + short(c.subject, 60) + '" stops here: the tap changes nothing'); break; }
            if (trail.includes(a2.st.key)) { flag('LOOP', screen, c.label, 'following "' + short(c.subject, 60) + '" comes back to ' + screenOf(a2.st) + ' after ' + (hop + 2) + ' taps'); break; }
            trail.push(a2.st.key);
          }
          newErrors().forEach((e) => flag('ERROR', screen, c.label + ' (following the item)', e));
          newOutside().forEach((u) => flag('ESCAPE', screen, c.label + ' (following the item)', 'called ' + u.replace(/[?#].*$/, '')));
        }
      } else if (/^input:(?!checkbox|radio|button|submit|image|reset)/.test(c.kind)) { result = aft.textSame && !aft.muts ? 'takes what is typed' : 'takes what is typed and redraws'; target = 'same screen'; }
      else if (aft.nav && aft.textSame && !aft.focusMoved && !aft.scrolled && !c.chrome) { flag('LOOP', screen, c.label, 'goes round and lands on the same screen with nothing changed'); result = 'lands on the same screen'; target = 'same screen'; }
      else if (!aft.textSame || aft.focusMoved || aft.scrolled || aft.gone) { target = 'same screen'; result = !aft.textSame ? 'changes this screen' : aft.focusMoved ? 'moves to ' + (aft.focus || 'its place') : 'scrolls to its place'; }
      else if (c.chrome && aft.nav) { target = 'same screen'; result = 'already here'; }
      else if (c.chosen) { target = 'same screen'; result = 'already chosen'; }
      else if (site.deadOk && site.deadOk(c, aft)) { target = 'same screen'; result = site.deadOk(c, aft); }
      else { flag('DEAD', screen, c.label || c.sig, 'nothing changed and nothing was said (' + c.kind + ' ' + c.tag + ')'); result = 'nothing happens'; target = 'same screen'; }
      if (plain && !hrefDone.has(c.href)) hrefDone.set(c.href, { label: c.label, target });
      if (site.dirty && site.dirty(c)) cold = true;   // this tap changed something the page remembers: start the next one from a fresh load
      rows.push({ screen, control: c.label || '(no name)', kind: c.kind, target, result, ms });
      log((Date.now() - t0) + 'ms settle ' + ms + ' · ' + c.kind + ' · ' + short(c.label, 50) + ' -> ' + short(target, 50) + ' · ' + result);
      if (ev.popup.length > 20) ev.popup.length = 0;
    };
    for (const c0 of list) {
      // one control that the page never answers costs seconds and is reported; it does not stop the walk
      try { await tapOne(c0); } catch (e) {
        const msg = String(e.message || e).split('\n')[0].slice(0, 140);
        log('HUNG ' + c0.kind + ' · ' + short(c0.label, 60) + ' · ' + msg);
        flag('ERROR', screen, c0.label || c0.sig, 'the walk could not finish this tap: ' + msg);
        cold = true;
      }
    }
  }
  page.off('dialog', onDialog); page.off('popup', onPopup); page.off('filechooser', onChooser); page.off('download', onDownload);
  const reachable = reach.size, tapped = Array.from(reach.keys()).filter((k) => done.has(k)).length;
  const left = Array.from(sampled.values()).reduce((a, b) => a + b, 0);
  // per screen, so walks that met the same screen from two start screens can be added without counting it twice
  const per = new Map();
  reach.forEach((v, k) => { const o = per.get(v.screen) || { screen: v.screen, reachable: 0, tapped: 0 }; o.reachable++; if (done.has(k)) o.tapped++; per.set(v.screen, o); });
  return { name: site.name, screens: Array.from(per.values()), waits, rows, findings, reachable, tapped, sameAddress, retried, sampledLeft: left, sampledKinds: sampled.size, states: visited.size, skipped, slow, missed: Array.from(reach.entries()).filter(([k]) => !done.has(k)).map(([, v]) => v) };
}

/** One line a person can read in the test output. */
function summary(r) {
  const n = (t) => r.findings.filter((f) => f.type === t).length;
  const pct = r.reachable ? (100 * r.tapped / r.reachable) : 100;
  return `${r.name}: visited ${r.tapped} of ${r.reachable} reachable controls (${pct.toFixed(1)}%) on ${r.states} screens`
    + (r.sameAddress ? ` (${r.sameAddress} of them are links to an address already tapped on the same screen)` : '')
    + (r.sampledLeft ? ` · plus ${r.sampledLeft} repeated copies not tapped (calendar days: the first two and the last of each of ${r.sampledKinds} kinds were)` : '') + ' · ' + FLAGS.map((t) => t + ' ' + n(t)).join(' · ');
}
function findingLines(r) { return r.findings.map((f) => `${f.type} · ${f.screen} · ${short(f.control, 60)} · ${f.detail}`); }

module.exports = { inPage, crawl, summary, findingLines, FLAGS, short };
