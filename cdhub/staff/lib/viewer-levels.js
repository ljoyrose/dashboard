(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDViewerLevels = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }

  var THINGS = ['records', 'grades', 'due_dates', 'must_pass', 'points', 'target', 'ranking', 'notes', 'programme'];
  var THING_WORDS = {
    records: 'The records ticked on the link', grades: 'Grades and dates', due_dates: 'When each check is next due',
    must_pass: 'Pass, Unverified or Fail on the must-pass checks', points: 'Points', target: 'The target', ranking: 'Ranking (best to worst)',
    notes: 'Notes', programme: 'Programme answers'
  };
  var NEVER = { points: 1, target: 1, ranking: 1, notes: 1, programme: 1 };

  var DEFAULT = {
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

  function levels(T, today) {
    var rows = ((T && T['BLD-viewer_level.csv']) || []).filter(function (r) { return t(r.viewer_type) && t(r.level_key) && inForce(r, today); });
    var src = rows.length ? {
      levels: rows.map(function (r) { return { key: t(r.level_key), label: t(r.level_label) || t(r.level_key), shows: t(r.shows).split(';') }; }),
      viewers: rows.map(function (r) { return { type: t(r.viewer_type).toLowerCase(), label: t(r.viewer_label) || t(r.viewer_type), level: t(r.level_key) }; })
    } : DEFAULT;
    var byKey = {};
    src.levels.forEach(function (l) { if (!byKey[l.key]) byKey[l.key] = { label: l.label, shows: showsMap(l.shows) }; });
    var seen = {}, viewers = src.viewers.filter(function (w) { if (seen[w.type]) return false; seen[w.type] = 1; return true; });
    return { fromRows: !!rows.length, viewers: viewers, byKey: byKey };
  }

  function showsFor(T, viewerType, today, levelKey) {
    var set = levels(T, today);
    var w = set.viewers.filter(function (x) { return x.type === t(viewerType).toLowerCase(); })[0];
    var lv = set.byKey[t(levelKey) || (w && w.level)];
    return lv ? Object.assign({}, lv.shows) : { records: true };
  }

  function trimLines(lines, shows) {
    return (lines || []).map(function (l) {
      var o = { label: t(l.label) };
      if (shows.must_pass && t(l.outcome)) o.outcome = t(l.outcome);
      if (shows.grades) { if (t(l.answer)) o.answer = t(l.answer); if (t(l.date)) o.date = t(l.date); }
      if (shows.due_dates && t(l.due_date)) o.due_date = t(l.due_date);
      return o;
    });
  }

  return { THINGS: THINGS, THING_WORDS: THING_WORDS, NEVER: NEVER, DEFAULT: DEFAULT, levels: levels, showsFor: showsFor, trimLines: trimLines };
}));

