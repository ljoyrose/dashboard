/*!
 * Breed Better: Add dog. One component for the standalone app, the BLD suite and the CD Hub.
 * Everything about the place it runs in comes through an adapter; nothing hub-only is in here.
 *
 *   adapter = {
 *     canWrite()                              -> true once a save route exists
 *     listCandidates()                        -> [{id, name, sex, dob, photo}]  animals already held, not yet enrolled
 *     species()                               -> [{id, name, sexes:[...]}]       the species rows, with their own sex words
 *     kinds()                                 -> optional, the kind words from rows (e.g. Adult, Pup)
 *     createSubject(fields, photoFile)        -> Promise<{id}>  (standalone and suite; the hub adds pups this way too)
 *     enrol(subjectId, schemeId, fromDate)    -> Promise
 *     photoUrl(photo)                         -> optional, a picture address for a candidate's photo cell
 *   }
 *   opts = { mode: 'pick' | 'new', schemeId, today, litterId, damName }
 *
 * Picking an existing animal links its record, so its photo (the subject's photo cell) comes with it. Nothing is copied.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BBAddDog = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function esc(s) { return t(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var NOSAVE = 'Saving is not set up yet.';

  /** Checks before saving. Returns { field: message }; empty when fine. No limits here: dates only must be real and not in the future. */
  function check(f, today) {
    var e = {};
    if (!t(f.name)) e.name = 'Add a name.';
    if (t(f.dob) && !/^\d{4}-\d{2}-\d{2}$/.test(t(f.dob))) e.dob = 'Use a date.';
    else if (t(f.dob) && today && f.dob > today) e.dob = 'Date of birth is in the future.';
    if (!t(f.species)) e.species = 'Pick a species.';
    if (!t(f.sex)) e.sex = 'Pick a sex.';
    return e;
  }

  function field(id, label, input, err) {
    return '<label class="bb-lab" for="' + id + '">' + label + input + (err ? '<span class="bb-err" role="alert">' + esc(err) + '</span>' : '') + '</label>';
  }

  /** The form. state = { mode, q, picked, fields, errors, busy, done, message } */
  function html(adapter, opts, state) {
    state = state || {};
    var can = !!(adapter && adapter.canWrite && adapter.canWrite());
    var mode = state.mode || opts.mode || 'new';
    var tabs = adapter.listCandidates ? '<div class="bb-filt" role="group" aria-label="How">'
      + '<button type="button" class="bb-f" data-ad-mode="pick" aria-pressed="' + (mode === 'pick') + '">Already on file</button>'
      + '<button type="button" class="bb-f" data-ad-mode="new" aria-pressed="' + (mode === 'new') + '">New ' + (opts.litterId ? 'pup' : 'dog') + '</button></div>' : '';
    var out = '<div class="card bb-add" data-ad-root="1">' + tabs;
    if (state.done) return out + '<p class="bb-strong">✓ ' + esc(state.done) + '</p></div>';
    if (mode === 'pick') {
      var q = t(state.q).toLowerCase(), list = (adapter.listCandidates() || []).filter(function (d) { return !q || t(d.name).toLowerCase().indexOf(q) !== -1; });
      out += field('adQ', 'Find', '<input id="adQ" type="search" data-ad-q="1" autocomplete="off" value="' + esc(state.q) + '">')
        + (list.length ? list.map(function (d) {
          var pic = d.photo && adapter.photoUrl ? adapter.photoUrl(d.photo) : '';
          return '<button type="button" class="bb-dog" data-ad-pick="' + esc(d.id) + '" aria-pressed="' + (state.picked === d.id) + '">'
            + '<span class="bb-pic bb-pic44">' + (pic ? '<img alt="" src="' + esc(pic) + '">' : '') + '</span>'
            + '<span class="bb-name">' + esc(d.name) + '</span><span class="bb-pts">' + esc([d.sex, d.dob].filter(Boolean).join(', ')) + '</span></button>';
        }).join('') : '<p class="mut">None to add.</p>');
    } else {
      var f = state.fields || {}, er = state.errors || {}, sp = (adapter.species && adapter.species()) || [];
      var cur = sp.filter(function (s) { return s.id === f.species; })[0] || sp[0] || { sexes: [] };
      if (opts.litterId) out += '<p class="bb-pts">Pup from ' + esc(opts.damName || 'this litter') + '.</p>';
      out += field('adSpecies', 'Species', '<select id="adSpecies" data-ad-f="species">' + sp.map(function (s) {
          return '<option value="' + esc(s.id) + '"' + (s === cur ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('') + '</select>', er.species)
        + field('adName', 'Name', '<input id="adName" data-ad-f="name" autocomplete="off" value="' + esc(f.name) + '">', er.name)
        + field('adSex', 'Sex', '<select id="adSex" data-ad-f="sex"><option value=""></option>' + (cur.sexes || []).map(function (x) {
          return '<option' + (f.sex === x ? ' selected' : '') + '>' + esc(x) + '</option>';
        }).join('') + '</select>', er.sex)
        + (adapter.kinds ? field('adKind', 'Kind', '<select id="adKind" data-ad-f="kind">' + adapter.kinds().map(function (x) {
          return '<option' + (f.kind === x ? ' selected' : '') + '>' + esc(x) + '</option>';
        }).join('') + '</select>') : '')
        + field('adDob', 'DOB', '<input id="adDob" type="date" data-ad-f="dob" value="' + esc(f.dob) + '">', er.dob)
        + field('adColour', 'Colour', '<input id="adColour" data-ad-f="colour" value="' + esc(f.colour) + '">')
        + field('adChip', 'Chip', '<input id="adChip" data-ad-f="chip" inputmode="numeric" value="' + esc(f.chip) + '">')
        + field('adPhoto', 'Photo', '<input id="adPhoto" type="file" accept="image/*" data-ad-photo="1">');
    }
    var ready = mode === 'pick' ? !!state.picked : true;
    out += (state.message ? '<p class="bb-err" role="alert">' + esc(state.message) + '</p>' : '')
      + '<button type="button" class="bb-f" data-ad-save="1"' + (can && ready && !state.busy ? '' : ' disabled') + '>' + (state.busy ? 'Saving…' : 'Save') + '</button>'
      + (can ? '' : ' <span class="bb-pts">' + NOSAVE + '</span>') + '</div>';
    return out;
  }

  /** Save: pick = enrol the chosen animal; new = create it (with the photo), then enrol. Resolves to the subject id. */
  function save(adapter, opts, state, photoFile) {
    if (!adapter.canWrite || !adapter.canWrite()) return Promise.reject(new Error(NOSAVE));
    var from = opts.today || '';
    if ((state.mode || opts.mode) === 'pick') {
      if (!state.picked) return Promise.reject(new Error('Pick an animal.'));
      return Promise.resolve(adapter.enrol(state.picked, opts.schemeId, from)).then(function () { return state.picked; });
    }
    var f = Object.assign({}, state.fields || {});
    if (!t(f.species)) { var sp = (adapter.species && adapter.species()) || []; if (sp[0]) f.species = sp[0].id; }
    var e = check(f, opts.today);
    if (Object.keys(e).length) { var err = new Error('Check the form.'); err.fields = e; return Promise.reject(err); }
    if (opts.litterId) f.birth_litter_id = opts.litterId;
    if (!t(f.kind) && adapter.kinds) f.kind = adapter.kinds()[0] || '';
    return Promise.resolve(adapter.createSubject(f, photoFile || null)).then(function (made) {
      if (!made || !made.id) throw new Error('The animal was not saved.');
      return opts.schemeId ? Promise.resolve(adapter.enrol(made.id, opts.schemeId, from)).then(function () { return made.id; }) : made.id;
    });
  }

  /** Wire a mounted form: redraws itself in place. */
  function bind(el, adapter, opts, onDone) {
    var state = { mode: opts.mode || (adapter.listCandidates ? 'pick' : 'new'), fields: {} }, photo = null;
    function draw() { el.innerHTML = html(adapter, opts, state); }
    el.addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-ad-f');
      if (k) state.fields[k] = e.target.value;
      if (e.target.hasAttribute('data-ad-q')) { state.q = e.target.value; draw(); var q = el.querySelector('#adQ'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    });
    el.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-ad-f');
      if (k) { state.fields[k] = e.target.value; if (k === 'species') draw(); }
      if (e.target.hasAttribute('data-ad-photo')) photo = e.target.files && e.target.files[0] || null;
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-ad-mode],[data-ad-pick],[data-ad-save]');
      if (!b || b.disabled) return;
      if (b.hasAttribute('data-ad-mode')) { state.mode = b.getAttribute('data-ad-mode'); state.message = ''; draw(); return; }
      if (b.hasAttribute('data-ad-pick')) { state.picked = b.getAttribute('data-ad-pick'); draw(); return; }
      state.busy = true; state.message = ''; state.errors = {}; draw();
      save(adapter, opts, state, photo).then(function (id) {
        state.busy = false; state.done = 'Saved.'; draw(); if (onDone) onDone(id);
      }, function (err) {
        state.busy = false; state.errors = err.fields || {}; state.message = err.message || 'Not saved.'; draw();
      });
    });
    draw();
  }

  return { html: html, bind: bind, save: save, check: check, NOSAVE: NOSAVE };
}));
