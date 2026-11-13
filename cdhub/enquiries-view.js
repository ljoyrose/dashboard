/*!
 * Puppy enquiries inside CD Hub. Reads the enquiries list and the BLD tables already loaded by the hub.
 * Example mode (empty sheet id) shows invented rows and sends nothing. Writes stay behind cdhub.enquiriesWrites.
 */
(function (root) {
  'use strict';
  var Core = root.EnquiriesCore;
  var Examples = root.EnquiriesExamples;
  if (!Core && typeof require === 'function') Core = require('../enquiries/core.js');
  if (!Examples && typeof require === 'function') Examples = require('../enquiries/examples.js');

  var FILES = ['BLD-person.csv', 'BLD-household.csv', 'BLD-household_member.csv', 'BLD-subject_owner.csv', 'BLD-sale.csv', 'BLD-match_candidate.csv'];
  var VIEWS = [['home', 'Home'], ['today', 'Today'], ['all', 'All'], ['litters', 'Litters'], ['add', 'Add']];
  var WORD = { young: 'young_word', female: 'adult_female_word', male: 'adult_male_word', birth: 'birth_event_word' };
  var state = { view: 'home', key: '', litter: '', stage: '', msg: '', tabs: null, example: true };

  function t(v) { return v == null ? '' : String(v).trim(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dmy(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t(iso));
    return m ? m[3] + '/' + m[2] + '/' + m[1].slice(2) : '';
  }
  function cfg() { return (root.DASH_CONFIG && root.DASH_CONFIG.enquiries) || {}; }
  function writesOn() { return !!(root.DASH_CONFIG && root.DASH_CONFIG.cdhub && root.DASH_CONFIG.cdhub.enquiriesWrites); }
  function rows(T, name) { return (T && T[name]) || []; }

  function speciesWord(speciesRows, speciesId, which) {
    var col = WORD[which];
    if (!col || !t(speciesId)) return '';
    var hit = (speciesRows || []).filter(function (r) { return r.id === speciesId; })[0];
    return hit ? t(hit[col]) : '';
  }

  function litterChoices(litters) {
    return (litters || []).map(function (r) {
      var dob = t(r.dob) || t(r.born_on);
      var label = [t(r.pairing), dmy(dob)].filter(Boolean).join(' ');
      return { id: t(r.id), label: label || t(r.id), dob: dob };
    }).filter(function (r) { return r.id; }).sort(function (a, b) {
      return String(b.dob).localeCompare(String(a.dob)) || a.label.localeCompare(b.label);
    });
  }

  function linkedLitterId(e, litters) {
    var id = t(e && e.bld_litter_id);
    return id || Core.bldLitterFor(e && e.litter_ref, litters);
  }

  function litterWords(e, litters) {
    var id = linkedLitterId(e, litters);
    if (!id) return 'not linked';
    var row = (litters || []).filter(function (r) { return t(r.id) === id; })[0];
    if (!row) return id;
    var label = [t(row.pairing), dmy(t(row.dob) || t(row.born_on))].filter(Boolean).join(' ');
    return label || id;
  }

  function subjectFor(e, litters, subjects) {
    var id = t(e && e.bld_subject_id);
    if (!id) id = Core.bldSubjectFor(e && e.pup_ref, linkedLitterId(e, litters), subjects);
    if (!id) return null;
    return (subjects || []).filter(function (s) { return t(s.id) === id; })[0] || { id: id };
  }

  function pupLabel(sub, speciesRows) {
    if (!sub) return '';
    if (t(sub.name)) return t(sub.name);
    return speciesWord(speciesRows, sub.species, 'young') || t(sub.id);
  }

  /** Assigned or Owner, with the household name read from the household row at run time. */
  function householdLine(T, subjectId) {
    var owners = rows(T, 'BLD-subject_owner.csv').filter(function (r) { return r.subject_id === subjectId; });
    var row = owners.filter(function (r) { return r.role === 'owner'; })[0] || owners.filter(function (r) { return r.role === 'assigned'; })[0];
    if (!row) return '';
    var word = row.role === 'owner' ? 'Owner' : 'Assigned';
    var home = rows(T, 'BLD-household.csv').filter(function (h) { return h.id === row.household_id; })[0];
    var name = home ? t(home.name) : '';
    if (!name && home) {
      var person = rows(T, 'BLD-person.csv').filter(function (p) { return p.id === home.primary_person_id; })[0];
      name = person ? t(person.known_as || person.full_name) : '';
    }
    return name ? word + ' · ' + name : word;
  }

  function matchScore(T, subjectId) {
    var hit = rows(T, 'BLD-match_candidate.csv').filter(function (r) { return r.subject_id === subjectId && r.person_id; })[0];
    return hit ? t(hit.score) : '';
  }

  function ensureTabs() {
    var c = cfg();
    state.example = !t(c.sheetId);
    if (state.example) { state.tabs = Examples.build(); return; }
    if (!state.tabs) state.tabs = { Enquiries: [], People: [], Litters: [], Deposits: [], FollowUps: [], Drafts: [], Events: [] };
  }

  function shown(list, litters) {
    return (list || []).filter(function (e) {
      if (state.litter && linkedLitterId(e, litters) !== state.litter) return false;
      if (state.stage && Core.plainStage(e) !== state.stage) return false;
      return true;
    });
  }

  function writeButton(e) {
    if (!writesOn()) return '';
    var s = Core.plainStage(e);
    if (s !== 'deposit' && s !== 'working to collection' && s !== 'after collection') return '';
    return '<button type="button" class="btn" data-enq-write data-key="' + esc(e.key) + '">Add to BLD</button>';
  }

  function seg() {
    return '<div class="seg" role="tablist" aria-label="Enquiries">' + VIEWS.map(function (x) {
      var on = state.view === x[0] || (state.view === 'e' && x[0] === 'all');
      return '<button type="button" data-go="enquiries/' + x[0] + '" aria-pressed="' + on + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
  }

  function stageSeg() {
    var all = [''].concat(Core.PLAIN_STAGES);
    return '<div class="seg" role="group" aria-label="Stage">' + all.map(function (s) {
      return '<button type="button" data-enq-stage="' + esc(s) + '" aria-pressed="' + (state.stage === s) + '">' + esc(s || 'Any stage') + '</button>';
    }).join('') + '</div>';
  }

  function litterSelect(litters) {
    var opts = litterChoices(litters);
    return '<div class="filt"><label>Litter <select id="enqLitter" data-enq-litter aria-label="Litter"><option value="">All litters</option>' +
      opts.map(function (o) {
        return '<option value="' + esc(o.id) + '"' + (state.litter === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select></label></div>';
  }

  function rowHtml(e, litters, subjects, speciesRows) {
    var stage = Core.plainStage(e);
    var sub = subjectFor(e, litters, subjects);
    var pup = '';
    if (sub) pup = ' <a class="btn" href="#/dogs/' + esc(sub.id) + '">' + esc(pupLabel(sub, speciesRows) || sub.id) + '</a>';
    else if (t(e.pup_ref)) pup = ' <span>' + esc(e.pup_ref) + '</span>';
    return '<div class="card" data-enq="' + esc(e.key) + '"><p><a class="btn" href="#/enquiries/' + esc(e.key) + '">' + esc(e.ref || e.key) + '</a>' +
      (stage ? ' <span class="pill" data-plain-stage>' + esc(stage) + '</span>' : '') +
      ' <span data-litter-label>' + esc(litterWords(e, litters)) + '</span>' + pup + '</p>' +
      '<p class="mut">' + esc(Core.summary(e.question_summary || e.kind || '', 120)) + '</p>' + writeButton(e) + '</div>';
  }

  function shell(body) {
    var stamp = state.example ? '<p><span class="pill" data-enq-stamp>TEST</span></p>' : '';
    return '<h2>Enquiries</h2>' + seg() + stamp + stageSeg() +
      '<p class="mut" data-enq-msg role="status">' + esc(state.msg) + '</p>' + body;
  }

  function pageHome(v, litters, subjects, speciesRows) {
    var hv = Core.hubView(state.tabs, {});
    var list = shown(state.tabs.Enquiries, litters);
    return shell(litterSelect(litters) +
      '<div class="card"><p><b>' + hv.counts.hot + '</b> hot · <b>' + hv.counts.newToday + '</b> received today · <b>' + hv.counts.openPups + '</b> open</p></div>' +
      (list.length ? list.map(function (e) { return rowHtml(e, litters, subjects, speciesRows); }).join('') : '<p class="mut">No enquiries for this litter.</p>'));
  }

  function pageToday(litters, subjects, speciesRows) {
    var hv = Core.hubView(state.tabs, {});
    var calls = hv.today.calls || [], fus = hv.today.followups || [];
    var byKey = {};
    (state.tabs.Enquiries || []).forEach(function (e) { byKey[e.key] = e; });
    var body = '<div class="card"><h3>Today</h3>';
    if (!calls.length && !fus.length) body += '<p class="mut">No calls in the next 48 hours and no follow-ups due.</p>';
    calls.forEach(function (c) {
      var e = byKey[c.enquiry_key] || { key: c.enquiry_key, ref: c.ref };
      body += '<p><a class="btn" href="#/enquiries/' + esc(c.enquiry_key) + '">' + esc(c.ref || c.enquiry_key) + '</a> <span class="pill" data-plain-stage>' + esc(Core.plainStage(e)) + '</span></p>';
    });
    fus.forEach(function (f) {
      var e = byKey[f.enquiry_key] || { key: f.enquiry_key };
      body += '<p><a class="btn" href="#/enquiries/' + esc(f.enquiry_key) + '">Follow up ' + esc(e.ref || f.enquiry_key) + '</a></p>';
    });
    return shell(body + '</div>');
  }

  function pageAll(litters, subjects, speciesRows) {
    var list = shown(state.tabs.Enquiries, litters);
    return shell(litterSelect(litters) + '<div class="card"><h3>All</h3><p class="mut">' + list.length + '</p></div>' +
      (list.length ? list.map(function (e) { return rowHtml(e, litters, subjects, speciesRows); }).join('') : '<p class="mut">No enquiry matches.</p>'));
  }

  function pageLitters(litters, subjects, speciesRows) {
    var choices = litterChoices(litters);
    var pups = (state.tabs.Litters || []).filter(function (r) { return r.list === 'pups' && t(r.pup_ref); });
    var body = '<div class="card"><h3>Litters</h3>' + (choices.length ? choices.map(function (o) {
      return '<p data-bld-litter="' + esc(o.id) + '"><b>' + esc(o.label) + '</b></p>';
    }).join('') : '<p class="mut">No litters in the BLD list.</p>') + '</div>';
    pups.forEach(function (r) {
      var fake = { litter_ref: r.litter_ref, pup_ref: r.pup_ref, bld_litter_id: r.bld_litter_id, bld_subject_id: r.bld_subject_id };
      var sub = subjectFor(fake, litters, subjects);
      var link = sub ? '<a class="btn" href="#/dogs/' + esc(sub.id) + '">' + esc(pupLabel(sub, speciesRows) || sub.id) + '</a>' : esc(r.pup_ref);
      var birth = speciesWord(speciesRows, sub && sub.species, 'birth');
      body += '<div class="card"><p>' + link + ' <span data-litter-label>' + esc(litterWords(fake, litters)) + '</span>' +
        (birth ? ' <span class="mut">' + esc(birth) + '</span>' : '') + '</p></div>';
    });
    return shell(body);
  }

  function pageAdd() {
    return shell('<div class="card" data-card="add"><h3>Add by hand</h3><p class="mut">Paste a message that came in by hand. Nothing is sent while the sheet is not set up.</p>' +
      '<div class="filt"><select id="enqChannel" aria-label="Where it came from"><option value="">Where it came from</option>' +
      Core.HAND_CHANNELS.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') +
      '</select></div><p><textarea id="enqText" aria-label="The message" maxlength="' + Core.HAND_MAX + '"></textarea></p>' +
      '<p><button type="button" class="btn" data-enq-add>Add</button></p></div>');
  }

  function pageDetail(litters, subjects, speciesRows) {
    var e = (state.tabs.Enquiries || []).filter(function (x) { return x.key === state.key; })[0];
    if (!e) return shell('<div class="card"><h3>Not found</h3><p><a class="btn" data-go="enquiries/all">All</a></p></div>');
    var stage = Core.plainStage(e);
    return shell('<p><a class="btn" data-go="enquiries/all">All</a></p>' + rowHtml(e, litters, subjects, speciesRows) +
      (stage ? '' : '') );
  }

  function open(sub) {
    var known = { home: 1, today: 1, all: 1, litters: 1, add: 1 };
    sub = t(sub) || 'home';
    if (known[sub]) { state.view = sub; state.key = ''; }
    else { state.view = 'e'; state.key = sub; }
  }

  function page(v) {
    v = v || {};
    ensureTabs();
    var T = v.T || {};
    var litters = rows(T, 'BLD-litter.csv');
    var subjects = rows(T, 'BLD-subject.csv');
    var speciesRows = rows(T, 'BLD-species.csv');
    var body = state.view === 'today' ? pageToday(litters, subjects, speciesRows)
      : state.view === 'all' ? pageAll(litters, subjects, speciesRows)
      : state.view === 'litters' ? pageLitters(litters, subjects, speciesRows)
      : state.view === 'add' ? pageAdd()
      : state.view === 'e' ? pageDetail(litters, subjects, speciesRows)
      : pageHome(v, litters, subjects, speciesRows);
    void matchScore(T, '');
    return body;
  }

  function say(text) { state.msg = text; var el = root.document && root.document.querySelector('[data-enq-msg]'); if (el) el.textContent = text; }

  function depositFor(e) {
    return ((state.tabs && state.tabs.Deposits) || []).filter(function (d) { return d.person_key && d.person_key === e.person_key; })[0] || {};
  }

  function addToBld(key, v) {
    var c = cfg();
    if (!t(c.sheetId) && !t(c.requestsFolderId)) { say('Example mode: nothing was sent.'); return Promise.resolve(); }
    if (!writesOn()) return Promise.resolve();
    var post = v && v.sinkPost;
    if (!post) { say('Saving is not set up on this device.'); return Promise.resolve(); }
    var e = (state.tabs.Enquiries || []).filter(function (x) { return x.key === key; })[0];
    if (!e) return Promise.resolve();
    var person = (state.tabs.People || []).filter(function (p) { return p.person_key === e.person_key; })[0] || {};
    var stage = Core.plainStage(e);
    var built = Core.bldPersonRow(person, {});
    if (!t(built.full_name)) { say('A name is needed before this can be added.'); return Promise.resolve(); }
    say('Sending…');
    var fields = { full_name: built.full_name };
    if (t(built.known_as)) fields.known_as = built.known_as;
    return post('person', fields).then(function (pr) {
      var pid = pr && pr.ok && pr.result && pr.result.id;
      if (!pid) { say((pr && pr.message) || 'The person row was not sent.'); return; }
      var home = Core.bldHouseholdRow({ name: built.full_name, primary_person_id: pid, stage: stage });
      if (!home) { say('Nothing to add for this stage.'); return; }
      return post('household', { name: home.name, primary_person_id: home.primary_person_id, stage: home.stage }).then(function (hr) {
        var hid = hr && hr.ok && hr.result && hr.result.id;
        if (!hid) { say((hr && hr.message) || 'The household row was not sent.'); return; }
        var member = Core.bldHouseholdMemberRow({ household_id: hid, person_id: pid });
        return post('household_member', { household_id: member.household_id, person_id: member.person_id }).then(function () {
          var litters = rows(v.T, 'BLD-litter.csv'), subjects = rows(v.T, 'BLD-subject.csv');
          var sub = subjectFor(e, litters, subjects);
          var chain = Promise.resolve();
          if (sub && (stage === 'working to collection' || stage === 'after collection')) {
            var role = stage === 'after collection' ? 'owner' : 'assigned';
            var own = Core.bldSubjectOwnerRow({ subject_id: sub.id, person_id: pid, household_id: hid, role: role });
            chain = post('subject_owner', { subject_id: own.subject_id, person_id: own.person_id, household_id: own.household_id, role: own.role });
          }
          if (stage === 'after collection' && sub) {
            var dep = depositFor(e);
            chain = chain.then(function () {
              var sale = Core.bldSaleRow({ subject_id: sub.id, person_id: pid, household_id: hid, role: 'owner', deposit: dep.deposit || '', deposit_date: dep.deposit_date || '', sold_on: dep.collection_date || '', price: '' });
              return post('sale', { subject_id: sale.subject_id, person_id: sale.person_id, household_id: sale.household_id, deposit: sale.deposit, deposit_date: sale.deposit_date, sold_on: sale.sold_on, price: sale.price });
            });
          }
          return chain.then(function () { say('Sent. It waits for approval. Nothing already in BLD is changed.'); });
        });
      });
    }).catch(function () { say('Not sent.'); });
  }

  function bind(rootEl, v) {
    if (!rootEl) return;
    var sel = rootEl.querySelector('[data-enq-litter]');
    if (sel) sel.addEventListener('change', function () { state.litter = sel.value; state.msg = ''; if (v && v.redraw) v.redraw(); });
    Array.prototype.forEach.call(rootEl.querySelectorAll('[data-enq-stage]'), function (b) {
      b.addEventListener('click', function () { state.stage = b.getAttribute('data-enq-stage') || ''; state.msg = ''; if (v && v.redraw) v.redraw(); });
    });
    Array.prototype.forEach.call(rootEl.querySelectorAll('[data-enq-write]'), function (b) {
      b.addEventListener('click', function () { addToBld(b.getAttribute('data-key'), v); });
    });
    var add = rootEl.querySelector('[data-enq-add]');
    if (add) add.addEventListener('click', function () {
      var c = cfg();
      if (!t(c.sheetId) && !t(c.requestsFolderId)) { say('Example mode: nothing was sent.'); return; }
      var Req = root.EnquiriesRequests;
      if (!Req) return;
      add.disabled = true;
      Req.addByHand({ folderId: c.requestsFolderId, token: v && v.token }, { channel: (rootEl.querySelector('#enqChannel') || {}).value, text: (rootEl.querySelector('#enqText') || {}).value })
        .then(function (r) { say(r && r.example ? 'Example mode: nothing was sent.' : 'Added. The engine picks it up within 10 minutes.'); add.disabled = false; })
        .catch(function (e) { say('Not added: ' + (e && e.message ? e.message : 'error')); add.disabled = false; });
    });
  }

  var api = { page: page, open: open, bind: bind, FILES: FILES, householdLine: householdLine, speciesWord: speciesWord };
  root.CDEnquiries = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof self !== 'undefined' ? self : this));
