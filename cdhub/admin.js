/*!
 * ADMIN (More -> Admin), owner-only. Lisa, 12 Nov 2026: one visual place for every admin job.
 * Shown only to someone whose Google sign-in can read BLD-field_visibility.csv (staff and visitors use the staff
 * page with codes and never sign in here). Everything is READ from live rows; this page saves nothing and never
 * sees a code: codes are made and stopped by Lisa in the Apps Script editor or on the save script's owner page.
 * No rule, limit or list of people lives here: who-sees-what comes from BLD-field_visibility + BLD-audience rows,
 * roles from BLD-role, links from BLD-inspect_link, rules from BLD-breeding_rule, record periods from
 * BLD-retention_setting. The future list (admin-future.json) is a list of jobs to build, not rules.
 */
var AdminView = (function () {
  'use strict';
  var FILES = ['BLD-field_visibility.csv', 'BLD-audience.csv', 'BLD-inspect_link.csv', 'BLD-retention_setting.csv'];
  var S = { open: '', aud: '', cell: '', futureAll: false, future: null, futureErr: '', qr: false };
  var I = {   // Tabler outline paths, ours
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
    save: 'M7 18a4.6 4.4 0 0 1 0-9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1M9 15l3 3l3-3M12 12v6',
    staff: 'M9 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M3 21v-1a6 6 0 0 1 12 0v1M19 8v6M16 11h6',
    visitor: 'M12 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M6 21v-1a6 6 0 0 1 12 0v1',
    inspect: 'M11 11m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M20 20l-4.5-4.5',
    lost: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2M3 3l18 18',
    print: 'M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2M17 9V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4M7 13h10v8H7z',
    rules: 'M4 6h16M4 12h10M4 18h6',
    records: 'M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4',
    health: 'M3 12h4l3-8l4 16l3-8h4',
    eye: 'M10 12a2 2 0 1 0 4 0a2 2 0 0 0-4 0M21 12c-2.4 4-5.4 6-9 6s-6.6-2-9-6c2.4-4 5.4-6 9-6s6.6 2 9 6',
    dash: 'M5 12h14',
    shield: 'M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21A12 12 0 0 1 3.5 6A12 12 0 0 0 12 3',
    future: 'M12 7v5l3 3M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0'
  };
  // card id, title, icon, slot colour (LJR7), group
  var CARDS = [
    ['phone', 'Set up a phone', 'qr', 5, 'Phones'], ['saving', 'This device', 'save', 5, 'Phones'],
    ['staff', 'Add staff', 'staff', 5, 'People'], ['visitor', 'Add visitor', 'visitor', 6, 'People'],
    ['inspect', 'Inspector link', 'inspect', 7, 'People'], ['lost', 'Lost phone / code', 'lost', 2, 'People'],
    ['print', 'Print', 'print', 4, 'Tools'], ['rules', 'Rules & limits', 'rules', 3, 'Tools'],
    ['records', 'Records kept', 'records', 0, 'Tools'], ['health', 'System health', 'health', 5, 'Tools']
  ];


  /* look: colour lives in icons and the full-height left line; hover is the pale grey fill (Lisa 11 Nov) */
  (function () {
    if (typeof document === 'undefined' || document.getElementById('adm-css')) return;
    var st = document.createElement('style'); st.id = 'adm-css';
    st.textContent = [
      '.adm-h{display:flex;align-items:center;gap:8px}.adm-h .ti{width:22px;height:22px}',
      '.adm-lock{font-size:var(--fs-small);font-weight:400;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:1px 8px}',
      '.adm-g{font-size:var(--fs-small);font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:16px 0 6px}',
      '.adm-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}',
      '.adm-card{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:2px;min-height:76px;padding:10px;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);color:var(--ink)}',
      '.adm-card .ti{width:22px;height:22px}.adm-card span{font-weight:500}.adm-card small{color:var(--muted);font-size:var(--fs-small)}',
      '.adm-card.adm-hero{grid-column:1/-1;min-height:64px}',
      '#main .adm-card:hover,#main .adm-card.sel{background:var(--hov)}.adm-card.sel{border-color:var(--sel-bd)}',
      '.adm-card:focus-visible,.adm-cell:focus-visible,.adm-aud:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}',
      '.adm-line{border-left:3px solid var(--ljr-0-icon)}',
      '.adm-line.l2{border-left-color:var(--ljr-2-icon)}.adm-line.l3{border-left-color:var(--ljr-3-icon)}.adm-line.l4{border-left-color:var(--ljr-4-icon)}.adm-line.l5{border-left-color:var(--ljr-5-icon)}.adm-line.l6{border-left-color:var(--ljr-6-icon)}.adm-line.l7{border-left-color:var(--ljr-7-icon)}',
      '.ti.c0{color:var(--ljr-0-icon)}.ti.c2{color:var(--ljr-2-icon)}.ti.c3{color:var(--ljr-3-icon)}.ti.c4{color:var(--ljr-4-icon)}.ti.c5{color:var(--ljr-5-icon)}.ti.c6{color:var(--ljr-6-icon)}.ti.c7{color:var(--ljr-7-icon)}',
      '.adm-body h3,#admMap h3,#admFuture h3{display:flex;align-items:center;gap:8px;margin:0 0 8px}',
      '.adm-steps{margin:0 0 10px;padding-left:22px}.adm-steps li{margin:4px 0}',
      '.adm-list{list-style:none;margin:0 0 10px;padding:0}.adm-list li{padding:4px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
      '.adm-ok{color:var(--ljr-5-icon);font-weight:600}.adm-no{color:var(--muted);font-weight:600}',
      '.adm-qr{display:flex;flex-direction:column;align-items:center;gap:6px;margin:8px 0 12px}.adm-qr svg{width:min(260px,70vw);height:auto;background:#fff;padding:8px;border-radius:8px}',
      '.adm-map table{border-collapse:separate;border-spacing:0;font-size:var(--fs-small)}.adm-map th,.adm-map td{padding:2px 4px;text-align:center;white-space:nowrap}',
      '.adm-map tbody th{text-align:left;font-weight:400;position:sticky;left:0;background:var(--card)}',
      '.adm-cell,.adm-aud{all:unset;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;border-radius:6px;font-weight:500}',
      '.adm-aud{padding:0 6px}#main .adm-cell:hover,#main .adm-aud:hover,.adm-cell.sel,.adm-aud.sel{background:var(--hov)}',
      '.ti.adm-see,.adm-see .ti{color:var(--ljr-6-icon)}.adm-part .ti{color:var(--ljr-3-icon)}.ti.adm-hid,.adm-hid .ti{color:var(--muted)}',
      '.adm-key{display:flex;align-items:center;gap:4px;flex-wrap:wrap;color:var(--muted);font-size:var(--fs-small)}.adm-key .ti{width:16px;height:16px}',
      '.adm-why{border-top:1px solid var(--line);margin-top:8px;padding-top:8px}.adm-why ul{margin:6px 0 0;padding-left:18px}.adm-why li{margin:3px 0}',
      '.adm-later{margin-top:8px}',
      '.adm-future{list-style:none;margin:0;padding:0}.adm-future li{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}.adm-future li:last-child{border:0}',
      '.adm-future span{flex:1}.adm-future em{font-style:normal;color:var(--muted);font-size:var(--fs-small)}'
    ].join('\n');
    document.head.appendChild(st);
  }());

  function icon(k, cls) { return '<svg class="ti ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + I[k] + '"/></svg>'; }
  function rows(T, f) { return (T[f] || []).filter(function (r) { return r && Object.keys(r).length; }); }
  function on(T) { return rows(T, 'BLD-field_visibility.csv').length > 0; }
  function ls(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function scriptUrl() {
    var u = ls('bld.scriptUrl') || ls('cdhub.sink.url');
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u) ? u : '';
  }
  function staffBase() { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'staff/'; }
  function ownerPage(v, label) {
    var u = scriptUrl();
    return u ? '<a class="btn" href="' + v.esc(u + '?page=approve') + '" target="_blank" rel="noopener">' + (label || 'Open owner page') + '</a>'
      : '<span class="mut">No save address in this browser. <button type="button" class="cb" data-go="round">Set it up</button></span>';
  }
  function steps(list) { return '<ol class="adm-steps">' + list.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>'; }

  /* ---- who sees what: from BLD-field_visibility rows + BLD-audience names ---- */
  function audName(T, id) {
    var a = rows(T, 'BLD-audience.csv').filter(function (r) { return r.id === id; })[0];
    if (a && a.name) return a.name;
    if (/^person:/.test(id)) return 'Person ' + id.slice(7);
    return id.replace(/^aud-/, '').replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function audRank(T, id) { var a = rows(T, 'BLD-audience.csv').filter(function (r) { return r.id === id; })[0]; return a && a.rank !== '' && !isNaN(+a.rank) ? +a.rank : -1; }
  function tblName(t) { return String(t || '').replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); }
  function access(T, today) {
    var fv = rows(T, 'BLD-field_visibility.csv').filter(function (r) { var d = String(r.set_on || '').slice(0, 10); return !d || d <= today; });
    var auds = {}, tables = {}, cell = {};
    fv.forEach(function (r) {
      var a = r.audience_id, t = r.table_name; if (!a || !t) return;
      auds[a] = auds[a] || { id: a, live: false, n: 0 }; auds[a].n++;
      tables[t] = 1;
      var k = t + '|' + a, c = cell[k] = cell[k] || { yes: [], no: [], star: null, rows: [] };
      c.rows.push(r);
      var yes = String(r.visible || '').toLowerCase() === 'yes';
      if (r.field_name === '*') { if (yes) { c.star = r; auds[a].live = true; } return; }
      (yes ? c.yes : c.no).push(r);
    });
    var A = Object.keys(auds).map(function (k) { return auds[k]; })
      .sort(function (x, y) { return (y.live - x.live) || (audRank(T, y.id) - audRank(T, x.id)) || (x.id < y.id ? -1 : 1); });
    var Tb = Object.keys(tables).sort();
    return { auds: A, tables: Tb, cell: cell };
  }
  function cellMark(c) {
    if (!c || !c.yes.length) return { k: 'dash', t: 'Hidden', cls: 'adm-hid' };
    return { k: 'eye', t: 'Sees ' + c.yes.length + ' column' + (c.yes.length === 1 ? '' : 's') + (c.star ? '' : ' (no rows rule: no rows)'), cls: c.star ? 'adm-see' : 'adm-part' };
  }
  function mapHtml(v) {
    var m = access(v.T, v.today), live = m.auds.filter(function (a) { return a.live; }), later = m.auds.filter(function (a) { return !a.live; });
    var grid = function (auds) {
      return '<div class="scroll adm-map" tabindex="0" role="group" aria-label="Who sees what, scroll sideways for more"><table><thead><tr><th>List</th>'
        + auds.map(function (a) { return '<th><button type="button" class="adm-aud' + (S.aud === a.id ? ' sel' : '') + '" data-adm-aud="' + v.esc(a.id) + '">' + v.esc(audName(v.T, a.id)) + '</button></th>'; }).join('')
        + '</tr></thead><tbody>' + m.tables.filter(function (t) { return auds.some(function (a) { return m.cell[t + '|' + a.id]; }); }).map(function (t) {
          return '<tr><th scope="row">' + v.esc(tblName(t)) + '</th>' + auds.map(function (a) {
            var k = t + '|' + a.id, c = m.cell[k], mk = cellMark(c);
            return '<td><button type="button" class="adm-cell ' + mk.cls + (S.cell === k ? ' sel' : '') + '" data-adm-cell="' + v.esc(k) + '" aria-label="' + v.esc(audName(v.T, a.id) + ', ' + tblName(t) + ': ' + mk.t) + '">' + icon(mk.k) + '</button></td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    };
    var why = '';
    if (S.cell && m.cell[S.cell]) {
      var c = m.cell[S.cell], p = S.cell.split('|');
      why = '<div class="adm-why"><b>' + v.esc(audName(v.T, p[1])) + ' · ' + v.esc(tblName(p[0])) + '</b>'
        + '<ul>' + c.rows.map(function (r) {
          return '<li>' + (String(r.visible).toLowerCase() === 'yes' ? 'Sees ' : 'Hidden: ') + (r.field_name === '*' ? 'rows' + (r.condition ? ' (' + v.esc(r.condition) + ')' : ' (all)') : v.esc(String(r.field_name).replace(/_/g, ' ')))
            + (r.redaction ? ' · ' + v.esc(r.redaction) : '') + (r.condition && r.field_name !== '*' ? ' · if ' + v.esc(r.condition) : '')
            + ' <span class="mut">' + v.esc(r.id) + ', from <span class="dpill">' + v.esc(v.dmy(String(r.set_on || '').slice(0, 10))) + '</span>' + (r.reason ? ' · ' + v.esc(r.reason) : '') + '</span></li>';
        }).join('') + '</ul></div>';
    }
    var see = '';
    if (S.aud) {
      var mine = m.tables.map(function (t) { var c = m.cell[t + '|' + S.aud]; return c && c.yes.length ? [t, c] : null; }).filter(Boolean);
      see = '<div class="adm-why"><b>' + v.esc(audName(v.T, S.aud)) + ' sees</b>' + (mine.length ? '<ul>' + mine.map(function (x) {
        return '<li><b>' + v.esc(tblName(x[0])) + '</b>: ' + v.esc(x[1].yes.map(function (r) { return String(r.field_name).replace(/_/g, ' '); }).join(', '))
          + (x[1].star ? '' : ' <span class="mut">(no rows rule, so no rows)</span>') + '</li>';
      }).join('') + '</ul>' : '<p class="mut">Nothing.</p>') + '</div>';
    }
    return '<section class="card adm-line l6" id="admMap"><details class="compfold" data-adm-fold="map"' + (S.mapShut ? '' : ' open') + '><summary><h3>' + icon('eye', 'c6') + 'Who sees what</h3></summary>'
      + '<p class="adm-key">' + icon('eye', 'adm-see') + ' sees ' + icon('dash', 'adm-hid') + ' hidden · tap a name or a mark</p>'
      + (live.length ? grid(live) : '<p class="mut">No rows yet.</p>') + see + why
      + (later.length ? '<details class="adm-later"><summary class="mut">Website people, later (' + later.length + ')</summary>' + grid(later) + '</details>' : '')
      + '<p class="mut">From BLD-field_visibility, today. Add and change: set in the save script, not rows yet (coming).</p>'
      + '</details></section>';
  }

  /* ---- the cards ---- */
  function body(v, id) {
    var T = v.T, u = scriptUrl(), host = location.host;
    if (id === 'phone') {
      var link = u ? staffBase() + '#setup=' + encodeURIComponent(u) : '', qr = '';
      if (S.qr && link) { try { qr = '<div class="adm-qr">' + BLDQr.svg(link, 'Phone set-up QR') + '<small>Show on screen. Do not pin up or photograph.</small></div>'; } catch (e) { qr = '<p class="mut">QR could not be drawn.</p>'; } }
      return '<p>Sets up <b>' + v.esc(host) + '</b> only. Each address needs its own set-up.</p>'
        + (u ? '<p><button type="button" class="btn" data-adm-qr="1">' + icon('qr') + (S.qr ? ' Hide QR' : ' Show QR') + '</button></p>' + qr
          : '<p class="mut">No save address in this browser. <button type="button" class="cb" data-go="round">Set it up</button></p>')
        + steps(['They scan the QR', 'They type their own code', 'Done: their phone remembers it'])
        + '<p class="mut">No typing for them: <a href="' + v.esc(staffBase() + 'print/') + '">Private set-up QR</a> (you paste their code; shown 2 min).</p>';
    }
    if (id === 'saving') {
      var hub = v.sinkOn(), staff = !!ls('bld.scriptUrl') && !!ls('bld.device.code');
      return '<ul class="adm-list"><li>' + mark(hub) + ' Hub saving: <b>' + (hub ? 'on' : 'off') + '</b></li>'
        + '<li>' + mark(staff) + ' Staff page on this device: <b>' + (staff ? 'on' : 'off') + '</b></li>'
        + '<li>' + icon('save') + ' Address: <b>' + v.esc(host) + '</b></li></ul>'
        + (hub ? '' : '<p><button type="button" class="btn" data-go="round">Fix it</button></p>')
        + (staff ? '' : '<p><a class="btn" href="' + v.esc(staffBase()) + '">Set up staff page here</a></p>');
    }
    if (id === 'staff') {
      var roles = rows(T, 'BLD-role.csv').filter(function (r) { return r.code; });
      return steps(['Apps Script editor → <b>Admin.gs</b> → <b>adminAddStaffCode</b>', 'Type their NAME and ROLE', 'Press <b>Run</b>. Copy the code from the log (only you see it)', 'Give it to them, then <button type="button" class="cb" data-adm-open="phone">Set up a phone</button>'])
        + (roles.length ? '<p class="mut">Roles: ' + roles.map(function (r) { return '<b>' + v.esc(r.code) + '</b> ' + v.esc(r.name || ''); }).join(' · ') + '</p>' : '')
        + '<p>Who has a code, and remove someone: ' + ownerPage(v) + '</p>';
    }
    if (id === 'visitor') {
      var m = access(T, v.today), g = m.tables.filter(function (t) { var c = m.cell[t + '|aud-guest']; return c && c.yes.length; });
      return steps(['Apps Script editor → <b>Admin.gs</b> → <b>adminAddGuestCode</b>', 'Type a LABEL and how many DAYS', 'Press <b>Run</b>. Copy the code (only you see it)', 'It ends by itself'])
        + '<p class="mut">A visitor sees: ' + (g.length ? g.map(function (t) { return v.esc(tblName(t)); }).join(', ') : 'nothing yet') + ' · <button type="button" class="cb" data-adm-aud="aud-guest">Detail</button></p>'
        + '<p>Stop one early: ' + ownerPage(v) + '</p>';
    }
    if (id === 'inspect') {
      var L = rows(T, 'BLD-inspect_link.csv').filter(function (r) { return r.id; }).sort(function (a, b) { return a.ends < b.ends ? 1 : -1; });
      var openN = L.filter(function (r) { return String(r.ends || '').slice(0, 10) >= v.today; });
      return (v.hasTable('BLD-inspect_link.csv') ? (L.length ? '<ul class="adm-list">' + L.slice(0, 8).map(function (r) {
        var e = String(r.ends || '').slice(0, 10), live = e >= v.today;
        return '<li>' + mark(live) + ' <b>' + v.esc(r.label || r.id) + '</b> ends <span class="dpill' + (live ? '' : ' late') + '">' + v.esc(v.dmy(e)) + '</span>' + (live ? '' : ' <span class="mut">ended</span>') + '</li>';
      }).join('') + '</ul>' : '<p class="mut">No links yet.</p>') : '<p class="mut">Links not set up yet.</p>')
        + steps(['Owner page → <b>Inspector link</b>', 'Tick the dogs and what they see', 'Send the link. It ends by itself'])
        + '<p>' + ownerPage(v, 'Make or end a link') + '</p>' + (openN.length ? '<p class="mut">' + openN.length + ' open now.</p>' : '');
    }
    if (id === 'lost') {
      return steps(['Owner page → <b>Revoke</b> their code', 'That phone is wiped on its next use', 'New code: <button type="button" class="cb" data-adm-open="staff">Add staff</button>', 'New phone: <button type="button" class="cb" data-adm-open="phone">Set up a phone</button>'])
        + '<p>' + ownerPage(v, 'Revoke a code') + '</p>';
    }
    if (id === 'print') {
      return '<p><a class="btn" href="' + v.esc(staffBase() + 'print/') + '">' + icon('print') + ' Open Print</a></p>'
        + '<p class="mut">Room signs · dog cards · litter cards · set-up QRs. Needs an owner code on this device.</p>'
        + '<p class="mut">QRs carry <b>' + v.esc(host) + '</b>: print from the address staff use.</p>';
    }
    if (id === 'rules') {
      var R = rows(T, 'BLD-breeding_rule.csv').filter(function (r) { return r.rule_key; }), by = {};
      R.forEach(function (r) { (by[r.rule_key] = by[r.rule_key] || []).push(r); });
      var keys = Object.keys(by).sort();
      return (keys.length ? '<ul class="adm-list">' + keys.map(function (k) {
        var list = by[k].slice().sort(function (a, b) { return (a.effective_from || '') < (b.effective_from || '') ? -1 : 1; });
        var now = list.filter(function (r) { return (r.effective_from || '') <= v.today && (!r.to_date || r.to_date >= v.today); }).slice(-1)[0];
        return '<li><b>' + v.esc(k) + '</b> ' + (now ? '= <b>' + v.esc(now.value) + '</b> from <span class="dpill">' + v.esc(v.dmy(now.effective_from)) + '</span>' + (now.source ? ' <span class="mut">' + v.esc(now.source) + '</span>' : '') : '<span class="mut">not in force today</span>')
          + (list.length > 1 ? ' <span class="mut">(' + list.length + ' versions)</span>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="mut">No rule rows.</p>')
        + '<p class="mut">A change is a new row from a date; history stays.</p><p><button type="button" class="btn" data-go="compliance">Add a change</button></p>';
    }
    if (id === 'records') {
      var K = rows(T, 'BLD-retention_setting.csv');
      return (v.hasTable('BLD-retention_setting.csv') && K.length ? '<ul class="adm-list">' + K.map(function (r) {
        var f = r.from_date || r.effective_from || '';
        return '<li><b>' + v.esc(r.section || r.table_name || r.id) + '</b> ' + v.esc(r.years ? r.years + ' years' : (r.value || '')) + (f ? ' from <span class="dpill">' + v.esc(v.dmy(String(f).slice(0, 10))) + '</span>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="mut">No rows yet. With none, the legal period applies, else the save script default.</p>')
        + '<p class="mut">Setting them here: coming.</p>';
    }
    if (id === 'health') {
      var want = v.want || [], miss = want.filter(function (f) { return !v.hasTable(f); });
      var last = rows(T, 'BLD-area_reading.csv').map(function (r) { return String(r.taken_at || r.period_start || ''); }).filter(Boolean).sort().slice(-1)[0];
      return '<ul class="adm-list"><li>' + mark(v.load.state === 'ok') + ' Tables read: <b>' + (want.length - miss.length) + '</b> of ' + want.length + (v.load.storedAt ? ' at ' + v.esc(new Date(v.load.storedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })) : '') + '</li>'
        + (last ? '<li>' + icon('save') + ' Last temperature saved <span class="dpill">' + v.esc(v.dmy(last.slice(0, 10))) + '</span> ' + v.esc(last.slice(11, 16)) + '</li>' : '')
        + '<li>' + mark(v.sinkOn()) + ' Saving here: <b>' + (v.sinkOn() ? 'on' : 'off') + '</b></li></ul>'
        + (miss.length ? '<details><summary class="mut">Not set up yet (' + miss.length + ')</summary><p class="mut">' + miss.map(v.esc).join(', ') + '</p></details>' : '')
        + '<p class="mut">Script version, last backup, errors: coming.</p>';
    }
    return '';
  }
  function mark(ok) { return ok ? '<span class="adm-ok" aria-label="on">✓</span>' : '<span class="adm-no" aria-label="off">–</span>'; }
  function sub(v, id) {
    var u = !!scriptUrl();
    if (id === 'phone') return u ? 'Show QR · ' + v.esc(location.host) : 'Needs a save address';
    if (id === 'saving') return v.sinkOn() ? 'Saving on ✓' : 'Saving off';
    if (id === 'staff') { var n = rows(v.T, 'BLD-role.csv').filter(function (r) { return r.code; }).length; return n ? n + ' roles' : 'Steps'; }
    if (id === 'visitor') return 'Ends by itself';
    if (id === 'inspect') { var o = rows(v.T, 'BLD-inspect_link.csv').filter(function (r) { return String(r.ends || '').slice(0, 10) >= v.today; }).length; return o ? o + ' open' : 'None open'; }
    if (id === 'lost') return 'Stop a code';
    if (id === 'print') return 'Rooms · dogs · litters';
    if (id === 'rules') { var k = {}; rows(v.T, 'BLD-breeding_rule.csv').forEach(function (r) { if (r.rule_key) k[r.rule_key] = 1; }); return Object.keys(k).length + ' rules'; }
    if (id === 'records') return rows(v.T, 'BLD-retention_setting.csv').length ? 'Per section' : 'Coming';
    if (id === 'health') return v.load.state === 'ok' ? 'Read ✓' : 'Problem';
    return '';
  }

  function futureHtml(v) {
    if (!S.future && !S.futureErr) {
      S.future = 'loading';
      fetch('admin-future.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
        .then(function (j) { S.future = j && j.jobs || []; v.rerender(); })
        .catch(function () { S.future = null; S.futureErr = 'The list did not load.'; v.rerender(); });
    }
    var J = Array.isArray(S.future) ? S.future : [], shown = S.futureAll ? J : J.slice(0, 8);
    var tag = function (e) { return e === 'yes' ? '<span class="adm-ok">✓ here</span>' : (e === 'part' ? '<span class="pill">part</span>' : '<span class="mut">coming</span>'); };
    return '<section class="card adm-line l0" id="admFuture"><details class="compfold" data-adm-fold="future"' + (S.futureShut ? '' : ' open') + '><summary><h3>' + icon('future', 'c0') + 'Next 3 years' + (J.length ? ' <span class="cnt wide">' + J.length + '</span>' : '') + '</h3></summary>'
      + (S.futureErr ? '<p class="mut">' + v.esc(S.futureErr) + '</p>' : (!J.length ? '<p class="mut">Loading…</p>'
        : '<ul class="adm-future">' + shown.map(function (j) {
          return '<li><span>' + v.esc(j.job) + '</span><em>' + v.esc(j.often) + '</em>' + tag(j.exists) + '</li>';
        }).join('') + '</ul>' + (J.length > 8 ? '<p><button type="button" class="cb" data-adm-future="1">' + (S.futureAll ? 'Show fewer' : 'Show all ' + J.length) + '</button></p>' : '')))
      + '<p class="mut">Most often first. Laws to check are on each job’s card when it is built.</p></details></section>';
  }

  function page(v) {
    if (!on(v.T)) return '<h2>Admin</h2><div class="card"><p class="mut">Only the owner sees Admin.</p></div>';
    var groups = [], seen = {};
    CARDS.forEach(function (c) { if (!seen[c[4]]) { seen[c[4]] = 1; groups.push(c[4]); } });
    var html = '<h2 class="adm-h">' + icon('shield') + ' Admin <span class="adm-lock">Only you</span></h2>';
    groups.forEach(function (g) {
      html += '<h3 class="adm-g">' + g + '</h3><div class="adm-grid">' + CARDS.filter(function (c) { return c[4] === g; }).map(function (c) {
        var open = S.open === c[0];
        return '<button type="button" class="adm-card adm-line l' + c[3] + (open ? ' sel' : '') + (c[0] === 'phone' ? ' adm-hero' : '') + '" data-adm-open="' + c[0] + '" aria-expanded="' + open + '">'
          + icon(c[2], 'c' + c[3]) + '<span>' + v.esc(c[1]) + '</span><small>' + sub(v, c[0]) + '</small></button>';
      }).join('') + '</div>';
      var o = CARDS.filter(function (c) { return c[4] === g && c[0] === S.open; })[0];
      if (o) html += '<section class="card adm-line l' + o[3] + ' adm-body" id="adm-' + o[0] + '"><h3>' + icon(o[2], 'c' + o[3]) + v.esc(o[1]) + '</h3>' + body(v, o[0]) + '</section>';
      if (g === 'People') html += mapHtml(v);
    });
    return html + futureHtml(v);
  }

  var bound = false;
  function bind(v) {
    AdminView._v = v;
    if (bound) return; bound = true;
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-adm-open],[data-adm-aud],[data-adm-cell],[data-adm-qr],[data-adm-future]');
      if (!t || !AdminView._v) return;
      var d = t.dataset;
      if (d.admOpen) { S.open = S.open === d.admOpen ? '' : d.admOpen; if (S.open !== 'phone') S.qr = false; }
      else if (d.admAud) { S.aud = S.aud === d.admAud ? '' : d.admAud; S.mapShut = false; }
      else if (d.admCell) S.cell = S.cell === d.admCell ? '' : d.admCell;
      else if (d.admQr) S.qr = !S.qr;
      else if (d.admFuture) S.futureAll = !S.futureAll;
      var keep = d.admOpen ? 'adm-' + S.open : (d.admAud || d.admCell ? 'admMap' : '');
      AdminView._v.rerender();
      var el = keep && document.getElementById(keep); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
    });
    document.addEventListener('toggle', function (e) {
      var d = e.target && e.target.dataset; if (!d || !d.admFold) return;
      if (d.admFold === 'map') S.mapShut = !e.target.open; else S.futureShut = !e.target.open;
    }, true);
  }
  return { FILES: FILES, on: on, page: page, bind: bind, access: access, _state: S };
}());
