// Tech section (TECH-HUB-1, Dashboard > More > Tech): one tile per paid tool, from the tools tab Studio already reads
// (config.js studio.ownedTools). This file is the pure part: read the tab's rows by header name, check the header,
// build one view-model per row, filter, search, sort and group, check an Add tech entry, and draw one tile as HTML.
// No DOM, no network, no ids: the page (index.html) reads the tab with Lisa's sign-in and only renders what this returns.
// Node tests load it directly (tests/mocked/tech-core.spec.js). Nothing about any real tool is written here.
(function (root) {
  'use strict';
  var DAY = 864e5;

  // Groups in their fixed order (TECH-HUB-1a G3). slot = the LJR7 colour slot in tokens.css (--ljr-N), so a tool's colour
  // comes from its group, never its row. Dev and hosting has no free slot: it reads opts.devHostingSlot (config.js
  // tech.devHostingSlot, Lisa's decision pending), so one value moves every Dev and hosting tile. A group the tab names
  // that is not on this list falls into Other (grey).
  var GROUPS = [
    { key: 'ai', name: 'AI', slot: 0 },
    { key: 'design', name: 'Design and assets', slot: 7 },
    { key: 'money', name: 'Money and admin', slot: 3 },
    { key: 'comms', name: 'Comms', slot: 5 },
    { key: 'dev', name: 'Dev and hosting', slot: null },
    { key: 'data', name: 'Data and automation', slot: 4 },
    { key: 'other', name: 'Other', slot: 0 }
  ];
  var DEV_SLOT_DEFAULT = 6;

  // The tools tab's columns (TECH-HUB-1a column table, plus logo_url). Matched by name, any order; extra columns are ignored.
  // tool_name may instead be Studio's own first column, "tool", so the tab is extended, not duplicated.
  var COLUMNS = ['tool_key', 'tool_name', 'group', 'sort_order', 'plan_or_tier', 'allowance_amount', 'allowance_unit', 'used_period',
    'unused_period', 'period', 'renewal_or_expiry', 'flag_unused_month', 'status', 'verified', 'source_name', 'last_updated',
    'review_file_id', 'review_file_name', 'review_count', 'ai_share_used_week', 'ai_unused_premium_images', 'ai_higher_spec_runs',
    'ai_outputs_in_drive', 'ai_outputs_waiting_review', 'ai_right_first_time', 'logo_url'];
  // The least a row needs to draw a tile (1a "minimum required set"). A header without one of these fails the whole section closed.
  var REQUIRED = ['tool_key', 'tool_name', 'group', 'status', 'period', 'verified', 'last_updated'];
  var STATUSES = { live: 'Live', trial: 'Trial', expired: 'Expired', refunded: 'Refunded', superseded: 'Superseded' };
  var PERIODS = { week: 'week', month: 'month', lifetime: 'lifetime' };
  // AI-only lines (1a G16): drawn only when that row has a value. Counts must be whole numbers (G17: never names or ids).
  var AI_FIELDS = [
    ['ai_share_used_week', 'Paid allowance used this week', 'pct'],
    ['ai_unused_premium_images', 'Unused premium images', 'int'],
    ['ai_higher_spec_runs', 'Higher-spec model runs', 'int'],
    ['ai_outputs_in_drive', 'Outputs in Drive', 'int'],
    ['ai_outputs_waiting_review', 'Outputs waiting review', 'int'],
    ['ai_right_first_time', 'Right-first-time builds', 'int']
  ];
  var FLAGS = [['unused', 'Unused this month'], ['needs', 'Needs review'], ['dup', 'Duplicate reviews'], ['unverified', 'Unverified'], ['stale', 'Not updated'], ['broken', 'Row not complete']];
  var SORTS = [['group', 'Sheet order'], ['name', 'Name'], ['renew', 'Renews soon'], ['left', 'Most left']];

  function str(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slug(s) { return str(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
  function groupOf(name) {
    var n = str(name).toLowerCase();
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].name.toLowerCase() === n || GROUPS[i].key === n) return GROUPS[i];
    return GROUPS[GROUPS.length - 1];
  }
  function devSlot(opts) { var s = Number(opts && opts.devHostingSlot); return s >= 0 && s <= 8 && Math.floor(s) === s ? s : DEV_SLOT_DEFAULT; }
  function slotOf(g, opts) { return g.slot == null ? devSlot(opts) : g.slot; }

  // A figure from the sheet. Blank = unknown (null), never 0. "1,000" reads as 1000. Text that is not a number is kept as text.
  function figure(v) {
    var s = str(v);
    if (!s) return { n: null, text: '' };
    var t = s.replace(/[,\s]/g, '');
    if (/^-?\d+(\.\d+)?$/.test(t)) return { n: Number(t), text: '' };
    return { n: null, text: s.slice(0, 24) };
  }
  function wholeCount(v) { var s = str(v).replace(/,/g, ''); return /^\d{1,7}$/.test(s) ? Number(s) : null; }
  // Dates: 2026-12-01 or 01/12/2026 (UK). Anything else is unknown. Returns ms at UTC midnight.
  function day(v) {
    var s = str(v), m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    return null;
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dmy(ms) { var d = new Date(ms); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function todayUtc(now) { var d = new Date(now); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
  function fmtNum(n) { return n == null ? '' : Number(n).toLocaleString('en-GB', { maximumFractionDigits: 2 }); }
  // A logo address from the sheet: https only, no quotes, spaces or angle brackets. Otherwise none (initials instead).
  function safeLogo(v) { var s = str(v); return /^https:\/\/[^\s"'<>\\]+$/i.test(s) && s.length < 500 ? s : ''; }
  // The review file's id is used only to build the link; it is never shown as text (1a G6).
  function reviewHref(v) {
    var s = str(v);
    if (/^[A-Za-z0-9_-]{10,200}$/.test(s)) return 'https://drive.google.com/file/d/' + encodeURIComponent(s) + '/view';
    if (/^https:\/\/(drive|docs)\.google\.com\/[^\s"'<>\\]+$/i.test(s)) return s;
    return '';
  }
  function initials(name) {
    var w = str(name).replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '?';
    return (w.length > 1 ? w[0].charAt(0) + w[w.length - 1].charAt(0) : w[0].slice(0, 2)).toUpperCase();
  }

  // ---- Header check: which column is where, and which required ones are missing. ----
  function header(row) {
    var h = (row || []).map(function (x) { return str(x).toLowerCase(); }), idx = {};
    COLUMNS.forEach(function (c) { var i = h.indexOf(c); if (i >= 0) idx[c] = i; });
    if (idx.tool_name == null && h.indexOf('tool') >= 0) idx.tool_name = h.indexOf('tool');
    var techCols = COLUMNS.filter(function (c) { return c !== 'tool_name' && idx[c] != null; });
    return { idx: idx, missing: REQUIRED.filter(function (c) { return idx[c] == null; }), tech: techCols.length > 0 };
  }
  function rowOf(cells, idx) { var o = {}; Object.keys(idx).forEach(function (k) { o[k] = str(cells[idx[k]]); }); return o; }

  // ---- One tile's view-model. opts: { now, devHostingSlot, freshDays }. Returns null for a row with no name (skipped, 1a G8). ----
  function tile(raw, opts) {
    opts = opts || {};
    var now = opts.now || Date.now(), fresh = (Number(opts.freshDays) > 0 ? Number(opts.freshDays) : 35) * DAY;
    var name = str(raw.tool_name);
    if (!name) return null;
    var g = groupOf(raw.group), t = { key: str(raw.tool_key) || slug(name), name: name, group: g.key, groupName: g.name, slot: slotOf(g, opts),
      order: figure(raw.sort_order).n, plan: str(raw.plan_or_tier).slice(0, 60), logo: safeLogo(raw.logo_url), ini: initials(name), problems: [] };
    REQUIRED.forEach(function (c) { if (c !== 'tool_name' && !str(raw[c])) t.problems.push(c.replace(/_/g, ' ')); });
    var st = str(raw.status).toLowerCase(), per = str(raw.period).toLowerCase(), ver = str(raw.verified).toUpperCase(), upd = day(raw.last_updated);
    if (st && !STATUSES[st]) t.problems.push('status');
    if (per && !PERIODS[per]) t.problems.push('period');
    if (ver && ver !== 'VERIFIED' && ver !== 'UNVERIFIED') t.problems.push('verified');
    if (str(raw.last_updated) && upd == null) t.problems.push('last updated');
    t.broken = t.problems.length > 0;
    t.status = STATUSES[st] ? st : '';
    t.statusWord = STATUSES[st] || '';
    t.period = PERIODS[per] || '';
    // Paid = live or trial, with a plan (1a G12). Ended or plan-less rows stay in the sheet but draw no tile.
    t.paid = (st === 'live' || st === 'trial') && !!t.plan;
    t.show = t.broken || t.paid;
    t.verified = ver === 'VERIFIED';
    t.updated = upd;
    t.stale = upd != null && todayUtc(now) - upd > fresh;
    // Allowance, used, left (1a G4): left is worked out here, only when both figures are numbers.
    t.allow = figure(raw.allowance_amount); t.used = figure(raw.used_period);
    t.unit = str(raw.allowance_unit).slice(0, 20);
    t.left = t.allow.n != null && t.used.n != null ? t.allow.n - t.used.n : null;
    // Renewal or expiry (1a G14): the word lifetime, or a date, or unknown.
    var rv = str(raw.renewal_or_expiry), rd = day(rv);
    t.lifetime = /^lifetime$/i.test(rv) || t.period === 'lifetime';
    t.renew = t.lifetime ? null : rd;
    t.renewDays = t.renew == null ? null : Math.round((t.renew - todayUtc(now)) / DAY);
    // Unused this month (1a G5): worked out here, never read from the sheet. Live, monthly, a cap, nothing used, row not stale.
    t.unused = !t.broken && st === 'live' && t.period === 'month' && t.allow.n != null && t.allow.n > 0 && t.used.n === 0 && upd != null && !t.stale;
    // Reviews (1a G6): count 0 = needs review, 1 = one, 2+ = duplicates. Blank count: one if there is a file, else none.
    var rc = wholeCount(raw.review_count), href = reviewHref(raw.review_file_id);
    t.reviews = rc != null ? rc : href ? 1 : 0;
    t.needsReview = t.reviews === 0;
    t.dupReviews = t.reviews > 1;
    t.reviewHref = t.reviews > 0 ? href : '';
    t.reviewName = str(raw.review_file_name).slice(0, 80);
    t.ai = [];
    AI_FIELDS.forEach(function (f) {
      var v = str(raw[f[0]]);
      if (!v) return;
      if (f[2] === 'pct') { var p = Number(v.replace(/%$/, '').trim()); if (isFinite(p) && p >= 0 && p <= 1000) t.ai.push({ key: f[0], label: f[1], text: fmtNum(p) + '%' }); return; }
      var n = wholeCount(v); if (n != null) t.ai.push({ key: f[0], label: f[1], text: fmtNum(n) });
    });
    return t;
  }
  function flagsOf(t) {
    var f = [];
    if (t.unused) f.push('unused');
    if (!t.broken && t.needsReview) f.push('needs');
    if (!t.broken && t.dupReviews) f.push('dup');
    if (!t.broken && !t.verified) f.push('unverified');
    if (!t.broken && t.stale) f.push('stale');
    if (t.broken) f.push('broken');
    return f;
  }

  // ---- The whole tab. values = the Sheets answer's rows (row 1 = header). ----
  // mode: 'live' (tiles from the tab), 'example' (the tab has none of the Tech columns yet: invented tiles, stamped Example),
  // 'header' (a Tech column the tiles need is missing: nothing drawn, the section fails closed).
  function read(values, opts) {
    values = values || [];
    var h = header(values[0]);
    if (!values.length) return { mode: 'header', missing: REQUIRED.slice(), tiles: [], hidden: 0, skipped: 0, keys: [] };
    if (!h.tech) { var ex = read(example(), opts); ex.mode = 'example'; ex.tiles.forEach(function (t) { t.reviewHref = ''; }); return ex; } // example tiles link nowhere
    if (h.missing.length) return { mode: 'header', missing: h.missing.slice(), tiles: [], hidden: 0, skipped: 0, keys: [] };
    var tiles = [], hidden = 0, skipped = 0, keys = [];
    values.slice(1).forEach(function (cells, i) {
      var t = tile(rowOf(cells || [], h.idx), opts);
      if (!t) { if ((cells || []).some(function (c) { return str(c); })) skipped++; return; }
      t.row = i;
      keys.push(t.key, slug(t.name)); // every named row, shown or not, so Add tech never asks for a tool twice
      if (t.show) tiles.push(t); else hidden++;
    });
    return { mode: 'live', missing: [], tiles: tiles, hidden: hidden, skipped: skipped, keys: keys };
  }

  // Invented tiles for the Example view (shown, stamped, until the tab has the Tech columns). Fake names only.
  function example() {
    var H = ['tool_key', 'tool_name', 'group', 'sort_order', 'plan_or_tier', 'allowance_amount', 'allowance_unit', 'used_period', 'period', 'renewal_or_expiry',
      'status', 'verified', 'last_updated', 'review_file_id', 'review_count', 'ai_share_used_week', 'ai_outputs_waiting_review'];
    var today = new Date(), iso = function (off) { return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + off * DAY).toISOString().slice(0, 10); };
    return [H,
      ['example-a', 'Example Tool A', 'AI', '1', 'Tier 2', '100', 'credits', '0', 'month', iso(18), 'live', 'VERIFIED', iso(-2), 'EXAMPLE-ID-1', '1', '40', '3'],
      ['example-b', 'Example Tool B', 'Design and assets', '1', 'Tier 1', '', '', '', 'lifetime', 'lifetime', 'live', 'UNVERIFIED', iso(-4), '', '0', '', ''],
      ['example-c', 'Example Tool C', 'Money and admin', '1', 'Monthly plan', '500', 'tasks', '120', 'month', iso(40), 'trial', 'VERIFIED', iso(-1), 'EXAMPLE-ID-2', '2', '', ''],
      ['example-d', 'Example Tool D', 'Comms', '1', 'Starter', '2000', 'messages', '1500', 'month', iso(9), 'live', 'VERIFIED', iso(-60), 'EXAMPLE-ID-3', '1', '', ''],
      ['example-e', 'Example Tool E', 'Dev and hosting', '1', 'Hobby', '', '', '', 'month', '', 'live', 'UNVERIFIED', iso(-3), '', '1', '', ''],
      ['example-f', 'Example Tool F', 'Data and automation', '1', 'Lifetime deal', '200000', 'tasks', '', 'lifetime', 'lifetime', 'live', 'VERIFIED', iso(-5), 'EXAMPLE-ID-4', '1', '', '']
    ];
  }

  // ---- Find: search words, group chips, flag chips, sort. state: { q, groups: [key], flags: [key], sort } ----
  function hit(t, q) {
    var hay = [t.name, t.groupName, t.plan, t.unit, t.statusWord].join(' ').toLowerCase();
    return str(q).toLowerCase().split(/\s+/).filter(Boolean).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function passes(t, s, skip) {
    if (!hit(t, s.q)) return false;
    if (skip !== 'groups' && s.groups && s.groups.length && s.groups.indexOf(t.group) < 0) return false;
    if (skip !== 'flags' && s.flags && s.flags.length) { var f = flagsOf(t); if (!s.flags.every(function (x) { return f.indexOf(x) >= 0; })) return false; }
    return true;
  }
  function byName(a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : a.row - b.row; }
  function cmp(sort) {
    return function (a, b) {
      if (sort === 'name') return byName(a, b);
      if (sort === 'renew') { var ra = a.renew == null ? Infinity : a.renew, rb = b.renew == null ? Infinity : b.renew; return ra - rb || byName(a, b); }
      if (sort === 'left') { var la = a.left == null ? -Infinity : a.left, lb = b.left == null ? -Infinity : b.left; return lb - la || byName(a, b); }
      var oa = a.order == null ? Infinity : a.order, ob = b.order == null ? Infinity : b.order;
      return oa - ob || byName(a, b);
    };
  }
  // The groups to draw, in the fixed order, each with its tiles sorted. Counts for the chips ignore their own row's choice.
  function view(tiles, s, opts) {
    s = s || {};
    var out = GROUPS.map(function (g) { return { key: g.key, name: g.name, slot: slotOf(g, opts), tiles: [] }; }), at = {};
    out.forEach(function (g) { at[g.key] = g; });
    var shown = 0, gcount = {}, fcount = {};
    tiles.forEach(function (t) {
      if (passes(t, s, 'groups')) gcount[t.group] = (gcount[t.group] || 0) + 1;
      if (passes(t, s, 'flags')) flagsOf(t).forEach(function (f) { fcount[f] = (fcount[f] || 0) + 1; });
      if (passes(t, s)) { at[t.group].tiles.push(t); shown++; }
    });
    out.forEach(function (g) { g.tiles = g.tiles.slice().sort(cmp(s.sort)); });
    return { groups: out.filter(function (g) { return g.tiles.length; }), shown: shown, total: tiles.length, groupCounts: gcount, flagCounts: fcount };
  }

  // ---- Add tech: check an entry and build the row it asks for. now: ms. keys: tool_keys already on the tab. ----
  function newRow(d, now, keys) {
    d = d || {};
    var e = {}, name = str(d.tool_name), g = groupOf(d.group), st = str(d.status).toLowerCase(), per = str(d.period).toLowerCase();
    if (!name) e.tool_name = 'Name it.'; else if (name.length > 60) e.tool_name = 'Keep the name under 60 characters.';
    if (!str(d.group) || g.name.toLowerCase() !== str(d.group).toLowerCase()) e.group = 'Pick a group.';
    if (!str(d.plan_or_tier)) e.plan_or_tier = 'Say the plan or tier.';
    if (st !== 'live' && st !== 'trial') e.status = 'Pick Live or Trial.';
    if (!PERIODS[per]) e.period = 'Pick Month, Week or Lifetime.';
    var a = str(d.allowance_amount);
    if (a && !/^\d+(\.\d+)?$/.test(a.replace(/,/g, ''))) e.allowance_amount = 'A number, or leave it blank.';
    var r = str(d.renewal_or_expiry);
    if (per !== 'lifetime' && r && day(r) == null) e.renewal_or_expiry = 'A date, or leave it blank.';
    var logo = str(d.logo_url);
    if (logo && !safeLogo(logo)) e.logo_url = 'An https:// address, or leave it blank.';
    var key = slug(name);
    if (name && keys && keys.indexOf(key) >= 0) e.tool_name = 'Already on the list.';
    if (Object.keys(e).length) return { ok: false, errors: e };
    var t = new Date(now || Date.now()), ymd = t.toISOString().slice(0, 10);
    return { ok: true, errors: {}, row: {
      tool_key: key, tool_name: name, group: g.name, plan_or_tier: str(d.plan_or_tier).slice(0, 60), status: st, period: per,
      allowance_amount: a.replace(/,/g, ''), allowance_unit: str(d.allowance_unit).slice(0, 20), used_period: '',
      renewal_or_expiry: per === 'lifetime' ? 'lifetime' : r, verified: 'UNVERIFIED', source_name: 'Dashboard Add tech',
      last_updated: ymd, review_count: '0', logo_url: logo
    } };
  }

  // ---- The tile (one reusable component). icon(name) gives an <svg> from the house sprite. ----
  function tileHtml(t, icon) {
    icon = icon || function () { return ''; };
    var c = 'var(--ljr-' + t.slot + ')', ic = 'var(--ljr-' + t.slot + '-icon)';
    var mark = t.logo ? '<img class="bmark tlogo" src="' + esc(t.logo) + '" alt="" width="20" height="20" loading="lazy" data-ini="' + esc(t.ini) + '" data-col="' + esc(c) + '">'
      : '<span class="bmark bav" style="--c:' + c + '" aria-hidden="true">' + esc(t.ini) + '</span>';
    var h = '<article class="card house-lbar ttile" data-tool="' + esc(t.key) + '" data-group="' + esc(t.group) + '"' + (t.broken ? ' data-broken' : '') +
      ' style="--sc:' + c + ';--tic:' + ic + '"><div class="tt-head">' + mark + '<h5 class="tt-name">' + esc(t.name) + '</h5>' +
      (t.status ? '<span class="tt-stat" data-status="' + t.status + '">' + esc(t.statusWord) + '</span>' : '') + '</div>';
    if (t.broken) return h + '<p class="tt-note" data-tile-state="broken">' + icon('s-alert') + '<span>Row not complete: ' + esc(t.problems.join(', ')) + '.</span></p></article>';
    if (t.plan) h += '<p class="tt-plan">' + esc(t.plan) + '</p>';
    var flags = [];
    if (t.unused) flags.push('<span class="tt-flag" data-flag="unused">' + icon('s-clock') + 'Unused this month</span>');
    if (t.needsReview) flags.push('<span class="tt-flag" data-flag="needs">' + icon('s-alert') + 'Needs review</span>');
    if (t.dupReviews) flags.push('<span class="tt-flag" data-flag="dup">' + icon('s-repeat') + 'Duplicate reviews</span>');
    if (flags.length) h += '<p class="tt-flags">' + flags.join('') + '</p>';
    var u = t.unit ? ' ' + esc(t.unit) : '', val = function (f) { return f.n != null ? esc(fmtNum(f.n)) + u : f.text ? esc(f.text) : '<span class="tt-unk">unknown</span>'; };
    if (t.allow.n == null && !t.allow.text && t.used.n == null && !t.used.text) h += '<p class="tt-nums" data-nums="unknown"><span>Allowance <span class="tt-unk">unknown</span></span></p>';
    else h += '<p class="tt-nums" data-nums><span data-num="allowance">Allowance <b>' + val(t.allow) + '</b></span><span data-num="used">Used <b>' + val(t.used) + '</b></span>' +
      '<span data-num="left">Left <b>' + (t.left != null ? esc(fmtNum(t.left)) + u : '<span class="tt-unk">unknown</span>') + '</b></span></p>';
    var when = t.lifetime ? '<span data-date="lifetime">Lifetime</span>'
      : t.renew == null ? '<span data-date="unknown">Renews <span class="tt-unk">unknown</span></span>'
      : '<span data-date="' + (t.renewDays < 0 ? 'past' : 'next') + '">' + (t.renewDays < 0 ? 'Ended ' : t.status === 'trial' ? 'Trial ends ' : 'Renews ') + esc(dmy(t.renew)) + (t.renewDays >= 0 ? ' · ' + t.renewDays + 'd' : '') + '</span>';
    h += '<p class="tt-date">' + icon('t-cal') + when + '</p>';
    if (t.ai.length) h += '<ul class="tt-ai">' + t.ai.map(function (a) { return '<li data-ai="' + a.key + '"><span>' + esc(a.label) + '</span><b>' + esc(a.text) + '</b></li>'; }).join('') + '</ul>';
    var foot = [];
    if (!t.verified) foot.push('<span class="tt-unv" data-verified="no">Unverified' + (t.updated != null ? ' · checked ' + esc(dmy(t.updated)) : '') + '</span>');
    if (t.stale) foot.push('<span class="tt-unv" data-stale>Not updated since ' + esc(dmy(t.updated)) + '</span>');
    if (t.reviewHref) foot.push('<a class="tt-rev" href="' + esc(t.reviewHref) + '" target="_blank" rel="noopener" data-review' + (t.reviewName ? ' title="' + esc(t.reviewName) + '"' : '') + '>' + icon('s-check') + 'Review</a>');
    if (foot.length) h += '<p class="tt-foot">' + foot.join('') + '</p>';
    return h + '</article>';
  }

  var api = { GROUPS: GROUPS, COLUMNS: COLUMNS, REQUIRED: REQUIRED, FLAGS: FLAGS, SORTS: SORTS, AI_FIELDS: AI_FIELDS, DEV_SLOT_DEFAULT: DEV_SLOT_DEFAULT,
    header: header, tile: tile, flagsOf: flagsOf, read: read, example: example, view: view, newRow: newRow, tileHtml: tileHtml,
    initials: initials, slug: slug, groupOf: groupOf, safeLogo: safeLogo, reviewHref: reviewHref, figure: figure, day: day, dmy: dmy, esc: esc };
  if (root) root.TechCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
