/*!
 * BLDCheckRules - the owner's check settings, worked out from rows. No screen and no saving.
 * A check with no setting row stays logged, on its own how-often, one line per dog where it already
 * says so. Present, Health check all, and Exercise all are one session row unless a setting says off.
 * A past day uses the setting in force that day.
 * The live check_type row is the legal floor (more often is allowed, less often is not).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDCheckRules = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SESSION = { 'round.presence': 1, 'round_presence': 1, 'health_check_all': 1, 'exercise_all': 1 };
  var EX_WORD = { not_here: 'not here', concern: 'concern', note: 'note' };

  function str(v) { return String(v == null ? '' : v).trim(); }
  function every(v) {
    var s = str(v);
    if (!/^\d+$/.test(s)) return null;
    var n = parseInt(s, 10);
    return n > 0 ? n : null;
  }
  function on(v) { return str(v).toLowerCase() === 'true'; }
  function off(v) { return str(v).toLowerCase() === 'false'; }

  /** Latest row whose from/effective date has started and whose to date has not passed. */
  function inForce(rows, day, key) {
    var best = null, fk = key || 'from_date';
    (rows || []).forEach(function (r) {
      var f = str(r[fk] || r.effective_from).slice(0, 10), t = str(r.to_date).slice(0, 10);
      if (f && f > day) return;
      if (t && t < day) return;
      if (!best || f >= str(best[fk] || best.effective_from).slice(0, 10)) best = r;
    });
    return best;
  }

  /** The check_type row in force on a day. A latest row that is switched off means the check is not in use. */
  function typeInForce(types, typeKey, day) {
    var best = null;
    (types || []).forEach(function (r) {
      if (str(r.type_key) !== typeKey || !r.effective_from || r.effective_from > day) return;
      if (!best || r.effective_from >= best.effective_from) best = r;
    });
    if (best && off(best.active)) return null;
    return best;
  }

  function settingFor(settings, typeKey, day) {
    return inForce((settings || []).filter(function (r) { return str(r.type_key) === typeKey; }), day, 'from_date');
  }

  function printBan(type) {
    if (!type) return '';
    if (str(type.evidence) === 'required') return 'Evidence is required, so this cannot be print only.';
    var blob = (str(type.type_key) + ' ' + str(type.label)).toLowerCase();
    if (blob.indexOf('medicine') >= 0) return 'Medicines cannot be print only.';
    if (blob.indexOf('incident') >= 0) return 'Incidents cannot be print only.';
    var freq = str(type.frequency).toLowerCase(), n = every(type.every_days);
    if ((n >= 300 || /year|annual/.test(freq)) && /vet|fitness|screen/.test(blob)) return 'A yearly vet, fitness or screening check cannot be print only.';
    return '';
  }

  function sessionAllowed(typeKey) { return !!SESSION[typeKey]; }

  /** Why a choice is weaker than the live check, or ''. */
  function refuse(type, choice) {
    if (!type) return 'That check is not in use on that date.';
    var msg = {};
    if (choice.record_as === 'print') { var ban = printBan(type); if (ban) msg.record_as = ban; }
    var floor = every(type.every_days), want = every(choice.every_days);
    if (floor && (!want || want > floor)) msg.every_days = 'Legal minimum: every ' + floor + ' day' + (floor === 1 ? '' : 's') + '. It can be more often, not less.';
    if (on(choice.session_row) && !sessionAllowed(type.type_key)) msg.session_row = 'One line for the round is only for Present, Health check: all dogs, and Exercise and play: all dogs.';
    return msg;
  }

  /**
   * What is in force for a check on a day. No setting row = the check's own cadence, logged.
   * Present, Health check all, and Exercise all are one session row unless a setting says off.
   */
  function effective(type, setting) {
    var s = setting || {};
    var session = sessionAllowed(type && type.type_key);
    if (setting && str(setting.session_row) !== '') session = on(setting.session_row);
    return {
      record_as: str(s.record_as) || 'logged',
      every_days: str(s.every_days) !== '' ? s.every_days : (type ? type.every_days : ''),
      frequency: str(s.frequency) !== '' ? s.frequency : (type ? type.frequency : ''),
      site_scope: str(s.site_scope) || (type ? str(type.site_scope) : ''),
      session_row: session,
      from_date: str(s.from_date),
      to_date: str(s.to_date),
      source: str(s.source),
      set_by: str(s.set_by)
    };
  }

  function covered(log) {
    return str(log && log.covered_ids).split('|').map(str).filter(Boolean);
  }
  function exceptions(log) {
    var out = [];
    str(log && log.exceptions).split('|').forEach(function (part) {
      part = str(part);
      if (!part) return;
      var bits = part.split(':'), id = str(bits[0]), kind = str(bits[1]), text = bits.slice(2).join(':').trim();
      if (!id || !EX_WORD[kind]) return;
      out.push({ id: id, kind: kind, word: EX_WORD[kind], text: text });
    });
    return out;
  }
  function exceptionFor(log, dogId) {
    var list = exceptions(log);
    for (var i = 0; i < list.length; i++) if (list[i].id === dogId) return list[i];
    return null;
  }

  /** One register line per dog on a session row. Other rows pass through. opts.dogName(id) optional. */
  function expandLog(log, dogName) {
    var ids = covered(log), ex = exceptions(log);
    if (!ids.length && !ex.length) return [log];
    var name = typeof dogName === 'function' ? dogName : function (id) { return id; };
    var skip = {};
    ex.forEach(function (e) { skip[e.id] = 1; });
    var out = [];
    ids.forEach(function (id) {
      if (skip[id]) return;
      out.push(Object.assign({}, log, { subject_id: id, _session: 'included', _dogName: name(id) }));
    });
    ex.forEach(function (e) {
      out.push(Object.assign({}, log, {
        subject_id: e.id, _session: 'exception', _exception: e.word, _dogName: name(e.id),
        note: e.text || log.note || ''
      }));
    });
    return out;
  }

  /** Years check records are kept: the retention row in force, else 6. */
  function keepYears(rows, day) {
    var hit = inForce((rows || []).filter(function (r) {
      return str(r.section) === 'checks' || str(r.section) === 'jobs';
    }), day, 'from_date');
    var n = hit ? parseInt(hit.keep_years, 10) : 0;
    return n > 0 ? n : 6;
  }

  /** A short line for the dog card. Empty when this dog is on no session row. */
  function dogLine(dog, tables, esc) {
    if (!dog || !dog.id) return '';
    var logs = (tables && tables['BLD-check_log.csv']) || [], types = {};
    ((tables && tables['BLD-check_type.csv']) || []).forEach(function (t) { if (t.id) types[t.id] = t.label || t.type_key || 'Check'; });
    var e = esc || function (s) { return String(s == null ? '' : s); };
    var bits = [];
    logs.forEach(function (l) {
      var ex = exceptionFor(l, dog.id), inc = covered(l).indexOf(dog.id) >= 0;
      if (!inc && !ex) return;
      var label = types[l.check_type_id] || 'Check';
      bits.push(e(label) + ' · included in the round' + (ex ? ' · ' + e(ex.word + (ex.text ? ': ' + ex.text : '')) : ''));
    });
    if (!bits.length) return '';
    return '<div class="dcs dcs-line" data-k="round-in"><span class="dcs-label">' + bits.slice(0, 3).join('<br>') + '</span></div>';
  }

  return {
    SESSION: SESSION, every: every, inForce: inForce, typeInForce: typeInForce, settingFor: settingFor,
    printBan: printBan, sessionAllowed: sessionAllowed, refuse: refuse, effective: effective,
    covered: covered, exceptions: exceptions, exceptionFor: exceptionFor, expandLog: expandLog,
    keepYears: keepYears, dogLine: dogLine
  };
}));
