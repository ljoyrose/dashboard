/*!
 * Jobs: the buttons after a scan, and today's whole-site list. Every job is a BLD-check_type row the owner entered:
 * nothing here names a job or a place. A scan only opens this screen; it says nothing about who was there.
 * Until the rows, the list or the saving are switched on, a scan goes on to Move dogs exactly as before.
 */
(function () {
  'use strict';
  var RANK = { late: 0, never: 1, today: 2, as_needed: 3, ok: 4 }, REPORT_KEY = 'report', ctx0 = StaffPage.ctx;

  function dmy(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0].slice(2) : iso; }
  function dueLine(j) {
    if (j.status === 'late') return j.days_late === 1 ? '1 day late' : j.days_late + ' days late';
    if (j.status === 'today') return 'Due today';
    if (j.status === 'never') return 'Due';
    if (j.status === 'ok') return 'Next ' + dmy(j.next_due);
    return 'As needed';
  }
  function isDue(j) { return j.status === 'late' || j.status === 'today' || j.status === 'never'; }
  function byRank(a, b) { return (RANK[a.status] - RANK[b.status]) || String(a.label).localeCompare(String(b.label)); }
  /* A-Z, matching the printed card; a group sits where its name falls */
  function aToZ(a, b) { return String(a.group || a.label).localeCompare(String(b.group || b.label)) || String(a.label).localeCompare(String(b.label)); }
  function worst(list) { return list.slice().sort(byRank)[0]; }
  function isOn(r) { return String(r.active).toLowerCase() !== 'false'; }

  function open(host, c) {
    var h = c.h, tag = c.params.tag, how = tag ? 'scanned' : 'tapped';
    function moves() { c.go('mv/' + tag); }
    host.textContent = 'Loading...';
    BLDChecks.register(c.save);
    Promise.all([c.data(), c.readOptional('check_type'), c.readOptional('check_log'), tag ? c.readOptional('qr_tag') : { ok: true, rows: [] }, tag ? c.readOptional('litter') : { ok: true, rows: [] }, c.readOptional('check_field')]).then(function (v) {
      var d = v[0], typesRead = v[1], logs = v[2].rows || [], tags = v[3], off = !typesRead.ok || !c.save.banner('check_log').canSave || !d.ok;
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
      /* the dogs here, for a whole-site job about dogs (health check): each dog as they go, or all at once */
      var labelOf = {};
      if (!target.litter_id) {
        target.dogs = d.dogs.filter(function (x) { return !x.away && x.areaId && (site || x.areaId === target.area_id || x.id === target.subject_id); })
          .map(function (x) { labelOf[x.id] = x.label; return { id: x.id, area_id: x.areaId }; });
      }

      var today = c.today(), types = typesRead.rows, inForce = BLDDue.jobsInForce(types, today), byKey = {}, keyOf = {};
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
        todays(key).forEach(function (l) { if (l.subject_id && l.outcome !== 'not_done' && !m[l.subject_id]) m[l.subject_id] = l; });
        return m;
      }
      var kept = {};
      function here(l) {
        if (target.litter_id) return l.litter_id === target.litter_id;
        if (target.subject_id) return l.subject_id === target.subject_id;
        if (target.area_id) return l.area_id === target.area_id;
        return !l.subject_id && !l.area_id && !l.litter_id;
      }
      /* the card's tick: from today's lines, so it shows after a save and when the screen opens again */
      function showDone(card, key, dogIds) {
        var lines = todays(key).filter(function (l) { return dogIds ? dogIds.indexOf(l.subject_id) >= 0 : here(l); }), l = lines[0];
        if (!l) return;
        if (l._queued) { BLDDone.wait(card, l._queued); return; }
        var n = dogIds ? Object.keys(doneToday(key)).filter(function (x) { return dogIds.indexOf(x) >= 0; }).length : 0;
        BLDDone.mark(card, { outcome: l.outcome, at: l.taken_at, who: l.taken_by, extra: dogIds && dogIds.length > 1 ? n + ' of ' + dogIds.length + ' dogs' : '' });
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
      if (tag && !BLDDue.forTarget(types, logs, target, today).length) { moves(); return; }

      host.appendChild(h('h2', { text: title }));
      var status = h('p', { class: 'msg', role: 'status' }), list = h('div', { class: 'cards' }), group = '', more = false;
      host.appendChild(status); host.appendChild(list);
      if (tag && !site) host.appendChild(h('button', { class: 'btn quiet job-move', type: 'button', text: 'Move dogs', onclick: moves }));

      /* a room job restarted by a bigger job, such as the whole-site clean, says which */
      function byLine(job) { var b = job.reset_by && byKey[job.reset_by]; return b && job.status === 'ok' ? ' · ' + b.label : ''; }
      function say(text, kind) { status.className = 'msg ' + (kind || ''); status.textContent = text; }

      function send(job, t, outcome, inputs, panelMsg, state) {
        var entry = { check_type_id: t.id, outcome: outcome, how_recorded: how };
        if (target.subject_id) entry.subject_id = target.subject_id;
        if (target.area_id) entry.area_id = target.area_id;
        if (target.litter_id) entry.litter_id = target.litter_id;
        if (inputs.item) entry.item = inputs.item.value.trim();
        if (inputs.amount) entry.amount = inputs.amount.value.trim();
        if (inputs.note) entry.note = inputs.note.value.trim();
        var check = Object.assign({}, entry);
        if (t.target === 'none') delete check.area_id;
        var bad = BLDChecks.checkEntry(t, check), first = Object.keys(bad)[0];
        if (first) { panelMsg.className = 'msg bad'; panelMsg.textContent = bad[first]; return; }
        var values = {}, missing = '';
        (state.form || []).forEach(function (q) {
          var val = q.input.value.trim();
          if (val) values[q.field.field_key] = val; else if (!missing && String(q.field.required).toLowerCase() === 'true') missing = q.field.label;
        });
        if (missing) { panelMsg.className = 'msg bad'; panelMsg.textContent = 'This is needed: ' + missing + '.'; return; }
        var opts = { requestId: state.rid = state.rid || c.save.newRequestId() };
        if (Object.keys(values).length) opts.values = values;
        if (state.ticks) {
          var ticked = state.ticks.filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
          if (!ticked.length) { panelMsg.className = 'msg bad'; panelMsg.textContent = 'Tick a dog.'; return; }
          opts.action = 'add_site'; entry.dog_ids = ticked.join('|');
        } else if (BLDDue.perDogSite(t) && target.subject_id) { opts.action = 'add_site'; entry.dog_ids = target.subject_id; }
        if (site) { opts.action = 'add_site'; entry.how_recorded = 'site_tap'; }
        panelMsg.className = 'msg'; panelMsg.textContent = 'Saving...';
        c.save.submit('check_log', entry, opts).then(function (r) {
          if (!r.ok) {
            var fe = r.fields && Object.keys(r.fields)[0], q = fe && (state.form || []).filter(function (x) { return 'values.' + x.field.field_key === fe; })[0];
            panelMsg.className = 'msg bad'; panelMsg.textContent = fe ? (q ? q.field.label + ': ' : '') + r.fields[fe] : r.message;
            BLDDone.fail(state.card, 'Not saved.' + (fe ? '' : ' ' + (r.message || '')));
            if (r.code !== 'NETWORK') state.rid = null; return;
          }
          (state.form || []).forEach(function (x) { x.input.value = ''; });
          var at = r.at || new Date().toISOString(), mine = { taken_at: at, taken_by: r.who || '', _queued: r.status === 'queued' ? (r.message || 'Waiting for signal') : '' };
          logs = logs.concat(entry.dog_ids ? entry.dog_ids.split('|').map(function (dog, i) { return Object.assign({}, entry, mine, { id: r.id + '-' + i, subject_id: dog }); })
            : [Object.assign({}, entry, mine, { id: r.id })]);
          var left = r.left_out ? r.left_out.isolation + r.left_out.no_room + r.left_out.off_site + r.left_out.repeat : 0;
          kept[job.type_key] = true;   // stays on today's list with its tick, not gone without a trace
          say(left ? 'Left out: ' + left + '.' : '', 'warn');
          draw();
        });
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
        var panel = h('div', { class: 'job-panel', hidden: true }), panelMsg = h('p', { class: 'msg', role: 'status' }), inputs = {}, state = { rid: null };
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
            state.ticks.forEach(function (b, i) { if (!did[dogs[i].id]) b.checked = true; }); state.rid = null;
          } });
          roomList = h('div', { class: 'job-dogs' }, (dogs.length > 1 ? [all] : []).concat(dogs.map(function (x, i) { return dogRow(state.ticks[i], labelOf[x.id], did[x.id]); })));
          state.dogIds = dogs.map(function (x) { return x.id; });
          if (site) { panel.insertBefore(roomList, panel.firstChild); roomList = null; }
        }
        var problems = h('div', { class: 'job-btns', hidden: true }, [
          h('button', { class: 'btn quiet', type: 'button', text: 'Concern', onclick: function () { send(job, t, 'concern', inputs, panelMsg, state); } }),
          h('button', { class: 'btn quiet', type: 'button', text: 'Not done', onclick: function () { send(job, t, 'not_done', inputs, panelMsg, state); } })
        ]);
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
        if (a.outcome) kids.push(h('button', { class: 'job-prob', type: 'button', text: 'Problem', 'aria-label': 'Problem: ' + job.label, onclick: function () { panel.hidden = false; problems.hidden = false; } }));
        kids.push(panel);
        var card = state.card = h('div', { class: 'card job s-' + job.status, 'data-job': job.type_key }, kids);
        showDone(card, t.type_key, state.dogIds || (dogJob && target.subject_id ? [target.subject_id] : null));
        return card;
      }
      /* one dog in a tick list: a dog with a line today shows a tick and the time */
      function dogRow(box, label, line) {
        var kids = [box, h('span', { text: label || '' })];
        if (line) kids.push(h('span', { class: 'dog-done', html: line._queued ? '' : BLDDone.TICK }), h('span', { class: 'dog-at', text: line._queued ? 'Waiting' : BLDDone.hhmm(line.taken_at) }));
        return h('label', { class: 'job-dog' }, kids);
      }

      function groupCard(name, jobs) {
        var w = worst(jobs);
        return h('button', { class: 'card job go-group s-' + w.status, type: 'button', 'data-group': name, onclick: function () { group = name; say(''); draw(); } }, [
          h('div', { class: 'nm', text: name }), h('div', { class: 'ds', text: dueLine(w) })
        ]);
      }

      function draw() {
        var jobs = BLDDue.forTarget(types, logs, target, today).sort(aToZ);
        list.textContent = '';
        if (group) {
          list.appendChild(h('button', { class: 'back', type: 'button', text: '← All jobs', onclick: function () { group = ''; say(''); draw(); } }));
          list.appendChild(h('h3', { text: group }));
          jobs.filter(function (j) { return j.group === group; }).forEach(function (j) { list.appendChild(jobCard(j)); });
          return;
        }
        var shown = site && !more ? jobs.filter(function (j) { return isDue(j) || kept[j.type_key]; }) : jobs, rest = jobs.length - shown.length, seen = {};
        shown.forEach(function (j) {
          if (!j.group) { list.appendChild(jobCard(j)); return; }
          if (seen[j.group]) return;
          seen[j.group] = true;
          list.appendChild(groupCard(j.group, jobs.filter(function (x) { return x.group === j.group; })));
        });
        if (!shown.length) list.appendChild(h('p', { class: 'sub', text: jobs.length ? 'All done.' : 'No jobs set up.' }));
        if (rest > 0) list.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'More', onclick: function () { more = true; draw(); } }));
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
      var d = v[0], type = v[1].ok ? BLDDue.jobsInForce(v[1].rows, c.today()).filter(function (t) { return t.type_key === REPORT_KEY; })[0] : null;
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
      var note = h('textarea', { class: 'inp', rows: '4', 'aria-label': type.note_label || 'What happened?', placeholder: type.note_label || 'What happened?' });
      var msg = h('p', { class: 'msg', role: 'status' }), rid = null;
      note.addEventListener('input', function () { rid = null; });
      var btn = h('button', { class: 'btn', type: 'button', text: 'Send', onclick: function () {
        var text = note.value.trim();
        if (!text) { msg.className = 'msg bad'; msg.textContent = 'Say what happened.'; return; }
        var f = { check_type_id: type.id, outcome: 'recorded', note: text, how_recorded: 'tapped' };
        if (dog.value) f.subject_id = dog.value;
        if (room.value) f.area_id = room.value;
        rid = rid || c.save.newRequestId(); btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Saving...';
        c.save.submit('check_log', f, { requestId: rid }).then(function (r) {
          btn.disabled = false;
          if (r.ok) { rid = null; note.value = ''; msg.className = 'msg good'; msg.textContent = r.status === 'queued' ? r.message : 'Sent.'; return; }
          msg.className = 'msg bad'; msg.textContent = r.message;
          if (r.code !== 'NETWORK') rid = null;
        });
      } });
      [h('h2', { text: type.label || 'Report' }), dog, room, note, btn, msg].forEach(function (n) { host.appendChild(n); });
    });
  }

  StaffPage.register({ id: 'jobs', title: 'Jobs', icon: ctx0.icons.dogs, order: 5, open: open });
  StaffPage.register({ id: 'report', title: 'Report', hidden: true, open: openReport });
}());
