/*!
 * BLDJobCal - one month calendar per daily job (Lisa 17 Nov 2026: "make a calendar view which will help the user, simple
 * to use and log all done so staff or user say done then it shows as green"). The same look as the Temperatures page:
 * green with a tick = done that day, orange frame = missed, part done = orange frame with how many. Which jobs have a
 * calendar, and in what order, is the owner's: rows compliance.calendar.<type_key> (value = place 1, 2, 3...; 0 or off =
 * hidden), dated by effective_from. No rows = the starter list. Nothing here names a job beyond that starter list.
 * Needs BLDDue. Reads and draws only; the page saves.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./staff/lib/due.js'));
  else root.BLDJobCal = factory(root.BLDDue);
}(typeof self !== 'undefined' ? self : this, function (Due) {
  'use strict';

  /* the stop-gap until the owner has calendar rows (Lisa 17 Nov 2026: health checks, bowls washed, site cleaned) */
  var STARTER = ['health_check_all', 'food_bowls', 'water_bowls', 'whole_site_clean'];
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SKIP = { not_done: 1, note: 1, part_done: 1 };

  function inForce(r, day) { return r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day); }

  /** The type_keys to draw, in the owner's order. */
  function chosen(v) {
    var best = {};
    (v.rules || []).forEach(function (r) {
      var m = /^compliance\.calendar\.(.+)$/.exec(String(r.rule_key || ''));
      if (m && inForce(r, v.today) && (!best[m[1]] || r.effective_from > best[m[1]].effective_from)) best[m[1]] = r;
    });
    var keys = Object.keys(best);
    if (!keys.length) return STARTER.filter(function (k) { return !!typeOf(v, k); });
    return keys.map(function (k) { return { k: k, n: parseInt(best[k].value, 10) }; })
      .filter(function (x) { return x.n > 0 && typeOf(v, x.k); })
      .sort(function (a, b) { return a.n - b.n; }).map(function (x) { return x.k; });
  }

  /** The job row in force today for a type_key (the newest effective_from on or before today, switched on). */
  function typeOf(v, key) {
    var best = null;
    (v.types || []).forEach(function (r) { if (r.type_key === key && r.effective_from && r.effective_from <= v.today && (!best || r.effective_from > best.effective_from)) best = r; });
    return best && String(best.active).toLowerCase() !== 'false' ? best : null;
  }

  /** London day -> {dogs:{id:1}, n, lines:[{by, at}]} for every done record of this job (all its versions). */
  function days(v, key) {
    var ids = {}, replaced = {}, out = {};
    (v.types || []).forEach(function (r) { if (r.type_key === key) ids[r.id] = 1; });
    (v.logs || []).forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = 1; });
    (v.logs || []).forEach(function (l) {
      if (!ids[l.check_type_id] || replaced[l.id] || SKIP[l.outcome] || String(l.how_recorded || '') === 'owner_note') return;
      var d = Due.londonDate(l.happened_at || l.taken_at); if (!d) return;
      var x = out[d] = out[d] || { dogs: {}, n: 0, lines: [] };
      if (l.subject_id) x.dogs[l.subject_id] = 1;
      x.n++; x.lines.push({ by: l.taken_by || '', at: l.happened_at || l.taken_at || '' });
    });
    return out;
  }

  /** One month for one job: {key, label, ym, first, need, cells:[{iso, day, state, got, need}]}. State: done, part,
      missed, due (today, not yet), future, before (before this job's first record: not tracked here), blank (padding). */
  function month(v, key, ym) {
    var t = typeOf(v, key); if (!t) return null;
    var perDog = Due.perDogSite(t), need = perDog ? Due.dogsFor(t, { dogs: v.dogs || [] }).length : 1;
    var d = days(v, key), first = Object.keys(d).sort()[0] || '';
    var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10);
    var len = new Date(Date.UTC(y, m, 0)).getUTCDate(), lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push({ state: 'blank' });
    for (var dd = 1; dd <= len; dd++) {
      var iso = ym + '-' + (dd < 10 ? '0' : '') + dd, x = d[iso], got = x ? (perDog ? Object.keys(x.dogs).length : x.n) : 0;
      var state = iso > v.today ? 'future' : (got && (!perDog || got >= need)) ? 'done' : got ? 'part' : iso === v.today ? 'due' : (!first || iso < first) ? 'before' : 'missed';
      cells.push({ iso: iso, day: dd, state: state, got: got, need: perDog ? need : 0, lines: x ? x.lines : [] });
    }
    return { key: key, label: t.label || key, ym: ym, first: first, perDog: perDog, need: need, typeId: t.id, cells: cells };
  }

  var WORD = { done: 'done', part: 'part done', missed: 'missed', due: 'due today', future: '', before: 'not tracked yet' };
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>';

  /** The calendars for one month, with a "Done today" button on each job not yet done today (when the page can save). */
  function html(v, ym, canSave) {
    var e = v.esc, keys = chosen(v);
    var mm = parseInt(ym.slice(5, 7), 10), title = MON[mm - 1] + ' ' + ym.slice(0, 4);
    var prev = shift(ym, -1), next = shift(ym, 1), atNow = ym >= v.today.slice(0, 7);
    var h = '<section class="card jcal-wrap" id="jobCals"><div class="jcal-head"><h3>Daily records</h3><div class="jcal-nav">'
      + '<button class="btn quiet" type="button" data-jcal-month="' + prev + '" aria-label="Previous month">‹</button><b data-jcal-title>' + e(title) + '</b>'
      + '<button class="btn quiet" type="button" data-jcal-month="' + next + '" aria-label="Next month"' + (atNow ? ' disabled' : '') + '>›</button></div></div>'
      + '<p class="mut jcal-key"><span class="jd done">' + TICK + '</span> done <span class="jd part"></span> part done <span class="jd missed"></span> missed</p>';
    if (!keys.length) return h + '<p class="mut">No calendars chosen. Add rows compliance.calendar.&lt;job&gt; in Settings.</p></section>';
    h += '<div class="jcal-grid">' + keys.map(function (k) {
      var c = month(v, k, ym); if (!c) return '';
      var today = c.cells.filter(function (x) { return x.iso === v.today; })[0];
      var doneToday = today && today.state === 'done';
      return '<div class="jcal" data-jcal="' + e(k) + '"><div class="jcal-t"><b>' + e(c.label) + '</b>'
        + (today ? (doneToday ? '<span class="jcal-ok">' + TICK + ' Done today</span>'
          : canSave ? '<button class="btn" type="button" data-jcal-done="' + e(k) + '">' + (today.state === 'part' ? 'Mark all done' : 'Done today') + '</button>' : '') : '')
        + '</div><div class="jdays">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (w) { return '<span class="jdh">' + w + '</span>'; }).join('')
        + c.cells.map(function (x) {
          if (x.state === 'blank') return '<span class="jd blank"></span>';
          var who = x.lines.length ? ' · ' + x.lines.map(function (l) { return l.by; }).filter(Boolean).filter(function (b, i, a) { return a.indexOf(b) === i; }).join(', ') : '';
          var part = x.state === 'part' && x.need ? ' (' + x.got + ' of ' + x.need + ')' : '';
          var label = (v.dmy ? v.dmy(x.iso) : x.iso) + (WORD[x.state] ? ': ' + WORD[x.state] : '') + part + who;
          return '<span class="jd ' + x.state + (x.iso === v.today ? ' today' : '') + '" data-day="' + x.iso + '" title="' + e(label) + '" aria-label="' + e(label) + '" role="img">'
            + (x.state === 'done' ? TICK : '<i>' + x.day + '</i>') + '</span>';   // the date in every square but a done one (its tick); part done says how many in its label
        }).join('') + '</div></div>';
    }).join('') + '</div>';
    return h + '</section>';
  }
  function shift(ym, n) { var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + (m < 9 ? '0' : '') + (m + 1); }

  /** What the page sends for "Done today": one whole-site save; a per-dog job lists every dog it covers. */
  function doneFields(v, key) {
    var t = typeOf(v, key); if (!t) return null;
    var f = { check_type_id: t.id, outcome: String(t.asks_outcome).toLowerCase() === 'false' ? 'recorded' : 'ok', how_recorded: 'site_tap' };
    if (Due.perDogSite(t)) f.dog_ids = Due.dogsFor(t, { dogs: v.dogs || [] }).map(function (d) { return d.id; }).join('|');
    return f;
  }

  var CSS = '.jcal-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.jcal-nav{display:flex;align-items:center;gap:8px}'
    + '.jcal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.jcal{border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--card)}'
    + '.jcal-t{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;margin-bottom:6px}.jcal-ok{display:inline-flex;align-items:center;gap:4px;color:var(--ink);font-weight:700}'
    + '.jcal-ok svg,.jd svg{width:16px;height:16px}.jdays{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.jdh{font-size:10px;color:var(--muted);text-align:center}'
    + '.jd{aspect-ratio:1;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);font-size:10px;color:var(--ink)}'
    + '.jd.blank{background:transparent;box-shadow:none}.jd.future,.jd.before{opacity:.4}.jd.done{background:var(--ljr-5);box-shadow:none;color:var(--ljr-paper,#fff)}'
    + '.jd.part,.jd.missed{box-shadow:inset 0 0 0 2px var(--ljr-3)}.jd.due{box-shadow:inset 0 0 0 2px var(--line)}.jd.today{outline:2px solid var(--ink);outline-offset:-2px}'
    + '.jd i{font-style:normal;color:var(--muted)}.jd.part i,.jd.missed i,.jd.due i{color:var(--ink);font-weight:700}.jcal-key{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.jcal-key .jd{width:18px;height:18px;aspect-ratio:auto}';

  return { STARTER: STARTER, chosen: chosen, month: month, html: html, doneFields: doneFields, shift: shift, CSS: CSS };
}));
