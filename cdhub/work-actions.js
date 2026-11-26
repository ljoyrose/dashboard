/*!
 * CDWork: Done, Reassign and Snooze on every waiting row (the owner 19 Nov 2026: "I had to put screws in but nothing to reassign
 * or say done to take it off ... things like screws done same day as due stay there forever").
 *
 * Nothing in BLD-WORK is changed or deleted. Each tap adds one dated owner row to BLD-requirement (the shared need-row list),
 * pointing at the work row: target_table 'work', target_id the W number, from_date today, set_by and set_on stamped by the
 * save script, and a source saying what was done.
 *   work.done          the item is done from from_date: it leaves both waiting lists.
 *   work.owner.<who>   it now waits on <who> (the owner = Waiting on you; anyone else = Waiting on me, with the name shown).
 *   work.snooze        hidden from from_date to to_date (both included), then it comes back by itself.
 * The newest row wins (set_on, then from_date). A snooze only counts while its dates cover today.
 * What Reassign and Snooze offer are owner setting rows in BLD-breeding_rule (dated, newest in force wins):
 *   work.reassign.to    e.g. the owner|Claude|Staff
 *   work.snooze.days    e.g. 1|7|30
 * The values below are only the starting defaults.
 * Works in a browser (window.CDWork) and in Node (module.exports) so the rules can be tested.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CDWork = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var START = { 'work.reassign.to': 'Lisa|Claude|Staff', 'work.snooze.days': '1|7|30' };
  var S = { open: '', msg: {} };

  function t(x) { return String(x == null ? '' : x).trim(); }
  function day(x) { var s = t(x).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function addDays(iso, n) { var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  /** An owner setting row in force today (newest from date wins), else the starting default. Returns a list. */
  function setting(rules, key, today) {
    var best = null;
    (rules || []).forEach(function (r) {
      if (r.rule_key !== key) return;
      var f = day(r.effective_from || r.from_date), to = day(r.to_date || r.effective_to);
      if ((f && f > today) || (to && to < today) || !t(r.value)) return;
      if (!best || f >= best.f) best = { f: f, v: t(r.value) };
    });
    return (best ? best.v : START[key]).split('|').map(t).filter(Boolean);
  }

  /** The work rows with their actions applied: status DONE, a new owner, or SNOOZED (with until). Pure. */
  function apply(work, req, today) {
    var acts = {};
    (req || []).forEach(function (r) {
      if (t(r.target_table) !== 'work' || !t(r.target_id) || !/^work\./.test(t(r.need_type))) return;
      var f = day(r.from_date);
      if (!f || f > today) return;
      (acts[t(r.target_id)] = acts[t(r.target_id)] || []).push(r);
    });
    return (work || []).map(function (w) {
      var list = acts[t(w.id)];
      if (!list) return w;
      list = list.slice().sort(function (a, b) {
        var x = t(a.set_on) || day(a.from_date), y = t(b.set_on) || day(b.from_date);
        return x < y ? -1 : x > y ? 1 : 0;
      });
      var o = Object.assign({}, w), snooze = '';
      list.forEach(function (r) {
        var n = t(r.need_type);
        if (n === 'work.done') { o.status = 'DONE'; o.done_on = day(r.from_date); snooze = ''; }
        else if (n.indexOf('work.owner.') === 0) {
          o.owner = n.slice(11); o.status = o.owner === 'Lisa' ? 'BLOCKED' : 'OPEN';
          o.blocked_on = o.owner === 'Lisa' ? (o.blocked_on || 'Waiting on you') : 'Waiting on ' + o.owner;
          snooze = '';
        } else if (n === 'work.snooze') {
          var to = day(r.to_date);
          snooze = to && to >= today ? to : '';
        }
      });
      if (o.status !== 'DONE' && o.status !== 'DROPPED' && snooze) { o.was = o.status; o.status = 'SNOOZED'; o.snooze_until = snooze; }
      return o;
    });
  }

  /** The buttons under one waiting row. v: {esc, canWrite, rules, today, dmy}. */
  function rowActions(r, v) {
    var id = v.esc(r.id), m = S.msg[r.id];
    if (!v.canWrite()) return '<div class="wk-acts"><span class="mut">To mark done, reassign or snooze, set up saving on this device first.</span></div>';
    var h = '<div class="wk-acts" data-wk="' + id + '">'
      + '<button type="button" class="btn yes" data-wk-done="' + id + '">Done</button> '
      + '<button type="button" class="btn" data-wk-open="re:' + id + '" aria-expanded="' + (S.open === 're:' + r.id) + '">Reassign</button> '
      + '<button type="button" class="btn" data-wk-open="sn:' + id + '" aria-expanded="' + (S.open === 'sn:' + r.id) + '">Snooze</button>';
    if (S.open === 're:' + r.id) {
      h += '<div class="filt">' + setting(v.rules, 'work.reassign.to', v.today).filter(function (w) { return w !== r.owner; }).map(function (w) {
        return '<button type="button" class="btn" data-wk-to="' + v.esc(w) + '" data-wk-id="' + id + '">' + v.esc(w) + '</button>';
      }).join(' ') + ' <button type="button" class="btn" data-wk-open="">Cancel</button></div>';
    }
    if (S.open === 'sn:' + r.id) {
      h += '<div class="filt">' + setting(v.rules, 'work.snooze.days', v.today).filter(function (d) { return /^\d+$/.test(d) && +d > 0; }).map(function (d) {
        return '<button type="button" class="btn" data-wk-days="' + v.esc(d) + '" data-wk-id="' + id + '">' + (d === '1' ? '1 day' : v.esc(d) + ' days') + '</button>';
      }).join(' ') + ' <button type="button" class="btn" data-wk-open="">Cancel</button></div>';
    }
    if (m) h += '<p role="status" data-wk-msg>' + v.saveHtml(m) + '</p>';
    return h + '</div>';
  }

  /** Wire the buttons on the Outstanding page. v: {sinkPost, bbSaved, showSave, remember, redraw, today, esc}. */
  function bind(main, v) {
    if (!main || main.dataset.wkBound) return;
    main.dataset.wkBound = '1';
    main.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-wk-open],[data-wk-done],[data-wk-to],[data-wk-days]');
      if (!b || !main.contains(b)) return;
      if (b.hasAttribute('data-wk-open')) { S.open = b.getAttribute('data-wk-open') === S.open ? '' : b.getAttribute('data-wk-open'); v.redraw(); return; }
      var id = b.getAttribute('data-wk-done') || b.getAttribute('data-wk-id'), today = v.today;
      var fields, said;
      if (b.hasAttribute('data-wk-done')) { fields = { need_type: 'work.done', from_date: today, source: 'Marked done on Outstanding' }; said = 'done'; }
      else if (b.hasAttribute('data-wk-to')) { var who = b.getAttribute('data-wk-to'); fields = { need_type: 'work.owner.' + who, from_date: today, source: 'Reassigned on Outstanding' }; said = 'now with ' + who; }
      else { var n = +b.getAttribute('data-wk-days'), until = addDays(today, n); fields = { need_type: 'work.snooze', from_date: today, to_date: until, source: 'Snoozed on Outstanding' }; said = 'snoozed to ' + v.dmy(until); }
      fields.target_table = 'work'; fields.target_id = id;
      var box = b.closest('[data-wk]');
      box.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
      v.showSave(box, 'Saving…');
      v.sinkPost('requirement', fields).then(function (j) {
        var res = v.bbSaved(j);
        v.remember(Object.assign({ id: res.id || '', set_on: new Date().toISOString() }, fields));
        var text = 'Saved ' + new Date().toTimeString().slice(0, 5) + '. ' + id + ': ' + said + '.';
        S.open = ''; S.msg[id] = text;
        v.showSave(box, text);
        setTimeout(v.redraw, 900);
      }).catch(function (err) {
        box.querySelectorAll('button').forEach(function (x) { x.disabled = false; });
        var why = String(err && err.message || err).replace(/^Not saved:\s*/, '').replace(/[.\s]*$/, '');
        v.showSave(box, 'Not saved: ' + why + '. Nothing changed; try again.');
      });
    });
  }

  /** The ticks for saves whose row has now left the list (done, snoozed, moved), newest first. */
  function notes(v, shown) {
    return Object.keys(S.msg).filter(function (id) { return !shown[id]; }).map(function (id) {
      return '<p role="status" data-wk-note>' + v.saveHtml(S.msg[id]) + '</p>';
    }).join('');
  }

  return { apply: apply, setting: setting, rowActions: rowActions, bind: bind, notes: notes, START: START, _state: S };
}));
