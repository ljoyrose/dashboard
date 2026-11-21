/*!
 * Temperatures report: "Print / Save as PDF" (Lisa 18 Nov 2026: "PDF A and B and also both month and year - all options
 * selectable by user"). The person picks the period (one month, or a whole year) and what goes in:
 *   B  Summary: one small calendar per room, a day green when every slot was read inside its limit, solid orange when a
 *      reading was outside, an orange frame when a slot was missed. No numbers: the month at a glance.
 *   A  Room table: rooms down the side, days across, AM and PM rows, lowest over highest in each cell. Outside-limit
 *      readings carry "!", missed slots say MISS, so it reads in black and white too. A foot lists every outside reading
 *      with what was done, and the totals.
 * Uses the Temperatures page's own day rules (dayRooms / slotState), so the paper and the screen always agree.
 * The browser's print makes the PDF (Save as PDF), so nothing is sent anywhere. Every room comes from the records.
 */
(function () {
  'use strict';
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var READ = { in: 1, out: 1, nolimit: 1, eout: 1, swap: 1, warm: 1, nospot: 1 };

  function e(s) { return window.esc ? window.esc(s) : String(s || ''); }
  function days(y, m) { var n = window.mdays(y)[m], out = []; for (var d = 1; d <= n; d++) out.push(window.ds(y, m, d)); return out; }

  /** One month: {rooms:[{aid, name, days:{iso:{am,pm}}}], totals, outside:[...]}, all from the page's day rules. */
  function monthData(y, m) {
    var rooms = {}, order = [], t = { read: 0, miss: 0, out: 0, empty: 0 }, outside = [];
    days(y, m).forEach(function (iso) {
      if (iso > window.TODAY_STR) return;
      window.dayRooms(iso).forEach(function (x) {
        if (!rooms[x.aid]) { rooms[x.aid] = { aid: x.aid, name: String(x.name || '').replace(/ \(from [^)]+\)$/, ''), days: {} }; order.push(x.aid); }
        rooms[x.aid].days[iso] = { am: x.am, pm: x.pm };
        [['AM', x.am], ['PM', x.pm]].forEach(function (p) {
          var s = p[1];
          if (READ[s.k]) t.read++;
          if (s.k === 'miss') t.miss++;
          if (s.k === 'empty' || s.empty) t.empty++;
          if (s.k === 'out' || s.k === 'swap') { t.out++; outside.push({ iso: iso, room: rooms[x.aid].name, slot: p[0], lo: s.lo, hi: s.hi, note: s.note || '', why: s.k === 'swap' ? (s.unread ? 'not a number' : 'max lower than min') : '' }); }
        });
      });
    });
    return { y: y, m: m, rooms: order.map(function (a) { return rooms[a]; }), totals: t, outside: outside };
  }

  /* a day for one room, for the summary: done (all read inside), out, miss, part (some read, rest due), none */
  function dayState(dd) {
    if (!dd) return 'none';
    var k = [dd.am.k, dd.pm.k];
    if (k.some(function (x) { return x === 'out' || x === 'swap'; })) return 'out';
    if (k.some(function (x) { return x === 'miss'; })) return 'miss';
    if (k.every(function (x) { return x === 'none'; })) return 'none';
    return 'done';
  }

  function head(title, sub) {
    return '<div class="rp-head"><b>' + e(title) + '</b><span>' + e(sub) + '</span></div>';
  }
  function foot() {
    var d = new Date(), when = d.getDate() + ' ' + MON[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
    return '<div class="rp-foot"><span>Printed ' + e(when) + '</span><span>Checked by ______________________ &nbsp; Signed ______________________</span></div>';
  }

  /** B: one small calendar per room for the month. */
  function summaryPage(md) {
    var y = md.y, m = md.m, lead = (new Date(y, m, 1).getDay() + 6) % 7;
    var h = '<section class="rp-page" data-rp="summary" data-month="' + y + '-' + (m < 9 ? '0' : '') + (m + 1) + '">'
      + head('Room temperatures: summary', MON[m] + ' ' + y);
    if (!md.rooms.length) return h + '<p>No room readings were needed or taken this month.</p>' + foot() + '</section>';
    h += '<p class="rp-key"><i class="rk done">✓</i> every reading inside its limit &nbsp; <i class="rk out">!</i> a reading outside its limit &nbsp; <i class="rk miss">✗</i> a reading missed</p><div class="rp-cals">';
    md.rooms.forEach(function (r) {
      h += '<div class="rp-cal" data-room="' + e(r.aid) + '"><b>' + e(r.name) + '</b><div class="rp-g">'
        + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (w) { return '<span class="rh">' + w + '</span>'; }).join('');
      for (var i = 0; i < lead; i++) h += '<span></span>';
      days(y, m).forEach(function (iso) {
        var st = iso > window.TODAY_STR ? 'none' : dayState(r.days[iso]);
        h += '<span class="rd ' + st + '">' + (st === 'done' ? '✓' : st === 'out' ? '!' : st === 'miss' ? '✗' : +iso.slice(8)) + '</span>';
      });
      h += '</div></div>';
    });
    return h + '</div>' + totalsLine(md) + foot() + '</section>';
  }

  function cell(s) {
    if (!s || s.k === 'none' || s.k === 'due') return '<td></td>';
    if (s.k === 'miss') return '<td class="miss">MISS</td>';
    if (s.k === 'empty') return '<td class="empty">empty</td>';
    var bad = s.k === 'out' || s.k === 'swap';
    return '<td class="' + (bad ? 'out' : 'in') + '">' + e(s.lo || '–') + '<br>' + e(s.hi || '–') + (bad ? ' !' : '') + '</td>';
  }

  /** A: rooms down the side, days across, AM and PM rows. */
  function tablePage(md) {
    var y = md.y, m = md.m, ds = days(y, m);
    var h = '<section class="rp-page" data-rp="table" data-month="' + y + '-' + (m < 9 ? '0' : '') + (m + 1) + '">'
      + head('Room temperatures °C: lowest over highest', MON[m] + ' ' + y);
    if (!md.rooms.length) return h + '<p>No room readings were needed or taken this month.</p>' + foot() + '</section>';
    h += '<table class="rp-t"><thead><tr><th>Room</th><th></th>' + ds.map(function (iso) { return '<th>' + (+iso.slice(8)) + '</th>'; }).join('') + '</tr></thead><tbody>';
    md.rooms.forEach(function (r) {
      ['am', 'pm'].forEach(function (slot, i) {
        h += '<tr' + (i ? ' class="pm"' : '') + '>' + (i ? '' : '<th rowspan="2">' + e(r.name) + '</th>') + '<th class="sl">' + slot.toUpperCase() + '</th>'
          + ds.map(function (iso) { var dd = r.days[iso]; return cell(dd && dd[slot]); }).join('') + '</tr>';
      });
    });
    h += '</tbody></table>' + totalsLine(md);
    if (md.outside.length) {
      h += '<div class="rp-out"><b>Outside the limit, and what was done</b><ul>' + md.outside.map(function (o) {
        return '<li>' + e(+o.iso.slice(8) + ' ' + MON[m].slice(0, 3)) + ' · ' + e(o.room) + ' · ' + o.slot + ' ' + e((o.lo || '–') + '–' + (o.hi || '–'))
          + (o.why ? ' (' + e(o.why) + ')' : '') + ' · ' + (o.note ? e(o.note) : '<i>nothing recorded</i>') + '</li>';
      }).join('') + '</ul></div>';
    }
    return h + foot() + '</section>';
  }

  function totalsLine(md) {
    var t = md.totals;
    return '<p class="rp-tot" data-rp-totals>Readings taken: <b>' + t.read + '</b> · missed: <b>' + t.miss + '</b> · outside the limit: <b>' + t.out + '</b>'
      + (t.empty ? ' · room empty: <b>' + t.empty + '</b>' : '') + '</p>';
  }

  /** The report for the choice: {period:'month'|'year', year, month (0-11), summary:bool, table:bool}. */
  function build(o) {
    var months = o.period === 'year' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [o.month];
    var h = '';
    months.forEach(function (m) {
      if (window.ds(o.year, m, 1) > window.TODAY_STR) return;   // a month that has not started yet: no empty pages
      var md = monthData(o.year, m);
      if (o.summary) h += summaryPage(md);
      if (o.table) h += tablePage(md);
    });
    return h || '<section class="rp-page"><p>Nothing to print for that choice.</p></section>';
  }

  var CSS = '#rpPanel{position:fixed;inset:auto 0 0 0;z-index:60;background:var(--card);border-top:1px solid var(--line);padding:16px;display:grid;gap:10px;max-width:640px;margin:0 auto;border-radius:16px 16px 0 0;box-shadow:0 -4px 16px color-mix(in srgb,var(--ink) 15%,transparent)}'
    + '#rpPanel[hidden]{display:none}#rpPanel fieldset{border:1px solid var(--line);border-radius:12px;padding:8px 12px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}'
    + '#rpPanel label{display:flex;align-items:center;gap:6px;min-height:40px}#rpPanel select{min-height:40px}#rpPanel .row{display:flex;gap:8px;flex-wrap:wrap}'
    + '#report{display:none}'
    + '@media print{@page{size:A4 landscape;margin:8mm}html,body.rp-printing{background:none!important}body.rp-printing>*:not(#report){display:none!important}body.rp-printing #report{display:block}'
    + '#report{color:var(--ink);font:9px/1.25 system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.rp-page{page-break-after:always;break-after:page}.rp-head{display:flex;justify-content:space-between;font-size:13px;border-bottom:1px solid var(--ink);margin-bottom:4px}'
    + '.rp-foot{display:flex;justify-content:space-between;margin-top:6px;font-size:8px}.rp-tot{margin:4px 0}'
    + '.rp-t{width:100%;border-collapse:collapse;table-layout:fixed}.rp-t th,.rp-t td{border:0.5px solid var(--line);padding:0 1px;text-align:center;font-size:6.5px;line-height:1.15;overflow:hidden}'
    + '.rp-t thead th{font-size:7px}.rp-t tbody th{text-align:left;font-size:7px}.rp-t th:first-child{width:22mm}.rp-t .sl{width:6mm}'
    + '.rp-t td.in{background:var(--ljr-5-tint)}.rp-t td.out{background:var(--ljr-3);color:var(--ink);font-weight:700}.rp-t td.miss{outline:1.5px solid var(--ljr-3);outline-offset:-1.5px;font-weight:700}.rp-t td.empty{color:var(--muted)}'
    + '.rp-out ul{margin:2px 0 0 14px;padding:0}.rp-cals{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.rp-cal b{display:block;font-size:8px}'
    + '.rp-g{display:grid;grid-template-columns:repeat(7,1fr);gap:1px}.rp-g span{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:6px}'
    + '.rp-g .rh{aspect-ratio:auto;color:var(--muted)}.rd.none{color:var(--muted)}.rd.done{background:var(--ljr-5);color:var(--paper)}.rd.out{background:var(--ljr-3);font-weight:700}.rd.miss{outline:1.5px solid var(--ljr-3);outline-offset:-1.5px;font-weight:700}'
    + '.rk{display:inline-block;width:10px;text-align:center;font-style:normal}.rk.done{background:var(--ljr-5);color:var(--paper)}.rk.out{background:var(--ljr-3)}.rk.miss{outline:1.5px solid var(--ljr-3)}}';

  function panel() {
    var p = document.getElementById('rpPanel');
    if (p) return p;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var rep = document.createElement('div'); rep.id = 'report'; document.body.appendChild(rep);
    p = document.createElement('div'); p.id = 'rpPanel'; p.hidden = true; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Print or save as PDF');
    var y = parseInt(window.TODAY_STR.slice(0, 4), 10), m = parseInt(window.TODAY_STR.slice(5, 7), 10) - 1;
    var years = [y, y - 1, y - 2].map(function (v) { return '<option value="' + v + '">' + v + '</option>'; }).join('');
    p.innerHTML = '<b>Print or save as PDF</b>'
      + '<fieldset><legend>Period</legend><label><input type="radio" name="rpPeriod" value="month" checked> One month</label>'
      + '<label><input type="radio" name="rpPeriod" value="year"> Whole year</label>'
      + '<select id="rpMonth" aria-label="Month">' + MON.map(function (n, i) { return '<option value="' + i + '"' + (i === m ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>'
      + '<select id="rpYear" aria-label="Year">' + years + '</select></fieldset>'
      + '<fieldset><legend>Include</legend><label><input type="checkbox" id="rpSummary" checked> Summary calendars</label>'
      + '<label><input type="checkbox" id="rpTable" checked> Room tables with readings</label></fieldset>'
      + '<p class="mut" id="rpMsg">In the print window choose "Save as PDF" to keep a copy.</p>'
      + '<div class="row"><button type="button" class="btn" id="rpGo">Print / Save as PDF</button><button type="button" class="btn quiet" id="rpClose">Close</button></div>';
    document.body.appendChild(p);
    var monthSel = p.querySelector('#rpMonth');
    p.addEventListener('change', function () { monthSel.disabled = p.querySelector('input[name="rpPeriod"]:checked').value === 'year'; });
    p.querySelector('#rpClose').onclick = function () { p.hidden = true; };
    p.querySelector('#rpGo').onclick = function () {
      var o = choice();
      if (!o.summary && !o.table) { p.querySelector('#rpMsg').textContent = 'Tick at least one: summary calendars or room tables.'; return; }
      rep.innerHTML = build(o);
      document.body.classList.add('rp-printing');
      window.print();
    };
    window.addEventListener('afterprint', function () { document.body.classList.remove('rp-printing'); });
    return p;
  }
  function choice() {
    var p = document.getElementById('rpPanel');
    return { period: p.querySelector('input[name="rpPeriod"]:checked').value, year: parseInt(p.querySelector('#rpYear').value, 10),
      month: parseInt(p.querySelector('#rpMonth').value, 10), summary: p.querySelector('#rpSummary').checked, table: p.querySelector('#rpTable').checked };
  }

  window.TempsReport = { open: function () { var p = panel(); p.hidden = false; p.querySelector('#rpGo').focus(); }, build: build, monthData: monthData };
}());
