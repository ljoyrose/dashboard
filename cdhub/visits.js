/*!
 * VISITS (Admin -> Visits), owner-only. Lisa, 13 Nov 2026: inspectors, vets, auditors and guests get a time-boxed visit.
 * Loaded only when the Visits card opens (admin.js), so the hub's first load stays the same size.
 * One window shape: Now for X hours, Now until HH:MM, or Scheduled DD/MM/YY HH:MM to DD/MM/YY HH:MM. End now needs a reason. Field names follow Regulatory-Core (7 Nov): a visit is a DisclosureGrant.
 * A visit is given by a pre-printed visitor card (BLD-qr_tag kind visitor_card) or a link. Visit types (BLD-visit_type)
 * are the owner's own rows: length, rights, lists, fields and the jobs a visitor may record. No type, length, right or
 * list is fixed here: the three "suggested" types are only filled into the form for the owner to change and save.
 * Writes go through the save script (API: notes AA_VISIT-API_2026-11-13-2034). The SERVER clock decides open and ended;
 * this page only shows what the rows say. A link's address is shown once and never kept.
 */
var VisitView = (function () {
  'use strict';
  var S = { mode: '', end: '', ext: '', msg: '', ok: '', busy: false, url: '', f: null, t: null };
  /* what the visitor page can show today (inspect.js lists) and the rights it understands: capabilities, not rules */
  var LISTS = [['subject', 'Dogs'], ['microchip', 'Microchips'], ['subject_status', 'Status'], ['health_screen', 'Health tests'], ['fit_to_breed', 'Fit to breed'], ['litter', 'Litters'], ['check_log', 'Jobs done']];
  var RIGHTS = [['view', 'View'], ['review', 'Review'], ['print', 'Print'], ['export', 'Export'], ['record', 'Record jobs']];
  /* first-use suggestions only: filled into the form, saved only if the owner presses Save */
  var SUGGEST = {
    Inspector: { default_hours: '4', max_hours: '12', data_years: '3', rights: 'view|review', lists: 'subject|microchip|subject_status|health_screen|fit_to_breed|litter|check_log', email_code: 'yes' },
    Vet: { default_hours: '2', max_hours: '8', data_years: '', rights: 'view|review|record', lists: 'subject|microchip|health_screen', email_code: '' },
    Guest: { default_hours: '1', max_hours: '4', data_years: '', rights: 'view', lists: '', email_code: '' }
  };

  (function () {
    if (typeof document === 'undefined' || document.getElementById('vis-css')) return;
    var st = document.createElement('style'); st.id = 'vis-css';
    st.textContent = [
      '.vis-sec{margin:10px 0}.vis-sec h4{margin:12px 0 4px;font-size:var(--fs-small);color:var(--muted);text-transform:uppercase;letter-spacing:.04em}',
      '.vis-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}.vis-row:last-child{border:0}',
      '.vis-row b{flex:1 1 140px}.vis-when{font-size:var(--fs-small);color:var(--muted)}',
      '.vis-f{display:grid;gap:10px;margin:10px 0}.vis-f label{display:flex;flex-direction:column;gap:2px;font-size:var(--fs-small)}',
      '.vis-f input[type=text],.vis-f input[type=email],.vis-f input[type=number],.vis-f select{min-height:44px;box-sizing:border-box;max-width:100%}',
      '.vis-ticks{display:flex;flex-wrap:wrap;gap:4px 12px}.vis-ticks label{flex-direction:row;align-items:center;gap:6px;min-height:44px;font-size:inherit}',
      '.vis-ticks input{width:20px;height:20px}.vis-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}',
      '.vis-chips{display:flex;flex-wrap:wrap;gap:6px}.vis-chips label{flex-direction:row;align-items:center;gap:6px;min-height:44px;padding:0 10px;border:1px solid var(--line);border-radius:999px;font-size:inherit}',
      '#main .vis-chips label:hover{background:var(--hov)}.vis-chips label:has(input:checked){background:var(--hov);border-color:var(--sel-bd)}',
      '.vis-url{word-break:break-all;background:var(--hov);padding:8px;border-radius:6px}.vis-bad{color:var(--ink);font-weight:600}',
      '.vis-fields{margin-left:26px}'
    ].join('\n');
    document.head.appendChild(st);
  }());

  function rows(T, f) { return (T[f] || []).filter(function (r) { return r && r.id; }); }
  function pipe(s) { return String(s || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean); }
  function has(list, x) { return list.indexOf(x) >= 0; }
  function p2(n) { return ('0' + n).slice(-2); }
  /* a time this device can show; the server's own clock decides open/ended */
  function when(iso) { var d = new Date(iso); if (isNaN(d)) return ''; return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(2) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function hm(iso) { var d = new Date(iso); return isNaN(d) ? '' : p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  /* local ISO with offset, e.g. 2026-11-13T14:30:00+00:00 */
  function iso(d) { var o = -d.getTimezoneOffset(), sg = o < 0 ? '-' : '+'; o = Math.abs(o);
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':00' + sg + p2(Math.floor(o / 60)) + ':' + p2(o % 60); }
  /* DD/MM/YY and HH:MM typed -> Date, or null */
  function parse(dmy, t) {
    var a = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(dmy || '').trim()), b = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
    if (!a || !b) return null;
    var y = +a[3] < 100 ? 2000 + +a[3] : +a[3], d = new Date(y, +a[2] - 1, +a[1], +b[1], +b[2]);
    return d.getDate() === +a[1] && d.getMonth() === +a[2] - 1 && +b[1] < 24 && +b[2] < 60 ? d : null;
  }
  /* A visit is a grant (Regulatory-Core DisclosureGrant). Nothing is edited: extend and end each add a row whose
     supersedes_id points at the row it replaces. The CURRENT row is the one nothing points at; child rows, the code
     and the card stay on the ROOT row, so the hub sends link_id = root id. cur() returns one merged row per visit:
     id = root id, later rows' filled columns laid over earlier ones. */
  function cur(T) {
    var L = rows(T, 'BLD-inspect_link.csv'), by = {}, next = {};
    L.forEach(function (r) { by[r.id] = r; if (r.supersedes_id) next[r.supersedes_id] = r; });
    return L.filter(function (r) { return !r.supersedes_id || !by[r.supersedes_id]; }).map(function (root) {
      var m = Object.assign({}, root), seen = {};
      for (var x = next[root.id]; x && !seen[x.id]; x = next[x.id]) { seen[x.id] = 1; Object.keys(x).forEach(function (k) { if (x[k] !== '' && x[k] != null && k !== 'id' && k !== 'supersedes_id') m[k] = x[k]; }); m._cur = x.id; }
      m._cur = m._cur || root.id; return m;
    });
  }
  /* window: usable_from/usable_to (datetimes); V1 rows have only `ends` (a date, to 23:59:59) */
  function win(r) {
    var s = Date.parse(r.usable_from || r.made_at || '') || 0;
    var e = r.usable_to ? Date.parse(r.usable_to) : (r.ends ? new Date(String(r.ends).slice(0, 10) + 'T23:59:59').getTime() : 0);
    if (r.revoked_at) e = Math.min(e || Infinity, Date.parse(r.revoked_at));
    return { s: s, e: e || 0 };
  }
  function state(r, now) { var w = win(r); return w.e && now >= w.e ? 'ended' : (w.s > now ? 'soon' : 'live'); }
  /* the type in force today: latest effective_from on or before today, per type_key */
  function types(T, today) {
    var by = {};
    rows(T, 'BLD-visit_type.csv').forEach(function (r) {
      var k = r.type_key || r.id, f = String(r.effective_from || '').slice(0, 10);
      if (f > today) return;
      if (!by[k] || f >= String(by[k].effective_from || '').slice(0, 10)) by[k] = r;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (r) { return String(r.active).toLowerCase() !== 'no' && String(r.active).toLowerCase() !== 'false'; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }
  function jobs(T, today) {
    var by = {};
    rows(T, 'BLD-check_type.csv').forEach(function (r) {
      var k = r.type_key, f = String(r.effective_from || '').slice(0, 10);
      if (!k || f > today) return;
      if (!by[k] || f >= String(by[k].effective_from || '').slice(0, 10)) by[k] = r;
    });
    return Object.keys(by).map(function (k) { return by[k]; }).filter(function (r) { return String(r.active).toLowerCase() !== 'false' && String(r.active).toLowerCase() !== 'no'; });
  }
  function cards(T) { return rows(T, 'BLD-qr_tag.csv').filter(function (r) { return r.kind === 'visitor_card' && String(r.active).toLowerCase() !== 'no' && String(r.active).toLowerCase() !== 'false'; }); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function cols(T, list) { var r = (T['BLD-' + list + '.csv'] || [])[0]; return r ? Object.keys(r).filter(function (c) { return c !== 'id' && c !== 'tenant_id'; }) : []; }

  /* grant picker: rights, lists, fields (per list), record jobs (+ counts toward due). g = the values; p = name prefix */
  function grant(v, g, p) {
    var R = pipe(g.rights), L = pipe(g.lists), F = pipe(g.fields), J = pipe(g.record_jobs), C = pipe(g.record_counts);
    var tick = function (name, val, on, label, extra) { return '<label><input type="checkbox" name="' + p + name + '" value="' + v.esc(val) + '"' + (on ? ' checked' : '') + (extra || '') + '> ' + label + '</label>'; };
    var h = '<fieldset class="vis-ticks"><legend>Can</legend>' + RIGHTS.map(function (x) { return tick('rights', x[0], has(R, x[0]), x[1]); }).join('') + '</fieldset>';
    h += '<fieldset><legend>Sees</legend>' + LISTS.map(function (x) {
      var on = has(L, x[0]), cs = on ? cols(v.T, x[0]) : [];
      return '<div class="vis-ticks">' + tick('lists', x[0], on, x[1]) + '</div>'
        + (on && cs.length ? '<div class="vis-ticks vis-fields">' + cs.map(function (c) {
          var k = x[0] + '.' + c, cut = has(F, k + ':last4');
          return tick('fields', k, cut || has(F, k) || !F.some(function (f) { return f.indexOf(x[0] + '.') === 0; }), v.esc(c.replace(/_/g, ' ')))
            + (/chip|number/.test(c) ? tick('cut', k, cut, 'last 4 only') : '');
        }).join('') + '</div>' : '');
    }).join('') + '</fieldset>';
    if (has(R, 'record')) {
      var js = jobs(v.T, v.today);
      h += '<fieldset><legend>Jobs they may record</legend>' + (js.length ? js.map(function (j) {
        var on = has(J, j.type_key);
        return '<div class="vis-ticks">' + tick('jobs', j.type_key, on, v.esc(j.label || j.type_key)) + (on ? tick('counts', j.type_key, has(C, j.type_key), 'counts toward due') : '') + '</div>';
      }).join('') + '<p class="mut">Not ticked = kept separate.</p>' : '<p class="mut">No jobs set up.</p>') + '</fieldset>';
    }
    return h + '<p class="mut">Print is asked of their page; a screen can always be photographed.</p><div class="vis-ticks">' + tick('email', 'yes', String(g.email_code).toLowerCase() === 'yes', 'Email code before viewing (links)') + '</div>';
  }
  /* read the grant picker back into pipe lists */
  function readGrant(form, p) {
    var all = function (n) { return Array.prototype.filter.call(form.querySelectorAll('[name="' + p + n + '"]'), function (i) { return i.checked; }).map(function (i) { return i.value; }); };
    var cut = all('cut'), lists = all('lists');
    var fields = all('fields').filter(function (f) { return has(lists, f.split('.')[0]); }).map(function (f) { return has(cut, f) ? f + ':last4' : f; });
    var jobsT = all('jobs');
    return { rights: all('rights').join('|'), lists: lists.join('|'), fields: fields.join('|'), record_jobs: jobsT.join('|'),
      record_counts: all('counts').filter(function (k) { return has(jobsT, k); }).join('|'), email_code: all('email').length ? 'yes' : '' };
  }

  function endForm(v, id) {
    return '<form class="vis-f" data-vis-form="end"><input type="hidden" name="link_id" value="' + v.esc(id) + '"><label>Reason<input type="text" name="reason" required autocomplete="off"></label>'
      + '<p><button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>End now</button> <button type="button" class="cb" data-vis-end="">Back</button></p></form>';
  }
  function dendForm(v, id) {
    return '<form class="vis-f" data-vis-form="dend"><input type="hidden" name="id" value="' + v.esc(id) + '"><label>Reason<input type="text" name="reason" required autocomplete="off"></label>'
      + '<fieldset class="vis-chips"><legend>What they gave under it</legend><label><input type="radio" name="end_issued" value="keep" checked> Keep</label><label><input type="radio" name="end_issued" value="end"> End now too</label></fieldset>'
      + '<p class="mut">Anyone they passed it on to loses it too.</p><p><button type="submit" class="btn">End</button> <button type="button" class="cb" data-vis-dend="">Back</button></p></form>';
  }
  function listHtml(v, L, now, kind) {
    var T = types(v.T, v.today), C = cards(v.T);
    return L.map(function (r) {
      var w = win(r), t = byId(T, r.visit_type_id), c = byId(C, r.card_tag_id), ok = S.ok === r.id ? ' <span class="adm-ok" aria-label="saved">✓</span>' : '';
      var span = kind === 'live' ? 'until ' + (new Date(w.e).toDateString() === new Date(now).toDateString() ? hm(w.e) : when(w.e)) : when(w.s) + ' to ' + when(w.e);
      var h = '<div class="vis-row" data-vis-link="' + v.esc(r.id) + '"><b>' + v.esc(r.visitor_name ? r.visitor_name + (r.organisation ? ', ' + r.organisation : '') : (r.label || r.id)) + ok + '</b><span class="vis-when">' + v.esc(span)
        + (t ? ' · ' + v.esc(t.name) : '') + (by(r.issued_by) ? ' · by ' + v.esc(person(v.T, r.issued_by)) : '') + (c ? ' · ' + v.esc(c.ref_id || c.tag) : (r.card_tag_id ? '' : ' · link')) + '</span>'
        + '<button type="button" class="cb" data-vis-ext="' + v.esc(r.id) + '">Extend</button><button type="button" class="cb" data-vis-end="' + v.esc(r.id) + '">' + (kind === 'live' ? 'End now' : 'Cancel') + '</button></div>';
      if (S.end === r.id) h += endForm(v, r.id);
      if (S.ext === r.id) h += '<form class="vis-f" data-vis-form="ext"><input type="hidden" name="link_id" value="' + v.esc(r.id) + '"><div class="vis-two"><label>New end DD/MM/YY<input type="text" name="d" inputmode="numeric" value="' + v.esc(when(w.e).slice(0, 8)) + '"></label>'
        + '<label>HH:MM<input type="text" name="t" inputmode="numeric" value="' + v.esc(hm(w.e)) + '"></label></div><label>Reason<input type="text" name="reason" required autocomplete="off"></label>'
        + '<p><button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>Extend</button> <button type="button" class="cb" data-vis-ext="">Back</button></p></form>';
      return h;
    }).join('');
  }

  /* a choice from status_label rows of one group (values are rows, never fixed); no rows = the default only */
  function pick(v, group, label, val) {
    var R = (v.T['BLD-status_label.csv'] || []).filter(function (r) { return r.group === group && r.code; });
    if (!R.length) return '<input type="hidden" name="' + group + '" value="' + v.esc(val) + '">';
    return '<label>' + label + '<select name="' + group + '">' + R.map(function (r) { return '<option value="' + v.esc(r.code) + '"' + (r.code === val ? ' selected' : '') + '>' + v.esc(r.label || r.code) + '</option>'; }).join('') + '</select></label>';
  }
  /* how long the grant and its read log are kept: the owner's retention row for inspect_link, else blank (never a fixed number) */
  function keepUntil(v, end) {
    var k = rows(v.T, 'BLD-retention_setting.csv').filter(function (r) { return (r.section || r.table_name) === 'inspect_link' && +r.years > 0 && String(r.from_date || '').slice(0, 10) <= v.today; })
      .sort(function (a, b) { return String(b.from_date || '').localeCompare(String(a.from_date || '')); })[0];
    if (!k || !end) return '';
    var d = new Date(end); d.setFullYear(d.getFullYear() + (+k.years)); return d.toISOString().slice(0, 10);
  }
  function giveHtml(v) {
    var T = types(v.T, v.today), C = cards(v.T), f = S.f || (S.f = { how: C.length ? 'card' : 'link', win: 'now' });
    var t = byId(T, f.type) || T[0] || {}, now = Date.now(), L = cur(v.T);
    var busy = function (c) { return L.some(function (r) { return r.card_tag_id === c.id && state(r, now) !== 'ended'; }); };
    var free = C.filter(function (c) { return !busy(c) || c.id === f.card; });
    if (!T.length) return '<p class="mut">First make a visit type.</p><p><button type="button" class="btn" data-vis-mode="types">Visit types</button></p>';
    var dogs = rows(v.T, 'BLD-subject.csv').filter(function (d) { return d.name; });
    var hours = f.hours || t.default_hours || '';
    return '<form class="vis-f" data-vis-form="give">'
      + '<fieldset class="vis-chips"><legend>How</legend><label><input type="radio" name="how" value="card"' + (f.how === 'card' ? ' checked' : '') + (C.length ? '' : ' disabled') + '> Visitor card</label>'
      + '<label><input type="radio" name="how" value="link"' + (f.how === 'link' ? ' checked' : '') + '> Link</label></fieldset>'
      + (f.how === 'card' ? '<label>Card<select name="card">' + free.map(function (c) { return '<option value="' + v.esc(c.id) + '"' + (c.id === f.card ? ' selected' : '') + '>' + v.esc(c.ref_id || c.tag) + '</option>'; }).join('') + '</select></label>'
        + (free.length ? '' : '<p class="vis-bad">Every card is in use.</p>') : '')
      + '<div class="vis-two"><label>Name<input type="text" name="name" autocomplete="off" value="' + v.esc(f.name || '') + '"></label><label>Organisation<input type="text" name="org" autocomplete="off" value="' + v.esc(f.org || '') + '"></label></div>'
      + '<label>Type<select name="type" data-vis-type="1">' + T.map(function (x) { return '<option value="' + v.esc(x.id) + '"' + (x.id === t.id ? ' selected' : '') + '>' + v.esc(x.name) + '</option>'; }).join('') + '</select></label>'
      + '<fieldset class="vis-chips"><legend>When</legend>' + [['now', 'Now for'], ['until', 'Now until'], ['sched', 'Scheduled']].map(function (x) {
        return '<label><input type="radio" name="win" value="' + x[0] + '"' + (f.win === x[0] ? ' checked' : '') + '> ' + x[1] + '</label>'; }).join('') + '</fieldset>'
      + (f.win === 'now' ? '<label>Hours' + (t.max_hours ? ' (up to ' + v.esc(t.max_hours) + ')' : '') + '<input type="number" name="hours" min="0.25" step="0.25"' + ' value="' + v.esc(hours) + '"></label>'
        : f.win === 'until' ? '<label>Until HH:MM<input type="text" name="until" inputmode="numeric" placeholder="HH:MM" value="' + v.esc(f.until || '') + '"></label>'
        : '<div class="vis-two"><label>From DD/MM/YY<input type="text" name="fd" inputmode="numeric" placeholder="DD/MM/YY" value="' + v.esc(f.fd || '') + '"></label><label>HH:MM<input type="text" name="ft" inputmode="numeric" placeholder="HH:MM" value="' + v.esc(f.ft || '') + '"></label>'
          + '<label>To DD/MM/YY<input type="text" name="td" inputmode="numeric" placeholder="DD/MM/YY" value="' + v.esc(f.td || '') + '"></label><label>HH:MM<input type="text" name="tt" inputmode="numeric" placeholder="HH:MM" value="' + v.esc(f.tt || '') + '"></label></div>')
      + '<fieldset><legend>Dogs</legend><div class="vis-ticks"><label><input type="checkbox" name="alldogs" value="1"' + (f.dogs ? '' : ' checked') + '> All</label></div>'
      + (f.dogs ? '<div class="vis-ticks">' + dogs.map(function (d) { return '<label><input type="checkbox" name="dog" value="' + v.esc(d.id) + '"' + (has(f.dogs, d.id) ? ' checked' : '') + '> ' + v.esc(d.name) + '</label>'; }).join('') + '</div>' : '') + '</fieldset>'
      + '<details><summary>What they can do and see</summary>' + grant(v, f.g || t, 'g_') + '</details>'
      + (f.how === 'link' && (f.g || t).email_code === 'yes' ? '<label>Their email<input type="email" name="email" autocomplete="off" value="' + v.esc(f.email || '') + '"></label>' : '')
      + '<label>Purpose<input type="text" name="purpose" autocomplete="off" value="' + v.esc(f.purpose || '') + '"></label>'
      + pick(v, 'grant_basis', 'Basis', f.basis || t.grant_basis || 'voluntary') + pick(v, 'identity_assurance', 'ID checked', f.assure || 'none')
      + '<p><button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>Give visit</button> <button type="button" class="cb" data-vis-mode="">Back</button></p></form>';
  }

  function typesHtml(v) {
    var T = types(v.T, v.today), roles = rows(v.T, 'BLD-role.csv').filter(function (r) { return r.code; });
    if (!S.t) return (T.length ? T.map(function (t) {
      return '<div class="vis-row"><b>' + v.esc(t.name) + (S.ok === t.type_key ? ' <span class="adm-ok" aria-label="saved">✓</span>' : '') + '</b><span class="vis-when">' + v.esc((t.default_hours || '?') + 'h · ' + pipe(t.rights).join(', ')) + '</span>'
        + '<button type="button" class="cb" data-vis-edit="' + v.esc(t.id) + '">Change</button></div>';
    }).join('') : '<p class="mut">None yet. Start from one, then change it:</p><p class="vis-chips">' + Object.keys(SUGGEST).map(function (k) { return '<button type="button" class="cb" data-vis-suggest="' + k + '">' + k + '</button>'; }).join(' ') + '</p>')
      + '<p><button type="button" class="btn" data-vis-edit="new">New type</button> <button type="button" class="cb" data-vis-mode="">Back</button></p>';
    var t = S.t;
    return '<form class="vis-f" data-vis-form="type"><label>Name<input type="text" name="name" required autocomplete="off" value="' + v.esc(t.name || '') + '"></label>'
      + '<div class="vis-two"><label>Usual hours<input type="number" name="default_hours" min="0.25" step="0.25" value="' + v.esc(t.default_hours || '') + '"></label>'
      + '<label>Longest hours<input type="number" name="max_hours" min="0.25" step="0.25" value="' + v.esc(t.max_hours || '') + '"></label>'
      + '<label>Records back (years)<input type="number" name="data_years" min="0" step="1" value="' + v.esc(t.data_years || '') + '"></label>'
      + '<label>Role<select name="role_code"><option value="">–</option>' + roles.map(function (r) { return '<option' + (r.code === t.role_code ? ' selected' : '') + '>' + v.esc(r.code) + '</option>'; }).join('') + '</select></label></div>'
      + pick(v, 'grant_basis', 'Basis', t.grant_basis || 'voluntary') + grant(v, t, 't_')
      + '<label>Source or reason<input type="text" name="source" autocomplete="off" value="' + v.esc(t.source || '') + '"></label>'
      + '<div class="vis-ticks"><label><input type="checkbox" name="active" value="yes"' + (String(t.active).toLowerCase() === 'no' ? '' : ' checked') + '> In use</label></div>'
      + '<p><button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>Save type</button> <button type="button" class="cb" data-vis-edit="">Back</button></p>'
      + '<p class="mut">A change is a new row from today; earlier visits keep what they were given.</p></form>';
  }

  /* WHO CAN GIVE VISITS (Lisa 13 Nov): giving access is a power of its own (BLD-delegation, power give_visit). No role
     carries it; only the owner confers it, with its own limits and how many layers it may be passed on. The server
     enforces "never more than the giver holds"; this list only shows the rows. */
  function person(T, id) {
    if (!id || id === 'owner') return 'You';
    var c = (T['BLD-code_register.csv'] || []).filter(function (r) { return r.code_id === id; })[0]; if (c) return c.who || id;   /* staff code: the holder survives a reset */
    var p = byId(rows(T, 'BLD-person.csv'), id); return p ? (p.known_as || p.full_name || id) : id;
  }
  function hk(r) { return r.holder_code_id || r.holder_person_id || ''; }   /* the server keys a holder on their code */
  function by(x) { return !x || x === 'owner' ? '' : x; }
  function dlive(r, now) { return !r.ended_at && (!r.to_at || Date.parse(r.to_at) > now) && (!r.from_at || Date.parse(r.from_at) <= now); }
  function limits(v, r) {
    var T = types(v.T, v.today), x = [];
    x.push(pipe(r.visit_type_ids).length ? pipe(r.visit_type_ids).map(function (id) { var t = byId(T, id); return t ? t.name : id; }).join(', ') : 'any type');
    if (r.max_hours) x.push('up to ' + r.max_hours + 'h');
    x.push(pipe(r.rights).length ? pipe(r.rights).join(', ') : 'any rights');
    if (pipe(r.area_ids).length) x.push(pipe(r.area_ids).length + ' rooms');
    if (pipe(r.subject_ids).length) x.push(pipe(r.subject_ids).length + ' dogs');
    if (r.end_others === 'yes') x.push('ends others');
    if (r.extend_others === 'yes') x.push('extends others');
    x.push(+r.depth_left > 0 ? 'may pass on (' + r.depth_left + ')' : 'may not pass on');
    if (r.to_at) x.push('until ' + when(r.to_at));
    return x.join(' · ');
  }
  function whoHtml(v) {
    var now = Date.now(), D = rows(v.T, 'BLD-delegation.csv').filter(function (r) { return r.power === 'give_visit' && dlive(r, now); });
    if (!v.hasTable('BLD-delegation.csv')) return '<p class="mut">Not set up yet.</p><p><button type="button" class="cb" data-vis-mode="">Back</button></p>';
    if (S.d) return delegForm(v);
    return '<p class="mut">Only people listed here can give visits. A role alone never can.</p>'
      + (D.length ? D.map(function (r) {
        var ok = S.ok === r.id ? ' <span class="adm-ok" aria-label="saved">✓</span>' : '';
        var h = '<div class="vis-row" data-vis-deleg="' + v.esc(r.id) + '"><b>' + v.esc(person(v.T, hk(r))) + ok + '</b><span class="vis-when">' + v.esc(limits(v, r))
          + (r.parent_id ? ' · via ' + v.esc(person(v.T, hk(byId(rows(v.T, 'BLD-delegation.csv'), r.parent_id) || {}))) : '') + '</span>'
          + '<button type="button" class="cb" data-vis-dend="' + v.esc(r.id) + '">End</button></div>';
        if (S.dend === r.id) h += dendForm(v, r.id);
        return h;
      }).join('') : '<p class="mut">No one yet.</p>')
      + '<p><button type="button" class="btn" data-vis-dnew="1">Let someone give visits</button> <button type="button" class="cb" data-vis-mode="">Back</button></p>';
  }
  function delegForm(v) {
    var d = S.d, P = (v.T['BLD-code_register.csv'] || []).filter(function (r) { return r.code_id && (!r.to_date || r.to_date >= v.today); }), T = types(v.T, v.today), A = rows(v.T, 'BLD-area.csv'), R = pipe(d.rights), Ty = pipe(d.visit_type_ids), Ar = pipe(d.area_ids);
    var tick = function (name, val, on, label) { return '<label><input type="checkbox" name="' + name + '" value="' + v.esc(val) + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; };
    return '<form class="vis-f" data-vis-form="deleg">'
      + '<label>Who<select name="holder"><option value="">–</option>' + P.map(function (p) { return '<option value="' + v.esc(p.code_id) + '"' + (p.code_id === d.holder ? ' selected' : '') + '>' + v.esc((p.who || p.code_id) + (p.role ? ' (' + p.role + ')' : '')) + '</option>'; }).join('') + '</select></label>'
      + (P.length ? '' : '<p class="mut">No one has a code yet: give them one first.</p>')
      + '<fieldset class="vis-ticks"><legend>Types they may give (none ticked = any)</legend>' + T.map(function (t) { return tick('d_types', t.id, has(Ty, t.id), v.esc(t.name)); }).join('') + '</fieldset>'
      + '<fieldset class="vis-ticks"><legend>Rights they may hand out (none ticked = any)</legend>' + RIGHTS.map(function (x) { return tick('d_rights', x[0], has(R, x[0]), x[1]); }).join('') + '</fieldset>'
      + (A.length ? '<fieldset class="vis-ticks"><legend>Rooms (none ticked = all)</legend>' + A.map(function (a) { return tick('d_areas', a.id, has(Ar, a.id), v.esc(a.code || a.id)); }).join('') + '</fieldset>' : '')
      + '<div class="vis-two"><label>Longest visit (hours)<input type="number" name="max_hours" min="0.25" step="0.25" value="' + v.esc(d.max_hours || '') + '"></label>'
      + '<label>Pass on (layers, 0 = no)<input type="number" name="depth_left" min="0" step="1" value="' + v.esc(d.depth_left || '0') + '"></label>'
      + '<label>Until DD/MM/YY (blank = until ended)<input type="text" name="td" inputmode="numeric" placeholder="DD/MM/YY" value="' + v.esc(d.td || '') + '"></label>'
      + '<label>HH:MM<input type="text" name="tt" inputmode="numeric" placeholder="HH:MM" value="' + v.esc(d.tt || '') + '"></label></div>'
      + '<div class="vis-ticks">' + tick('end_others', 'yes', d.end_others === 'yes', 'May end visits others gave') + tick('extend_others', 'yes', d.extend_others === 'yes', 'May extend visits others gave') + '</div>'
      + '<label>Reason<input type="text" name="source" autocomplete="off" value="' + v.esc(d.source || '') + '"></label>'
      + '<p><button type="submit" class="btn">Save</button> <button type="button" class="cb" data-vis-dnew="">Back</button></p></form>';
  }
  async function saveDeleg(v, form) {
    var el = form.elements, all = function (n) { return Array.prototype.filter.call(form.querySelectorAll('[name="' + n + '"]'), function (i) { return i.checked; }).map(function (i) { return i.value; }).join('|'); };
    if (!el.holder.value) return 'Pick who.';
    var F = { power: 'give_visit', holder_person_id: '', holder_code_id: el.holder.value, parent_id: '', depth_left: String(Math.max(0, parseInt(el.depth_left.value, 10) || 0)), from_at: '', to_at: '',
      visit_type_ids: all('d_types'), max_hours: el.max_hours.value, rights: all('d_rights'), lists: '', fields: '', area_ids: all('d_areas'), subject_ids: '',
      end_others: el.end_others.checked ? 'yes' : 'no', extend_others: el.extend_others.checked ? 'yes' : 'no', source: el.source.value.trim() };
    if (el.td.value || el.tt.value) { var e = parse(el.td.value, el.tt.value || '23:59'); if (!e) return 'Type the end as DD/MM/YY and HH:MM.'; if (e <= new Date()) return 'That time has passed.'; F.to_at = iso(e); }
    var r = await v.send({ action: 'delegation_give', fields: F });
    if (!(r && r.ok && r.result && r.result.status === 'saved')) return v.msg(r || {});
    F.id = r.result.id || ('dl-' + Date.now());
    (v.T['BLD-delegation.csv'] = v.T['BLD-delegation.csv'] || []).push(F);
    S.d = null; S.ok = F.id; S.msg = '';
    return '';
  }
  async function endDeleg(v, form) {
    var el = form.elements, reason = el.reason.value.trim(), ei = form.querySelector('[name="end_issued"]:checked');
    if (!reason) return 'Type a reason.';
    var F = { id: el.id.value, reason: reason, end_issued: ei ? ei.value : 'keep' };
    var r = await v.send({ action: 'delegation_end', fields: F });
    if (!(r && r.ok && r.result && r.result.status === 'saved')) return v.msg(r || {});
    var at = r.result.ended_at || new Date().toISOString(), D = rows(v.T, 'BLD-delegation.csv'), gone = {}; gone[F.id] = 1;
    for (var more = true; more;) { more = false; D.forEach(function (x) { if (!gone[x.id] && gone[x.parent_id]) { gone[x.id] = 1; more = true; } }); }   /* children go too */
    D.forEach(function (x) { if (gone[x.id] && !x.ended_at) x.ended_at = at; });
    if (F.end_issued === 'end') cur(v.T).forEach(function (l) { if (gone[l.delegation_id] && !l.revoked_at) v.T['BLD-inspect_link.csv'].push({ id: l._cur + '+r', supersedes_id: l._cur, revoked_at: at, revoke_reason: reason }); });
    S.dend = ''; S.msg = 'Ended ✓';
    return '';
  }

  /* WHO GAVE WHAT (Lisa 13 Nov: "I can see who has given what from my admin screen?"). Owner-only, from rows:
     powers held (BLD-delegation, any power) with the chain back to the owner, and everything each person gave:
     visits (inspect_link.issued_by = the giver's code_id or 'owner'), codes (code_register.issued_by when the column exists, else the owner),
     roles (person_role.granted_by). Blank issuer = the owner ("You"). */
  var KINDS = [['', 'All'], ['visit', 'Visits'], ['code', 'Codes'], ['role', 'Roles'], ['power', 'Powers']];
  var POWER = { give_visit: 'Give visits', issue_code: 'Give codes', issue_device: 'Set up phones', give_role: 'Give roles' };
  function chain(v, r) {
    var D = rows(v.T, 'BLD-delegation.csv'), out = [person(v.T, hk(r))], seen = {};
    for (var p = byId(D, r.parent_id); p && !seen[p.id]; p = byId(D, p.parent_id)) { seen[p.id] = 1; out.unshift(person(v.T, hk(p))); }
    out.unshift('You'); return out.join(' → ');
  }
  function given(v) {
    var now = Date.now(), out = [];
    cur(v.T).forEach(function (r) { var w = win(r); out.push({ kind: 'visit', by: by(r.issued_by), at: w.s, what: r.visitor_name || r.label || r.id, live: state(r, now) !== 'ended', id: r.id, end: 'visit' }); });
    rows(v.T, 'BLD-code_register.csv').forEach(function (r) { out.push({ kind: 'code', by: by(r.issued_by), at: Date.parse(r.from_date) || 0, what: (r.who || '') + ' ' + (r.role || ''), live: !r.to_date || r.to_date >= v.today, id: r.id }); });
    rows(v.T, 'BLD-person_role.csv').forEach(function (r) { out.push({ kind: 'role', by: by(r.granted_by), at: Date.parse(r.started_on) || 0, what: person(v.T, r.person_id) + ' ' + (r.role_code || ''), live: !r.ended_on || r.ended_on >= v.today, id: r.id }); });
    rows(v.T, 'BLD-delegation.csv').forEach(function (r) { var p = byId(rows(v.T, 'BLD-delegation.csv'), r.parent_id);
      out.push({ kind: 'power', by: p ? hk(p) : '', at: Date.parse(r.from_at || r.conferred_at) || 0, what: person(v.T, hk(r)) + ': ' + (POWER[r.power] || r.power), live: dlive(r, now), id: r.id, end: 'deleg' }); });
    return out;
  }
  function gaveHtml(v) {
    var g = S.g || (S.g = { who: '', kind: '', from: '' }), all = given(v), from = g.from ? parse(g.from, '00:00') : null;
    var people = {}; all.forEach(function (x) { people[x.by] = 1; });
    rows(v.T, 'BLD-delegation.csv').forEach(function (r) { people[hk(r)] = 1; });
    var list = Object.keys(people).sort(function (a, b) { return a === '' ? -1 : b === '' ? 1 : person(v.T, a).localeCompare(person(v.T, b)); });
    if (g.who !== '' && g.who !== '*') list = list.filter(function (p) { return p === g.who; });
    var opt = function (val, label, on) { return '<option value="' + v.esc(val) + '"' + (on ? ' selected' : '') + '>' + v.esc(label) + '</option>'; };
    var h = '<form class="vis-f vis-two" data-vis-form="gavef"><label>Person<select name="who">' + opt('*', 'Everyone', g.who === '' || g.who === '*')
      + Object.keys(people).map(function (p) { return opt(p || '-', p ? person(v.T, p) : 'You', g.who === (p || '-')); }).join('') + '</select></label>'
      + '<label>What<select name="kind">' + KINDS.map(function (k) { return opt(k[0], k[1], g.kind === k[0]); }).join('') + '</select></label>'
      + '<label>From DD/MM/YY<input type="text" name="from" inputmode="numeric" placeholder="DD/MM/YY" value="' + v.esc(g.from) + '"></label></form>';
    if (g.who === '-') list = [''];
    var now = Date.now();
    list.forEach(function (p) {
      var held = rows(v.T, 'BLD-delegation.csv').filter(function (r) { return p && hk(r) === p; }).sort(function (a, b) { return (dlive(b, now) ? 1 : 0) - (dlive(a, now) ? 1 : 0); });
      var gave = all.filter(function (x) { return x.by === p && (!g.kind || x.kind === g.kind) && (!from || x.at >= from.getTime()); })
        .sort(function (a, b) { return (b.live ? 1 : 0) - (a.live ? 1 : 0) || b.at - a.at; });
      if (!held.length && !gave.length) return;
      h += '<div class="vis-sec" data-vis-who="' + v.esc(p || '-') + '"><h4>' + v.esc(p ? person(v.T, p) : 'You') + '</h4>';
      if (held.length && (!g.kind || g.kind === 'power')) h += '<p class="mut">Can:</p>' + held.map(function (r) {
        var live = dlive(r, now);
        return '<div class="vis-row"><b>' + v.esc(POWER[r.power] || r.power) + '</b><span class="vis-when">' + v.esc(limits(v, r)) + ' · from ' + v.esc(chain(v, r)) + (live ? '' : ' · ended') + '</span>'
          + (live ? '<button type="button" class="cb" data-vis-dend="' + v.esc(r.id) + '">End</button>' : '') + '</div>' + (S.dend === r.id ? dendForm(v, r.id) : '');
      }).join('');
      if (gave.length) h += '<p class="mut">Gave:</p>' + gave.map(function (x) {
        return '<div class="vis-row"><b>' + v.esc(x.what) + '</b><span class="vis-when">' + v.esc((KINDS.filter(function (k) { return k[0] === x.kind; })[0] || ['', x.kind])[1]) + (x.at ? ' · ' + v.esc(when(x.at).slice(0, 8)) : '') + ' · ' + (x.live ? 'active' : 'ended') + '</span>'
          + (x.live && x.end === 'visit' ? '<button type="button" class="cb" data-vis-end="' + v.esc(x.id) + '">End now</button>' : '')
          + (x.live && x.end === 'deleg' ? '<button type="button" class="cb" data-vis-dend="' + v.esc(x.id) + '">End</button>' : '') + '</div>'
          + (S.end === x.id && x.end === 'visit' ? endForm(v, x.id) : '') + (S.dend === x.id && x.end === 'deleg' ? dendForm(v, x.id) : '');
      }).join('');
      h += '</div>';
    });
    return h + '<p class="mut">Phones set up: coming. Only you see this page.</p><p><button type="button" class="cb" data-vis-mode="">Back</button></p>';
  }

  function body(v) {
    var now = Date.now(), L = cur(v.T);
    var live = L.filter(function (r) { return state(r, now) === 'live'; }).sort(function (a, b) { return win(a).e - win(b).e; });
    var soon = L.filter(function (r) { return state(r, now) === 'soon'; }).sort(function (a, b) { return win(a).s - win(b).s; });
    var msg = S.msg ? '<p role="status"' + (/^NOT/.test(S.msg) ? ' class="vis-bad"' : '') + '>' + v.esc(S.msg) + '</p>' : '';
    var url = S.url ? '<div class="vis-sec"><p><b>Send this link now.</b> It is shown once.</p><p class="vis-url">' + v.esc(S.url) + '</p><p><button type="button" class="btn" data-vis-copy="1">Copy</button> <button type="button" class="cb" data-vis-url="">Done</button></p></div>' : '';
    if (!v.hasTable('BLD-inspect_link.csv')) return '<p class="mut">Links not set up yet.</p>';
    if (S.mode === 'give') return msg + giveHtml(v);
    if (S.mode === 'types') return msg + typesHtml(v);
    if (S.mode === 'who') return msg + whoHtml(v);
    if (S.mode === 'gave') return msg + gaveHtml(v);
    return msg + url
      + '<p><button type="button" class="btn" data-vis-mode="give">Give a visit</button> <button type="button" class="cb" data-vis-mode="types">Visit types</button> <button type="button" class="cb" data-vis-mode="who">Who can give visits</button> <button type="button" class="cb" data-vis-mode="gave">Who gave what</button></p>'
      + '<div class="vis-sec"><h4>Active now</h4>' + (live.length ? listHtml(v, live, now, 'live') : '<p class="mut">No one.</p>') + '</div>'
      + '<div class="vis-sec"><h4>Coming up</h4>' + (soon.length ? listHtml(v, soon, now, 'soon') : '<p class="mut">None.</p>') + '</div>'
      + (v.hasTable('BLD-visit_type.csv') ? '' : '<p class="mut">Visit types not set up yet.</p>');
  }
  function sub(v) {
    var now = Date.now(), n = cur(v.T).filter(function (r) { return state(r, now) === 'live'; }).length;
    return n ? n + ' here now' : 'No one now';
  }

  /* owner rescanned a visitor card while signed in here: open that visit's End now, or Give a visit when the card is free.
     qr_tag keeps only sha256:<hex> of a card's tag (reading the table must not let anyone use a card), so hash the scanned tag. */
  function sha(text) {
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (b) {
      return 'sha256:' + Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); });
  }
  function rescan(v, tag) {
    S.msg = 'Finding that card…';
    sha(tag).then(function (h) { found(v, h); v.rerender(); }, function () { S.msg = 'That card could not be checked.'; v.rerender(); });
  }
  function found(v, h) {
    var c = h && rows(v.T, 'BLD-qr_tag.csv').filter(function (r) { return r.tag === h && r.kind === 'visitor_card'; })[0];
    if (!c) { S.msg = 'That card is not on the list.'; return; }
    var now = Date.now(), r = cur(v.T).filter(function (x) { return x.card_tag_id === c.id && state(x, now) !== 'ended'; })[0];
    S.mode = ''; S.end = ''; S.ext = ''; S.msg = '';
    if (r) S.end = r.id; else { S.mode = 'give'; S.f = { how: 'card', card: c.id, win: 'now', type: c.fixed_type_id || '' }; }
  }

  function keep(form) {   /* the give form's typed values survive a redraw */
    if (!form || form.dataset.visForm !== 'give') return;
    var f = S.f || (S.f = {}), val = function (n) { var e = form.elements[n]; return e ? (e.value != null ? e.value : '') : undefined; };
    ['how', 'card', 'name', 'org', 'type', 'win', 'hours', 'until', 'fd', 'ft', 'td', 'tt', 'email', 'purpose', 'grant_basis', 'identity_assurance'].forEach(function (n) {
      var e = form.elements[n]; if (!e) return;
      if (e.length && e[0] && e[0].type === 'radio') { for (var i = 0; i < e.length; i++) if (e[i].checked) f[n] = e[i].value; } else f[n] = e.value;
    });
    f.basis = f.grant_basis; f.assure = f.identity_assurance;
    var all = form.elements.alldogs; f.dogs = all && all.checked ? null : Array.prototype.filter.call(form.querySelectorAll('[name="dog"]'), function (i) { return i.checked; }).map(function (i) { return i.value; });
    if (form.querySelector('[name="g_rights"]')) f.g = readGrant(form, 'g_');
    return val;
  }

  async function give(v, form) {
    keep(form);
    var f = S.f, t = byId(types(v.T, v.today), f.type) || types(v.T, v.today)[0], g = f.g || t, F = { visit_type_id: t.id, visitor_name: (f.name || '').trim(), organisation: (f.org || '').trim(), purpose_text: (f.purpose || '').trim(),
      grant_basis: f.basis || t.grant_basis || 'voluntary', identity_assurance: f.assure || 'none' };
    if (!F.visitor_name) return 'Type their name.';
    if (!F.purpose_text) return 'Type the purpose.';
    if (f.how === 'card') { if (!f.card) return 'Pick a card.'; F.card_tag_id = f.card; }
    var now = new Date(), max = parseFloat(t.max_hours) || 0, s, e;
    if (f.win === 'now') { var h = parseFloat(f.hours); if (!(h > 0)) return 'Type the hours.'; if (max && h > max) return 'Longest for ' + t.name + ' is ' + max + ' hours.'; F.usable_from = ''; F.hours = String(h); }
    else if (f.win === 'until') { var m = /^(\d{1,2}):(\d{2})$/.exec(String(f.until || '').trim()); if (!m) return 'Type the end as HH:MM.';
      e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2]); if (e <= now) return 'That time has passed today.'; F.usable_from = ''; F.usable_to = iso(e); }
    else { s = parse(f.fd, f.ft); e = parse(f.td, f.tt); if (!s || !e) return 'Type both as DD/MM/YY and HH:MM.'; if (e <= s) return 'The end is before the start.';
      if (e <= now) return 'That window has passed.'; F.usable_from = iso(s); F.usable_to = iso(e); }
    if (s && e && max && (e - s) / 36e5 > max) return 'Longest for ' + t.name + ' is ' + max + ' hours.';
    if (f.dogs && !f.dogs.length) return 'Tick at least one dog, or All.';
    F.subject_ids = f.dogs || [];
    if (+t.data_years > 0) { var a = new Date(); a.setFullYear(a.getFullYear() - (+t.data_years)); F.as_of_from = a.toISOString().slice(0, 10); }   /* records back: the type's own row */
    var endAt = F.usable_to || new Date(Date.now() + (parseFloat(F.hours) || 0) * 36e5).toISOString();
    F.retention_until = keepUntil(v, endAt);
    ['rights', 'lists', 'fields', 'record_jobs', 'record_counts'].forEach(function (k) { F[k] = pipe(g[k]); });
    if (f.how === 'link' && g.email_code === 'yes') { if (!/^\S+@\S+\.\S+$/.test(f.email || '')) return 'Type their email for the code.'; F.email = f.email.trim(); }
    var r = await v.send({ action: 'visit_give', fields: F });
    if (!(r && r.ok && r.result && r.result.status === 'saved')) return v.msg(r || {});
    var id = r.result.link_id;
    (v.T['BLD-inspect_link.csv'] = v.T['BLD-inspect_link.csv'] || []).push({ id: id, visitor_name: F.visitor_name, organisation: F.organisation, usable_from: F.usable_from || new Date().toISOString(),
      usable_to: endAt, visit_type_id: t.id, card_tag_id: F.card_tag_id || '' });
    S.mode = ''; S.f = null; S.ok = id; S.url = r.result.url || ''; S.msg = F.email && r.result.email_sent === false ? 'Email not sent: send the link yourself.' : '';
    return '';
  }

  async function saveType(v, form) {
    var el = form.elements, g = readGrant(form, 't_'), name = el.name.value.trim();
    if (!name) return 'Type a name.';
    var key = S.t.type_key || name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    var F = { type_key: key, name: name, role_code: el.role_code.value, default_hours: el.default_hours.value, max_hours: el.max_hours.value, data_years: el.data_years.value,
      active: el.active.checked ? 'yes' : 'no', effective_from: v.today, source: el.source.value.trim(), grant_basis: el.grant_basis ? el.grant_basis.value : '' };
    Object.keys(g).forEach(function (k) { F[k] = g[k]; });
    if (F.default_hours && F.max_hours && +F.default_hours > +F.max_hours) return 'Usual hours are more than the longest.';
    var r = await v.send({ action: 'visit_type_save', fields: F });
    if (!(r && r.ok && r.result && r.result.status === 'saved')) return v.msg(r || {});
    F.id = r.result.id || ('vt-' + key + '-' + v.today);
    (v.T['BLD-visit_type.csv'] = v.T['BLD-visit_type.csv'] || []).push(F);
    S.t = null; S.ok = key; S.msg = '';
    return '';
  }

  async function endOrExtend(v, form, kind) {
    var el = form.elements, reason = el.reason.value.trim(), id = el.link_id.value, F = { link_id: id, reason: reason };
    if (!reason) return 'Type a reason.';
    if (kind === 'ext') { var e = parse(el.d.value, el.t.value); if (!e) return 'Type the end as DD/MM/YY and HH:MM.'; if (e <= new Date()) return 'That time has passed.'; F.usable_to = iso(e); }
    var r = await v.send({ action: kind === 'ext' ? 'visit_extend' : 'visit_end', fields: F });
    if (!(r && r.ok && r.result && r.result.status === 'saved')) return v.msg(r || {});
    var row = byId(cur(v.T), id);   /* nothing is edited: add the superseding row the server wrote */
    if (row) v.T['BLD-inspect_link.csv'].push(kind === 'ext' ? { id: r.result.id || row._cur + '+x', supersedes_id: row._cur, usable_to: F.usable_to }
      : { id: r.result.id || row._cur + '+r', supersedes_id: row._cur, revoked_at: r.result.revoked_at || r.result.ended_at || new Date().toISOString(), revoke_reason: reason });
    S.end = ''; S.ext = ''; S.ok = id; S.msg = kind === 'ext' ? 'Extended ✓' : 'Ended ✓';
    return '';
  }

  var bound = false;
  function bind(v) {
    VisitView._v = v;
    if (bound) return; bound = true;
    var redraw = function () { VisitView._v.rerender(); };
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-vis-mode],[data-vis-end],[data-vis-ext],[data-vis-edit],[data-vis-suggest],[data-vis-copy],[data-vis-url],[data-vis-dnew],[data-vis-dend]');
      if (!t || !VisitView._v) return;
      var d = t.dataset, vv = VisitView._v;
      if (d.visCopy) { try { navigator.clipboard.writeText(S.url); t.textContent = 'Copied ✓'; } catch (x) { /* shown on screen to copy by hand */ } return; }
      S.msg = '';
      if (d.visMode != null) { S.mode = d.visMode; S.end = ''; S.ext = ''; S.t = null; S.d = null; S.dend = ''; if (d.visMode === 'give') S.f = null; }
      else if (d.visDnew != null) S.d = d.visDnew ? { depth_left: '0' } : null;
      else if (d.visDend != null) S.dend = d.visDend;
      else if (d.visEnd != null) { S.end = d.visEnd; S.ext = ''; }
      else if (d.visExt != null) { S.ext = d.visExt; S.end = ''; }
      else if (d.visEdit != null) S.t = d.visEdit === 'new' ? { rights: 'view|review' } : (d.visEdit ? Object.assign({}, byId(types(vv.T, vv.today), d.visEdit)) : null);
      else if (d.visSuggest) S.t = Object.assign({ name: d.visSuggest }, SUGGEST[d.visSuggest]);
      else if (d.visUrl != null) S.url = '';
      redraw();
    });
    document.addEventListener('change', function (e) {
      var form = e.target.closest && e.target.closest('form[data-vis-form]'); if (!form) return;
      if (form.dataset.visForm === 'gavef') { S.g = { who: form.elements.who.value, kind: form.elements.kind.value, from: form.elements.from.value.trim() }; S.end = ''; S.dend = ''; redraw(); return; }
      if (form.dataset.visForm === 'give') {
        var n = e.target.name;
        if (n === 'type') { keep(form); S.f.g = null; S.f.hours = ''; redraw(); }
        else if (n === 'how' || n === 'win' || n === 'alldogs' || n === 'g_rights' || n === 'g_lists' || n === 'g_jobs') { keep(form); if (n === 'alldogs' && !e.target.checked) S.f.dogs = []; redraw(); }
      } else if (form.dataset.visForm === 'type' && /^t_(rights|lists|jobs)$/.test(e.target.name)) {
        var g = readGrant(form, 't_'), el = form.elements;
        S.t = Object.assign({}, S.t, g, { name: el.name.value, default_hours: el.default_hours.value, max_hours: el.max_hours.value, data_years: el.data_years.value, role_code: el.role_code.value, source: el.source.value, active: el.active.checked ? 'yes' : 'no' });
        redraw();
      }
    });
    document.addEventListener('submit', function (e) {
      var form = e.target.closest && e.target.closest('form[data-vis-form]'); if (!form) return;
      e.preventDefault();
      if (S.busy || form.dataset.visForm === 'gavef') return;
      var vv = VisitView._v, k = form.dataset.visForm;
      S.busy = true;
      var btn = form.querySelector('[type=submit]'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
      var job = k === 'give' ? give(vv, form) : k === 'type' ? saveType(vv, form) : k === 'deleg' ? saveDeleg(vv, form) : k === 'dend' ? endDeleg(vv, form) : endOrExtend(vv, form, k);
      job.then(function (bad) { S.busy = false; if (bad) S.msg = /^NOT/.test(bad) ? bad : 'NOT saved — ' + bad; redraw(); },
        function () { S.busy = false; S.msg = 'NOT saved — something went wrong.'; redraw(); });
    });
  }
  return { body: body, sub: sub, bind: bind, rescan: rescan, _state: S, _win: win, _parse: parse };
}());
