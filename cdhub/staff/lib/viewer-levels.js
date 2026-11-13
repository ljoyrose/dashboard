/*!
 * Viewer levels: what each kind of OUTSIDE viewer (an inspector, a vet, another breeder) may see of an animal's records.
 * The breeder chooses, per viewer type, a level; each level is a list of things it shows. It sits on top of the per-link
 * choices already made for an inspector link (which dogs, which fields: BLD-inspect_link_subject / _field). It never widens them.
 *
 * Rows: optional BLD-viewer_level (viewer_type, viewer_label, level_key, level_label, shows = things joined by ';',
 * from_date, to_date). With no rows a PLACEHOLDER set is used; its level names and contents are not decided yet.
 * Whatever any row says, an outside viewer never sees points, the target, ranking, notes or programme and looks answers.
 * Pure: no page, no network. Works in a browser (window.BLDViewerLevels) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDViewerLevels = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }

  /* the things a level can show, in the order they are listed */
  var THINGS = ['records', 'grades', 'due_dates', 'must_pass', 'points', 'target', 'ranking', 'notes', 'programme'];
  var THING_WORDS = {
    records: 'The records ticked on the link', grades: 'Grades and dates', due_dates: 'When each check is next due',
    must_pass: 'Pass, Unverified or Fail on the must-pass checks', points: 'Points', target: 'The target', ranking: 'Ranking (best to worst)',
    notes: 'Notes', programme: 'Programme and looks answers'
  };
  /* never shown to anyone outside, whatever a row says (only the owner sees scores) */
  var NEVER = { points: 1, target: 1, ranking: 1, notes: 1, programme: 1 };

  /* PLACEHOLDER levels and defaults (names and contents are an open question for the owner).
     The inspector default is the decided one: Pass / Unverified / Fail on the must-pass checks, never points or targets. */
  var PLACEHOLDER = {
    levels: [
      { key: 'level_a', label: 'Level A: records only', shows: ['records', 'grades', 'due_dates'] },
      { key: 'level_b', label: 'Level B: records and must-pass results', shows: ['records', 'grades', 'due_dates', 'must_pass'] }
    ],
    viewers: [
      { type: 'inspector', label: 'Inspector', level: 'level_b' },
      { type: 'vet', label: 'Vet', level: 'level_a' },
      { type: 'breeder', label: 'Another breeder', level: 'level_a' }
    ]
  };

  function showsMap(list) {
    var o = {};
    (list || []).forEach(function (k) { k = t(k).toLowerCase(); if (THINGS.indexOf(k) >= 0 && !NEVER[k]) o[k] = true; });
    return o;
  }
  function inForce(r, d) { var f = t(r.from_date), to = t(r.to_date); return (!f || !d || f <= d) && (!to || !d || to >= d); }

  /** The levels in force: { placeholder, viewers:[{type,label,level}], byKey:{key:{label, shows}} }. */
  function levels(T, today) {
    var rows = ((T && T['BLD-viewer_level.csv']) || []).filter(function (r) { return t(r.viewer_type) && t(r.level_key) && inForce(r, today); });
    var src = rows.length ? {
      levels: rows.map(function (r) { return { key: t(r.level_key), label: t(r.level_label) || t(r.level_key), shows: t(r.shows).split(';') }; }),
      viewers: rows.map(function (r) { return { type: t(r.viewer_type).toLowerCase(), label: t(r.viewer_label) || t(r.viewer_type), level: t(r.level_key) }; })
    } : PLACEHOLDER;
    var byKey = {};
    src.levels.forEach(function (l) { if (!byKey[l.key]) byKey[l.key] = { label: l.label, shows: showsMap(l.shows) }; });
    var seen = {}, viewers = src.viewers.filter(function (w) { if (seen[w.type]) return false; seen[w.type] = 1; return true; });
    return { placeholder: !rows.length, viewers: viewers, byKey: byKey };
  }

  /** What one viewer type sees: a map of thing -> true. Unknown viewer or level: records only. */
  function showsFor(T, viewerType, today, levelKey) {
    var set = levels(T, today);
    var w = set.viewers.filter(function (x) { return x.type === t(viewerType).toLowerCase(); })[0];
    var lv = set.byKey[t(levelKey) || (w && w.level)];
    return lv ? Object.assign({}, lv.shows) : { records: true };
  }

  /** Trim one animal's must-pass lines to what a level shows. Never points, target or ranking.
   *  line: { label, outcome, answer, date, due_date, points?, target? } -> { label, outcome?, answer?, date?, due_date? } */
  function trimLines(lines, shows) {
    return (lines || []).map(function (l) {
      var o = { label: t(l.label) };
      if (shows.must_pass && t(l.outcome)) o.outcome = t(l.outcome);
      if (shows.grades) { if (t(l.answer)) o.answer = t(l.answer); if (t(l.date)) o.date = t(l.date); }
      if (shows.due_dates && t(l.due_date)) o.due_date = t(l.due_date);
      return o;
    });
  }

  return { THINGS: THINGS, THING_WORDS: THING_WORDS, NEVER: NEVER, PLACEHOLDER: PLACEHOLDER, levels: levels, showsFor: showsFor, trimLines: trimLines };
}));
