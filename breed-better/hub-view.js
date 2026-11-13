/*!
 * Breed Better in CD Hub: reads rule rows and draws scores. It writes nothing and holds no animal data.
 * Everything specific to a species, breed or scheme comes from rows. Needs BreedBetterScore (score.js).
 * Scores are worked out when the page loads and carry a Testing label until the owner signs the scoring off.
 *
 * Screens (the owner's design, 13 Nov 2026): five tabs at the bottom, always shown: Score, Evidence, Dogs, Calendar, More.
 * Each tab has its own address under #/breed (#/breed/calendar, #/breed/score.<animal id> ...), so Back and reload work.
 * Look: no fill at rest, pale grey (--hov) on hover or tap, no outline; colour sits in lines and icons only.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./score.js'), require('./dna-panel.js'), require('../cdhub/staff/lib/viewer-levels.js'));
  else root.BBHubView = factory(root.BreedBetterScore, root.BBDnaPanel, root.BLDViewerLevels);
}(typeof self !== 'undefined' ? self : this, function (Score, Dna, Levels) {
  'use strict';

  var FILES = ['BLD-score_scheme.csv', 'BLD-score_band.csv', 'BLD-score_criterion.csv', 'BLD-score_point.csv', 'BLD-score_enrolment.csv',
    /* evidence only Breed Better reads; the hub already loads health_screen, dna_result, litter and subject_status */
    'BLD-fit_to_breed.csv', 'BLD-score_judgement.csv',
    /* optional settings rows: grade-to-colour bands for health results, and what each kind of outside viewer may see */
    'BLD-grade_band.csv', 'BLD-viewer_level.csv'];
  /* default words; a scheme row can change any of them with verdict_words, e.g. "unverified=To prove" */
  var VERDICT = { pass: 'Pass', below_target: 'Below target', unverified: 'Unverified', fail: 'Fail' };
  /* other words a scheme row may set the same way (verdict_words "to_prove=still to prove") */
  var EXTRA_WORDS = { to_prove: 'to prove' };
  var ORDER = ['pass', 'below_target', 'unverified', 'fail'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var words = VERDICT;
  var REASON = {
    no_source: 'Record type not set up yet', no_record: 'No record yet', not_judged: 'Not entered yet', expired: 'Out of date',
    undated: 'Record has no date', blank_answer: 'Blank on the record', no_rule_for_answer: 'Answer is not in the rules',
    recorded_unverified: 'Recorded, cannot be scored yet'
  };
  /* reasons that mean "the current record is missing": they count as Due on the Calendar */
  var MISSING = { no_record: 1, not_judged: 1, undated: 1, blank_answer: 1 };
  var state = {
    filter: '', dog: '', edit: '', editPushed: false, open: {}, q: '', sort: 'verdict', tab: 'dogs', sex: '', month: '',
    cal: 'due', calDay: '', calc: {}, focus: '', evKind: '', evCheck: ''
  }, last = null, memo = null;

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function isDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(t(v)); }

  /** 2026-03-02 -> "2 Mar 2026". Anything else is shown as it is. */
  function day(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(d));
    return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1] + ' ' + m[1] : t(d);
  }

  function wordsFor(scheme) {
    var w = Object.assign({}, VERDICT, EXTRA_WORDS);
    t(scheme && scheme.verdict_words).split(';').forEach(function (pair) {
      var at = pair.indexOf('='), k = pair.slice(0, at).trim().toLowerCase().replace(/\s+/g, '_');
      if (at > 0 && w[k] && t(pair.slice(at + 1))) w[k] = t(pair.slice(at + 1));
    });
    return w;
  }
  function verdictOf(r) { return r.verdict || r.gate_result; }

  /** "field=value" pairs joined by ';' (the calculator's own form). Blank matches everything. */
  function fieldsMatch(spec, row) {
    if (!t(spec)) return true;
    return t(spec).split(';').every(function (pair) {
      var at = pair.indexOf('=');
      return at > 0 && t(row[pair.slice(0, at).trim()]).toLowerCase() === t(pair.slice(at + 1)).toLowerCase();
    });
  }

  /** Judged answers (programme and looks) for one animal: the newest row per check on or before the day. Keyed by check id,
   *  matched on the check's id or its key, so a later version of a check keeps its answer. */
  function judgementsFor(T, subjectId, criteria, asOf) {
    var rows = (T['BLD-score_judgement.csv'] || []).filter(function (j) {
      return j.subject_id === subjectId && t(j.answer) && (!isDate(j.judged_on) || j.judged_on <= asOf);
    });
    var out = {};
    criteria.forEach(function (c) {
      var mine = rows.filter(function (j) { return t(j.criterion_id) === c.id || (t(c.key) && t(j.criterion_id) === t(c.key)); })
        .sort(function (a, b) { return t(b.judged_on).localeCompare(t(a.judged_on)); });
      if (mine[0]) out[c.id] = { answer: t(mine[0].answer), by: t(mine[0].judged_by), on: t(mine[0].judged_on) };
    });
    return out;
  }

  /** One result per enrolled animal, best first. { results, error, byId } */
  function compute(v) {
    var T = v.T, key = v.today + '|' + FILES.concat(['BLD-subject.csv', 'BLD-health_screen.csv', 'BLD-dna_result.csv', 'BLD-litter.csv', 'BLD-subject_status.csv'])
      .map(function (f) { return (T[f] || []).length; }).join(',');
    if (memo && memo.key === key && memo.T === T) return memo;
    var out = { key: key, T: T, results: [], byId: {}, error: '', ended: [], setUp: !!(T['BLD-score_enrolment.csv'] || []).length };
    var subjects = {};
    (T['BLD-subject.csv'] || []).forEach(function (s) { subjects[s.id] = s; });
    var evidence = new Proxy({}, { get: function (o, name) { return T[name + '.csv']; } });
    (T['BLD-score_enrolment.csv'] || []).forEach(function (e) {
      /* enrolled from valid_from (live name) to to_date, both inclusive */
      if (/^false$/i.test(t(e.is_active)) || (t(e.to_date) && e.to_date < v.today)) {
        /* kept for the Archive: an enrolment that has ended, with its dates */
        if (subjects[e.subject_id]) out.ended.push({ id: e.subject_id, name: t(subjects[e.subject_id].name), from: t(e.valid_from), to: t(e.to_date) });
        return;
      }
      if (t(e.valid_from) && e.valid_from > v.today) return;
      var subject = subjects[e.subject_id];
      if (!subject) { out.error = 'An enrolled animal is not in the animal list: check BLD-score_enrolment.'; return; }
      /* the enrolment names one scheme; a later version of it (same name, species and breed) takes over on its own date */
      var schemes = T['BLD-score_scheme.csv'] || [];
      var named = schemes.filter(function (s) { return s.id === e.scheme_id; })[0];
      var scheme = named && Score.pickScheme(schemes.filter(function (s) {
        return t(s.name).toLowerCase() === t(named.name).toLowerCase() && t(s.breed).toLowerCase() === t(named.breed).toLowerCase();
      }), named.species_id, t(named.breed), v.today);
      if (!scheme) { out.error = 'No active scheme for an enrolled animal: check BLD-score_scheme.'; return; }
      var inScheme = function (r) { return r.scheme_id === scheme.id; };
      var bands = (T['BLD-score_band.csv'] || []).filter(function (b) { return inScheme(b) && t(b.kind); });
      var criteria = (T['BLD-score_criterion.csv'] || []).filter(inScheme);
      var ids = {}; criteria.forEach(function (c) { ids[c.id] = 1; });
      var points = (T['BLD-score_point.csv'] || []).filter(function (p) { return ids[p.criterion_id]; });
      try {
        var input = { scheme: scheme, bands: bands, criteria: criteria, points: points, subject: subject, evidence: evidence,
          judgements: judgementsFor(T, subject.id, criteria, v.today), asOf: v.today };
        var r = Score.score(input);
        r.name = t(subject.name); r.dob = t(subject.dob); r.bands = bands; r.words = wordsFor(scheme); r.scheme = scheme; r.input = input;
        out.words = r.words;
        out.results.push(r); out.byId[r.subject_id] = r;
      } catch (err) { out.error = err.message; }
    });
    out.results.sort(function (a, b) {
      var d = ORDER.indexOf(verdictOf(a)) - ORDER.indexOf(verdictOf(b));
      /* within a verdict, by percent of what each animal could earn: a male and a female can have different totals */
      return d || (pct(b) - pct(a)) || a.name.localeCompare(b.name);
    });
    memo = out;
    return out;
  }

  function pct(r) { return r.points_available ? r.points_earned / r.points_available : 0; }
  function hasTarget(r) { return r.target !== '' && r.target !== undefined; }
  function total(r) { return r.points_earned + ' of ' + r.points_available + (hasTarget(r) ? ', target ' + r.target : ''); }
  function vpill(k, w) { return '<span class="bb-v bb-' + k + '">' + (w || words)[k] + '</span>'; }
  function pill(r) { return vpill(verdictOf(r), r.words); }
  function unv(r) { return r.points_unverified ? ', ' + r.points_unverified + ' ' + r.words.unverified.toLowerCase() : ''; }
  /** "Target x%. This dog y%." when the scheme's target is a percent of points available. Both numbers are worked out. */
  function pctLine(r) {
    if (!r.scheme || !/^percent\b/i.test(t(r.scheme.target_is)) || !t(r.scheme.target_points) || !r.points_available) return '';
    return 'Target ' + t(r.scheme.target_points) + '%. This dog ' + Math.round(100 * r.points_earned / r.points_available) + '%.';
  }

  /* Drawing only: verdict icons, the must-pass star, tab and section icons. No rule lives here. */
  var ICON = {
    pass: 'M5 12l5 5l10 -10', below_target: 'M6 9l6 6l6 -6', fail: 'M18 6l-12 12 M6 6l12 12',
    unverified: 'M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4 M12 19l0 .01',
    star: 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z',
    info: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 9h.01 M11 12h1v4h1',
    award: 'M6 9a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M12 15l3.4 5.89l1.598 -3.233l3.598 .232l-3.4 -5.889 M6.802 12l-3.4 5.89l3.598 -.233l1.598 3.232l3.4 -5.889',
    folder: 'M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2',
    list: 'M9 6h11 M9 12h11 M9 18h11 M5 6v.01 M5 12v.01 M5 18v.01',
    cal: 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z M16 3v4 M8 3v4 M4 11h16',
    more: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M8 12h.01 M12 12h.01 M16 12h.01',
    right: 'M9 6l6 6l-6 6', left: 'M15 6l-6 6l6 6', down: 'M6 9l6 6l6 -6',
    sliders: 'M4 6h8 M16 6h4 M14 4v4 M4 12h2 M10 12h10 M8 10v4 M4 18h11 M19 18h1 M17 16v4',
    archive: 'M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10 M10 12h4',
    history: 'M12 8v4l2 2 M3.05 11a9 9 0 1 1 .5 4 M3 20v-5h5',
    dna: 'M14.8 14.8a4 4 0 1 0 -5.6 -5.6a4 4 0 0 0 5.6 5.6z M9.2 20.5a4 4 0 1 0 -5.7 -5.7 M14.8 3.5a4 4 0 0 0 5.7 5.7',
    eye: 'M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6',
    mark: 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'
  };
  /* Plain icon names a score_band row may give in icon_key. Any other name draws a plain neutral mark. */
  var BAND_ICON = {
    target: 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0 M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    star: ICON.star,
    heart: 'M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572',
    stethoscope: 'M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1 M8 15a6 6 0 1 0 12 0v-3 M11 3v2 M6 3v2 M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    smile: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M9 10h.01 M15 10h.01 M9.5 15a3.5 3.5 0 0 0 5 0',
    people: 'M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2 M16 3.13a4 4 0 0 1 0 7.75 M21 21v-2a4 4 0 0 0 -3 -3.85',
    info: ICON.info, eye: ICON.eye, dna: ICON.dna,
    shield: 'M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3'
  };
  var VTEXT = { pass: '--ljr-5-text', below_target: '--ljr-3-text', unverified: '--ljr-6-text', fail: '--ljr-2-text' };
  /* a colour word on a band row -> the house slot (line, and the icon shade that reads in light and dark) */
  var BANDVAR = { red: 'ljr-2', orange: 'ljr-3', yellow: 'ljr-4', green: 'ljr-5', blue: 'ljr-6', purple: 'ljr-7', white: '', black: 'ljr-8' };
  function ic(d, size, colour) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="stroke:' + (colour || 'currentColor') + ';flex-shrink:0"><path d="' + d + '"/></svg>';
  }
  function star() {
    return '<svg class="bb-star" role="img" aria-label="Must pass" width="15" height="15" viewBox="0 0 24 24"><path d="' + ICON.star + '"/></svg>';
  }
  function vword(r) {
    var k = verdictOf(r);
    return '<span class="bb-vw">' + ic(ICON[k], 16, 'var(' + VTEXT[k] + ')') + r.words[k] + '</span>';
  }

  /** A colour cell from a band row: a hex colour (3 or 6 digits), or a house token name (--ljr-4 or ljr-4). Anything else is ignored. */
  function colourCell(v) {
    var s = t(v);
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
    if (/^-{0,2}[a-z][a-z0-9-]*$/i.test(s) && /^-{0,2}(ljr|house)-/i.test(s)) return 'var(--' + s.replace(/^-+/, '') + ')';
    return '';
  }
  /** The band's colours, from its row: line (ring, bar, 3px line) and icon (light and dark). Blank cells fall back to the colour word. */
  function bandPaint(b) {
    var slot = BANDVAR[t(b && b.colour).toLowerCase()];
    var line = colourCell(b && b.line_colour) || (slot ? 'var(--' + slot + ')' : 'var(--line)');
    var light = colourCell(b && b.icon_light) || (slot ? 'var(--' + slot + '-icon)' : 'var(--muted)');
    var dark = colourCell(b && b.icon_dark) || light;
    return { line: line, light: light, dark: dark };
  }
  function bandColour(b) { return bandPaint(b).line; }
  function bandVars(b) { var p = bandPaint(b); return '--bl:' + p.line + ';--bi:' + p.light + ';--bd:' + p.dark; }
  /** The band's icon: its row's icon_key, or the must-pass star for a gate band with none, or a plain mark. */
  function bandIcon(b) {
    var k = t(b && b.icon_key).toLowerCase();
    if (k && BAND_ICON[k]) return BAND_ICON[k];
    if (!k && t(b && b.kind) === 'gate') return BAND_ICON.star;
    return ICON.mark;
  }
  function sortBands(bands) { return bands.slice().sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); }); }

  /** Points bands in their own order, each with what it can give, what was earned and what is still to prove. */
  function bandStats(r) {
    return sortBands(r.bands).filter(function (b) { return t(b.kind) === 'points'; }).map(function (b) {
      var o = { band: b, max: 0, earned: 0, unv: 0 };
      r.lines.forEach(function (l) {
        if (l.band_id !== b.id || l.points_max === '') return;
        o.max += Number(l.points_max) || 0;
        if (l.points === '') o.unv += Number(l.points_max) || 0; else o.earned += Number(l.points) || 0;
      });
      return o;
    }).filter(function (o) { return o.max > 0; });
  }
  /** One band's count: "n of m met" for must-pass, "x of y" points, from this animal's own lines (a skipped line is not counted). */
  function bandCount(r, b) {
    var lines = r.lines.filter(function (l) { return l.band_id === b.id; });
    if (t(b.kind) === 'gate') {
      var met = lines.filter(function (l) { return l.gate_outcome === 'pass'; }).length;
      return { text: met + ' of ' + lines.length + ' met', n: met, of: lines.length, lit: met > 0, attention: met < lines.length };
    }
    if (t(b.kind) === 'points') {
      var max = 0, got = 0;
      lines.forEach(function (l) { if (l.points_max !== '') max += Number(l.points_max) || 0; if (l.points !== '') got += Number(l.points) || 0; });
      return { text: fmt(got) + ' of ' + fmt(max), n: got, of: max, lit: got > 0, attention: lines.some(needsWork) };
    }
    return { text: '', n: 0, of: 0, lit: false, attention: false };
  }
  function fmt(n) { return String(Math.round(n * 10) / 10); }
  /** A line still to do: a must-pass not passed, points not proved, or a record due. Done lines are the rest. */
  function needsWork(l) {
    if (l.kind === 'gate') return l.gate_outcome !== 'pass' || !!l.due;
    if (l.kind === 'points') return l.points === '' || !!l.due;
    return false;
  }
  function attentionFirst(lines) {
    return lines.map(function (l, i) { return { l: l, i: i }; })
      .sort(function (a, b) { return (needsWork(b.l) - needsWork(a.l)) || a.i - b.i; }).map(function (x) { return x.l; });
  }

  function arc(c, rad, a, b) {
    function pt(x) { x = x * Math.PI / 180; return (c + rad * Math.sin(x)).toFixed(2) + ' ' + (c - rad * Math.cos(x)).toFixed(2); }
    return 'M' + pt(a) + 'A' + rad + ' ' + rad + ' 0 ' + (b - a > 180 ? 1 : 0) + ' 1 ' + pt(b);
  }
  /** The score ring round the photo: each points band owns an arc sized by its points, filled as far as earned. */
  function ring(r) {
    var st = bandStats(r), all = st.reduce(function (s, o) { return s + o.max; }, 0), a = 0, out = '';
    if (!all) return '';
    st.forEach(function (o) {
      var span = 360 * o.max / all, from = a + 1, to = a + span - 1;
      out += '<path d="' + arc(42, 38, from, to) + '" fill="none" stroke-width="6" style="stroke:var(--hov)"/>';
      var got = Math.max(0, Math.min(1, o.earned / o.max));
      if (got > 0) out += '<path d="' + arc(42, 38, from, from + (to - from) * got) + '" fill="none" stroke-width="6" style="stroke:' + bandColour(o.band) + '"/>';
      a += span;
    });
    return '<svg class="bb-ring" width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">' + out + '</svg>';
  }
  function hubDog(v, id) { return (v.dogs && v.dogs[id]) || null; }
  /** The animal's photo in a circle, or a plain circle when there is none. The hub loads the picture. */
  function photo(v, r) {
    var d = hubDog(v, r.subject_id), pic = d && v.photoId ? v.photoId(d.photo) : '';
    return '<span class="bb-ph">' + ring(r) + '<span class="bb-pic">' + (pic ? '<img class="dogphoto off" alt="" data-photo-id="' + v.esc(pic) + '" referrerpolicy="no-referrer">' : '') + '</span></span>';
  }
  /** "3 yrs 7 mths" on the given day. */
  function age(dob, today) {
    var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(dob)), b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(today));
    if (!a || !b) return '';
    var m = (b[1] - a[1]) * 12 + (b[2] - a[2]) - (Number(b[3]) < Number(a[3]) ? 1 : 0);
    if (m < 0) return '';
    var y = Math.floor(m / 12), mm = m % 12;
    return [y ? y + (y === 1 ? ' yr' : ' yrs') : '', mm || !y ? mm + (mm === 1 ? ' mth' : ' mths') : ''].filter(Boolean).join(' ');
  }
  function subLine(v, r) {
    var d = hubDog(v, r.subject_id);
    return [d && t(d.sex), age(r.dob, v.today)].filter(Boolean).join(', ');
  }

  /* ---- addresses: each tab has its own, so Back and reload keep it ---- */
  var TABKEY = { score: 'score', evidence: 'evidence', dogs: 'dogs', cal: 'calendar', more: 'more', system: 'system', archive: 'archive', history: 'history', dna: 'dna', viewers: 'viewers' };
  var KEYTAB = {}; Object.keys(TABKEY).forEach(function (k) { KEYTAB[TABKEY[k]] = k; }); KEYTAB.cal = 'cal';
  var DOG_TABS = { score: 1, evidence: 1, history: 1 };
  var MORE_TABS = { system: 1, archive: 1, history: 1, dna: 1, viewers: 1 };
  function href(tab, id) { return 'breed/' + TABKEY[tab] + (id && DOG_TABS[tab] ? '.' + encodeURIComponent(id) : ''); }
  /** A button that opens one animal's Score tab at one section (data-bb-sec), through the hub's own address change. */
  function secAttrs(esc, id, bandId) {
    return ' data-go="' + esc(href('score', id)) + '" data-bb-sec="' + esc(id) + '"' + (bandId ? ' data-bb-band-go="' + esc(bandId) + '"' : '');
  }

  /* Sort choices (11 Nov 2026). Verdict best to worst is the default; "Fail to Pass" is the one opt-in reverse. */
  var SORTS = [
    ['verdict', 'Verdict, Pass to Fail'], ['high', 'Score, highest %'], ['low', 'Score, lowest %'], ['name', 'Name, A to Z'],
    ['oldest', 'Oldest first'], ['youngest', 'Youngest first'], ['attention', 'Verdict, Fail to Pass']
  ];
  function byVerdict(a, b) { return ORDER.indexOf(verdictOf(a)) - ORDER.indexOf(verdictOf(b)); }
  function byName(a, b) { return a.name.localeCompare(b.name); }
  /* no date of birth sorts last either way */
  function byDob(dir) { return function (a, b) { return (!a.dob - !b.dob) || dir * a.dob.localeCompare(b.dob); }; }
  var SORT_FN = {
    verdict: function (a, b) { return byVerdict(a, b) || (pct(b) - pct(a)) || byName(a, b); },
    high: function (a, b) { return (pct(b) - pct(a)) || byVerdict(a, b) || byName(a, b); },
    low: function (a, b) { return (pct(a) - pct(b)) || byVerdict(a, b) || byName(a, b); },
    name: byName,
    oldest: function (a, b) { return byDob(1)(a, b) || byName(a, b); },
    youngest: function (a, b) { return byDob(-1)(a, b) || byName(a, b); },
    attention: function (a, b) { return byVerdict(b, a) || (pct(a) - pct(b)) || byName(a, b); }
  };
  function shownRows(c) {
    var f = state.filter, q = state.q.toLowerCase(), sx = state.sex;
    return c.results.filter(function (r) {
      var d = hubDog(last || {}, r.subject_id);
      return (!f || verdictOf(r) === f) && (!q || r.name.toLowerCase().indexOf(q) !== -1) && (!sx || (d && t(d.sex) === sx));
    }).sort(SORT_FN[state.sort] || SORT_FN.verdict);
  }

  /** The section icons on a list row: one per must-pass or points band, in the band's colour; grey when nothing is scored yet. */
  function secIcons(v, r) {
    var esc = v.esc;
    return '<span class="bb-sics">' + sortBands(r.bands).filter(function (b) { return t(b.kind) === 'gate' || t(b.kind) === 'points'; })
      .filter(function (b) { return r.lines.some(function (l) { return l.band_id === b.id; }); }).map(function (b) {
        var n = bandCount(r, b);
        return '<button type="button" class="bb-sic' + (n.lit ? '' : ' bb-off') + '" style="' + bandVars(b) + '"' + secAttrs(esc, r.subject_id, b.id)
          + ' aria-label="' + esc(t(b.label) + ': ' + n.text + '. Open ' + r.name + ' at ' + t(b.label)) + '" title="' + esc(t(b.label) + ': ' + n.text) + '">'
          + ic(bandIcon(b), 16) + '</button>';
      }).join('') + '</span>';
  }
  function rowsHtml(v, c) {
    var esc = v.esc, shown = shownRows(c);
    return shown.length ? shown.map(function (r) {
      var k = verdictOf(r);
      return '<div class="bb-dog bb-row" style="--v:var(' + VTEXT[k] + ')"><button type="button" class="bb-rowbtn" data-bb-open="' + esc(r.subject_id) + '" data-go="' + esc(href('score', r.subject_id)) + '">' + photo(v, r)
        + '<span class="bb-info"><span class="bb-l1"><span class="bb-name">' + esc(r.name) + '</span><span class="bb-sc"><span class="bb-big">' + fmt(r.points_earned) + '</span> of ' + r.points_available
        + '<span class="bb-sr">' + esc(unv(r) + (hasTarget(r) ? ', target ' + r.target : '') + dueCount(r)) + '</span></span></span>'
        + '<span class="bb-l2"><span>' + esc(subLine(v, r)) + '</span>' + vword(r) + '</span>'
        + '</span></button>'
        + secIcons(v, r) + '</div>';
    }).join('') : '<p class="mut">None.</p>';
  }

  function listHtml(v, c) {
    var esc = v.esc, f = state.filter;
    words = c.words || VERDICT;
    var counts = { '': c.results.length };
    c.results.forEach(function (r) { counts[verdictOf(r)] = (counts[verdictOf(r)] || 0) + 1; });
    var h = '<div class="bb-filt" role="group" aria-label="Filter by verdict">' + [''].concat(ORDER).map(function (k) {
      return '<button type="button" class="bb-f" data-bb-filter="' + k + '" aria-pressed="' + (f === k) + '">' + (words[k] || 'All') + ' <span class="cnt">' + (counts[k] || 0) + '</span></button>';
    }).join('') + '</div>';
    var tools = '<div class="bb-tools"><label class="bb-lab">Find a dog<input type="search" id="bbSearch" data-bb-search="1" placeholder="Name" autocomplete="off" value="' + esc(state.q) + '"></label>'
      + '<label class="bb-lab">Sort<select id="bbSort" data-bb-sort="1">' + SORTS.map(function (o) {
        return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label></div>';
    /* sex: the words the hub holds, so another species' words show as they are */
    var sexes = {};
    c.results.forEach(function (r) { var d = hubDog(v, r.subject_id), x = d && t(d.sex); if (x) sexes[x] = (sexes[x] || 0) + 1; });
    var sk = Object.keys(sexes).sort();
    var sx = sk.length > 1 ? '<div class="bb-filt" role="group" aria-label="Filter by sex">' + [''].concat(sk).map(function (k) {
      return '<button type="button" class="bb-f" data-bb-sex="' + esc(k) + '" aria-pressed="' + (state.sex === k) + '">' + esc(k || 'Any sex') + (k ? ' <span class="cnt">' + sexes[k] + '</span>' : '') + '</button>';
    }).join('') + '</div>' : '';
    return '<div class="bb-title"><h3 class="bb-h">All dogs</h3><span class="bb-pts" id="bbShown">' + shownText(c) + '</span></div>'
      + tools + h + sx + '<div id="bbList">' + rowsHtml(v, c) + '</div>';
  }
  function shownText(c) { return shownRows(c).length + ' of ' + c.results.length + ' shown'; }

  /** The animal's details from the hub, folded. Only what the hub holds is shown. */
  function infoHtml(v, r) {
    var esc = v.esc, d = hubDog(v, r.subject_id) || {}, pic = v.photoId ? v.photoId(d.photo) : '';
    var chips = [t(d.sex), age(r.dob, v.today), r.dob ? 'Born ' + day(r.dob) : '', d.colour && t(d.colour.name), t(d.pat),
      t(d.chip) ? 'Chip ...' + t(d.chip).slice(-4) : '', d.littersAsDam && d.littersAsDam.length ? d.littersAsDam.length + (d.littersAsDam.length === 1 ? ' litter' : ' litters') : '',
      t(d.state)].filter(Boolean);
    return '<details class="card bb-infobox" data-bb-band="__info"' + (state.open.__info ? ' open' : '') + '><summary>' + ic(ICON.info, 18, 'var(--muted)')
      + '<span class="bb-strong">Information</span><span class="bb-pts">' + esc([t(d.sex), age(r.dob, v.today)].filter(Boolean).join(', ')) + '</span>' + chev() + '</summary>'
      + '<div class="bb-infobd"><span class="bb-pic bb-pic88">' + (pic ? '<img class="dogphoto off" alt="" data-photo-id="' + esc(pic) + '" referrerpolicy="no-referrer">' : '') + '</span>'
      + '<span><span class="bb-strong">' + esc(r.name) + '</span><br><span class="bb-pts">' + esc(t(d.breed)) + '</span></span></div>'
      + '<div class="bb-chips">' + chips.map(function (x) { return '<span class="bb-tag">' + esc(x) + '</span>'; }).join('') + '</div></details>';
  }
  function chev() { return '<span class="bb-chev">' + ic(ICON.down, 18) + '</span>'; }

  /** Why this verdict, in plain words, from the lines themselves. */
  function whyHtml(r) {
    var k = verdictOf(r);
    var gates = r.lines.filter(function (l) { return l.kind === 'gate'; });
    if (k === 'fail') return 'Must pass not met: ' + gates.filter(function (l) { return l.gate_outcome === 'fail'; }).map(function (l) { return l.label_then; }).join(', ') + '.';
    if (r.gate_result === 'unverified') return 'Must pass still to prove: ' + gates.filter(function (l) { return l.gate_outcome === 'unverified'; }).map(function (l) { return l.label_then; }).join(', ') + '.';
    if (k === 'unverified') return r.points_unverified + ' points still to prove could reach the target.';
    if (k === 'below_target') return 'All must pass met. ' + fmt(r.target - r.points_earned) + ' points under the target.';
    return (gates.length ? 'All must pass met' : 'Scored') + (hasTarget(r) ? ', target reached.' : '.');
  }

  /** The verdict box: word, points, target (and the percent line), a bar split by section with the target marked, and why. */
  function verdictHtml(r) {
    var k = verdictOf(r), all = r.points_available || 0, st = bandStats(r);
    var lost = Math.max(0, all - r.points_earned - r.points_unverified);
    var bar = all ? st.map(function (o) {
      return (o.earned ? '<span style="width:' + (100 * o.earned / all) + '%;background:' + bandColour(o.band) + '" title="' + o.band.label + ': ' + fmt(o.earned) + ' of ' + o.max + '"></span>' : '')
        + (o.unv ? '<span class="bb-tp" style="width:' + (100 * o.unv / all) + '%;--c:' + bandColour(o.band) + '" title="' + o.band.label + ': ' + o.unv + ' ' + r.words.to_prove + '"></span>' : '');
    }).join('') : '';
    var pl = pctLine(r);
    return '<div class="card bb-vbox" style="--v:var(' + VTEXT[k] + ')"><div class="bb-vtop"><span class="bb-vl">' + ic(ICON[k], 28, 'var(' + VTEXT[k] + ')')
      + '<span><span class="bb-pts">Breed Better verdict</span><br><span class="bb-vword">' + r.words[k] + '</span></span></span>'
      + '<span class="bb-vr"><span class="bb-huge">' + fmt(r.points_earned) + '</span><br><span class="bb-pts">of ' + all + ' points</span>'
      + (pl ? '<br><span class="bb-pts bb-pct">' + pl + '</span>' : hasTarget(r) ? '<br><span class="bb-pts">Target ' + r.target + '</span>' : '') + '</span></div>'
      + (all ? '<div class="bb-barw"><div class="bb-bar">' + bar + '</div>' + (hasTarget(r) ? '<span class="bb-tmark" style="left:' + Math.min(100, 100 * r.target / all) + '%" title="Target ' + r.target + '"></span>' : '') + '</div>' : '')
      + '<div class="bb-three"><span>' + fmt(r.points_earned) + ' earned</span><span>' + r.points_unverified + ' ' + r.words.to_prove + '</span><span>' + fmt(lost) + ' lost</span></div>'
      + '<p class="bb-why">' + whyHtml(r) + '</p><p class="bb-pts bb-scored">Scored on ' + day(r.as_of) + '</p></div>';
  }

  /** The header on an animal's own tabs: back to the list, the name, where it sits in the list, previous and next. */
  function dogHead(v, r, c, tab) {
    var esc = v.esc, list = shownRows(c);
    if (!list.some(function (x) { return x.subject_id === r.subject_id; })) list = c.results;
    var at = 0; list.forEach(function (x, i) { if (x.subject_id === r.subject_id) at = i; });
    var prev = list[(at - 1 + list.length) % list.length], next = list[(at + 1) % list.length];
    return '<div class="bb-dhead"><button type="button" class="bb-f bb-ico" data-bb-back="1" data-go="breed/dogs" aria-label="All dogs" title="All dogs">' + ic(ICON.list, 20) + '</button>'
      + '<h3 class="bb-dname">' + esc(r.name) + '</h3><span class="bb-pts bb-nof">' + (at + 1) + ' of ' + list.length + '</span>'
      + '<button type="button" class="bb-f bb-ico" data-bb-step="1" data-go="' + esc(href(tab, prev.subject_id)) + '" aria-label="Previous: ' + esc(prev.name) + '">' + ic(ICON.left, 20) + '</button>'
      + '<button type="button" class="bb-f bb-ico" data-bb-step="1" data-go="' + esc(href(tab, next.subject_id)) + '" aria-label="Next: ' + esc(next.name) + '">' + ic(ICON.right, 20) + '</button></div>';
  }

  /** One section card on the dog page: icon, label and count in the header; things to do first; done lines folded under "show done". */
  function bandHtml(v, r, b) {
    var esc = v.esc, lines = r.lines.filter(function (l) { return l.band_id === b.id; });
    if (!lines.length) return '';
    var n = bandCount(r, b), todo = attentionFirst(lines).filter(needsWork), done = lines.filter(function (l) { return !needsWork(l); });
    var head = t(b.kind) === 'status' ? '<span class="bb-tag">' + esc(lines.map(function (l) { return l.answer_then || REASON[l.unknown_reason] || ''; }).filter(Boolean).join(', ') || 'Not recorded') + '</span>'
      : '<span class="cnt wide bb-cnt' + (n.attention ? ' bb-att' : '') + '">' + n.text + '</span>';
    var body = todo.map(function (l) { return lineHtml(v, l, r.words, r); }).join('');
    if (done.length && todo.length) {
      var key = 'done-' + r.subject_id + '-' + b.id;
      body += '<details class="bb-done" data-bb-band="' + esc(key) + '"' + (state.open[key] ? ' open' : '') + '><summary>Show done <span class="cnt">' + done.length + '</span></summary>'
        + done.map(function (l) { return lineHtml(v, l, r.words, r); }).join('') + '</details>';
    } else body += done.map(function (l) { return lineHtml(v, l, r.words, r); }).join('');
    return '<details class="card bb-band" style="' + bandVars(b) + '" data-bb-band="' + esc(b.id) + '"' + (state.open[b.id] ? ' open' : '') + '><summary>'
      + '<span class="bb-bandic">' + ic(bandIcon(b), 20) + '</span><span class="bb-blabel">' + esc(b.label) + '</span> ' + head + chev() + '</summary>' + body + '</details>';
  }

  function dogHtml(v, r, c) {
    var esc = v.esc;
    var dna = Dna ? Dna.card(v.T, r.subject_id, esc) : '';
    if (dna) dna = dna.replace('data-bb-band="__dna"', 'data-bb-band="__dna"' + (state.open.__dna ? ' open' : ''));
    return dogHead(v, r, c, 'score') + infoHtml(v, r) + verdictHtml(r) + dna
      + sortBands(r.bands).map(function (b) { return bandHtml(v, r, b); }).join('');
  }

  function dueCount(r) {
    var n = r.lines.filter(function (l) { return l.due; }).length;
    return n ? ', ' + n + ' due' : '';
  }

  /** The Due level: shown beside the result, never a result itself. */
  function dueHtml(l) {
    if (l.due === 'overdue') return '<span class="bb-due bb-overdue">Overdue since ' + day(l.due_date) + '</span>';
    if (l.due === 'due_soon') return '<span class="bb-due">Due ' + day(l.due_date) + '</span>';
    return '';
  }

  /** What is still needed to prove a check: the check's own proof_label, else its guidance, else a dated record of it. */
  function toProve(r, l) {
    var crit = r && r.input ? r.input.criteria.filter(function (c) { return c.id === l.criterion_id; })[0] : null;
    var need = crit && (t(crit.proof_label) || t(crit.guidance));
    return 'To prove: ' + (need || 'a dated record of ' + t(l.label_then));
  }

  function lineHtml(v, l, w, r) {
    var esc = v.esc, res, mark = '';
    w = w || words;
    if (l.kind === 'gate') { res = vpill(l.gate_outcome, w); mark = ic(ICON[l.gate_outcome] || ICON.unverified, 16, 'var(' + (VTEXT[l.gate_outcome] || '--muted') + ')'); }
    else if (l.kind === 'status') res = '<span class="bb-pts">' + esc(l.answer_then) + '</span>';
    else {
      res = l.points === '' ? vpill('unverified', w) : '<span class="bb-pts">' + fmt(l.points) + ' of ' + l.points_max + '</span>';
      mark = ic(l.points === '' ? ICON.unverified : ICON.pass, 16, 'var(' + (l.points === '' ? VTEXT.unverified : '--muted') + ')');
    }
    var when = l.date_then ? ' · ' + esc(day(l.date_then)) : '';
    if (l.rules_then) when += ' · rules then';
    if (l.weight !== undefined && l.weight < 1) when += ' · at ' + l.age_months + ' months, ' + (l.weight === 0.5 ? 'half' : Math.round(l.weight * 100) + '%') + ' points';
    if (l.judged_by) when += ' · judged by ' + esc(l.judged_by);
    var why = l.unknown_reason ? (REASON[l.unknown_reason] || '') + when : (l.answer_then ? 'Recorded: ' + esc(l.answer_then) + when : '');
    if (l.due_date && !l.due) why += ' · due ' + esc(day(l.due_date));
    res += dueHtml(l);
    var unverified = l.gate_outcome === 'unverified' || (l.kind === 'points' && l.points === '');
    /* Open stays on this page. data-go would be caught by the hub and sent back to the dog list. */
    var openBtn = l.criterion_id ? ' <button type="button" class="bb-src" data-bb-edit="' + esc(l.criterion_id) + '">Open</button>' : '';
    return '<div class="bb-line" data-bb-crit="' + esc(l.criterion_id) + '"><span class="bb-mk">' + mark + '</span><span class="bb-l">' + (l.kind === 'gate' ? star() : '') + esc(l.label_then) + '</span>' + res
      + '<span class="bb-why">' + why + openBtn + '</span>'
      + (unverified ? '<span class="bb-prove">' + esc(toProve(r, l)) + '</span>' : '') + '</div>';
  }

  /** Add or edit one check's result. Replaces the dog page until Back. */
  function editHtml(v, r, criterionId) {
    var esc = v.esc;
    var line = (r.lines || []).filter(function (l) { return l.criterion_id === criterionId; })[0];
    var crit = (v.T['BLD-score_criterion.csv'] || []).filter(function (c) { return c.id === criterionId; })[0];
    if (!line && !crit) return '';
    var label = (line && line.label_then) || (crit && t(crit.label)) || 'Result';
    var answer = crit ? t(crit.answer_field) : '';
    var date = crit ? t(crit.date_field) : '';
    var match = crit ? t(crit.evidence_match) : '';
    var have = line && t(line.answer_then);
    var title = (have ? 'Edit' : 'Add') + ' result';
    var ansLabel = answer ? answer.replace(/_/g, ' ') : 'Result';
    var dateLabel = date ? date.replace(/_/g, ' ') : 'Date';
    return '<section class="bb-edit" data-bb-edit-screen="' + esc(criterionId) + '" aria-label="' + esc(title + ': ' + label) + '">'
      + '<button type="button" class="bb-f" data-bb-edit-back="1">Back</button>'
      + '<h3 class="bb-h">' + esc(label) + '</h3>'
      + '<p class="bb-pts">' + esc(title) + ' for ' + esc(r.name) + (match ? '. ' + esc(match) : '') + '</p>'
      + '<form class="card" data-bb-result="1">'
      + (date ? '<label class="bb-lab">' + esc(dateLabel) + '<input type="date" name="on" value="' + esc(line && line.date_then || '') + '"></label>' : '')
      + (answer ? '<label class="bb-lab">' + esc(ansLabel) + '<input type="text" name="answer" value="' + esc(line && line.answer_then || '') + '" autocomplete="off"></label>' : '')
      + '<button type="submit" class="bb-f">Save result</button>'
      + '<p class="bb-pts" data-bb-edit-msg role="status"></p></form></section>';
  }

  /* ---- the five tabs at the bottom (owner's design): Score, Evidence, Dogs, Calendar, More ---- */
  var TABS = [['score', 'Score', ICON.award], ['evidence', 'Evidence', ICON.folder], ['dogs', 'Dogs', ICON.list], ['cal', 'Calendar', ICON.cal], ['more', 'More', ICON.more]];
  /** The animal an animal tab opens: the one chosen (or last viewed), else the first in the list as it is now. */
  function dogFor(c) { return state.dog || (c && (shownRows(c)[0] || c.results[0] || {}).subject_id) || ''; }
  function tabsHtml(v, c) {
    var on = MORE_TABS[state.tab] ? 'more' : state.tab, esc = v ? v.esc : function (s) { return s; }, id = dogFor(c);
    return '<nav class="bb-tabs" aria-label="Breed Better">' + TABS.map(function (x) {
      var to = DOG_TABS[x[0]] && id ? href(x[0], id) : href(x[0]);
      return '<button type="button" class="bb-tab" data-bb-tab="' + x[0] + '" data-go="' + esc(to) + '"' + (on === x[0] ? ' aria-current="page"' : '') + '><span class="bb-tabic">' + ic(x[2], 20) + '</span><span class="bb-tabw">' + x[1] + '</span></button>';
    }).join('') + '</nav>';
  }
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  /** The Calendar's items, from the lines the calculator already worked out (no table of its own):
   *  done = a dated record still valid, on its own date; due / overdue = the date each check's rules give for its next record;
   *  missing = no current record at all (no date, listed apart). */
  function calItems(c, today) {
    var out = [];
    c.results.forEach(function (r) {
      r.lines.forEach(function (l) {
        if (l.kind === 'status') return;
        var base = { id: r.subject_id, dog: r.name, check: l.label_then, band: l.band_id };
        if (l.date_then && isDate(l.date_then) && !l.unknown_reason) out.push(Object.assign({ date: l.date_then, kind: 'done' }, base));
        if (l.due_date && isDate(l.due_date)) out.push(Object.assign({ date: l.due_date, kind: l.due_date < today ? 'overdue' : 'due' }, base));
        else if (MISSING[l.unknown_reason]) out.push(Object.assign({ date: '', kind: 'missing' }, base));
      });
    });
    return out.sort(function (a, b) { return (!a.date - !b.date) || a.date.localeCompare(b.date) || a.dog.localeCompare(b.dog) || a.check.localeCompare(b.check); });
  }
  var CAL_MODES = [['due', 'Due'], ['done', 'Done'], ['all', 'All']];
  var CAL_IN = { due: { due: 1, overdue: 1, missing: 1 }, done: { done: 1 }, all: { due: 1, overdue: 1, missing: 1, done: 1 } };
  var CAL_WORD = { done: 'Done', due: 'Due', overdue: 'Overdue', missing: 'Due' };
  var CAL_COLOUR = { done: VTEXT.pass, due: VTEXT.unverified, overdue: VTEXT.fail, missing: VTEXT.unverified };
  /** Due / Done / All counts: All = Due + Done. */
  function calCounts(items) {
    var n = { due: 0, done: 0, all: 0 };
    items.forEach(function (x) { if (x.kind === 'done') n.done++; else n.due++; });
    n.all = n.due + n.done;
    return n;
  }
  function calHtml(v, c) {
    var esc = v.esc, today = v.today, month = state.month || today.slice(0, 7);
    var items = calItems(c, today), soon = addDays(today, 30), mode = CAL_IN[state.cal] ? state.cal : 'due';
    var n = calCounts(items);
    var next30 = items.filter(function (x) { return x.kind === 'due' && x.date >= today && x.date <= soon; }).length;
    var mine = items.filter(function (x) { return CAL_IN[mode][x.kind]; });
    var y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
    var first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var has = {};
    mine.forEach(function (x) { if (x.date.slice(0, 7) === month) (has[x.date] = has[x.date] || []).push(x); });
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var iso = month + '-' + (d < 10 ? '0' : '') + d, xs = has[iso] || [];
      var cls = 'bb-day' + (iso === today ? ' bb-today' : '');
      if (!xs.length) { cells += '<span class="' + cls + '">' + d + '</span>'; continue; }
      var kinds = {}; xs.forEach(function (x) { kinds[x.kind] = 1; });
      var dots = ['overdue', 'due', 'done'].filter(function (k) { return kinds[k]; }).map(function (k) { return '<i style="background:var(' + CAL_COLOUR[k] + ')"></i>'; }).join('');
      cells += '<button type="button" class="' + cls + '" data-bb-day="' + iso + '" aria-pressed="' + (state.calDay === iso) + '" aria-label="' + day(iso) + ', ' + xs.length + ' ' + (xs.length === 1 ? 'item' : 'items') + '">' + d + '<span class="bb-dots">' + dots + '</span></button>';
    }
    var prev = addDays(month + '-01', -1).slice(0, 7), next = addDays(month + '-28', 7).slice(0, 7);
    var rows = mine.filter(function (x) { return x.date && (state.calDay ? x.date === state.calDay : x.date.slice(0, 7) === month); });
    var undated = state.calDay ? [] : mine.filter(function (x) { return !x.date; });
    var row = function (x) {
      return '<button type="button" class="bb-dog bb-calrow" style="--v:var(' + CAL_COLOUR[x.kind] + ')"' + secAttrs(esc, x.id, x.band) + '><span class="bb-info"><span class="bb-l1"><span class="bb-name">' + esc(x.dog) + ', ' + esc(x.check) + '</span>'
        + '<span class="bb-calw" style="color:var(' + CAL_COLOUR[x.kind] + ')">' + CAL_WORD[x.kind] + '</span></span>'
        + '<span class="bb-l2"><span>' + (x.date ? day(x.date) : 'No record yet') + '</span></span></span></button>';
    };
    return '<h3 class="bb-h">Calendar</h3><p class="bb-pts">' + next30 + ' due in the next 30 days</p>'
      + '<div class="bb-filt" role="group" aria-label="Show">' + CAL_MODES.map(function (x) {
        return '<button type="button" class="bb-f" data-bb-cal="' + x[0] + '" aria-pressed="' + (mode === x[0]) + '">' + x[1] + ' <span class="cnt">' + n[x[0]] + '</span></button>';
      }).join('') + '</div>'
      + '<div class="card bb-month"><div class="bb-mhead"><button type="button" class="bb-f bb-ico" data-bb-month="' + prev + '" aria-label="Previous month">' + ic(ICON.left, 18) + '</button>'
      + '<span class="bb-strong">' + MONTH[m - 1] + ' ' + y + '</span><button type="button" class="bb-f bb-ico" data-bb-month="' + next + '" aria-label="Next month">' + ic(ICON.right, 18) + '</button></div>'
      + '<div class="bb-grid bb-wd" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class="bb-grid">' + cells + '</div></div>'
      + (state.calDay ? '<div class="bb-dayon"><span class="bb-pts">Showing ' + day(state.calDay) + '</span><button type="button" class="bb-f" data-bb-day="">Show the whole month</button></div>' : '')
      + '<div class="bb-callist">' + (rows.length ? rows.map(row).join('') : '<p class="mut">Nothing here.</p>') + '</div>'
      + (undated.length ? '<details class="bb-calnone bb-done" data-bb-band="cal-none"' + (state.open['cal-none'] ? ' open' : '') + '><summary>No record yet <span class="cnt">' + undated.length + '</span>' + chev() + '</summary>' + undated.map(row).join('') + '</details>' : '');
  }

  /* ---- Evidence: every dated record and judged answer the calculator reads for one animal. Read only, newest first. ---- */
  function tableWords(name) { var s = t(name).replace(/^BLD-/, '').replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
  var DOC_FIELDS = ['document_id', 'file_id', 'storage_ref', 'document'];
  /** [{key, kind, kindLabel, date, answer, doc, checks:[label]}], newest first. One record used by several checks is one item. */
  function evidenceItems(v, r) {
    var T = v.T, items = {}, order = [];
    var crit = r.input ? r.input.criteria.filter(function (c) { return Score.inForce(c, v.today); }) : [];
    crit.forEach(function (c) {
      var src = t(c.evidence_source);
      if (!src) return;
      if (src === 'judged') {
        (T['BLD-score_judgement.csv'] || []).filter(function (j) {
          return j.subject_id === r.subject_id && (t(j.criterion_id) === c.id || (t(c.key) && t(j.criterion_id) === t(c.key))) && (!isDate(j.judged_on) || j.judged_on <= v.today);
        }).forEach(function (j) { add('judged', 'Judged', 'judged|' + (t(j.id) || order.length), t(j.judged_on), t(j.answer), false, c); });
        return;
      }
      var rows = T[src + '.csv'];
      if (!rows) return;
      var sf = t(c.subject_field) || 'subject_id', df = t(c.date_field);
      rows.forEach(function (row, i) {
        if (row[sf] !== r.subject_id || !fieldsMatch(c.evidence_match, row)) return;
        if (df && isDate(row[df]) && row[df] > v.today) return;
        var doc = DOC_FIELDS.some(function (f) { return t(row[f]); });
        add(src, tableWords(src), src + '|' + (t(row.id) || i), df ? t(row[df]) : '', t(c.answer_field) ? t(row[c.answer_field]) : '', doc, c);
      });
    });
    function add(kind, label, key, date, answer, doc, c) {
      if (!items[key]) { items[key] = { key: key, kind: kind, kindLabel: label, date: date, answer: answer, doc: doc, checks: [], critIds: [] }; order.push(key); }
      var it = items[key];
      if (it.critIds.indexOf(c.id) < 0) { it.critIds.push(c.id); it.checks.push(t(c.label)); }
      if (!it.answer && answer) it.answer = answer;
    }
    return order.map(function (k) { return items[k]; }).sort(function (a, b) { return (!a.date - !b.date) || b.date.localeCompare(a.date); });
  }
  function evidenceHtml(v, r, c) {
    var esc = v.esc, all = evidenceItems(v, r);
    var kinds = {}, checks = {};
    all.forEach(function (x) { kinds[x.kind] = kinds[x.kind] || { label: x.kindLabel, n: 0 }; kinds[x.kind].n++; x.critIds.forEach(function (id, i) { checks[id] = x.checks[i]; }); });
    var docs = all.filter(function (x) { return x.doc; }).length;
    var shown = all.filter(function (x) {
      return (!state.evKind || (state.evKind === '__doc' ? x.doc : x.kind === state.evKind)) && (!state.evCheck || x.critIds.indexOf(state.evCheck) >= 0);
    });
    var f = '<div class="bb-filt" role="group" aria-label="Filter by kind"><button type="button" class="bb-f" data-bb-evkind="" aria-pressed="' + !state.evKind + '">All <span class="cnt">' + all.length + '</span></button>'
      + Object.keys(kinds).sort().map(function (k) {
        return '<button type="button" class="bb-f" data-bb-evkind="' + esc(k) + '" aria-pressed="' + (state.evKind === k) + '">' + esc(kinds[k].label) + ' <span class="cnt">' + kinds[k].n + '</span></button>';
      }).join('') + (docs ? '<button type="button" class="bb-f" data-bb-evkind="__doc" aria-pressed="' + (state.evKind === '__doc') + '">Documents <span class="cnt">' + docs + '</span></button>' : '') + '</div>';
    var sel = '<label class="bb-lab">Check<select data-bb-evcheck="1"><option value="">All checks</option>' + Object.keys(checks).map(function (id) {
      return '<option value="' + esc(id) + '"' + (state.evCheck === id ? ' selected' : '') + '>' + esc(checks[id]) + '</option>';
    }).join('') + '</select></label>';
    return dogHead(v, r, c, 'evidence') + '<p class="bb-strong bb-sub">' + esc(r.name) + '\'s evidence</p><p class="bb-pts">Every dated record the score reads, newest first. Never overwritten: a new result is a new record.</p>'
      + f + sel + '<div class="bb-evlist">' + (shown.length ? shown.map(function (x) {
        return '<div class="card bb-ev" data-bb-ev="' + esc(x.key) + '"><span class="bb-evic">' + ic(x.doc ? ICON.folder : x.kind === 'judged' ? ICON.eye : ICON.list, 18) + '</span>'
          + '<span class="bb-info"><span class="bb-l1"><span class="bb-name">' + esc(x.answer || 'Recorded') + '</span><span class="bb-pts">' + (x.date ? day(x.date) : 'No date') + '</span></span>'
          + '<span class="bb-pts">' + esc(x.kindLabel) + (x.doc ? ' · document on file' : '') + '</span>'
          + '<span class="bb-pts">Used by: ' + esc(x.checks.join(', ')) + '</span></span></div>';
      }).join('') : '<p class="mut">No records yet.</p>') + '</div>';
  }

  /* ---- History: the animal's dated entries, and its score worked out again as of each date. Nothing is stored. ---- */
  function historyRows(v, r) {
    var items = evidenceItems(v, r).filter(function (x) { return x.date; });
    var dates = {}; items.forEach(function (x) { (dates[x.date] = dates[x.date] || []).push(x); });
    return Object.keys(dates).sort().reverse().map(function (d) {
      var input = Object.assign({}, r.input, { asOf: d, judgements: judgementsFor(v.T, r.subject_id, r.input.criteria, d) });
      var s = null;
      try { s = Score.score(input); } catch (e) { s = null; }
      return { date: d, entries: dates[d], verdict: s ? verdictOf(s) : '', earned: s ? s.points_earned : '', available: s ? s.points_available : '' };
    });
  }
  function historyHtml(v, r, c) {
    var esc = v.esc, rows = historyRows(v, r);
    return backMore() + dogHead(v, r, c, 'history') + '<p class="bb-strong bb-sub">History</p><p class="bb-pts">Worked out from the records, as on each record\'s date. Nothing is stored or changed.</p>'
      + '<div class="card bb-hnow"><span class="bb-strong">Today</span> ' + vpill(verdictOf(r), r.words) + ' <span class="bb-pts">' + fmt(r.points_earned) + ' of ' + r.points_available + '</span></div>'
      + (rows.length ? rows.map(function (h) {
        return '<div class="card bb-hist" data-bb-hist="' + h.date + '"><div class="bb-l1"><span class="bb-strong">' + day(h.date) + '</span>'
          + (h.verdict ? '<span>' + vpill(h.verdict, r.words) + ' <span class="bb-pts">' + fmt(h.earned) + ' of ' + h.available + '</span></span>' : '') + '</div>'
          + h.entries.map(function (x) { return '<p class="bb-pts">' + esc(x.checks.join(', ')) + (x.answer ? ': ' + esc(x.answer) : '') + '</p>'; }).join('') + '</div>';
      }).join('') : '<p class="mut">No dated records yet.</p>');
  }

  /* ---- More ---- */
  function moreRow(tab, icon, label, extra, c) {
    return '<button type="button" class="bb-dog bb-more" data-bb-tab="' + tab + '" data-go="' + href(tab, DOG_TABS[tab] ? dogFor(c) : '') + '"><span class="bb-mic">' + ic(icon, 20) + '</span><span class="bb-name">' + label + '</span>'
      + (extra || '') + '<span class="bb-chev">' + ic(ICON.right, 18) + '</span></button>';
  }
  function moreHtml(c) {
    return '<h3 class="bb-h">More</h3>'
      + moreRow('system', ICON.sliders, 'My system', '<span class="bb-pts">Sections, checks and points</span>')
      + moreRow('archive', ICON.archive, 'Archive', '<span class="cnt">' + c.ended.length + '</span>')
      + moreRow('history', ICON.history, 'History', '', c)
      + (Dna ? moreRow('dna', ICON.dna, 'DNA panel', '<span class="bb-pts">Grades, probability per puppy, set-up</span>') : '')
      + (Levels ? moreRow('viewers', ICON.eye, 'Who sees what', '<span class="bb-pts">Inspector, vet, other breeder</span>') : '');
  }
  function backMore() { return '<button type="button" class="bb-f" data-bb-tab="more" data-go="breed/more">' + ic(ICON.left, 18) + 'More</button>'; }
  function archiveHtml(v, c) {
    var esc = v.esc;
    return backMore() + '<h3 class="bb-h">Archive</h3><p class="bb-pts">Animals whose scoring has ended. Their records stay.</p>'
      + (c.ended.length ? c.ended.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (x) {
        return '<div class="card bb-arch"><span class="bb-strong">' + esc(x.name) + '</span><span class="bb-pts">' + (x.from ? 'From ' + day(x.from) : '') + (x.to ? (x.from ? ', to ' : 'To ') + day(x.to) : '') + '</span></div>';
      }).join('') : '<p class="mut">None.</p>');
  }
  /** The rules in force today, read only: sections, checks, must pass, answers and points, target, and where each rule came from. */
  function systemHtml(v) {
    var esc = v.esc, T = v.T, today = v.today, schemes = (T['BLD-score_scheme.csv'] || []);
    var ids = {}; (T['BLD-score_enrolment.csv'] || []).forEach(function (e) { ids[e.scheme_id] = 1; });
    var shown = schemes.filter(function (s) { return ids[s.id] && /^active$/i.test(t(s.status)) && (!t(s.to_date) || s.to_date >= today); });
    if (!shown.length) return backMore() + '<p class="mut">No scheme in force today.</p>';
    return backMore() + '<h3 class="bb-h">My system</h3><p class="bb-pts">Read only. A star means must pass. Rules today; past records keep the rules of their own date.</p>'
      + shown.map(function (sc) {
        var bands = sortBands((T['BLD-score_band.csv'] || []).filter(function (b) { return b.scheme_id === sc.id && t(b.kind); }));
        var crit = (T['BLD-score_criterion.csv'] || []).filter(function (x) { return x.scheme_id === sc.id && Score.inForce(x, today); });
        var pts = T['BLD-score_point.csv'] || [];
        return '<div class="card"><span class="bb-strong">' + esc(t(sc.name) || 'Scheme') + (t(sc.breed) ? ', ' + esc(sc.breed) : '') + (t(sc.version) ? ', version ' + esc(sc.version) : '') + '</span>'
          + '<p class="bb-pts">' + (t(sc.target_points) ? 'Target ' + esc(sc.target_points) + (t(sc.target_is) ? ' (' + esc(sc.target_is) + ')' : '') + '. ' : '') + (t(sc.source) ? 'Source: ' + esc(sc.source) : '') + '</p>'
          + bands.map(function (b) {
            var cs = crit.filter(function (x) { return x.band_id === b.id; });
            if (!cs.length) return '';
            return '<details class="card bb-band" style="' + bandVars(b) + '" data-bb-band="sys-' + esc(b.id) + '"' + (state.open['sys-' + b.id] ? ' open' : '') + '><summary><span class="bb-bandic">' + ic(bandIcon(b), 20) + '</span><span class="bb-blabel">' + esc(b.label) + '</span> <span class="cnt">' + cs.length + '</span>' + chev() + '</summary>'
              + cs.map(function (x) {
                var rows = pts.filter(function (p) { return p.criterion_id === x.id && Score.inForce(p, today); });
                return '<div class="bb-line"><span class="bb-l">' + (t(b.kind) === 'gate' ? star() : '') + esc(x.label) + '</span>'
                  + '<span class="bb-why">' + rows.map(function (p) {
                    return esc(t(p.answer_match)) + ': ' + (t(p.gate_outcome) ? esc((words[t(p.gate_outcome)] || p.gate_outcome)) : esc(t(p.points)) + ' points');
                  }).join(' · ') + (t(x.valid_months) ? ' · lasts ' + esc(x.valid_months) + ' months' : '') + (t(x.authority) ? ' · ' + esc(x.authority) : '') + '</span></div>';
              }).join('') + '</details>';
          }).join('') + '</div>';
      }).join('');
  }
  /** Who sees what: each outside viewer type and the level it gets. Read only; the levels are a placeholder set until chosen. */
  function viewersHtml(v) {
    var esc = v.esc, set = Levels.levels(v.T, v.today);
    return backMore() + '<h3 class="bb-h">Who sees what</h3><p class="bb-pts">Read only. ' + (set.placeholder ? 'These levels are a placeholder set until the owner chooses them.' : 'From the viewer level rows.')
      + ' Staff never see Breed Better. Points, the target and ranking are never shown outside.</p>'
      + set.viewers.map(function (w) {
        var lv = set.byKey[w.level] || {};
        return '<div class="card bb-viewer" data-bb-viewer="' + esc(w.type) + '"><span class="bb-strong">' + esc(w.label) + '</span> <span class="bb-tag">' + esc(lv.label || w.level) + '</span>'
          + '<ul class="bb-shows">' + Levels.THINGS.map(function (k) {
            var on = !!(lv.shows && lv.shows[k]);
            return '<li data-on="' + on + '">' + ic(on ? ICON.pass : ICON.fail, 16, on ? 'var(' + VTEXT.pass + ')' : 'var(--muted)') + esc(Levels.THING_WORDS[k]) + '</li>';
          }).join('') + '</ul></div>';
      }).join('');
  }

  /** The animal the Score, Evidence and History tabs show: the chosen one, else the first in the list as it is now. */
  function pickDog(c) {
    var r = state.dog && c.byId[state.dog];
    if (!r) r = shownRows(c)[0] || c.results[0];
    if (r) state.dog = r.subject_id;
    return r || null;
  }

  function inner(v) {
    var c = compute(v);
    if (!c.setUp) return '<p class="mut">Not set up yet.</p>';
    var err = c.error ? '<div class="card acc2"><p>' + v.esc(c.error) + '</p></div>' : '';
    words = c.words || VERDICT;
    var tab = state.tab, body;
    if (DOG_TABS[tab]) {
      var r = pickDog(c);
      if (r && tab === 'score' && state.edit) {
        var screen = editHtml(v, r, state.edit);
        if (screen) return err + screen + tabsHtml(v, c);
        state.edit = '';
      }
      body = !r ? '<p class="mut">No animals scored yet.</p>' : tab === 'evidence' ? evidenceHtml(v, r, c) : tab === 'history' ? historyHtml(v, r, c) : dogHtml(v, r, c);
    } else if (tab === 'cal') body = calHtml(v, c);
    else if (tab === 'more') body = moreHtml(c);
    else if (tab === 'archive') body = archiveHtml(v, c);
    else if (tab === 'system') body = systemHtml(v);
    else if (tab === 'dna' && Dna) body = backMore() + Dna.screen(v.T, state.calc, v.esc, v.today);
    else if (tab === 'viewers' && Levels) body = viewersHtml(v);
    else body = listHtml(v, c);
    return err + body + tabsHtml(v, c);
  }

  /* The look (owner's design, 13 Nov 2026): house tokens only; Lexend 400, 500 and 600; nothing under 14px; 12px corners;
     1px lines inside; 3px verdict line; no fill at rest, pale grey (--hov) on hover or tap, no outline; the name is 16px and the
     score 18px (a Breed Better size, --bb-fs-name, so the house body size is unchanged). */
  var STYLE = [
    '#bbRoot,.bb-sec{--bb-fs-name:16px;--bb-tabs-h:64px}',
    '.bb-v{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--radius);border:1px solid;font-size:var(--fs-small);font-weight:500;white-space:nowrap;background:transparent}',
    '.bb-pass{border-color:var(--ljr-5);color:var(--ink)}.bb-below_target{border-color:var(--ljr-3);color:var(--ink)}.bb-unverified{border-color:var(--ljr-6);color:var(--ink)}.bb-fail{border-color:var(--ljr-2);color:var(--ink)}',
    '.bb-due{font-size:var(--fs-small);color:var(--muted);white-space:nowrap}.bb-overdue{color:var(--ljr-3-text)}',
    '.bb-test{border-color:var(--ljr-7);color:var(--ink)}',
    '.bb-filt{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}',
    '.bb-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin:0 0 12px}',
    '.bb-lab{display:flex;flex-direction:column;gap:4px;font-size:var(--fs-small);color:var(--muted);min-width:0;margin:0 0 12px}.bb-tools .bb-lab{margin:0}',
    '.bb-lab input,.bb-lab select{min-height:44px;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:var(--radius);padding:6px 10px;background:var(--card);color:var(--ink);font-size:var(--fs-input,16px)}',
    '.bb-f,.bb-dog,.bb-src,.bb-chip,.bb-sic,.bb-rowbtn,.bb-day,.bb-tab{font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:var(--radius);cursor:pointer}',
    '.bb-f{min-height:44px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;font-weight:500}.bb-ico{padding:0;width:44px;justify-content:center}',
    '.bb-f:hover,.bb-dog:hover,.bb-src:hover,.bb-chip:hover,.bb-sic:hover,.bb-day:hover,.bb-tab:hover,.bb-f:active,.bb-dog:active,.bb-src:active,.bb-chip:active,.bb-sic:active,.bb-day:active,.bb-tab:active{background:var(--hov);outline:none}',
    '.bb-f[aria-pressed=true],.bb-day[aria-pressed=true]{background:var(--hov);border-color:var(--press)}',
    '.bb-f:focus-visible,.bb-dog:focus-visible,.bb-src:focus-visible,.bb-chip:focus-visible,.bb-sic:focus-visible,.bb-rowbtn:focus-visible,.bb-day:focus-visible,.bb-tab:focus-visible{border-color:var(--ink);outline:none}',
    '.bb-dog{display:flex;flex-wrap:nowrap;align-items:center;gap:12px;width:100%;min-height:44px;padding:12px 12px 12px 15px;margin:0 0 8px;text-align:left;position:relative;overflow:hidden;box-sizing:border-box}',
    '.bb-dog::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--v,var(--line))}',
    '.bb-name{font-weight:500;flex:1 1 auto;font-size:var(--bb-fs-name)}.bb-pts,.bb-why{color:var(--muted);font-size:var(--fs-small)}',
    '.bb-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    /* list row: the row is one button; the section icons sit on top of it, in the info column */
    '.bb-row{display:block;padding:0;cursor:default}.bb-row:has(.bb-rowbtn:hover),.bb-row:has(.bb-rowbtn:active){background:var(--hov)}',
    '.bb-rowbtn{display:flex;align-items:flex-start;gap:12px;width:100%;min-height:116px;padding:12px 12px 48px 15px;border:0;border-radius:0;text-align:left;background:transparent}',
    '.bb-rowbtn:hover,.bb-rowbtn:active{background:transparent;outline:none}',
    '.bb-sics{position:absolute;left:111px;right:12px;bottom:12px;display:flex;flex-wrap:wrap;gap:6px;pointer-events:none}.bb-sic{pointer-events:auto}',
    '.bb-sic{width:28px;height:28px;padding:0;border-color:transparent;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--bi)}',
    '@media (max-width:544px){.bb-sic{width:32px;height:32px}}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #bbRoot .bb-sic:not(.bb-off),:root:not([data-theme="light"]) .bb-bandic{color:var(--bd,var(--bi))}}',
    ':root[data-theme="dark"] #bbRoot .bb-sic:not(.bb-off),:root[data-theme="dark"] .bb-bandic{color:var(--bd,var(--bi))}',
    '#bbRoot .bb-sic{color:var(--bi)}#bbRoot .bb-sic.bb-off,:root #bbRoot .bb-sic.bb-off{color:var(--muted)}',
    '.bb-ph{width:84px;height:84px;flex-shrink:0;position:relative}.bb-ring{position:absolute;inset:0}',
    '.bb-pic{position:absolute;inset:9px;border-radius:50%;background:var(--hov);overflow:hidden;display:block}',
    '.bb-pic img{width:100%;height:100%;object-fit:cover;display:block}.bb-pic img.off{display:none}',
    '.bb-pic88{position:relative;inset:auto;width:88px;height:88px;flex-shrink:0;border-radius:var(--radius)}',
    '.bb-info{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px}',
    '.bb-l1,.bb-l2{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.bb-l2{font-size:var(--fs-small);color:var(--muted)}',
    '.bb-l1 .bb-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.bb-sc{white-space:nowrap;font-size:var(--fs-small);color:var(--muted)}',
    '.bb-big{font-weight:600;font-size:var(--fs-figure);color:var(--ink);white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.bb-vw{display:inline-flex;align-items:center;gap:4px;color:var(--ink);font-weight:500;white-space:nowrap}',
    '.bb-star{flex-shrink:0;fill:var(--ljr-2);stroke:var(--ljr-2);stroke-width:1.5;stroke-linejoin:round;vertical-align:-2px;margin-right:4px}',
    '.bb-title{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0 0 8px}',
    /* dog page */
    '.bb-dhead{display:flex;align-items:center;gap:8px;margin:0 0 12px}.bb-dname{margin:0;font-size:var(--bb-fs-name);font-weight:600;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bb-nof{white-space:nowrap}',
    '.bb-sub{margin:0}.bb-strong{font-weight:500}',
    'details.bb-infobox>summary,details.bb-band>summary,details.bb-dna>summary,details.bb-done>summary{list-style:none}',
    'details>summary::-webkit-details-marker{display:none}',
    '.bb-infobox summary{cursor:pointer;display:flex;align-items:center;gap:8px;min-height:44px}',
    '.bb-chev{margin-left:auto;display:inline-flex;color:var(--muted)}details[open]>summary .bb-chev{transform:rotate(180deg)}',
    '.bb-infobd{display:flex;gap:12px;align-items:center;margin:8px 0}',
    '.bb-chips{display:flex;flex-wrap:wrap;gap:6px}.bb-tag{border:1px solid var(--line);border-radius:var(--radius);padding:2px 10px;font-size:var(--fs-small);font-weight:400}',
    '.bb-vbox{position:relative;display:flex;flex-direction:column;gap:10px;border-left:3px solid var(--v,var(--line))}',
    '.bb-vtop{display:flex;justify-content:space-between;align-items:center;gap:12px}.bb-vl{display:flex;align-items:center;gap:10px}',
    '.bb-vword{font-size:var(--fs-figure);font-weight:600}.bb-vr{text-align:right}.bb-huge{font-size:28px;font-weight:600;line-height:1}',
    '.bb-barw{position:relative;height:10px}.bb-bar{display:flex;height:10px;border:1px solid var(--line);box-sizing:border-box;background:var(--hov);border-radius:var(--radius);overflow:hidden}',
    '.bb-tp{background:repeating-linear-gradient(45deg,var(--c) 0 2px,transparent 2px 6px);opacity:.6}',
    '.bb-tmark{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--ink)}',
    '.bb-three{display:flex;justify-content:space-between;gap:8px;font-size:var(--fs-small);color:var(--muted)}',
    '.bb-vbox .bb-why{margin:0;color:var(--ink)}.bb-scored{margin:0}',
    '.bb-band{border-left:3px solid var(--bl,var(--line))}.bb-band>summary{cursor:pointer;font-weight:500;display:flex;align-items:center;gap:8px;min-height:44px}',
    '.bb-bandic{display:inline-flex;color:var(--bi,var(--muted))}.bb-blabel{min-width:0}',
    '.bb-cnt{font-weight:400}.bb-att{border-color:var(--bl,var(--line))}',
    '.bb-line{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:8px 0;border-top:1px solid var(--line)}.bb-l{flex:1 1 55%;min-width:0}.bb-why{flex:1 1 100%;padding-left:24px}',
    '.bb-mk{display:inline-flex;width:16px}.bb-prove{flex:1 1 100%;padding-left:24px;font-size:var(--fs-small);color:var(--ink)}',
    '.bb-done>summary{cursor:pointer;display:flex;align-items:center;gap:8px;min-height:44px;color:var(--muted);font-size:var(--fs-small);border-top:1px solid var(--line)}',
    '.bb-src{min-height:24px;padding:0 8px;font-size:var(--fs-small);color:var(--ink)}@media (max-width:544px){.bb-src{min-height:44px}}',
    '.bb-chip{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;margin-top:4px}',
    /* the five tabs, fixed at the bottom of Breed Better, directly above the house bar; the page pads so nothing hides under them */
    '#bbRoot{padding-bottom:calc(var(--bb-tabs-h) + 16px)}',
    '.bb-tabs{position:fixed;left:0;right:0;bottom:calc(var(--house-tabs-h,70px) + env(safe-area-inset-bottom,0px));z-index:19;display:flex;justify-content:center;gap:4px;height:var(--bb-tabs-h);padding:4px 8px;box-sizing:border-box;background:var(--card);border-top:1px solid var(--line)}',
    '.bb-tab{flex:1 1 0;max-width:128px;min-width:0;border-color:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0;font-size:var(--fs-small);color:var(--ink)}',
    '.bb-tabic{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}',
    '.bb-tabw{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.bb-tab[aria-current=page]{background:var(--hov);font-weight:600}.bb-tab[aria-current=page] .bb-tabic{border-color:transparent}',
    '.bb-tab:focus-visible{border-color:var(--ink)}',
    '.bb-h{margin:0 0 4px;font-weight:600}.bb-h4{margin:16px 0 8px;font-size:var(--fs-body);font-weight:600;display:flex;gap:8px;align-items:center}',
    '.bb-edit{display:flex;flex-direction:column;gap:8px;align-items:flex-start}',
    '.bb-edit form{display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box}',
    /* calendar */
    '.bb-month{margin:12px 0}.bb-mhead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}',
    '.bb-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;text-align:center}.bb-wd{font-size:var(--fs-small);color:var(--muted)}',
    '.bb-day{position:relative;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--radius);border-color:transparent;padding:0}',
    'span.bb-day{border:1px solid transparent;box-sizing:border-box}.bb-today,span.bb-today{border-color:var(--ink)}',
    '.bb-dots{display:flex;gap:2px;height:6px;margin-top:2px}.bb-dots i{width:6px;height:6px;border-radius:50%}',
    '.bb-dayon{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}',
    '.bb-calrow .bb-name{white-space:normal}.bb-calw{font-weight:500;font-size:var(--fs-small);white-space:nowrap}',
    '.bb-arch{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}',
    /* more, evidence, history, viewers */
    '.bb-more{min-height:56px}.bb-mic{display:inline-flex;color:var(--muted)}.bb-more .bb-pts{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    '.bb-ev{display:flex;gap:12px;align-items:flex-start}.bb-evic{display:inline-flex;color:var(--muted);margin-top:2px}',
    '.bb-hist .bb-l1{align-items:center}.bb-hist p{margin:4px 0 0}',
    '.bb-shows{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:4px}.bb-shows li{display:flex;gap:8px;align-items:center;font-size:var(--fs-small)}.bb-shows li[data-on=false]{color:var(--muted)}',
    /* the one-line section on a dog card: folded by default; unfolds to the checks, grouped by section, things to do first */
    '.bb-sec{border-top:1px solid var(--line);padding:6px 12px;display:flex;flex-direction:column;gap:8px}.dc .bb-sec{padding-bottom:40px}',
    '.bb-secd>summary{list-style:none}.bb-secd>summary::-webkit-details-marker{display:none}',
    '.bb-sec .bb-sechd{display:flex;flex-wrap:nowrap;align-items:center;gap:6px 8px;width:100%;box-sizing:border-box;min-height:44px;padding:6px 8px;margin:0;border:1px solid var(--line);text-align:left;cursor:pointer}',
    '.bb-sechd .bb-v{flex:none}.bb-logo{flex:none;width:32px;height:32px}.bb-sect{font-weight:600;font-size:var(--fs-body);white-space:nowrap}.bb-secpts{margin-left:auto;white-space:nowrap}',
    '@media (max-width:544px){.bb-sechd .bb-sect{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}',
    '.bb-secd[open]>.bb-sechd .bb-chev{transform:rotate(180deg)}.bb-sechd .bb-chev{margin-left:0}',
    '.bb-secbody{display:flex;flex-direction:column;gap:8px;padding:8px 0 4px}',
    '.bb-secg{border-left:3px solid var(--bl,var(--line));padding-left:8px}.bb-secgh{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-weight:500}',
    '.bb-gates{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}',
    '.bb-gates li{border-top:1px solid var(--line)}.bb-gates li:first-child{border-top:0}',
    '.bb-gbtn{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:0 4px;font:inherit;font-size:var(--fs-small);color:var(--ink);background:transparent;border:1px solid transparent;border-radius:var(--radius);text-align:left;cursor:pointer}',
    '.bb-gbtn:hover,.bb-gbtn:active{background:var(--hov);outline:none}.bb-gbtn:focus-visible{border-color:var(--ink);outline:none}',
    '.bb-gl{flex:1;min-width:0}.bb-gw{color:var(--muted);white-space:nowrap}.bb-gates li[data-gate=fail] .bb-gw{color:var(--ljr-2-text)}'
  ];
  function cssText() { return STYLE.join('') + (Dna ? Dna.css() : ''); }
  function css() {
    if (typeof document === 'undefined' || document.getElementById('bbStyle')) return;
    var s = document.createElement('style'); s.id = 'bbStyle';
    s.textContent = cssText();
    document.head.appendChild(s);
  }

  /** The whole page. v = { T, today, esc } */
  function page(v) {
    last = v; css();
    if (state.focus && typeof document !== 'undefined') {
      var f = state.focus; state.focus = '';
      setTimeout(function () {
        var el = document.querySelector('[data-bb-band="' + (window.CSS && window.CSS.escape ? window.CSS.escape(f) : f) + '"]');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
      }, 0);
    }
    return '<h2>Breed Better <span class="bb-v bb-test" title="Trial scores, not yet signed off">Testing</span></h2><div id="bbRoot">' + inner(v) + '</div>';
  }

  /** The score on a dog card, as one small button. Empty when that animal is not enrolled. */
  function chip(v, id) {
    last = v; css();
    var r = compute(v).byId[id];
    if (!r) return '';
    return '<button type="button" class="bb-chip"' + secAttrs(v.esc, id, '') + ' aria-label="Breed Better score, testing: trial scores, not yet signed off">' + pill(r) + '<span class="bb-pts">' + total(r) + '</span><span class="bb-v bb-test" title="Trial scores, not yet signed off">Testing</span></button>';
  }

  /* The Breed Better logo file sits beside this script (bb-logo.svg). */
  var LOGO_SRC = (function () { try { var c = document.currentScript && document.currentScript.src; return c ? c.replace(/[^/]*$/, '') + 'bb-logo.svg' : 'bb-logo.svg'; } catch (e) { return 'bb-logo.svg'; } }());
  var LOGO = '<img class="bb-logo" src="' + LOGO_SRC + '" width="32" height="32" alt="Breed Better logo">';
  var GATE_WORD = { pass: 'Passed', fail: 'Failed', unverified: 'Missing' };
  var GATE_ICON = { pass: ICON.pass, fail: ICON.fail, unverified: 'M12 8v5 M12 16h.01 M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' };

  /** The Breed Better section on a dog card: ONE line, folded (logo, verdict, Testing, "x of y" points, chevron).
   *  Unfolds in place to the checks grouped by section, must pass first, things to do first in each.
   *  Every line opens that animal's Score tab at that check's section. */
  function section(v, id) {
    last = v; css();
    var r = compute(v).byId[id];
    if (!r) return '';
    var esc = v.esc, key = 'card-' + id;
    var bands = sortBands(r.bands).filter(function (b) { return t(b.kind) === 'gate' || t(b.kind) === 'points'; });
    bands = bands.filter(function (b) { return t(b.kind) === 'gate'; }).concat(bands.filter(function (b) { return t(b.kind) === 'points'; }));
    var groups = bands.map(function (b) {
      var lines = attentionFirst(r.lines.filter(function (l) { return l.band_id === b.id; }));
      if (!lines.length) return '';
      var n = bandCount(r, b);
      return '<div class="bb-secg" style="' + bandVars(b) + '" data-bb-group="' + esc(b.id) + '"><p class="bb-secgh"><span class="bb-bandic">' + ic(bandIcon(b), 18) + '</span>' + esc(b.label) + ' <span class="cnt wide bb-cnt">' + n.text + '</span></p>'
        + '<ul class="bb-gates">' + lines.map(function (l) {
          var o, word, colour;
          if (l.kind === 'gate') { o = l.gate_outcome || 'unverified'; word = GATE_WORD[o] || o; colour = VTEXT[o] || '--muted'; }
          else { o = l.points === '' ? 'unverified' : 'pass'; word = l.points === '' ? GATE_WORD.unverified : fmt(l.points) + ' of ' + l.points_max; colour = l.points === '' ? VTEXT.unverified : '--muted'; }
          if (l.due) word += ', ' + (l.due === 'overdue' ? 'overdue' : 'due ' + day(l.due_date));
          return '<li data-gate="' + esc(o) + '"><button type="button" class="bb-gbtn"' + secAttrs(esc, id, b.id) + ' aria-label="' + esc(l.label_then + ': ' + word + '. Open in Breed Better') + '">'
            + ic(GATE_ICON[o] || GATE_ICON.unverified, 16, 'var(' + colour + ')') + '<span class="bb-gl">' + esc(l.label_then) + '</span><span class="bb-gw">' + esc(word) + '</span></button></li>';
        }).join('') + '</ul></div>';
    }).join('');
    return '<section class="bb-sec" data-k="bb" aria-label="Breed Better"><details class="bb-secd" data-bb-band="' + esc(key) + '"' + (state.open[key] ? ' open' : '') + '>'
      + '<summary class="bb-chip bb-sechd" aria-label="Breed Better: ' + esc(r.words[verdictOf(r)]) + ', ' + esc(fmt(r.points_earned) + ' of ' + r.points_available) + ' points. Testing: trial scores, not yet signed off. Show the checks">'
      + LOGO + '<span class="bb-sect">Breed Better</span>' + pill(r) + '<span class="bb-v bb-test" title="Trial scores, not yet signed off">Testing</span>'
      + '<span class="bb-pts bb-secpts">' + fmt(r.points_earned) + ' of ' + r.points_available + '</span>' + chev() + '</summary>'
      + '<div class="bb-secbody">' + groups + '<button type="button" class="bb-f bb-secopen"' + secAttrs(esc, id, '') + '>Open in Breed Better' + ic(ICON.right, 18) + '</button></div></details></section>';
  }

  /** What an inspector link may show of one animal's must-pass checks: the word, the answer, its date and when it is next due.
   *  Never points, target or ranking. For the save script to send to an inspector (it does not yet; see the PR). */
  function mustPassFor(r) {
    return r.lines.filter(function (l) { return l.kind === 'gate'; }).map(function (l) {
      return { subject_id: r.subject_id, label: l.label_then, outcome: l.gate_outcome || 'unverified', answer: l.answer_then, date: l.date_then, due_date: l.due_date,
        evidence_table: l.evidence_table, evidence_id: l.evidence_id };
    });
  }

  /* typing or a new sort redraws the rows only, so the search box keeps focus */
  /* the hub loads the photos after each draw */
  function after() { if (last && typeof last.after === 'function') last.after(); }
  function redrawRows() {
    var el = document.getElementById('bbList'); if (el && last && memo) { el.innerHTML = rowsHtml(last, memo); after(); }
    var n = document.getElementById('bbShown'); if (n && memo) n.textContent = shownText(memo);
  }
  function redraw() { var el = document.getElementById('bbRoot'); if (el && last) { el.innerHTML = inner(last); after(); } }

  if (typeof document !== 'undefined') {
    /* remember which sections are open, so a redraw keeps them */
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (d && d.getAttribute && d.hasAttribute('data-bb-band')) state.open[d.getAttribute('data-bb-band')] = d.open;
    }, true);
    document.addEventListener('input', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-bb-search')) { state.q = e.target.value.trim(); redrawRows(); }
    });
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (!el || !el.hasAttribute) return;
      if (el.hasAttribute('data-bb-sort')) { state.sort = el.value; redrawRows(); }
      if (el.hasAttribute('data-bb-calc-test')) { state.calc = { code: el.value }; redraw(); }
      if (el.hasAttribute('data-bb-evcheck')) { state.evCheck = el.value; redraw(); }
    });
    /* capture, so the state is set before the hub's own click handler changes the address and draws the page */
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-bb-dog],[data-bb-filter],[data-bb-open],[data-bb-back],[data-bb-tab],[data-bb-sex],[data-bb-cal],[data-bb-month],[data-bb-calc],[data-bb-edit],[data-bb-edit-back],[data-bb-sec],[data-bb-day],[data-bb-evkind],[data-bb-step]');
      if (!b) return;
      var viaHub = b.hasAttribute('data-go');
      if (b.hasAttribute('data-bb-dog')) { state.dog = b.getAttribute('data-bb-dog'); state.tab = 'score'; state.edit = ''; return; }
      if (b.hasAttribute('data-bb-edit')) {
        e.preventDefault();
        e.stopPropagation();
        state.edit = b.getAttribute('data-bb-edit');
        state.editPushed = true;
        try { history.pushState({ bbEdit: 1 }, '', location.href); } catch (err) { state.editPushed = false; }
      } else if (b.hasAttribute('data-bb-edit-back')) {
        e.preventDefault();
        e.stopPropagation();
        var pushed = state.editPushed;
        state.edit = '';
        state.editPushed = false;
        if (pushed) { history.back(); return; }
      } else if (b.hasAttribute('data-bb-sec')) {
        state.dog = b.getAttribute('data-bb-sec'); state.tab = 'score'; state.edit = '';
        var band = b.getAttribute('data-bb-band-go');
        if (band) { state.open[band] = true; state.focus = band; }
      } else if (b.hasAttribute('data-bb-filter')) state.filter = b.getAttribute('data-bb-filter');
      else if (b.hasAttribute('data-bb-open')) { state.dog = b.getAttribute('data-bb-open'); state.tab = 'score'; state.edit = ''; }
      else if (b.hasAttribute('data-bb-back')) { state.tab = 'dogs'; state.edit = ''; }
      else if (b.hasAttribute('data-bb-step')) { state.edit = ''; }
      else if (b.hasAttribute('data-bb-tab')) { state.tab = b.getAttribute('data-bb-tab'); state.edit = ''; }
      else if (b.hasAttribute('data-bb-sex')) state.sex = b.getAttribute('data-bb-sex');
      else if (b.hasAttribute('data-bb-cal')) { state.cal = b.getAttribute('data-bb-cal'); state.calDay = ''; }
      else if (b.hasAttribute('data-bb-day')) { var dd = b.getAttribute('data-bb-day'); state.calDay = dd && state.calDay !== dd ? dd : ''; }
      else if (b.hasAttribute('data-bb-evkind')) state.evKind = b.getAttribute('data-bb-evkind');
      else if (b.hasAttribute('data-bb-calc')) { var cv = b.getAttribute('data-bb-calc').split(':'); state.calc[cv[0]] = Number(cv[1]); }
      else if (b.hasAttribute('data-bb-month')) { state.month = b.getAttribute('data-bb-month'); state.calDay = ''; }
      /* a button that also changes the address: the hub draws the page itself */
      if (viaHub) return;
      redraw();
    }, true);
    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f || !f.getAttribute || !f.hasAttribute('data-bb-result')) return;
      e.preventDefault();
      var msg = f.querySelector('[data-bb-edit-msg]');
      if (msg) msg.textContent = 'The result is entered here. It is saved when this check\'s table is on the save script.';
    }, true);
    window.addEventListener('popstate', function () {
      if (!state.editPushed) return;
      state.edit = '';
      state.editPushed = false;
    });
  }

  /** The hub's #/breed/<sub> address: a tab (calendar, more ...), a tab and an animal (score.<id>, evidence.<id>,
   *  history.<id>), or just an animal id (its Score tab). Blank goes back to the list. */
  function open(sub) {
    sub = t(sub); state.edit = ''; state.editPushed = false;
    if (!sub) { state.tab = 'dogs'; state.dog = ''; return; }
    var m = /^([a-z]+)(?:\.(.+))?$/.exec(sub), tab = m && KEYTAB[m[1]];
    if (tab) {
      state.tab = tab;
      if (m[2] && DOG_TABS[tab]) { try { state.dog = decodeURIComponent(m[2]); } catch (e) { state.dog = m[2]; } }
    } else { state.tab = 'score'; state.dog = sub; }
  }
  function setTab(k) { state.tab = k; state.edit = ''; if (!DOG_TABS[k]) state.dog = state.dog || ''; }
  /** For tests: the parts of the state a test may set, and a reset. */
  function setState(o) { Object.keys(o || {}).forEach(function (k) { state[k] = o[k]; }); }
  function getState() { return Object.assign({}, state); }

  return {
    FILES: FILES, compute: compute, page: page, chip: chip, section: section, open: open, setTab: setTab, setState: setState, getState: getState,
    age: age, bandStats: bandStats, bandCount: bandCount, bandPaint: bandPaint, bandIcon: bandIcon, BAND_ICON: BAND_ICON, day: day, lineHtml: lineHtml,
    wordsFor: wordsFor, pctLine: pctLine, judgementsFor: judgementsFor, calItems: calItems, calCounts: calCounts, evidenceItems: evidenceItems,
    historyRows: historyRows, mustPassFor: mustPassFor, cssText: cssText, toProve: toProve, href: href,
    SORTS: SORTS, sortRows: function (rows, k) { return rows.slice().sort(SORT_FN[k] || SORT_FN.verdict); }
  };
}));
