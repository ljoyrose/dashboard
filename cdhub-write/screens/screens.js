/*!
 * BLDScreens - the two staff screens for the write path:
 *   temperatureEntry(host, opts)  room min/max temperatures
 *   staffInput(host, opts)        staff roster (owner only)
 *
 * They are plain DOM, no framework, and use the page's own colours (see bld-save.css), so the same
 * code drops into the Bloodline redesign, the Board, or the standalone test page.
 *
 * They only ever call BLDSave.submit. They never write to Drive.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDScreens = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var G = typeof globalThis !== 'undefined' ? globalThis : {};

  function el(doc, tag, attrs, kids) {
    var e = doc.createElement(tag), k;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return e;
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  /* ----- shared pieces: banner + staff code box ----- */
  function mountHeader(doc, host, save, tableKey, onChange) {
    var banner = el(doc, 'div', { class: 'bs-banner', role: 'status', 'aria-live': 'polite' });
    var codeIn = el(doc, 'input', { type: 'password', autocomplete: 'off', class: 'bs-in', 'aria-label': 'Your staff code', placeholder: 'Your staff code', value: save.getCode() });
    var codeRow = el(doc, 'label', { class: 'bs-field' }, [
      el(doc, 'span', { class: 'bs-lab', text: 'Staff code' }), codeIn,
      el(doc, 'span', { class: 'bs-hint', text: 'Kept on this screen only until you close the tab.' })
    ]);
    codeIn.addEventListener('input', function () { save.setCode(codeIn.value); onChange(); });
    function paint() {
      var b = save.banner(tableKey);
      banner.className = 'bs-banner bs-' + b.kind;
      banner.textContent = b.text;
      return b;
    }
    host.appendChild(banner);
    host.appendChild(codeRow);
    paint();
    return { paint: paint, codeRow: codeRow };
  }

  function fieldRow(doc, label, input, errNode, hint) {
    return el(doc, 'label', { class: 'bs-field' }, [el(doc, 'span', { class: 'bs-lab', text: label }), input, hint ? el(doc, 'span', { class: 'bs-hint', text: hint }) : null, errNode]);
  }

  function showErrors(map, errs, general) {
    Object.keys(map).forEach(function (k) { map[k].textContent = errs && errs[k] ? errs[k] : ''; });
    if (general) general.textContent = '';
  }

  /* ================================================================== temperature entry */
  /**
   * @param {HTMLElement} host
   * @param {Object} o
   *   save       BLDSave instance (required)
   *   areas      [{id, label, group}]  rooms, from the area list the page already loaded
   *   bandForArea(areaId) -> {band:{band,min,max}, dogId, days} | {reason}   optional (uses BLDBands)
   *   actionFor(value)    -> text   optional
   *   document   (tests only)
   */
  function temperatureEntry(host, o) {
    var doc = o.document || host.ownerDocument || document;
    var save = o.save;
    clear(host);
    host.classList.add('bs');
    host.appendChild(el(doc, 'h2', { class: 'bs-h', text: 'Room temperatures' }));
    host.appendChild(el(doc, 'p', { class: 'bs-sub', text: 'Read the min/max thermometer, then type both numbers to 2 decimal places exactly as shown. A saved reading is never edited: a mistake is fixed by sending a correction.' }));

    var cards = el(doc, 'div', { class: 'bs-cards' });
    var header = mountHeader(doc, host, save, 'area_reading', refreshButtons);
    host.appendChild(cards);

    var areas = o.areas || [];
    var buttons = [];

    function refreshButtons() {
      var b = header.paint();
      buttons.forEach(function (x) { x.disabled = !b.canSave; x.setAttribute('aria-disabled', String(!b.canSave)); });
    }

    if (!areas.length) {
      cards.appendChild(el(doc, 'div', { class: 'bs-empty', text: 'No rooms are loaded, so nothing can be entered. The room list comes from BLD-area.csv: sign in to Drive and reload.' }));
      return { refresh: refreshButtons };
    }

    areas.forEach(function (a) {
      var minIn = el(doc, 'input', { class: 'bs-in', inputmode: 'decimal', autocomplete: 'off', placeholder: '00.00', 'aria-label': a.label + ' lowest' });
      var maxIn = el(doc, 'input', { class: 'bs-in', inputmode: 'decimal', autocomplete: 'off', placeholder: '00.00', 'aria-label': a.label + ' highest' });
      var spotIn = el(doc, 'input', { class: 'bs-in', inputmode: 'decimal', autocomplete: 'off', placeholder: 'optional', 'aria-label': a.label + ' spot reading' });
      var noteIn = el(doc, 'input', { class: 'bs-in', type: 'text', maxlength: '500', placeholder: 'e.g. fans on, doors open' });
      var errs = { min_c: el(doc, 'span', { class: 'bs-err' }), max_c: el(doc, 'span', { class: 'bs-err' }), spot_c: el(doc, 'span', { class: 'bs-err' }), mitigation_note: el(doc, 'span', { class: 'bs-err' }), area_id: el(doc, 'span', { class: 'bs-err' }) };
      var bandNote = el(doc, 'div', { class: 'bs-band' });
      var noteRow = fieldRow(doc, 'What was done about it', noteIn, errs.mitigation_note, 'Needed when a reading is outside the band.');
      noteRow.hidden = true;
      var result = el(doc, 'div', { class: 'bs-result', role: 'status', 'aria-live': 'polite' });
      var requestId = null; // reused if the same entry is sent again after a network failure
      var btn = el(doc, 'button', { class: 'bs-btn', type: 'button', text: 'Save' });
      buttons.push(btn);

      var band = o.bandForArea ? o.bandForArea(a.id) : null;
      if (band && band.band) bandNote.textContent = 'Band: ' + band.band.band + ', ' + Number(band.band.min).toFixed(2) + ' to ' + Number(band.band.max).toFixed(2) + ' C (set by the youngest dog in the room, ' + band.days + ' days old).';
      else if (band && band.reason) bandNote.textContent = 'No band: ' + band.reason + '.';

      function outOfBand() {
        var Bands = o.BLDBands || G.BLDBands;
        if (!band || !band.band || !Bands) return '';
        var vmin = Bands.verdict(minIn.value, band.band), vmax = Bands.verdict(maxIn.value, band.band);
        if ((vmin && vmin !== 'ok') || (vmax && vmax !== 'ok')) {
          var act = o.actionFor ? (o.actionFor(vmax === 'high' ? maxIn.value : minIn.value) || '') : '';
          return (vmin === 'low' || vmax === 'low' ? 'below' : 'above') + ' the band' + (act ? ' - ' + act : '');
        }
        return '';
      }
      function onType() {
        requestId = null; // the entry changed, so it is a new request
        var oob = outOfBand();
        noteRow.hidden = !oob;
        bandNote.setAttribute('data-oob', oob ? 'yes' : 'no');
        if (oob) bandNote.textContent = (band.band ? 'Band: ' + band.band.band + ', ' + Number(band.band.min).toFixed(2) + ' to ' + Number(band.band.max).toFixed(2) + ' C. ' : '') + 'This reading is ' + oob + '.';
      }
      [minIn, maxIn].forEach(function (i) { i.addEventListener('input', onType); });

      btn.addEventListener('click', function () {
        showErrors(errs, null);
        result.textContent = ''; result.className = 'bs-result';
        var fields = { area_id: a.id, min_c: minIn.value, max_c: maxIn.value };
        if (spotIn.value.trim()) fields.spot_c = spotIn.value;
        if (!noteRow.hidden) {
          if (!noteIn.value.trim()) { errs.mitigation_note.textContent = 'Say what was done about it.'; return; }
          fields.mitigation_note = noteIn.value;
        }
        btn.disabled = true;
        requestId = requestId || save.newRequestId();
        save.submit('area_reading', fields, { requestId: requestId }).then(function (r) {
          btn.disabled = !save.banner('area_reading').canSave;
          if (r.ok) {
            result.className = 'bs-result bs-ok';
            result.textContent = r.message + ' (' + r.id + ')';
            requestId = null;
            [minIn, maxIn, spotIn, noteIn].forEach(function (i) { i.value = ''; });
            noteRow.hidden = true;
            result.appendChild(correctionLink(doc, save, a, r, result));
          } else {
            result.className = 'bs-result bs-bad';
            result.textContent = r.message;
            if (r.fields) showErrors(errs, r.fields);
            if (r.code !== 'NETWORK') requestId = null;
          }
        });
      });

      cards.appendChild(el(doc, 'section', { class: 'bs-card', 'data-area': a.id }, [
        el(doc, 'h3', { class: 'bs-card-h', text: a.label + (a.group ? '  ·  ' + a.group : '') }),
        bandNote,
        el(doc, 'div', { class: 'bs-pair' }, [fieldRow(doc, 'Lowest (min) C', minIn, errs.min_c), fieldRow(doc, 'Highest (max) C', maxIn, errs.max_c)]),
        fieldRow(doc, 'Spot reading C (optional)', spotIn, errs.spot_c),
        noteRow, errs.area_id, btn, result
      ]));
    });
    refreshButtons();
    return { refresh: refreshButtons };
  }

  /** "Something wrong? Send a correction" under a successful save. */
  function correctionLink(doc, save, area, saved, resultNode) {
    var wrap = el(doc, 'div', { class: 'bs-corr' });
    var open = el(doc, 'button', { class: 'bs-link', type: 'button', text: 'Something wrong? Send a correction' });
    open.addEventListener('click', function () {
      open.hidden = true;
      var why = el(doc, 'input', { class: 'bs-in', type: 'text', maxlength: '500', placeholder: 'Why? e.g. typed the wrong digit' });
      var mn = el(doc, 'input', { class: 'bs-in', inputmode: 'decimal', placeholder: 'right min' });
      var mx = el(doc, 'input', { class: 'bs-in', inputmode: 'decimal', placeholder: 'right max' });
      var msg = el(doc, 'div', { class: 'bs-err' });
      var send = el(doc, 'button', { class: 'bs-btn', type: 'button', text: 'Send correction' });
      var rid = null;
      send.addEventListener('click', function () {
        rid = rid || save.newRequestId();
        send.disabled = true;
        save.submit('area_reading', { area_id: area.id, min_c: mn.value, max_c: mx.value }, { action: 'correct', correctsId: saved.id, reason: why.value, requestId: rid })
          .then(function (r) {
            send.disabled = false;
            if (r.ok) { msg.className = 'bs-ok'; msg.textContent = 'Correction sent. It waits for Lisa to approve it; the first entry stays on record.'; send.hidden = true; }
            else { msg.className = 'bs-err'; msg.textContent = r.message + (r.fields ? ' ' + Object.keys(r.fields).map(function (k) { return r.fields[k]; }).join(' ') : ''); if (r.code !== 'NETWORK') rid = null; }
          });
      });
      wrap.appendChild(el(doc, 'div', { class: 'bs-pair' }, [mn, mx]));
      wrap.appendChild(why); wrap.appendChild(send); wrap.appendChild(msg);
    });
    wrap.appendChild(open);
    return wrap;
  }

  /* ================================================================== staff input */
  /**
   * @param {Object} o  save, people [{id,label}], document (tests)
   * Owner only; always goes through approval. Honest empty states when the roster file or people list is missing.
   */
  function staffInput(host, o) {
    var doc = o.document || host.ownerDocument || document;
    var save = o.save;
    clear(host);
    host.classList.add('bs');
    host.appendChild(el(doc, 'h2', { class: 'bs-h', text: 'Staff roster' }));
    host.appendChild(el(doc, 'p', { class: 'bs-sub', text: 'Add a member of staff to the roster. Owner only. Every entry waits for approval and is never edited afterwards: a change is a new entry.' }));
    var form = el(doc, 'div', { class: 'bs-card' });
    var header = mountHeader(doc, host, save, 'staff', refresh);
    host.appendChild(form);

    var people = o.people || [];
    if (!people.length) {
      form.appendChild(el(doc, 'div', { class: 'bs-empty', text: 'No people are loaded, so the roster cannot be filled in. The list comes from BLD-person.csv: sign in to Drive and reload.' }));
      return { refresh: refresh };
    }
    var sel = el(doc, 'select', { class: 'bs-in', 'aria-label': 'Person' }, [el(doc, 'option', { value: '', text: 'Choose a person' })]
      .concat(people.map(function (p) { return el(doc, 'option', { value: p.id, text: p.label }); })));
    var role = el(doc, 'input', { class: 'bs-in', type: 'text', maxlength: '100', placeholder: 'e.g. Kennel assistant' });
    var emp = el(doc, 'select', { class: 'bs-in', 'aria-label': 'Full or part time' }, [
      el(doc, 'option', { value: '', text: 'Choose' }), el(doc, 'option', { value: 'full_time', text: 'Full time' }), el(doc, 'option', { value: 'part_time', text: 'Part time' })]);
    var started = el(doc, 'input', { class: 'bs-in', type: 'date' });
    var ended = el(doc, 'input', { class: 'bs-in', type: 'date' });
    var errs = { person_id: el(doc, 'span', { class: 'bs-err' }), role: el(doc, 'span', { class: 'bs-err' }), employment: el(doc, 'span', { class: 'bs-err' }), started_on: el(doc, 'span', { class: 'bs-err' }), ended_on: el(doc, 'span', { class: 'bs-err' }) };
    var result = el(doc, 'div', { class: 'bs-result', role: 'status', 'aria-live': 'polite' });
    var btn = el(doc, 'button', { class: 'bs-btn', type: 'button', text: 'Send for approval' });
    var requestId = null;
    btn.addEventListener('click', function () {
      showErrors(errs, null); result.textContent = ''; result.className = 'bs-result';
      var fields = { person_id: sel.value, role: role.value, employment: emp.value, started_on: started.value };
      if (ended.value) fields.ended_on = ended.value;
      btn.disabled = true;
      requestId = requestId || save.newRequestId();
      save.submit('staff', fields, { requestId: requestId }).then(function (r) {
        btn.disabled = !save.banner('staff').canSave;
        if (r.ok) { result.className = 'bs-result bs-ok'; result.textContent = r.message + ' (' + r.id + ')'; requestId = null; }
        else { result.className = 'bs-result bs-bad'; result.textContent = r.message; if (r.fields) showErrors(errs, r.fields); if (r.code !== 'NETWORK') requestId = null; }
      });
    });
    [sel, role, emp, started, ended].forEach(function (i) { i.addEventListener('input', function () { requestId = null; }); });
    form.appendChild(fieldRow(doc, 'Person', sel, errs.person_id));
    form.appendChild(fieldRow(doc, 'Role', role, errs.role));
    form.appendChild(fieldRow(doc, 'Full or part time', emp, errs.employment));
    form.appendChild(el(doc, 'div', { class: 'bs-pair' }, [fieldRow(doc, 'Started', started, errs.started_on), fieldRow(doc, 'Ended (if left)', ended, errs.ended_on)]));
    form.appendChild(btn); form.appendChild(result);
    function refresh() { var b = header.paint(); btn.disabled = !b.canSave; btn.setAttribute('aria-disabled', String(!b.canSave)); }
    refresh();
    return { refresh: refresh };
  }

  return { temperatureEntry: temperatureEntry, staffInput: staffInput };
}));
