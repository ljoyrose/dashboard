/*!
 * Scan and move. Works with any phone's own camera: every QR opens this page, and the room being filled is remembered
 * on the phone between scans. Scan a room sign, then each dog card: each scan adds one row to BLD-occupancy.
 * The QR holds only a random id. What it means comes from BLD-qr_tag, read with this phone's staff code.
 */
(function () {
  'use strict';
  var ROOM_KEY = 'bld.move.room', ROOM_MINUTES = 30, ctxIcons = StaffPage.ctx.icons;
  StaffPage.ctx.addTable('occupancy', { label: 'Where the dogs are', file: 'BLD-occupancy.csv', fields: {
    subject_id: { type: 'ref', lookup: 'subject', required: true, label: 'Dog' }, area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' }, classification_note: { type: 'text', label: 'Reason' }
  } });
  StaffPage.ctx.addTable('area_access', { label: 'Flap setting', file: 'BLD-area_access.csv', fields: {
    area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' }, access_type: { type: 'enum', values: ['free', 'limited'], required: true, label: 'Flap' }
  } });
  StaffPage.ctx.addTable('occupancy_out', { label: 'Dog taken out', file: 'BLD-occupancy.csv', fields: {
    subject_id: { type: 'ref', lookup: 'subject', required: true, label: 'Dog' }, off_site_kind: { type: 'enum', values: ['temporary', 'sold', 'owned_by_family', 'deceased'], required: true, label: 'Why' }, classification_note: { type: 'text', label: 'Note' }
  } });

  function getRoom() {
    try {
      var r = JSON.parse(localStorage.getItem(ROOM_KEY) || 'null');
      if (r && Date.now() - r.at < ROOM_MINUTES * 60000) return r;
    } catch (e) { /* nothing remembered */ }
    return null;
  }
  function setRoom(r) { try { if (r) localStorage.setItem(ROOM_KEY, JSON.stringify(r)); else localStorage.removeItem(ROOM_KEY); } catch (e) { /* the page still works for one scan */ } }

  function open(host, c) {
    var h = c.h, tag = c.params.tag;
    function say(text, kind) { return h('p', { class: 'msg ' + (kind || ''), role: 'status', text: text }); }
    host.textContent = 'Loading...';
    Promise.all([c.data(), c.readOptional('qr_tag'), c.readOptional('area_capacity'), c.readOptional('area_access'), c.readOptional('litter'), c.readOptional('capacity_setting')]).then(function (v) {
      var d = v[0], tags = v[1], capacity = v[2].rows, access = v[3].rows, litters = v[4].rows, settings = v[5].rows;
      host.textContent = '';
      if (!d.ok) { host.appendChild(say(d.message, 'bad')); return; }
      var action = (settings.filter(function (s) { return s.setting_key === 'over_capacity_action'; }).pop() || {}).value === 'refuse' ? 'refuse' : 'reason';
      var subj = {}; d.raw.subject.forEach(function (s) { subj[s.id] = s; });
      var damOfLitter = {}; litters.forEach(function (l) { damOfLitter[l.id] = l.dam_subject_id; });
      function fact(id) { var s = subj[id] || {}; return { id: id, size: s.size_band, damId: damOfLitter[s.birth_litter_id] || '' }; }
      function labelOf(id) { return (subj[id] || {}).name || id; }
      function area(id) { return d.areas.filter(function (a) { return a.id === id; })[0]; }
      function inRoom(areaId, extra) {
        var ids = d.dogs.filter(function (x) { return x.areaId === areaId && !x.away; }).map(function (x) { return x.id; });
        (extra || []).forEach(function (x) { if (ids.indexOf(x) < 0) ids.push(x); });
        return ids;
      }
      function checkRoom(areaId, ids) { return BLDCapacity.check({ areaId: areaId, access: BLDCapacity.accessOf(access, areaId), capacity: capacity, dogs: ids.map(fact) }); }
      function capLine(r) {
        if (r.limit === null) return 'Limit: not known. ' + r.notes.join(' ');
        return r.count + ' of ' + r.limit + ' dogs' + (r.access ? ' (' + r.access + ' access)' : '') + (r.notes.length ? '. ' + r.notes.join(' ') : '');
      }

      function drawHome() {
        var room = getRoom();
        host.appendChild(h('h2', { text: room ? 'Filling ' + room.label : 'Scan a room sign' }));
        host.appendChild(h('p', { class: 'sub', text: room ? 'Scan each dog card with your camera. Each scan saves one move.' : 'Point your phone camera at a room sign, then at each dog card.' }));
        if (room) host.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'Finished this room', onclick: function () { setRoom(null); c.go('home'); } }));
        if (!tags.ok) host.appendChild(say('QR codes are not switched on yet: ' + (tags.message || ''), 'warn'));
      }
      if (!tag) { drawHome(); return; }
      if (!tags.ok) { host.appendChild(say('QR codes are not switched on yet: ' + (tags.message || ''), 'bad')); return; }
      var row = tags.rows.filter(function (t) { return t.tag === tag && String(t.active).toLowerCase() !== 'false'; })[0];
      if (!row) { host.appendChild(say('This QR code is not recognised or has been retired.', 'bad')); return; }

      if (row.kind === 'area') drawRoom(row.ref_id);
      else if (row.kind === 'subject') drawDog(row.ref_id);
      else if (row.kind === 'litter') drawLitter(row.ref_id);
      else host.appendChild(say('This QR code is not one the page knows.', 'bad'));

      function drawRoom(areaId) {
        var a = area(areaId);
        if (!a) { host.appendChild(say('That room is not in the room list.', 'bad')); return; }
        var prev = getRoom(), added = prev && prev.areaId === areaId ? prev.added || [] : [];
        setRoom({ areaId: areaId, label: a.label, at: Date.now(), added: added });
        var ids = inRoom(areaId, added), r = checkRoom(areaId, ids);
        host.appendChild(h('h2', { text: a.label }));
        host.appendChild(h('p', { class: 'sub', text: 'Now scan each dog card with your camera. ' + capLine(r) }));
        if (r.status === 'over') host.appendChild(say('This room is already over its limit.', 'bad'));
        var msg = say('');
        function flapBtn(mode) {
          var cur = BLDCapacity.accessOf(access, areaId) === mode;
          return h('button', { class: cur ? 'btn' : 'btn quiet', type: 'button', 'aria-pressed': String(cur), text: mode === 'free' ? 'Flap free' : 'Flap limited', onclick: function () {
            msg.className = 'msg'; msg.textContent = 'Saving...';
            c.save.submit('area_access', { area_id: areaId, access_type: mode }).then(function (res) {
              if (res.ok) { access = access.concat([{ area_id: areaId, access_type: mode }]); msg.className = 'msg good'; msg.textContent = res.status === 'queued' ? res.message : 'Flap saved as ' + mode + '.'; }
              else { msg.className = 'msg bad'; msg.textContent = res.message; }
            });
          } });
        }
        host.appendChild(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [flapBtn('free'), flapBtn('limited')]));
        host.appendChild(msg);
        host.appendChild(h('h3', { text: 'In this room' }));
        var list = h('div', { class: 'cards' });
        ids.forEach(function (id) { list.appendChild(h('button', { class: 'card', type: 'button', onclick: function () { host.textContent = ''; drawDog(id, true); } }, [h('div', { class: 'nm', text: labelOf(id) })])); });
        if (!ids.length) list.appendChild(h('p', { class: 'sub', text: 'No dogs recorded here.' }));
        host.appendChild(list);
      }

      function saveMove(dogId, room, note, done) {
        var f = { subject_id: dogId, area_id: room.areaId };
        if (note) f.classification_note = note;
        c.save.submit('occupancy', f, { requestId: c.save.newRequestId() }).then(function (res) {
          if (res.ok) { room.added = (room.added || []).concat([dogId]); room.at = Date.now(); setRoom(room); }
          done(res);
        });
      }

      /** Warn or refuse if the move would break the limit; otherwise save straight away. */
      function moveOrWarn(ids, room, paint) {
        var would = inRoom(room.areaId, (room.added || []).concat(ids)), r = checkRoom(room.areaId, would);
        var names = ids.map(labelOf).join(', ');
        function send(note) {
          var i = 0, results = [];
          (function next() {
            if (i >= ids.length) { paint(results, r); return; }
            saveMove(ids[i], room, note, function (res) { results.push({ id: ids[i], res: res }); i++; next(); });
          }());
        }
        if (r.status !== 'over') { send(''); return; }
        host.appendChild(h('div', { class: 'card', role: 'alert', style: 'border-color:var(--bad);border-left:3px solid var(--bad)' }, [
          h('div', { class: 'nm', text: '⚠ Over the licence limit' }),
          h('p', { text: 'Moving ' + names + ' puts ' + r.count + ' dogs in ' + room.label + '. The limit is ' + r.limit + (r.access ? ' with ' + r.access + ' access.' : '.') })
        ]));
        if (action === 'refuse') { host.appendChild(say('This move has not been saved. Ask Lisa.', 'bad')); return; }
        var why = h('input', { class: 'inp', type: 'text', maxlength: '500', 'aria-label': 'Why this move is needed', placeholder: 'Why is this move needed?' });
        var err = say('');
        host.appendChild(why); host.appendChild(err);
        host.appendChild(h('button', { class: 'btn', type: 'button', text: 'Save with this reason', onclick: function (e) {
          if (!why.value.trim()) { err.className = 'msg bad'; err.textContent = 'Say why before saving.'; return; }
          e.target.disabled = true; err.textContent = '';
          send(why.value.trim());
        } }));
      }

      function outcome(results) {
        results.forEach(function (x) {
          var res = x.res, ok = res.ok;
          host.appendChild(say(ok ? labelOf(x.id) + (res.status === 'queued' ? ': sent for approval.' : ': moved.') : labelOf(x.id) + ': not saved. ' + res.message + (res.fields ? ' ' + Object.keys(res.fields).map(function (k) { return res.fields[k]; }).join(' ') : ''), ok ? 'good' : 'bad'));
        });
      }

      function drawDog(id, fromRoom) {
        var dog = d.dogs.filter(function (x) { return x.id === id; })[0], room = fromRoom ? null : getRoom();
        host.appendChild(h('h2', { text: labelOf(id) }));
        host.appendChild(h('p', { class: 'sub', text: dog ? (dog.known ? 'Last recorded in ' + dog.areaLabel : 'Room not recorded yet') : 'Not on the list of dogs on site.' }));
        if (room && dog) {
          if (dog.areaId === room.areaId || (room.added || []).indexOf(id) >= 0) host.appendChild(say('Already recorded in ' + room.label + '.', 'good'));
          else moveOrWarn([id], room, function (results, r) { outcome(results); host.appendChild(h('p', { class: 'sub', text: capLine(r) })); });
        } else if (!fromRoom) host.appendChild(say('Scan a room sign first to move this dog.', 'warn'));
        if (dog) host.appendChild(removeBox(id));
      }

      function removeBox(id) {
        var why = h('select', { class: 'inp', 'aria-label': 'Why is this dog leaving' }, [['', 'Choose why'], ['temporary', 'Away for now (vet, groomer)'], ['sold', 'Sold'], ['owned_by_family', 'Gone to family'], ['deceased', 'Died']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
        var msg = say('');
        var box = h('details', { class: 'card', style: 'margin-top:14px' }, [h('summary', { text: 'Take this dog out of its room' }), why,
          h('button', { class: 'btn quiet', type: 'button', text: 'Save', onclick: function () {
            if (!why.value) { msg.className = 'msg bad'; msg.textContent = 'Choose why.'; return; }
            msg.className = 'msg'; msg.textContent = 'Saving...';
            c.save.submit('occupancy_out', { subject_id: id, off_site_kind: why.value }, { requestId: c.save.newRequestId() }).then(function (res) {
              msg.className = 'msg ' + (res.ok ? 'good' : 'bad'); msg.textContent = res.ok ? (res.status === 'queued' ? res.message : 'Saved.') : res.message;
            });
          } }), msg]);
        return box;
      }

      function drawLitter(litterId) {
        var dam = damOfLitter[litterId], pups = d.raw.subject.filter(function (s) { return s.birth_litter_id === litterId; }).map(function (s) { return s.id; });
        var onSite = d.dogs.map(function (x) { return x.id; }), ids = pups.concat(dam ? [dam] : []).filter(function (x) { return onSite.indexOf(x) >= 0; });
        host.appendChild(h('h2', { text: dam ? 'Litter of ' + labelOf(dam) : 'Litter' }));
        host.appendChild(h('p', { class: 'sub', text: ids.length + ' on site' }));
        var room = getRoom();
        if (!ids.length) { host.appendChild(say('This litter has no dogs on site, or the litter list is not switched on yet.', 'warn')); return; }
        if (!room) { host.appendChild(say('Scan a room sign first to move this litter.', 'warn')); return; }
        var moving = ids.filter(function (x) { var y = d.dogs.filter(function (q) { return q.id === x; })[0]; return !(y && y.areaId === room.areaId) && (room.added || []).indexOf(x) < 0; });
        if (!moving.length) { host.appendChild(say('Already recorded in ' + room.label + '.', 'good')); return; }
        host.appendChild(h('button', { class: 'btn', type: 'button', text: 'Move ' + moving.length + ' to ' + room.label, onclick: function (e) {
          e.target.disabled = true;
          moveOrWarn(moving, room, function (results, r) { outcome(results); host.appendChild(h('p', { class: 'sub', text: capLine(r) })); });
        } }));
      }
    });
  }
  StaffPage.register({ id: 'moves', title: 'Scan and move', desc: 'Room sign, then each dog card', icon: ctxIcons.scan, order: 10, open: open });
}());
