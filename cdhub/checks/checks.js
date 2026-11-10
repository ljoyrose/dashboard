/*!
 * BLDChecks - the staff screen for rows-based checks (feeding, medicine, cleaning...).
 * Every check on this screen comes from BLD-check_type rows the owner entered: nothing here names a check.
 * Works on its own (checks.html) or inside another page: BLDChecks.mount(element, bldSave, {type: 'feeding'}).
 * Saves through BLDSave, which holds the code and the Script URL. No data, code or URL is stored in this file.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDChecks = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CHECK_LOG = {
    label: 'Staff checks', file: 'BLD-check_log.csv',
    fields: {
      check_type_id: { type: 'text', required: true, label: 'Check' },
      area_id: { type: 'text', label: 'Room' },
      subject_id: { type: 'text', label: 'Dog' },
      item: { type: 'text', label: 'What' },
      amount: { type: 'text', label: 'Amount' },
      outcome: { type: 'enum', values: ['ok', 'concern', 'not_done', 'recorded'], required: true, label: 'Outcome' },
      note: { type: 'text', label: 'Note' }
    }
  };
  var OUTCOMES = [['ok', 'Done, all fine'], ['concern', 'Done, with a concern'], ['not_done', 'Not done']];

  /** The checks in force today: for each type_key, the row with the latest effective_from on or before today. */
  function currentTypes(rows, today) {
    var best = {};
    (rows || []).forEach(function (r) {
      if (!r.type_key || !r.effective_from || r.effective_from > today) return;
      if (!best[r.type_key] || r.effective_from > best[r.type_key].effective_from) best[r.type_key] = r;
    });
    return Object.keys(best).map(function (k) { return best[k]; })
      .filter(function (r) { return r.active !== 'false'; })
      .sort(function (a, b) { return String(a.label).localeCompare(String(b.label)); });
  }

  function askedFields(type) {
    return {
      area: type.target === 'area' || type.target === 'either' || type.target === 'optional',
      dog: type.target === 'dog' || type.target === 'either' || type.target === 'optional',
      outcome: type.asks_outcome !== 'false',
      noteRequired: type.note_required === 'true',
      item: type.asks_item === 'true',
      amount: type.asks_amount === 'true'
    };
  }

  /** What this check needs before it can be sent. The server knows only the general rules, so these live here. */
  function checkEntry(type, entry) {
    var e = {}, a = askedFields(type);
    if (type.target === 'area' && !entry.area_id) e.area_id = 'Choose the room.';
    if (type.target === 'dog' && !entry.subject_id) e.subject_id = 'Choose the dog.';
    if (type.target === 'either' && !entry.area_id && !entry.subject_id) e.area_id = 'Choose a room or a dog.';
    if (a.item && !entry.item) e.item = 'This is needed.';
    if (a.amount && !entry.amount) e.amount = 'This is needed.';
    if (!entry.outcome) e.outcome = 'Choose one.';
    if ((entry.outcome === 'concern' || entry.outcome === 'not_done') && !entry.note) e.note = 'Say briefly what the concern is or why it was not done.';
    else if (a.noteRequired && !entry.note) e.note = 'This is needed.';
    return e;
  }

  function make(doc, tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function londonToday(now) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now || new Date());
  }

  /** The dogs on site now, A-Z: the same list as The Board, so dogs that have left are not offered. */
  function onSite(t) {
    if (typeof BLDOccupancy === 'undefined') return t.subject || [];
    return BLDOccupancy.dailyList(t).dogs.map(function (d) { return { id: d.id, name: d.label }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function register(save) { if (!save.TABLES.check_log) save.TABLES.check_log = CHECK_LOG; }

  /** Draw the form. opts.type = a type_key to open that check directly (from a QR code). Returns a promise. */
  function mount(host, save, opts) {
    opts = opts || {};
    var doc = host.ownerDocument;
    register(save);
    host.textContent = '';
    host.classList.add('bs');
    var msg = make(doc, 'div', 'bs-banner', 'Loading the checks...');
    msg.setAttribute('role', 'status');
    host.appendChild(msg);

    return save.checkStatus().then(function () {
      var b = save.banner('check_log');
      msg.textContent = b.text;
      if (!b.canSave) return { ok: false, reason: 'off' };
      return save.readMany(['check_type', 'area', 'subject', 'occupancy', 'subject_status'], ['subject', 'occupancy', 'subject_status']).then(function (all) {
        if (!all.ok) { msg.textContent = all.message; return { ok: false, reason: 'read' }; }
        var types = currentTypes(all.tables.check_type, londonToday(opts.now));
        if (!types.length) { msg.textContent = 'No checks have been set up yet. Ask Lisa.'; return { ok: false, reason: 'none' }; }
        draw(host, save, types, all.tables.area, onSite(all.tables), opts.type, msg);
        return { ok: true, types: types.length };
      });
    });
  }

  function draw(host, save, types, areas, dogs, startKey, msg) {
    var doc = host.ownerDocument, requestId = null, type = null;
    var form = make(doc, 'form', 'bs-card'), inputs = {}, errs = {}, rows = {};

    function field(name, label, control) {
      var w = make(doc, 'div', 'bs-field'), l = make(doc, 'label', null, label), er = make(doc, 'div', 'bs-err');
      control.id = 'chk-' + name; control.classList.add('bs-in');
      l.setAttribute('for', control.id);
      w.appendChild(l); w.appendChild(control); w.appendChild(er);
      inputs[name] = control; errs[name] = er; rows[name] = w;
      form.appendChild(w);
    }
    function select(pairs, blank) {
      var s = doc.createElement('select');
      if (blank !== undefined) { var o = make(doc, 'option', null, blank); o.value = ''; s.appendChild(o); }
      pairs.forEach(function (p) { var op = make(doc, 'option', null, p[1]); op.value = p[0]; s.appendChild(op); });
      return s;
    }

    field('check', 'Which check?', select(types.map(function (t) { return [t.type_key, t.label]; })));
    field('area_id', 'Room', select(areas.map(function (a) { return [a.id, a.code || a.id]; }), 'Choose a room'));
    field('subject_id', 'Dog', select(dogs.map(function (d) { return [d.id, d.name || d.id]; }), 'Choose a dog'));
    field('item', 'What', doc.createElement('input'));
    field('amount', 'Amount', doc.createElement('input'));
    field('outcome', 'How did it go?', select(OUTCOMES, 'Choose one'));
    field('note', 'Note', doc.createElement('input'));

    var send = make(doc, 'button', 'bs-btn', 'Save'); send.type = 'submit'; form.appendChild(send);
    var result = make(doc, 'div', 'bs-result'); result.setAttribute('role', 'status'); form.appendChild(result);

    function clearErrors() { Object.keys(errs).forEach(function (k) { errs[k].textContent = ''; }); }
    function showErrors(e) { Object.keys(e || {}).forEach(function (k) { if (errs[k]) errs[k].textContent = e[k]; }); }
    function reset() { requestId = null; ['area_id', 'subject_id', 'item', 'amount', 'outcome', 'note'].forEach(function (k) { inputs[k].value = ''; }); }

    function nameOf(list, id, col) { var hit = list.filter(function (x) { return x.id === id; })[0]; return hit ? (hit[col] || id) : ''; }
    function savedWhat(t, entry) {
      return [t.label, nameOf(dogs, entry.subject_id, 'name'), nameOf(areas, entry.area_id, 'code'), entry.item, entry.amount].filter(String).join(', ') + '.';
    }

    function choose(key) {
      type = types.filter(function (t) { return t.type_key === key; })[0] || types[0];
      inputs.check.value = type.type_key;
      var a = askedFields(type);
      rows.area_id.hidden = !a.area; rows.subject_id.hidden = !a.dog; rows.item.hidden = !a.item; rows.amount.hidden = !a.amount;
      rows.outcome.hidden = !a.outcome;
      rows.item.querySelector('label').textContent = type.item_label || 'What';
      rows.amount.querySelector('label').textContent = type.amount_unit ? 'Amount (' + type.amount_unit + ')' : 'Amount';
      rows.note.querySelector('label').textContent = type.note_label || 'Note';
      clearErrors(); result.textContent = ''; reset();
    }

    inputs.check.addEventListener('change', function () { choose(inputs.check.value); });
    // changing anything makes it a new entry, so a retry only re-uses the reference while the entry is unchanged
    form.addEventListener('input', function (ev) { if (ev.target !== inputs.check) requestId = null; });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearErrors(); result.textContent = '';
      var a = askedFields(type), entry = { check_type_id: type.id, outcome: a.outcome ? inputs.outcome.value : 'recorded' };
      if (a.area) entry.area_id = inputs.area_id.value;
      if (a.dog) entry.subject_id = inputs.subject_id.value;
      if (a.item) entry.item = inputs.item.value.trim();
      if (a.amount) entry.amount = inputs.amount.value.trim();
      entry.note = inputs.note.value.trim();
      var problems = checkEntry(type, entry);
      if (Object.keys(problems).length) { showErrors(problems); return; }
      requestId = requestId || save.newRequestId();
      send.disabled = true; result.textContent = 'Saving...';
      return save.submit('check_log', entry, { requestId: requestId }).then(function (r) {
        send.disabled = false;
        if (r.ok) { reset(); result.textContent = r.message + ' ' + savedWhat(type, entry); return; }
        result.textContent = r.message;
        showErrors(r.fields);
        if (r.code !== 'NETWORK') requestId = null;
      });
    });

    host.appendChild(form);
    choose(startKey);
  }

  return { mount: mount, currentTypes: currentTypes, askedFields: askedFields, checkEntry: checkEntry, register: register, CHECK_LOG: CHECK_LOG };
}));
