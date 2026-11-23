/*!
 * Jobs: the buttons after a scan, and today's whole-site list. Every job is a BLD-check_type row the owner entered:
 * nothing here names a job or a place. A scan only opens this screen; it says nothing about who was there.
 * Until the rows, the list or the saving are switched on, a scan goes on to Move dogs exactly as before.
 */
(function () {
  'use strict';
  var RANK = { late: 0, never: 1, today: 2, as_needed: 3, ok: 4 }, REPORT_KEY = 'report', ctx0 = StaffPage.ctx;

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /* "2 Mar 2026" on every screen, staff and owner (Lisa 13/11) */
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso)); return m && MON[+m[2] - 1] ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : iso; }
  function dueLine(j) {
    if (j.status === 'late') return j.days_late === 1 ? '1 day late' : j.days_late + ' days late';
    if (j.status === 'today') return j.times_per_day > 1 ? 'Due today: ' + (j.done_today || 0) + ' of ' + j.times_per_day : 'Due today';
    if (j.status === 'never') return 'Due';
    if (j.status === 'ok') return 'Next ' + dmy(j.next_due);
    return 'As needed';
  }
  function isDue(j) { return j.status === 'late' || j.status === 'today' || j.status === 'never'; }
  function byRank(a, b) { return (RANK[a.status] - RANK[b.status]) || String(a.label).localeCompare(String(b.label)); }
  /* Lisa 18 Nov 2026: daily jobs first (feed, health check), then the less often ones (grooming, ears), as needed last;
     A-Z within the same frequency. The frequency is the owner's every_days on the job row; a group goes by its most frequent job. */
  function every(j) { var n = parseInt(j.every_days, 10); return n > 0 ? n : 1e6; }
  function byFrequency(list) {
    var g = {};
    list.forEach(function (j) { if (j.group) g[j.group] = Math.min(g[j.group] || 1e6, every(j)); });
    var f = function (j) { return j.group ? g[j.group] : every(j); };
    return function (a, b) { return (f(a) - f(b)) || String(a.group || a.label).localeCompare(String(b.group || b.label)) || (every(a) - every(b)) || String(a.label).localeCompare(String(b.label)); };
  }
  function worst(list) { return list.slice().sort(byRank)[0]; }
  function isOn(r) { return String(r.active).toLowerCase() !== 'false'; }
  /* how a late entry came in: one at a time (paper) or several days at once (bulk). Owner-only; staff never see it */
  var PAPER_HOW = 'paper', BULK_HOW = 'bulk';
  /* starting default for a new app only: the owner's rule row job.paper_default_time (or .<type_key>) wins */
  var START_TIME = '12:00';
  var PLUS = '<svg class="ic-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  function addDays(day, n) { return new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10); }
  /** A London wall-clock date and time (YYYY-MM-DD, HH:MM) as a UTC ISO time, summer time included. */
  function londonIso(date, time) {
    var p = date.split('-').map(Number), q = (time || '12:00').split(':').map(Number), guess = Date.UTC(p[0], p[1] - 1, p[2], q[0], q[1]);
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    var g = {}; f.forEach(function (x) { g[x.type] = Number(x.value); });
    return new Date(guess - (Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute) - guess)).toISOString();
  }

  function open(host, c) {
    var h = c.h, tag = c.params.tag, how = tag ? 'scanned' : 'tapped';
    function moves() { c.go('mv/' + tag); }
    host.textContent = 'Loading...';
    BLDChecks.register(c.save);
    Promise.all([c.data(), c.readOptional('check_type'), c.readOptional('check_log'), tag ? c.readOptional('qr_tag') : { ok: true, rows: [] }, tag ? c.readOptional('litter') : { ok: true, rows: [] }, c.readOptional('check_field'), c.readOptional('breeding_rule'),
      tag ? c.readOptional('area_capacity') : { ok: true, rows: [] }, tag ? c.readOptional('area_access') : { ok: true, rows: [] }, tag ? c.readOptional('weight') : { ok: false, rows: [] }]).then(function (v) {
      /* a visitor's records count here only when stamped counts_due true: this screen does not read the visit's grant */
      var d = v[0], typesRead = v[1], logs = (v[2].rows || []).filter(function (l) { return !BLDDue.visitOf(l) || String(l.counts_due).toLowerCase() === 'true'; }), tags = v[3], off = !typesRead.ok || !c.save.banner('check_log').canSave || !d.ok;
      if (off && tag) { moves(); return; }
      host.textContent = '';
      if (!d.ok) { host.appendChild(h('p', { class: 'msg bad', text: d.message })); return; }
      if (off) { host.appendChild(h('p', { class: 'msg', text: typesRead.ok ? c.save.banner('check_log').text : 'Jobs are not switched on yet.' })); return; }

      var target = {}, title = 'Today', site = true;
      if (tag) {
        var row = (tags.rows || []).filter(function (t) { return t.tag === tag && isOn(t); })[0];
        if (!row || ['subject', 'area', 'site', 'litter'].indexOf(row.kind) < 0) { moves(); return; }
        site = row.kind === 'site';
        if (row.kind === 'subject') { target.subject_id = row.ref_id; title = ((d.subjects.filter(function (x) { return x.id === row.ref_id; })[0]) || {}).label || 'Dog'; }
        if (row.kind === 'litter') {
          var lit = (v[4].rows || []).filter(function (x) { return x.id === row.ref_id; })[0] || {}, dam = d.subjects.filter(function (x) { return x.id === lit.dam_subject_id; })[0];
          target.litter_id = row.ref_id; title = dam ? 'Litter of ' + dam.label : 'Litter';
        }
        if (row.kind === 'area') { target.area_id = row.ref_id; title = ((d.areas.filter(function (x) { return x.id === row.ref_id; })[0]) || {}).label || 'Room'; }
      }
      ctx0.reportFor = target.litter_id ? {} : { subject_id: target.subject_id, area_id: target.area_id };
      var roomDogs = target.area_id ? d.dogs.filter(function (x) { return x.areaId === target.area_id && !x.away; }) : [];
      if (target.area_id && !target.subject_id) target.roomDogIds = roomDogs.map(function (x) { return x.id; });
      /* the dogs here, for a whole-site job about dogs (health check): each dog as they go, or all at once */
      var labelOf = {};
      if (!target.litter_id) {
        target.dogs = d.dogs.filter(function (x) { return !x.away && x.areaId && (site || x.areaId === target.area_id || x.id === target.subject_id); })
          .map(function (x) { labelOf[x.id] = x.label; return { id: x.id, area_id: x.areaId }; });
      }

      /* owner rule rows (the shared rule list): key.<type_key> beats key; the row in force on that day; none = the starting default */
      var rules = (v[6] && v[6].rows) || [];
      var today0 = c.today();
      function rule(key, typeKey, day) {
        function pick(k) {
          var best = null;
          rules.forEach(function (r) { if (r.rule_key === k && r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day) && (!best || r.effective_from > best.effective_from)) best = r; });
          return best ? String(best.value || '').trim() : '';
        }
        return pick(key + '.' + typeKey) || pick(key);
      }
      function paperTime(typeKey, day) { var t = rule('job.paper_default_time', typeKey, day); return /^\d{1,2}:\d{2}$/.test(t) ? t : START_TIME; }
      /* Earlier, how the time is given (owner rows): job.paper_time_options = a pipe list of exact|part|none|now, the first preselected;
         job.day_part.<code>.label/.at/.sort = the parts of the day. No options row = the optional time box, as before. */
      function timeOptions(typeKey, day) {
        var ok = { exact: 1, part: 1, none: 1, now: 1 }, seen = {};
        var list = rule('job.paper_time_options', typeKey, day).split('|').map(function (x) { return x.trim().toLowerCase(); })
          .filter(function (x) { if (!ok[x] || seen[x]) return false; seen[x] = 1; return true; });
        if (!dayParts(typeKey, day).length) list = list.filter(function (x) { return x !== 'part'; });
        if (day !== today) list = list.filter(function (x) { return x !== 'now'; });
        return list;
      }
      function dayParts(typeKey, day) {
        var codes = {};
        rules.forEach(function (r) { var m = /^job\.day_part\.([a-z0-9_-]+)\.at$/i.exec(r.rule_key || ''); if (m) codes[m[1]] = true; });
        return Object.keys(codes).map(function (code) {
          var p = 'job.day_part.' + code + '.';
          return { code: code, label: rule(p + 'label', typeKey, day) || code, at: rule(p + 'at', typeKey, day), sort: parseFloat(rule(p + 'sort', typeKey, day)) };
        }).filter(function (x) { return /^\d{1,2}:\d{2}$/.test(x.at); })
          .sort(function (a, b) { return ((isNaN(a.sort) ? 1e9 : a.sort) - (isNaN(b.sort) ? 1e9 : b.sort)) || a.code.localeCompare(b.code); });
      }
      function oldestDay(typeKey, day) { var n = parseInt(rule('job.paper_back_days', typeKey, day), 10); return n > 0 ? addDays(day, -n) : ''; }
      var nameOf = {};
      (d.dogs || []).forEach(function (x) { nameOf[x.id] = x.label; });

      /* type_keys starting "round." are rows The round writes for itself: never a job on this screen */
      var today = c.today(), types = (typesRead.rows || []).filter(function (t) { return String(t.type_key || '').indexOf('round.') !== 0 && t.target !== 'item'; }), inForce = BLDDue.jobsInForce(types, today), byKey = {}, keyOf = {};
      inForce.forEach(function (t) { byKey[t.type_key] = t; });
      types.forEach(function (t) { keyOf[t.id] = t.type_key; });
      /* today's lines for a job, newest first; a corrected line gives way to its correction */
      function todays(key) {
        var replaced = {};
        logs.forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = true; });
        return logs.filter(function (l) { return !replaced[l.id] && keyOf[l.check_type_id] === key && BLDDue.londonDate(l.happened_at || l.taken_at) === today; })
          .sort(function (a, b) { return String(b.taken_at).localeCompare(String(a.taken_at)); });
      }
      /* each dog's newest line today (not "not done"): the dog starts unticked and shows a tick */
      function doneToday(key) {
        var m = {};
        todays(key).forEach(function (l) { if (l.subject_id && l.outcome !== 'not_done' && l.outcome !== 'note' && l.outcome !== 'part_done' && !m[l.subject_id]) m[l.subject_id] = l; });
        return m;
      }
      var kept = {}, paperDone = {};   // paperDone: type_key -> the last row saved from paper on this screen (an earlier day still gets its tick)
      function here(l) {
        if (target.litter_id) return l.litter_id === target.litter_id;
        if (target.subject_id) return l.subject_id === target.subject_id;
        if (target.area_id) return l.area_id === target.area_id;
        return !l.subject_id && !l.area_id && !l.litter_id;
      }
      /* the card's tick: from today's lines, so it shows after a save and when the screen opens again */
      function showDone(card, key, dogIds) {
        var all = todays(key).filter(function (x) { return dogIds ? dogIds.indexOf(x.subject_id) >= 0 : here(x); });
        var l = all.filter(function (x) { return x.outcome !== 'note'; })[0];
        if (!l && paperDone[key]) { var pd = paperDone[key]; BLDDone.mark(card, { outcome: pd.outcome, at: pd.time_given ? '' : pd.happened_at, who: pd.taken_by, extra: [dmy(BLDDue.londonDate(pd.happened_at)), pd._part].filter(Boolean).join(' '), note: pd.note }); return; }
        if (!l) return;
        if (l._queued) { BLDDone.wait(card, l._queued); return; }
        var n = dogIds ? Object.keys(doneToday(key)).filter(function (x) { return dogIds.indexOf(x) >= 0; }).length : 0;
        var notes = [l.note].concat(all.filter(function (x) { return x.outcome === 'note' && x.note_for_id === l.id; }).reverse().map(function (x) { return x.note; }));
        BLDDone.mark(card, { outcome: l.outcome, at: l.taken_at, who: l.taken_by, note: notes.filter(Boolean).join('\n'), extra: dogIds && dogIds.length > 1 ? n + ' of ' + dogIds.length + ' dogs' : '' });
      }
      /* a job's form: the owner's check_field rows in force today, in their sort order */
      var formOf = {}, latestField = {};
      (v[5].rows || []).forEach(function (r) {
        if (!r.type_key || !r.field_key || !r.effective_from || r.effective_from > today) return;
        var k = r.type_key + '|' + r.field_key;
        if (!latestField[k] || r.effective_from > latestField[k].effective_from) latestField[k] = r;
      });
      Object.keys(latestField).forEach(function (k) { var r = latestField[k]; if (isOn(r)) (formOf[r.type_key] = formOf[r.type_key] || []).push(r); });
      Object.keys(formOf).forEach(function (k) { formOf[k].sort(function (a, b) { return (Number(a.sort) || 0) - (Number(b.sort) || 0) || String(a.label).localeCompare(String(b.label)); }); });
      if (tag && !BLDDue.forTarget(types, logs, target, today, null, { rules: rules }).length) { moves(); return; }

      host.appendChild(h('h2', { text: title }));
      /* a room's jobs show its capacity too (LD-SC audit, 15 Nov 2026): the rows in force today, the same check as Move dogs */
      if (target.area_id && window.BLDCapacity && v[7] && v[7].ok && (v[7].rows || []).some(function (r) { return r.area_id === target.area_id; })) {
        var fact = BLDCapacity.facts({ subjects: d.raw.subject, litters: (v[4] && v[4].rows) || [], weights: (v[9] && v[9].rows) || [], weightsRead: !!(v[9] && v[9].ok), rules: rules, today: today0 });
        var capR = BLDCapacity.check({ areaId: target.area_id, access: BLDCapacity.accessOn((v[8] && v[8].rows) || [], target.area_id, today0), capacity: v[7].rows, dogs: roomDogs.map(function (x) { return fact(x.id); }), date: today0 });
        host.appendChild(h('p', { class: capR.status === 'over' ? 'msg bad' : 'sub', 'data-k': 'capacity', text: capR.status === 'over' ? capR.message : BLDCapacity.summary(capR) }));
      }
      /* a room scan: who is in the room now, each opening that dog's own jobs (Lisa 18 Nov 2026); Move dogs is below */
      if (target.area_id) {
        var dogTag = {};
        (tags.rows || []).forEach(function (t) { if (t.kind === 'subject' && isOn(t)) dogTag[t.ref_id] = t.tag; });
        host.appendChild(h('div', { class: 'here-now', 'data-k': 'here' }, [h('h3', { text: 'Here now' })].concat(roomDogs.length
          ? roomDogs.slice().sort(function (x, y) { return String(x.label).localeCompare(String(y.label)); }).map(function (x) {
            return dogTag[x.id] ? h('button', { class: 'chip', type: 'button', 'data-dog': x.id, text: x.label, onclick: function () { c.go('s/' + dogTag[x.id]); } })
              : h('span', { class: 'chip', 'data-dog': x.id, text: x.label }); })
          : [h('p', { class: 'sub', text: 'No dogs here.' })])));
      }
      /* this code cannot read past records (no read rows for check_log): say so, never a silent "Due" */
      /* Lisa 17 Nov 2026: jobs she had just saved still said Due. Say WHY the records were not read: not allowed for this
         code (ask Lisa), or no answer in time (slow saves: try again), with a Try again button for the second. */
      if (!v[2].ok) {
        var slow = v[2].code === 'NETWORK' || v[2].code === 'BUSY' || v[2].code === 'TIMEOUT' || !v[2].code;
        host.appendChild(h('p', { class: 'msg warn', 'data-no-history': '1', text: slow
          ? 'The past records did not load in time, so "Due" may already be done. Try again in a minute.'
          : 'This code cannot read past records' + (v[2].message ? ' (' + v[2].message + ')' : '') + ', so "Due" may already be done. Ask Lisa.' }));
        if (slow) host.appendChild(h('button', { class: 'btn quiet', type: 'button', 'data-retry-history': '1', text: 'Try again', onclick: function () { open(host, c); } }));
      }
      var status = h('p', { class: 'msg', role: 'status' }), list = h('div', { class: 'cards' }), group = '', more = false;
      host.appendChild(status); host.appendChild(list);
      if (tag && !site) host.appendChild(h('button', { class: 'btn quiet job-move', type: 'button', text: 'Move dogs', onclick: moves }));

      /* a room job restarted by a bigger job, such as the whole-site clean, says which */
      function byLine(job) { var b = job.reset_by && byKey[job.reset_by]; return b && job.status === 'ok' ? ' · ' + b.label : ''; }
      function say(text, kind) { status.className = 'msg ' + (kind || ''); status.textContent = text; }

      /* every tap shows something on the card: Saving..., then a tick or a plain red line (Lisa, 13 Nov) */
      function send(job, t, outcome, inputs, panelMsg, state, noteFor) {
        try { sendNow(job, t, outcome, inputs, panelMsg, state, noteFor); }
        catch (e) { BLDDone.fail(state.card, 'Not saved. Something went wrong on this screen; try again.'); if (window.console) console.error(e); }
      }
      function sendNow(job, t, outcome, inputs, panelMsg, state, noteFor) {
        function stop(text) { panelMsg.textContent = ''; BLDDone.fail(state.card, text); }   // on the card, so it shows even with the panel shut
        var entry = { check_type_id: t.id, outcome: outcome, how_recorded: how };
        if (target.subject_id) entry.subject_id = target.subject_id;
        if (target.area_id) entry.area_id = target.area_id;
        if (target.litter_id) entry.litter_id = target.litter_id;
        if (inputs.item) entry.item = inputs.item.value.trim();
        if (inputs.amount) entry.amount = inputs.amount.value.trim();
        if (inputs.note) entry.note = inputs.note.value.trim();
        if (noteFor) {   // a note added to a job already done: its own row, same room, dog or litter as the done row, pointing at it
          ['subject_id', 'area_id', 'litter_id'].forEach(function (k) { if (noteFor[k]) entry[k] = noteFor[k]; else delete entry[k]; });
          entry.note_for_id = noteFor.id;
        }
        var paper = state.paper && state.paper.date.value ? state.paper : null;
        if (paper) {   // Earlier: the real day, judged by the job as it was set up on that day
          var day = paper.date.value;
          if (day > today) { stop('Pick today or an earlier day.'); return; }
          var oldest = oldestDay(t.type_key, today);
          if (oldest && day < oldest) { stop('Too far back for this job.'); return; }
          var then = BLDDue.jobsInForce(types, day).filter(function (x) { return x.type_key === t.type_key; })[0];
          if (!then) { stop('This job was not set up on ' + dmy(day) + '.'); return; }
          t = then; entry.check_type_id = then.id;
          var mode = paper.mode && !paper.mode.hidden ? paper.mode.value : '', partLabel = '';
          if (mode === 'now') {
            if (day !== today) { stop('Now is only for today.'); return; }
            entry.happened_at = new Date().toISOString();
          } else if (mode === 'part') {
            var pt = dayParts(t.type_key, day).filter(function (x) { return x.code === paper.part.value; })[0];
            if (!pt) { stop('Pick a part of the day.'); return; }
            entry.happened_at = londonIso(day, pt.at); entry.time_given = 'part:' + pt.code; partLabel = pt.label;
            if (Date.parse(entry.happened_at) > Date.now()) entry.happened_at = new Date().toISOString();   // today, a part not yet at its usual time: now
          } else if (mode === 'exact') {
            if (!paper.time.value) { stop('Type the time.'); return; }
            entry.happened_at = londonIso(day, paper.time.value);
          } else {
            entry.happened_at = londonIso(day, paper.time.value || paperTime(t.type_key, day));
            if (!paper.time.value) entry.time_given = 'false';   // the owner's default time was used: the owner sees "time not given"
          }
          if (Date.parse(entry.happened_at) > Date.now() + 60000) { stop('That time is still to come.'); return; }
          entry.how_recorded = PAPER_HOW;
          entry.confirm_unusual = 'yes';   // the day was picked on purpose, so an older day is not a slip
          if (noteFor) { noteFor = null; delete entry.note_for_id; }   // a note on today's done row does not belong to an earlier day
        }
        var check = Object.assign({}, entry);
        delete check.confirm_unusual;
        if (t.target === 'none') delete check.area_id;
        var bad = BLDChecks.checkEntry(t, check), first = Object.keys(bad)[0];
        if (first) { stop(bad[first]); return; }
        var values = {}, missing = '';
        (state.form || []).forEach(function (q) {
          var val = q.input.value.trim();
          if (val) values[q.field.field_key] = val; else if (!missing && String(q.field.required).toLowerCase() === 'true') missing = q.field.label;
        });
        if (missing) { stop('This is needed: ' + missing + '.'); return; }
        var opts = { requestId: state.rid = state.rid || c.save.newRequestId() };
        if (Object.keys(values).length) opts.values = values;
        if (noteFor) { /* one plain row: never a whole-site tap, never a second done */ }
        else if (state.ticks) {
          var ticked = state.ticks.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
          if (!ticked.length) { stop('Tick a dog.'); return; }
          opts.action = 'add_site'; entry.dog_ids = ticked.join('|');
        } else if (BLDDue.perDogSite(t) && target.subject_id) { opts.action = 'add_site'; entry.dog_ids = target.subject_id; }
        if (site && !noteFor) { opts.action = 'add_site'; entry.how_recorded = paper ? PAPER_HOW : 'site_tap'; }
        panelMsg.className = 'msg'; panelMsg.textContent = ''; BLDDone.saving(state.card);
        /* 20 Nov 2026 (OV12): saves on this phone go one at a time, so a waiting save says "Waiting, 2 ahead" */
        opts.onTurn = function (n) { BLDDone.saving(state.card, BLDDone.turn(n)); };
        c.save.submit('check_log', entry, opts).then(function (r) {
          if (!r.ok) {
            var fe = r.fields && Object.keys(r.fields)[0], q = fe && (state.form || []).filter(function (x) { return 'values.' + x.field.field_key === fe; })[0];
            panelMsg.textContent = '';   // said once, on the card
            /* Overseer 22 Nov 2026: a repeat means the first save landed (a slow reply, or a second tap), so show the tick, not only a red line */
            if (r.code === 'DUPLICATE' && !paper) { state.rid = null; repeatTick(job, t, entry); return; }
            BLDDone.fail(state.card, r.code === 'DUPLICATE' ? (paper ? 'Not saved: this job was saved in the last 30 minutes. Try again later.' : 'Already saved a moment ago, so not saved twice. To add to it, use Note.')
              : 'Not saved: ' + (fe ? (q ? q.field.label + ': ' : '') + r.fields[fe] : (r.message || 'try again.')));
            if (r.code !== 'NETWORK') state.rid = null; return;
          }
          (state.form || []).forEach(function (x) { x.input.value = ''; });
          if (paper) { paperDone[job.type_key] = Object.assign({}, entry, { taken_by: r.who || '', _part: partLabel }); paper.date.value = ''; paper.time.value = ''; paper.refresh(); }
          var at = r.at || new Date().toISOString(), mine = { taken_at: at, taken_by: r.who || '', _queued: r.status === 'queued' ? (r.message || 'Waiting for signal') : '' };
          var dogs = entry.dog_ids ? entry.dog_ids.split('|') : [], real = r.ids && r.ids.length === dogs.length;   // a row id we can point a note at only when the reply gives one per dog
          logs = logs.concat(dogs.length ? dogs.map(function (dog, i) { return Object.assign({}, entry, mine, { id: real ? r.ids[i] : r.id + '-' + i, _noId: !real, subject_id: dog }); })
            : [Object.assign({}, entry, mine, { id: r.id })]);
          var left = r.left_out ? r.left_out.isolation + r.left_out.no_room + r.left_out.off_site + r.left_out.repeat : 0;
          kept[job.type_key] = true;   // stays on today's list with its tick, not gone without a trace
          say(left ? 'Left out: ' + left + '.' : '', 'warn');
          draw();
        });
      }

      /* a save refused as a repeat: the card ticks from today's line (or, with none read yet, from this tap) and says why nothing new was saved */
      function repeatTick(job, t, entry) {
        var dogs = entry.dog_ids ? entry.dog_ids.split('|') : [];
        var has = todays(job.type_key).some(function (l) { return l.outcome !== 'not_done' && l.outcome !== 'note' && l.outcome !== 'part_done' && (dogs.length ? dogs.indexOf(l.subject_id) >= 0 : here(l)); });
        if (!has) {
          var line = Object.assign({}, entry, { taken_at: new Date().toISOString(), taken_by: '', _noId: true });
          delete line.dog_ids;
          logs = logs.concat(dogs.length ? dogs.map(function (dog, i) { return Object.assign({}, line, { id: 'dup-' + job.type_key + '-' + i, subject_id: dog }); }) : [Object.assign(line, { id: 'dup-' + job.type_key })]);
        }
        kept[job.type_key] = true;
        draw();
        var card = list.querySelector('[data-job="' + job.type_key + '"] .done-line');
        if (card) { var n = document.createElement('span'); n.className = 'done-note'; n.textContent = 'Already saved a moment ago, so not saved twice. To add to it, use Note.'; card.appendChild(n); }
      }

      /* one form question from a check_field row: text, number, date, yes or no, or a choice */
      function question(f, changed) {
        var label = f.label + (String(f.required).toLowerCase() === 'true' ? '' : ' (optional)'), el;
        if (f.kind === 'yesno' || f.kind === 'choice') {
          var opts = f.kind === 'yesno' ? [['yes', 'Yes'], ['no', 'No']] : String(f.choices || '').split('|').filter(Boolean).map(function (x) { return [x, x]; });
          el = h('select', { class: 'inp', 'aria-label': label, onchange: changed }, [h('option', { value: '', text: label })].concat(opts.map(function (o) { return h('option', { value: o[0], text: o[1] }); })));
        } else {
          el = h('input', { class: 'inp', 'aria-label': label, placeholder: label, oninput: changed,
            type: f.kind === 'date' ? 'date' : 'text', inputmode: f.kind === 'number' ? 'decimal' : null });
        }
        el.setAttribute('data-field', f.field_key);
        return el;
      }

      function jobCard(job) {
        var t = byKey[job.type_key], a = BLDChecks.askedFields(t), dogJob = BLDDue.perDogSite(t), many = site || dogJob || BLDDue.perDogRoom(t), form = many ? [] : (formOf[t.type_key] || []);
        var needs = a.item || a.amount || a.noteRequired || form.length > 0 || (dogJob && site);   // a whole-site or per-dog tap has no form: the save script refuses one
        var panel = h('div', { class: 'job-panel', hidden: true }), panelMsg = h('p', { class: 'msg', role: 'status' }), inputs = {}, state = { rid: null, panel: panel };
        state.form = form.map(function (f) { var q = { field: f, input: question(f, function () { state.rid = null; }) }; panel.appendChild(q.input); return q; });
        function input(key, label) { inputs[key] = h('input', { class: 'inp', 'aria-label': label, placeholder: label, oninput: function () { state.rid = null; } }); panel.appendChild(inputs[key]); }
        if (a.item) input('item', t.item_label || 'What');
        if (a.amount) input('amount', t.amount_unit ? 'Amount (' + t.amount_unit + ')' : 'Amount');
        input('note', t.note_label || 'Note');
        var done = a.outcome ? 'ok' : 'recorded', roomList = null;
        if (BLDDue.perDogRoom(t) && target.area_id) {   // all ticked: untick only a dog that missed out
          var roomDid = doneToday(t.type_key);
          state.ticks = roomDogs.map(function (x) { return h('input', { type: 'checkbox', value: x.id, checked: !roomDid[x.id], onchange: function () { state.rid = null; } }); });
          roomList = h('div', { class: 'job-dogs' }, roomDogs.length ? roomDogs.map(function (x, i) { return dogRow(state.ticks[i], x.label, roomDid[x.id]); }) : [h('p', { class: 'sub', text: 'No dogs here.' })]);
          state.dogIds = roomDogs.map(function (x) { return x.id; });
        }
        if (dogJob && !target.subject_id) {   // Lisa 12 Nov: every dog starts unticked; tick dogs one by one, or Select all and untick a dog that needs a comment
          var did = doneToday(t.type_key), dogs = BLDDue.dogsFor(t, target).slice().sort(function (x, y) { return String(labelOf[x.id]).localeCompare(String(labelOf[y.id])); });
          state.ticks = dogs.map(function (x) { return h('input', { type: 'checkbox', value: x.id, onchange: function () { state.rid = null; } }); });
          var all = h('button', { class: 'btn quiet job-all', type: 'button', text: 'Select all', onclick: function () {
            state.ticks.forEach(function (b, i) { if (!did[dogs[i].id]) b.checked = true; }); state.rid = null; if (state.countTicks) state.countTicks();
          } });
          roomList = h('div', { class: 'job-dogs' }, (dogs.length > 1 ? [all] : []).concat(dogs.map(function (x, i) { return dogRow(state.ticks[i], labelOf[x.id], did[x.id]); })));
          state.dogIds = dogs.map(function (x) { return x.id; });
          if (site) { panel.insertBefore(roomList, panel.firstChild); roomList = null; }
        }
        /* Lisa 22 Nov 2026: a multi-dog job had no button by its ticks, so the ticked dogs were never saved. "Done: N dogs" saves them. */
        if (state.ticks && state.ticks.length > 1) {
          var tickBtn = h('button', { class: 'btn job-ticks-done', type: 'button', 'data-ticks-done': '1', onclick: function () { send(job, t, done, inputs, panelMsg, state); } });
          var count = function () { var n = state.ticks.filter(function (x) { return x.checked; }).length; tickBtn.textContent = 'Done: ' + n + (n === 1 ? ' dog' : ' dogs'); tickBtn.disabled = !n; };
          state.ticks.forEach(function (b) { b.addEventListener('change', count); });
          var dogBox = roomList || panel.querySelector('.job-dogs');
          dogBox.appendChild(tickBtn); state.countTicks = count; count();
        }
        /* Note (Lisa 13 Nov): not always a problem, just an explanation. On a job not done today it saves it as done, with the note.
           On a job already done today it waits for the save script's note record (outcome note + note_for_id). */
        var dogIds = state.dogIds || (dogJob && target.subject_id ? [target.subject_id] : null);
        var doneLine = (dogIds && dogIds.length > 1) ? null : todays(t.type_key).filter(function (l) { return l.outcome !== 'not_done' && l.outcome !== 'note' && !l._queued && !l._noId && (dogIds ? dogIds.indexOf(l.subject_id) >= 0 : here(l)); })[0];
        var problems = h('div', { class: 'job-btns', hidden: true }, [
          h('button', { class: 'btn quiet', type: 'button', text: 'Note', onclick: function () {
            if (!inputs.note.value.trim()) { BLDDone.fail(state.card, 'Write the note.'); return; }
            if (doneLine) send(job, t, 'note', inputs, panelMsg, state, doneLine);   // already done today: add the note, not a second done
            else send(job, t, done, inputs, panelMsg, state);
          } })
        ].concat([
          h('button', { class: 'btn quiet', type: 'button', text: 'Concern', onclick: function () { send(job, t, 'concern', inputs, panelMsg, state); } }),
          h('button', { class: 'btn quiet', type: 'button', text: 'Not done', onclick: function () { send(job, t, 'not_done', inputs, panelMsg, state); } }),
          h('button', { class: 'btn quiet', type: 'button', text: 'Part done', onclick: function () { send(job, t, 'part_done', inputs, panelMsg, state); } })   // needs a note; not counted as done
        ]));
        /* Earlier (Lisa 13 Nov, option B): the day and time it was really done, then any button saves for that day */
        var WHEN = { exact: 'Time', part: 'Part of day', none: 'Not known', now: 'Now' };
        var pDate = h('input', { class: 'inp', type: 'date', max: today, 'aria-label': 'Day done', onchange: function () { state.rid = null; refresh(); } });
        var pTime = h('input', { class: 'inp', type: 'time', 'aria-label': 'Time done (optional)', onchange: function () { state.rid = null; } });
        var pMode = h('select', { class: 'inp', 'aria-label': 'When', hidden: true, onchange: function () { state.rid = null; show(); } });
        var pPart = h('select', { class: 'inp', 'aria-label': 'Part of day', hidden: true, onchange: function () { state.rid = null; } });
        function show() {
          var m = pMode.hidden ? '' : pMode.value;
          pTime.hidden = !!m && m !== 'exact'; pPart.hidden = m !== 'part';
          pTime.setAttribute('aria-label', m === 'exact' ? 'Time done' : 'Time done (optional)');
        }
        /* the choices in force on the picked day (today until a day is picked); a choice still offered stays picked */
        function refresh() {
          var day = pDate.value || today, opts = timeOptions(t.type_key, day), was = pMode.value, wasPart = pPart.value;
          pMode.textContent = ''; opts.forEach(function (o) { pMode.appendChild(h('option', { value: o, text: WHEN[o] })); });
          pMode.hidden = !opts.length; if (opts.indexOf(was) >= 0) pMode.value = was;
          pPart.textContent = ''; dayParts(t.type_key, day).forEach(function (p) { pPart.appendChild(h('option', { value: p.code, text: p.label })); });
          if (wasPart) pPart.value = wasPart; if (!pPart.value && pPart.options.length) pPart.selectedIndex = 0;
          show();
        }
        var paperRow = h('div', { class: 'job-paper', hidden: true }, [pDate, pMode, pTime, pPart]);
        refresh();
        state.paper = { date: pDate, time: pTime, mode: pMode, part: pPart, refresh: refresh };
        panel.insertBefore(paperRow, panel.firstChild);
        panel.appendChild(problems); panel.appendChild(panelMsg);
        var head = h('div', { class: 'job-head' }, [
          h('div', { class: 'job-txt' }, [h('div', { class: 'nm', text: job.label }), h('div', { class: 'ds', text: dueLine(job) + byLine(job) })]),
          h('button', { class: 'btn', type: 'button', 'data-done-btn': '1', text: site ? 'Yes' : 'Done', 'aria-label': (site ? 'Yes, done: ' : 'Done: ') + job.label, onclick: function () {
            if (needs && panel.hidden) { panel.hidden = false; return; }
            if (roomList) panel.hidden = false;
            send(job, t, done, inputs, panelMsg, state);
          } })
        ]);
        var kids = roomList ? [head, roomList] : [head];
        if (a.outcome) kids.push(h('button', { class: 'job-prob', type: 'button', text: 'Problem/Note?', 'aria-label': 'Problem: ' + job.label, onclick: function () { panel.hidden = false; problems.hidden = false; } }));
        /* "Earlier" + plus icon (Lisa 13/11, AA_BLD-SCHEMA §14): one word for any late entry, from paper, an app or memory */
        kids.push(earlierBtn('job-prob job-paper-btn', 'Earlier: ' + job.label, function () { panel.hidden = false; paperRow.hidden = false; if (a.outcome) problems.hidden = false; }));
        kids.push(panel);
        var card = state.card = h('div', { class: 'card job s-' + job.status, 'data-job': job.type_key }, kids);
        showDone(card, t.type_key, dogIds);
        return card;
      }
      /* one dog in a tick list: a dog with a line today shows a tick and the time */
      function dogRow(box, label, line) {
        var kids = [box, h('span', { text: label || '' })];
        if (line) kids.push(h('span', { class: 'dog-done', html: line._queued ? '' : BLDDone.TICK }), h('span', { class: 'dog-at', text: line._queued ? 'Waiting' : BLDDone.hhmm(line.taken_at) }));
        return h('label', { class: 'job-dog' }, kids);
      }

      /* "Earlier" + plus icon: the one word for any late entry (Lisa 13/11) */
      function earlierBtn(cls, label, onclick) {
        var b = h('button', { class: cls, type: 'button', 'aria-label': label, onclick: onclick });
        b.innerHTML = PLUS; b.appendChild(document.createTextNode('Earlier'));
        return b;
      }

      /* Earlier, several days at once (Lisa 13/11, option B): one job, a day or a week; a row per dog, room or site per day;
         each row is judged by the job as it was set up on its own day, and ticks when its save lands */
      function lineOn(key, tg, day) {
        return logs.filter(function (l) {
          if (keyOf[l.check_type_id] !== key || l.outcome === 'not_done' || l.outcome === 'note' || l.outcome === 'part_done') return false;
          if (BLDDue.londonDate(l.happened_at || l.taken_at) !== day) return false;
          if (tg.dog) return l.subject_id === tg.dog;
          return ['subject_id', 'area_id', 'litter_id'].every(function (k) { return !tg.fields[k] || l[k] === tg.fields[k]; });
        })[0];
      }
      /* the dogs and rooms as they were on that day, from the occupancy rows (not today's list) */
      var onDayMemo = {};
      function onDay(day) {
        if (!onDayMemo[day]) onDayMemo[day] = d.raw && typeof BLDOccupancy !== 'undefined' ? BLDOccupancy.dailyList(d.raw, day) : { dogs: d.dogs, areas: d.areas };
        return onDayMemo[day];
      }
      function targetsFor(t, day) {
        var on = onDay(day), here = on.dogs.filter(function (x) { return !x.away && x.areaId; });
        if (BLDDue.perDogSite(t) || BLDDue.perDogRoom(t)) {
          var dogs = target.subject_id ? here.filter(function (x) { return x.id === target.subject_id; }) : target.area_id ? here.filter(function (x) { return x.areaId === target.area_id; }) : here;
          var list2 = dogs.map(function (x) { return { id: x.id, area_id: x.areaId }; });
          if (BLDDue.perDogSite(t)) list2 = BLDDue.dogsFor(t, { dogs: list2 });
          return list2.map(function (x) { return { label: nameOf[x.id] || 'Dog', dog: x.id, fields: BLDDue.perDogRoom(t) ? { area_id: x.area_id } : {} }; });
        }
        if (t.target === 'dog' && !target.subject_id) {
          return here.filter(function (x) { return site || x.areaId === target.area_id; }).map(function (x) { return { label: nameOf[x.id] || x.label || 'Dog', fields: { subject_id: x.id } }; });
        }
        if (t.target === 'area' && !target.area_id) {
          return (on.areas || []).filter(function (a) { return BLDDue.forTarget([t], [], { area_id: a.id }, day).length; })
            .map(function (a) { return { label: a.label, fields: { area_id: a.id } }; });
        }
        if (target.subject_id && !target.litter_id && !here.some(function (x) { return x.id === target.subject_id; })) return [];   // not here that day
        var f = {};
        ['subject_id', 'area_id', 'litter_id'].forEach(function (k) { if (target[k]) f[k] = target[k]; });
        if (t.target === 'none') delete f.area_id;
        return [{ label: site ? 'Site' : title, fields: f }];
      }
      function gridRow(t, day, tg) {
        var a = BLDChecks.askedFields(t), inputs = {}, rid = null;
        var btn = h('button', { class: 'btn', type: 'button', 'data-done-btn': '1', text: 'Done', 'aria-label': 'Done: ' + tg.label + ', ' + dmy(day) });
        var kids = [h('div', { class: 'job-head' }, [h('div', { class: 'job-txt' }, [h('div', { class: 'nm', text: tg.label }), h('div', { class: 'ds', text: dmy(day) })]), btn])];
        function field(k, label) { inputs[k] = h('input', { class: 'inp', 'aria-label': label, placeholder: label, oninput: function () { rid = null; } }); kids.push(inputs[k]); }
        if (a.item) field('item', t.item_label || 'What');
        if (a.amount) field('amount', t.amount_unit ? 'Amount (' + t.amount_unit + ')' : 'Amount');
        if (a.noteRequired) field('note', t.note_label || 'Note');
        var row = h('div', { class: 'card job job-row', 'data-day': day }, kids);
        var prior = lineOn(t.type_key, tg, day);
        if (prior) { row._saved = true; BLDDone.mark(row, { outcome: prior.outcome, at: prior.happened_at || prior.taken_at, who: prior.taken_by }); }
        row._save = function () {
          if (row._saved) return Promise.resolve();
          var entry = Object.assign({ check_type_id: t.id, outcome: a.outcome ? 'ok' : 'recorded', how_recorded: BULK_HOW, time_given: 'false', happened_at: londonIso(day, paperTime(t.type_key, day)), confirm_unusual: 'yes' }, tg.fields);
          Object.keys(inputs).forEach(function (k) { entry[k] = inputs[k].value.trim(); });
          var check = Object.assign({}, entry, tg.dog ? { subject_id: tg.dog } : {});
          delete check.confirm_unusual;
          var bad = BLDChecks.checkEntry(t, check), first = Object.keys(bad)[0];
          if (first) { BLDDone.fail(row, bad[first]); return Promise.resolve(); }
          var opts = { requestId: rid = rid || c.save.newRequestId() };
          if (tg.dog) { opts.action = 'add_site'; entry.dog_ids = tg.dog; }
          else if (t.target === 'none') opts.action = 'add_site';
          BLDDone.saving(row);
          opts.onTurn = function (n) { BLDDone.saving(row, BLDDone.turn(n)); };
          return c.save.submit('check_log', entry, opts).then(function (r) {
            if (!r.ok) {
              BLDDone.fail(row, r.code === 'DUPLICATE' ? 'Not saved: this job was saved in the last 30 minutes. Try again later.' : 'Not saved: ' + (r.message || 'try again.'));
              if (r.code !== 'NETWORK') rid = null;
              return;
            }
            row._saved = true;
            logs = logs.concat([Object.assign({}, entry, { id: r.id, taken_at: r.at || new Date().toISOString(), taken_by: r.who || '' }, tg.dog ? { subject_id: tg.dog } : {})]);
            BLDDone.mark(row, { outcome: entry.outcome, at: entry.happened_at, who: r.who || '' });
          });
        };
        btn.onclick = function () { row._save(); };
        return row;
      }
      function catchUp() {
        /* on the whole-site screen every job (rooms and dogs too, a row each); on a dog, room or litter screen that one's jobs */
        var jobs = (site ? inForce.filter(function (t) { return t.target !== 'litter'; }) : BLDDue.forTarget(types, logs, target, today, null, { rules: rules })).slice();
        jobs.sort(byFrequency(jobs));
        list.textContent = ''; say('');
        list.appendChild(h('button', { class: 'back', type: 'button', text: '← All jobs', onclick: function () { draw(); } }));
        list.appendChild(h('h3', { text: 'Earlier' }));
        /* a job group (the owner's group on the job rows) enters every job in it, day by day */
        var groups = [];
        jobs.forEach(function (j) { if (j.group && groups.indexOf(j.group) < 0) groups.push(j.group); });
        var pick = h('select', { class: 'inp', 'aria-label': 'Job' }, groups.sort().map(function (g) { return h('option', { value: 'group:' + g, text: g + ' (all)' }); })
          .concat(jobs.map(function (j) { return h('option', { value: j.type_key, text: j.label }); })));
        if (groups.length) pick.value = jobs[0].type_key;
        var from = h('input', { class: 'inp', type: 'date', max: today, 'aria-label': 'First day' });
        var span = h('select', { class: 'inp', 'aria-label': 'Days' }, [h('option', { value: '1', text: '1 day' }), h('option', { value: '7', text: '7 days' })]);
        var rows = h('div', { class: 'cards job-grid' });
        list.appendChild(h('div', { class: 'job-paper' }, [pick, from, span, h('button', { class: 'btn', type: 'button', text: 'Show', onclick: build })]));
        list.appendChild(rows);
        function build() {
          rows.textContent = '';
          var g = pick.value.indexOf('group:') === 0 ? pick.value.slice(6) : '', first = from.value, made = 0;
          var keys = g ? jobs.filter(function (j) { return j.group === g; }).map(function (j) { return j.type_key; }) : [pick.value];
          function note(text, cls) { rows.appendChild(h('p', { class: cls || 'sub', text: text })); }
          if (!first) { note('Pick the first day.', 'msg bad'); return; }
          if (first > today) { note('Pick today or an earlier day.', 'msg bad'); return; }
          keys = keys.filter(function (key) { var oldest = oldestDay(key, today); return !(oldest && first < oldest); });
          if (!keys.length) { note('Too far back for this job.', 'msg bad'); return; }
          for (var i = 0; i < Number(span.value); i++) {
            var day = addDays(first, i);
            if (day > today) break;
            keys.forEach(function (key) {
              var t = BLDDue.jobsInForce(types, day).filter(function (x) { return x.type_key === key; })[0];
              if (!t) { if (!g) note(dmy(day) + ': not set up then.'); return; }
              targetsFor(t, day).forEach(function (tg) { rows.appendChild(gridRow(t, day, g ? Object.assign({}, tg, { label: t.label + ': ' + tg.label }) : tg)); made++; });
            });
          }
          if (!made) { note('Nothing to enter.'); return; }
          rows.appendChild(h('button', { class: 'btn', type: 'button', text: 'Done all', onclick: function () {
            [].slice.call(rows.querySelectorAll('.job-row')).reduce(function (p, r) { return p.then(function () { return r._save(); }); }, Promise.resolve());
          } }));
        }
      }

      function groupCard(name, jobs) {
        var w = worst(jobs);
        return h('button', { class: 'card job go-group s-' + w.status, type: 'button', 'data-group': name, onclick: function () { group = name; say(''); draw(); } }, [
          h('div', { class: 'nm', text: name }), h('div', { class: 'ds', text: dueLine(w) })
        ]);
      }

      /* Owner's order for today's list (rule row job.order, dated, with a source): a pipe list of type_keys, group:<name>,
         or screen:<module id>=<label> for another staff screen (e.g. temperatures). Listed ones come first in that order;
         the rest follow by frequency. No row = by frequency only. */
      var order = rule('job.order', '', today).split('|').map(function (x) { return x.trim(); }).filter(Boolean);
      function pos(j) { var i = order.indexOf(j.type_key); if (i < 0 && j.group) i = order.indexOf('group:' + j.group); return i < 0 ? 1e6 : i; }
      function screenCard(entry) {
        var m = /^screen:([a-z0-9_-]+)(?:=(.+))?$/i.exec(entry);
        if (!m) return null;
        return h('button', { class: 'card job go-group job-screen', type: 'button', 'data-screen': m[1], onclick: function () { c.go('m/' + m[1]); } }, [
          h('div', { class: 'nm', text: m[2] || m[1] })
        ]);
      }
      function draw() {
        var jobs = BLDDue.forTarget(types, logs, target, today, null, { rules: rules }), freq = byFrequency(jobs);
        jobs.sort(function (a, b) { return (pos(a) - pos(b)) || freq(a, b); });
        list.textContent = '';
        if (group) {
          list.appendChild(h('button', { class: 'back', type: 'button', text: '← All jobs', onclick: function () { group = ''; say(''); draw(); } }));
          list.appendChild(h('h3', { text: group }));
          jobs.filter(function (j) { return j.group === group; }).forEach(function (j) { list.appendChild(jobCard(j)); });
          return;
        }
        var shown = site && !more ? jobs.filter(function (j) { return isDue(j) || kept[j.type_key] || j.last_done === today; }) : jobs, rest = jobs.length - shown.length, seen = {};
        var screens = order.map(function (e, i) { return { e: e, i: i }; }).filter(function (x) { return x.e.indexOf('screen:') === 0; });
        function screensBefore(p) { while (screens.length && screens[0].i < p) { var card = screenCard(screens.shift().e); if (card) list.appendChild(card); } }
        shown.forEach(function (j) {
          screensBefore(pos(j));
          if (!j.group) { list.appendChild(jobCard(j)); return; }
          if (seen[j.group]) return;
          seen[j.group] = true;
          list.appendChild(groupCard(j.group, jobs.filter(function (x) { return x.group === j.group; })));
        });
        screensBefore(1e6);
        if (!shown.length) list.appendChild(h('p', { class: 'sub', text: jobs.length ? 'All done.' : 'No jobs set up.' }));
        if (rest > 0) list.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'More', onclick: function () { more = true; draw(); } }));
        if (jobs.length) list.appendChild(earlierBtn('btn quiet job-paper-btn job-earlier-all', 'Earlier: several days', catchUp));
      }
      draw();
    });
  }

  /* Report anything: the owner's row with type_key "report" says it is switched on and how the note is labelled. */
  function openReport(host, c) {
    var h = c.h, was = ctx0.reportFor || {};
    host.textContent = 'Loading...';
    BLDChecks.register(c.save);
    Promise.all([c.data(), c.readOptional('check_type')]).then(function (v) {
      /* the kinds of report are the owner's job rows with target "optional" (incident, accident, lost dog...): no fixed key */
      var d = v[0], kinds = v[1].ok ? BLDDue.jobsInForce(v[1].rows, c.today()).filter(function (t) { return t.target === 'optional' && isOn(t); })
        .sort(function (a, b) { return (a.type_key === REPORT_KEY ? -1 : b.type_key === REPORT_KEY ? 1 : 0) || String(a.label).localeCompare(String(b.label)); }) : [], type = kinds[0];
      host.textContent = '';
      if (!d.ok) { host.appendChild(h('p', { class: 'msg bad', text: d.message })); return; }
      if (!type || !c.save.banner('check_log').canSave) { host.appendChild(h('p', { class: 'msg', text: 'Reports are not switched on yet.' })); return; }
      function select(label, blank, pairs, value) {
        var s = h('select', { class: 'inp', 'aria-label': label }, [h('option', { value: '', text: blank })].concat(pairs.map(function (p) { return h('option', { value: p[0], text: p[1] }); })));
        s.value = value || '';
        return s;
      }
      var dog = select('Dog', 'Dog (optional)', d.subjects.map(function (x) { return [x.id, x.label]; }), was.subject_id);
      var room = select('Room', 'Room (optional)', d.areas.map(function (x) { return [x.id, x.label]; }), was.area_id);
      var kind = kinds.length > 1 ? select('Kind', 'Kind', kinds.map(function (t) { return [t.id, t.label]; }), type.id) : null;
      if (kind) kind.firstChild.disabled = true;
      function picked() { return kind ? kinds.filter(function (t) { return t.id === kind.value; })[0] || type : type; }
      var note = h('textarea', { class: 'inp', rows: '4', 'aria-label': type.note_label || 'What happened?', placeholder: type.note_label || 'What happened?' });
      if (kind) kind.addEventListener('change', function () { var t = picked(); note.placeholder = t.note_label || 'What happened?'; note.setAttribute('aria-label', note.placeholder); heading.textContent = t.label || 'Problem'; rid = null; });
      var msg = h('p', { class: 'msg', role: 'status' }), rid = null;
      note.addEventListener('input', function () { rid = null; });
      var btn = h('button', { class: 'btn', type: 'button', text: 'Send', onclick: function () {
        var text = note.value.trim();
        if (!text) { msg.className = 'msg bad'; msg.textContent = 'Say what happened.'; return; }
        var f = { check_type_id: picked().id, outcome: 'recorded', note: text, how_recorded: 'tapped' };
        if (dog.value) f.subject_id = dog.value;
        if (room.value) f.area_id = room.value;
        rid = rid || c.save.newRequestId(); btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving...';
        c.save.submit('check_log', f, { requestId: rid, onTurn: function (n) { msg.textContent = BLDDone.turn(n); } }).then(function (r) {
          btn.disabled = false;
          if (r.ok) { rid = null; note.value = ''; msg.className = 'msg good'; msg.textContent = r.status === 'queued' ? r.message : '✓ Sent'; return; }
          msg.className = 'msg bad'; msg.textContent = r.message;
          if (r.code !== 'NETWORK') rid = null;
        });
      } });
      var heading = h('h2', { text: type.label || 'Problem' });
      [heading, kind, dog, room, note, btn, msg].forEach(function (n) { if (n) host.appendChild(n); });
    });
  }

  StaffPage.register({ id: 'jobs', title: 'Jobs', icon: ctx0.icons.dogs, order: 5, open: open });
  StaffPage.register({ id: 'report', title: 'Problem', hidden: true, open: openReport });
}());
