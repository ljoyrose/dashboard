/*!
 * Breed Better in CD Hub: reads rule rows and draws scores. It writes nothing and holds no animal data.
 * Everything specific to a species, breed or scheme comes from rows. Needs BreedBetterScore (score.js).
 * Scores are worked out when the page loads and carry a Testing label until the owner signs the scoring off
 * (a date in BLD-score_scheme.signed_off_on, on or before today: D3, Lisa 18 Nov 2026).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./score.js'), require('./dna-kit.js'));
  else root.BBHubView = factory(root.BreedBetterScore, root.BBDnaKit);
}(typeof self !== 'undefined' ? self : this, function (Score, Dna) {
  'use strict';

  var FILES = ['BLD-score_scheme.csv', 'BLD-score_band.csv', 'BLD-score_criterion.csv', 'BLD-score_point.csv', 'BLD-score_enrolment.csv',
    /* evidence only Breed Better reads; the hub already loads health_screen, dna_result, litter and subject_status */
    'BLD-fit_to_breed.csv', 'BLD-score_judgement.csv',
    /* the values typed on a Checks form (grade, certainty, answer), read onto their check_log row */
    'BLD-check_value.csv'];
  /* default words; a scheme row can change any of them with verdict_words, e.g. "unverified=To prove" */
  var VERDICT = { pass: 'Pass', below_target: 'Below target', unverified: 'Unverified', fail: 'Fail' };
  var ORDER = ['pass', 'below_target', 'unverified', 'fail'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var words = VERDICT;
  var REASON = {
    no_source: 'Record type not set up yet', no_record: 'No record yet', not_judged: 'Not entered yet', expired: 'Out of date',
    undated: 'Record has no date', blank_answer: 'Blank on the record', no_rule_for_answer: 'Answer is not in the rules',
    recorded_unverified: 'Recorded, cannot be scored yet', not_accepted: 'Not accepted yet'
  };
  var state = { from: null, unenrol: '', filter: '', dog: '', edit: '', editPushed: false, open: {}, q: '', sort: 'verdict', tab: 'dogs', sex: '', age: '', month: '', cal: 'all', calc: {} }, last = null, memo = null;

  function t(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  /* D3 (Lisa, 18 Nov 2026): the Testing label stays until the scheme row's signed_off_on holds a date (YYYY-MM-DD) on or
     before today. Blank, not a date, or a future date keeps the label. Signing off is that one cell; clearing it brings the label back. */
  function signedOff(r, today) { var d = t(r && r.signed_off_on); return /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= t(today); }
  var TESTING = '<span class="bb-v bb-test" title="Trial scores, not yet signed off">Testing</span>';

  /** 2026-03-02 -> "2 Mar 2026". Anything else is shown as it is. */
  function day(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(d));
    if (m && typeof BLDDates !== 'undefined') return BLDDates.long(t(d));   /* the one formatter (13 Nov 2026) */
    return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1] + ' ' + m[1] : t(d);
  }

  function wordsFor(scheme) {
    var w = Object.assign({}, VERDICT);
    t(scheme && scheme.verdict_words).split(';').forEach(function (pair) {
      var at = pair.indexOf('='), k = pair.slice(0, at).trim().toLowerCase().replace(/\s+/g, '_');
      if (at > 0 && w[k] && t(pair.slice(at + 1))) w[k] = t(pair.slice(at + 1));
    });
    return w;
  }
  function verdictOf(r) { return r.verdict || r.gate_result; }

  /* Enrolments (Lisa, 15 Nov 2026): the older score_enrolment rows, read as they are, and enrolled_in link rows
     (subject -> score_scheme, any course or certification later). Each from its from date to its to date, both inclusive. */
  function enrolments(T) {
    var out = [];
    (T['BLD-score_enrolment.csv'] || []).forEach(function (e) {
      out.push({ id: t(e.id), src: 'legacy', subject_id: t(e.subject_id), scheme_id: t(e.scheme_id), from: t(e.valid_from), to: t(e.to_date), off: /^false$/i.test(t(e.is_active)), reason: '' });
    });
    (T['BLD-links.csv'] || []).forEach(function (l) {
      if (t(l.role) !== 'enrolled_in' || !/^subjects?$/.test(t(l.from_table)) || !/^score_schemes?$/.test(t(l.to_table))) return;
      out.push({ id: t(l.id), src: 'link', subject_id: t(l.from_id), scheme_id: t(l.to_id), from: t(l.from_date), to: t(l.to_date), off: false, reason: t(l.end_reason) });
    });
    /* once an animal has a link row for a scheme, the links say it all: its older row for that scheme is no longer read */
    var linked = {}; out.forEach(function (e) { if (e.src === 'link') linked[e.subject_id + '|' + e.scheme_id] = 1; });
    return out.filter(function (e) { return e.src === 'link' || !linked[e.subject_id + '|' + e.scheme_id]; });
  }

  /** One result per enrolled animal, best first. { results, error, byId } */
  function compute(v) {
    var T = v.T, key = v.today + '|' + FILES.concat(['BLD-subject.csv', 'BLD-health_screen.csv', 'BLD-dna_result.csv', 'BLD-litter.csv', 'BLD-subject_status.csv', 'BLD-links.csv'])
      .map(function (f) { return (T[f] || []).length; }).join(',');
    /* the same row counts can hold different rows (a re-read after an edit): reuse only when every table is the very same one */
    var names = Object.keys(T).sort(), held = names.map(function (f) { return T[f]; });
    if (memo && memo.key === key && memo.names === names.join('|') && memo.held.every(function (x, i) { return x === held[i]; })) return memo;
    var all = enrolments(T);
    var out = { key: key, names: names.join('|'), held: held, results: [], byId: {}, error: '', ended: [], enrol: {}, setUp: !!all.length };
    var subjects = {};
    (T['BLD-subject.csv'] || []).forEach(function (s) { subjects[s.id] = s; });
    var logs = null;
    var evidence = new Proxy({}, { get: function (o, name) {
      if (name !== 'BLD-check_log') return T[name + '.csv'];
      return logs || (logs = withValues(T['BLD-check_log.csv'], T['BLD-check_value.csv'], T['BLD-check_type.csv']));
    } });
    var open = all.filter(function (e) { return !e.off && !(e.to && e.to < v.today) && !(e.from && e.from > v.today); });
    var isOpen = {}; open.forEach(function (e) { isOpen[e.subject_id] = 1; });
    /* kept for the Archive: an animal whose every enrolment has ended, with the latest one's dates and reason */
    var last = {};
    all.forEach(function (e) {
      if (isOpen[e.subject_id] || !(e.off || (e.to && e.to < v.today)) || !subjects[e.subject_id]) return;
      if (!last[e.subject_id] || (e.to || '') > (last[e.subject_id].to || '')) last[e.subject_id] = e;
    });
    Object.keys(last).forEach(function (k) { var e = last[k]; out.ended.push({ id: k, name: t(subjects[k].name), from: e.from, to: e.to, reason: e.reason, scheme_id: e.scheme_id }); });
    open.forEach(function (e) {
      if (out.enrol[e.subject_id]) return;   /* one score per animal: the first open enrolment */
      out.enrol[e.subject_id] = e;
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
        var r = Score.score({ scheme: scheme, bands: bands, criteria: criteria, points: points, subject: subject, evidence: evidence, judgements: {}, asOf: v.today });
        r.name = t(subject.name); r.dob = t(subject.dob); r.bands = bands; r.words = wordsFor(scheme); r.signed_off_on = t(scheme.signed_off_on);
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
  function total(r) { return r.points_earned + ' of ' + r.points_available + (r.target !== '' && r.target !== undefined ? ', target ' + r.target : ''); }
  function vpill(k, w) { return '<span class="bb-v bb-' + k + '">' + (w || words)[k] + '</span>'; }
  function pill(r) { return vpill(verdictOf(r), r.words); }
  function unv(r) { return r.points_unverified ? ', ' + r.points_unverified + ' ' + r.words.unverified.toLowerCase() : ''; }

  /* Drawing only (mock-up and Style, 12 Nov 2026): verdict icons, the must-pass star and the band colours. No rule lives here. */
  var ICON = {
    pass: 'M5 12l5 5l10 -10', below_target: 'M6 9l6 6l6 -6', fail: 'M18 6l-12 12 M6 6l12 12',
    unverified: 'M8 8a3.5 3 0 0 1 3.5 -3h1a3.5 3 0 0 1 3.5 3a3 3 0 0 1 -2 3a3 4 0 0 0 -2 4 M12 19l0 .01',
    star: 'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z',
    info: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 9h.01 M11 12h1v4h1'
  };
  var VTEXT = { pass: '--ljr-5-text', below_target: '--ljr-3-text', unverified: '--ljr-6-text', fail: '--ljr-2-text' };
  var BANDVAR = { red: '--ljr-2', orange: '--ljr-3', yellow: '--ljr-4', green: '--ljr-5', blue: '--ljr-6', purple: '--ljr-7', white: '--line', black: '--ink' };
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
  /* a band's colour cell may hold a kit word (red, orange...) or a #hex; anything else draws in the line grey */
  function bandColour(b) {
    var c = t(b.colour), k = BANDVAR[c.toLowerCase()];
    return k ? 'var(' + k + ')' : /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? c : 'var(--line)';
  }
  /* Section icons (Style, 12 Nov 2026). Drawing only: a band row's own icon cell wins (a name below); otherwise its key picks one;
     a key not listed gets the plain circle. No rule lives here. */
  var SECICON = {
    target: 'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0 M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0 M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    star: ICON.star,
    heart: 'M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572',
    stethoscope: 'M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1 M8 15a6 6 0 1 0 12 0v-3 M11 3v2 M6 3v2 M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    smile: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M9 10h.01 M15 10h.01 M9.5 15a3.5 3.5 0 0 0 5 0',
    family: 'M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2 M16 3.13a4 4 0 0 1 0 7.75 M21 21v-2a4 4 0 0 0 -3 -3.85',
    dna: 'M14.828 14.828a4 4 0 1 0 -5.656 -5.656a4 4 0 0 0 5.656 5.656z M9.172 20.485a4 4 0 1 0 -5.657 -5.657 M14.828 3.515a4 4 0 0 0 5.657 5.657',
    info: ICON.info,
    circle: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'
  };
  var SECKEY = { programme: 'target', gate: 'star', gates: 'star', must_pass: 'star', health: 'heart', health_screening: 'heart',
    fit_to_breed: 'stethoscope', ftb: 'stethoscope', temperament: 'smile', breeding: 'family', breeding_record: 'family', dna: 'dna', status: 'info' };
  function secIcon(b) {
    var own = t(b.icon).toLowerCase(), key = t(b.key).toLowerCase();
    return SECICON[own] || SECICON[SECKEY[key]] || (b.kind === 'gate' ? SECICON.star : SECICON.circle);
  }
  /** One section's result for its colour: the worst of its lines. Status sections have none. */
  function secResult(lines) {
    var gates = lines.filter(function (l) { return l.kind === 'gate'; }), pts = lines.filter(function (l) { return l.kind !== 'gate' && l.kind !== 'status'; });
    if (!gates.length && !pts.length) return '';
    if (gates.some(function (l) { return l.gate_outcome === 'fail'; })) return 'fail';
    if (gates.some(function (l) { return l.gate_outcome !== 'pass'; }) || pts.some(function (l) { return l.points === ''; })) return 'unverified';
    var got = 0, max = 0; pts.forEach(function (l) { got += Number(l.points) || 0; max += Number(l.points_max) || 0; });
    return got >= max ? 'pass' : 'below_target';
  }
  /** Points bands in their own order, each with what it can give, what was earned and what is still to prove. */
  function bandStats(r) {
    return r.bands.slice().sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); })
      .filter(function (b) { return t(b.kind) === 'points'; }).map(function (b) {
        var o = { band: b, max: 0, earned: 0, unv: 0 };
        r.lines.forEach(function (l) {
          if (l.band_id !== b.id || l.points_max === '') return;
          o.max += Number(l.points_max) || 0;
          if (l.points === '') o.unv += Number(l.points_max) || 0; else o.earned += Number(l.points) || 0;
        });
        return o;
      }).filter(function (o) { return o.max > 0; });
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
  function months(dob, today) {
    var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(dob)), b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t(today));
    if (!a || !b) return null;
    var m = (b[1] - a[1]) * 12 + (b[2] - a[2]) - (Number(b[3]) < Number(a[3]) ? 1 : 0);
    return m < 0 ? null : m;
  }
  /* Age groups (Lisa's mock-up; OV11, 15 Nov 2026): owner rows in the shared rule list, never fixed. For each group key,
     age_group.<key>.from_months, age_group.<key>.to_months and age_group.<key>.label, each dated (effective_from, to_date)
     with a source. A group needs from_months; to_months blank = no upper end; an animal is in it when
     from_months <= age in whole months < to_months. No rows: no filter. */
  /* Lisa, 15 Nov 2026: "there are only 2 in sops". With no age_group rows, the two groups come from the owner's existing
     rule "Age a dog counts as an adult" (dog.adult_from_months, the row in force today): Puppy under it, Adult from it.
     Nothing new is seeded; no rule either = no filter. */
  function adultGroups(T, today) {
    var best = null;
    (T['BLD-breeding_rule.csv'] || []).forEach(function (r) {
      var from = t(r.effective_from), to = t(r.to_date);
      if (t(r.rule_key) !== 'dog.adult_from_months' || !/^\d+$/.test(t(r.value)) || !from || from > today || (to && to < today)) return;
      if (!best || from > t(best.effective_from) || (from === t(best.effective_from) && t(r.set_at) >= t(best.set_at))) best = r;
    });
    var n = best ? Number(t(best.value)) : 0;
    return n > 0 ? [{ key: 'puppy', label: 'Puppy', from: 0, to: n }, { key: 'adult', label: 'Adult', from: n, to: Infinity }] : [];
  }
  /* Records typed on the Checks screen (15 Nov 2026, OV11: the phone entry for Fit to Breed, health screens and judged
     answers is the existing Checks form, any industry): each check_log row carries the values typed on its form
     (BLD-check_value: field_key = value) as if they were its own columns, so a criterion can read e.g.
     answer_field=grade, evidence_match=check_type_id=cty-hips;certainty=final. A real column of the same name wins.
     Each row also carries check_type_key, the type_key of its check type (16 Nov 2026, OV11). A check type changes by a
     new dated row with a new id (cty-fit_to_breed-1, then -2) but keeps its type_key, so a criterion that matches
     check_type_key=fit_to_breed reads every version, past and future, with no list of ids anywhere. */
  function withValues(logs, values, types) {
    if (!logs) return logs;
    var kind = {};
    (types || []).forEach(function (c) { if (t(c.id) && t(c.type_key)) kind[t(c.id)] = t(c.type_key); });
    var by = {};
    (values || []).forEach(function (x) {
      var k = t(x.field_key), id = t(x.check_log_id);
      if (!k || !id || !/^[a-z][a-z0-9_]{0,40}$/.test(k)) return;
      (by[id] || (by[id] = {}))[k] = t(x.value);
    });
    return logs.map(function (r) {
      var add = by[t(r.id)], k = kind[t(r.check_type_id)];
      if (k && t(r.check_type_key) === '') { add = add ? Object.assign({}, add) : {}; add.check_type_key = k; }
      if (!add) return r;
      var o = {}; Object.keys(add).forEach(function (k) { o[k] = add[k]; });
      Object.keys(r).forEach(function (k) { if (t(r[k]) !== '' || o[k] === undefined) o[k] = r[k]; });
      return o;
    });
  }
  function ageGroups(T, today) {
    var own = ownGroups(T, today);
    return own.length ? own : adultGroups(T, today);
  }
  function ownGroups(T, today) {
    var g = {}, re = /^age_group\.([a-z0-9_]+)\.(from_months|to_months|label)$/;
    (T['BLD-breeding_rule.csv'] || []).forEach(function (r) {
      var m = re.exec(t(r.rule_key)), from = t(r.effective_from), to = t(r.to_date);
      if (!m || !from || from > today || (to && to < today)) return;
      var x = g[m[1]] || (g[m[1]] = { key: m[1], at: {} });
      if (x.at[m[2]] && x.at[m[2]] > from) return;   /* newest row in force wins */
      x.at[m[2]] = from; x[m[2]] = t(r.value);
    });
    return Object.keys(g).map(function (k) {
      var x = g[k], lo = x.from_months === undefined || x.from_months === '' ? NaN : Number(x.from_months), hi = x.to_months === undefined || x.to_months === '' ? Infinity : Number(x.to_months);
      return { key: k, label: x.label || k.replace(/_/g, ' '), from: lo, to: hi };
    }).filter(function (x) { return isFinite(x.from) && x.from >= 0 && !isNaN(x.to) && x.to > x.from; })
      .sort(function (a, b) { return a.from - b.from || a.label.localeCompare(b.label); });
  }
  function inAge(grp, dob, today) { var m = months(dob, today); return m !== null && m >= grp.from && m < grp.to; }
  function subLine(v, r) {
    var d = hubDog(v, r.subject_id);
    return [d && t(d.sex), age(r.dob, v.today)].filter(Boolean).join(', ');
  }

  /* Sort choices, as on the mock-up (11 Nov 2026). Verdict best to worst is the default; "Fail to Pass" is the one opt-in reverse. */
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
    var f = state.filter, q = state.q.toLowerCase();
    var sx = state.sex, v = last || {}, ag = state.age && v.T ? ageGroups(v.T, v.today).filter(function (x) { return x.key === state.age; })[0] : null;
    return c.results.filter(function (r) {
      var d = hubDog(v, r.subject_id);
      return (!f || verdictOf(r) === f) && (!q || r.name.toLowerCase().indexOf(q) !== -1) && (!sx || (d && t(d.sex) === sx))
        && (!ag || inAge(ag, r.dob, v.today));
    })
      .sort(SORT_FN[state.sort] || SORT_FN.verdict);
  }
  function rowsHtml(v, c) {
    var esc = v.esc, shown = shownRows(c);
    return shown.length ? shown.map(function (r) {
      var k = verdictOf(r);
      return '<button type="button" class="bb-dog" data-bb-open="' + esc(r.subject_id) + '" style="--v:var(' + VTEXT[k] + ')">' + photo(v, r)
        + '<span class="bb-info"><span class="bb-l1"><span class="bb-name">' + esc(r.name) + '</span><span class="bb-big" aria-hidden="true">' + r.points_earned + '</span></span>'
        + '<span class="bb-l2"><span>' + esc(subLine(v, r)) + '</span>' + vword(r) + '</span>'
        + '<span class="bb-pts">' + total(r) + unv(r) + dueCount(r) + '</span>' + secsHtml(r) + '</span></button>';
    }).join('') : '<p class="mut">None.</p>';
  }

  /* the row's section icons: in the section colour when it has points (or its must-pass checks are met), grey when nothing yet */
  function secsHtml(r) {
    var bands = r.bands.slice().sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); }).filter(function (b) { return t(b.kind) !== 'status'; });
    if (!bands.length) return '';
    return '<span class="bb-secs">' + bands.map(function (b) {
      var lines = r.lines.filter(function (l) { return l.band_id === b.id; });
      var on = lines.some(function (l) { return l.kind === 'gate' ? false : Number(l.points) > 0; })
        || (lines.length && lines.every(function (l) { return l.kind !== 'gate' || l.gate_outcome === 'pass'; }) && lines.some(function (l) { return l.kind === 'gate'; }));
      return '<i class="' + (on ? '' : 'off') + '" title="' + t(b.label).replace(/"/g, '') + (on ? '' : ', nothing yet') + '">'
        + ic(secIcon(b), 15, on ? bandColour(b) : 'var(--line)') + '</i>';
    }).join('') + '</span>';
  }

  /* Species words (Style, 12 Nov 2026): from the scheme's species row, never fixed. common_name gives "Find a dog";
     plural_word, when the row has one, names the tab. With no row, neutral words. */
  function spWords(v) {
    var sch = (v.T['BLD-score_scheme.csv'] || [])[0] || {}, id = t(sch.species_id);
    var all = v.T['BLD-species.csv'] || [], lc = id.toLowerCase();
    var row = all.filter(function (x) { return lc && [t(x.id), t(x.code), t(x.common_name)].some(function (y) { return y.toLowerCase() === lc; }); })[0]
      || (all.length === 1 ? all[0] : {});   /* one species held: it is that one */
    var one = t(row.common_name).toLowerCase();
    return { one: one, find: one ? 'Find ' + (/^[aeiou]/.test(one) ? 'an ' : 'a ') + one : 'Find', many: t(row.plural_word) || (t(row.common_name) ? t(row.common_name) + 's' : 'Animals') };
  }

  function listHtml(v, c) {
    var esc = v.esc, f = state.filter;
    words = c.words || VERDICT;
    var counts = { '': c.results.length };
    c.results.forEach(function (r) { counts[verdictOf(r)] = (counts[verdictOf(r)] || 0) + 1; });
    var h = '<div class="bb-filt" role="group" aria-label="Filter by verdict">' + [''].concat(ORDER).map(function (k) {
      return '<button type="button" class="bb-f" data-bb-filter="' + k + '"' + (k ? ' style="--hc:var(' + VTEXT[k] + ')"' : '') + ' aria-pressed="' + (f === k) + '">' + (words[k] || 'All') + ' <span class="cnt">' + (counts[k] || 0) + '</span></button>';
    }).join('') + '</div>';
    var tools = '<div class="bb-tools"><label class="bb-lab">' + esc(spWords(v).find) + '<input type="search" id="bbSearch" data-bb-search="1" placeholder="Name" autocomplete="off" value="' + esc(state.q) + '"></label>'
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
    /* age groups: only when the owner has rows for them */
    var groups = ageGroups(v.T, v.today);
    var ag = groups.length ? '<div class="bb-filt" role="group" aria-label="Filter by age">' + [{ key: '', label: 'Any age' }].concat(groups).map(function (g) {
      var n = g.key ? c.results.filter(function (r) { return inAge(g, r.dob, v.today); }).length : 0;
      return '<button type="button" class="bb-f" data-bb-age="' + esc(g.key) + '" aria-pressed="' + (state.age === g.key) + '">' + esc(g.label) + (g.key ? ' <span class="cnt">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div>' : '';
    return tools + h + sx + ag + '<div id="bbList">' + rowsHtml(v, c) + '</div>';
  }

  /** The animal's details from the hub, folded, as on the mock-up. Only what the hub holds is shown. */
  function infoHtml(v, r) {
    var esc = v.esc, d = hubDog(v, r.subject_id) || {}, pic = v.photoId ? v.photoId(d.photo) : '';
    var chips = [t(d.sex), age(r.dob, v.today), r.dob ? 'Born ' + day(r.dob) : '', d.colour && t(d.colour.name), t(d.pat),
      t(d.chip) ? 'Chip ...' + t(d.chip).slice(-4) : '', d.littersAsDam && d.littersAsDam.length ? d.littersAsDam.length + (d.littersAsDam.length === 1 ? ' litter' : ' litters') : '',
      t(d.state)].filter(Boolean);
    return '<details class="card bb-infobox" data-bb-band="__info"' + (state.open.__info ? ' open' : '') + '><summary>' + ic(ICON.info, 18, 'var(--muted)')
      + '<span class="bb-strong">Information</span><span class="bb-pts">' + esc([t(d.sex), age(r.dob, v.today)].filter(Boolean).join(', ')) + '</span></summary>'
      + '<div class="bb-infobd"><span class="bb-pic bb-pic88">' + (pic ? '<img class="dogphoto off" alt="" data-photo-id="' + esc(pic) + '" referrerpolicy="no-referrer">' : '') + '</span>'
      + '<span><span class="bb-strong">' + esc(r.name) + '</span><br><span class="bb-pts">' + esc(t(d.breed)) + '</span></span></div>'
      + '<div class="bb-chips">' + chips.map(function (x) { return '<span class="bb-tag">' + esc(x) + '</span>'; }).join('') + '</div></details>';
  }

  /** Why this verdict, in plain words, from the lines themselves. */
  function whyHtml(r) {
    var k = verdictOf(r), w = r.words;
    var gates = r.lines.filter(function (l) { return l.kind === 'gate'; });
    if (k === 'fail') return 'Must pass not met: ' + gates.filter(function (l) { return l.gate_outcome === 'fail'; }).map(function (l) { return l.label_then; }).join(', ') + '.';
    if (r.gate_result === 'unverified') return 'Must pass still to prove: ' + gates.filter(function (l) { return l.gate_outcome === 'unverified'; }).map(function (l) { return l.label_then; }).join(', ') + '.';
    if (k === 'unverified') return r.points_unverified + ' points still to prove could reach the target.';
    if (k === 'below_target') return 'All must pass met. ' + (r.target - r.points_earned) + ' points under the target.';
    return (gates.length ? 'All must pass met' : 'Scored') + (r.target !== '' && r.target !== undefined ? ', target reached.' : '.') + (w ? '' : '');
  }

  /** The verdict box: word, points, target, a bar split by section with the target marked, and why. */
  function verdictHtml(r) {
    var k = verdictOf(r), all = r.points_available || 0, st = bandStats(r);
    var lost = Math.max(0, all - r.points_earned - r.points_unverified);
    var hasT = r.target !== '' && r.target !== undefined;
    var bar = all ? st.map(function (o) {
      return (o.earned ? '<span style="width:' + (100 * o.earned / all) + '%;background:' + bandColour(o.band) + '" title="' + o.band.label + ': ' + o.earned + ' of ' + o.max + '"></span>' : '')
        + (o.unv ? '<span class="bb-tp" style="width:' + (100 * o.unv / all) + '%;--c:' + bandColour(o.band) + '" title="' + o.band.label + ': ' + o.unv + ' to prove"></span>' : '');
    }).join('') : '';
    return '<div class="card bb-vbox" style="--v:var(' + VTEXT[k] + ')"><div class="bb-vtop"><span class="bb-vl">' + ic(ICON[k], 28, 'var(' + VTEXT[k] + ')')
      + '<span><span class="bb-pts">Breed Better verdict</span><br><span class="bb-vword">' + r.words[k] + '</span></span></span>'
      + '<span class="bb-vr"><span class="bb-huge">' + r.points_earned + '</span><br><span class="bb-pts">of ' + all + ' points</span>'
      + (hasT ? '<br><span class="bb-pts">Target ' + r.target + '</span>' : '') + '</span></div>'
      + (all ? '<div class="bb-barw"><div class="bb-bar">' + bar + '</div>' + (hasT ? '<span class="bb-tmark" style="left:' + Math.min(100, 100 * r.target / all) + '%" title="Target ' + r.target + '"></span>' : '') + '</div>' : '')
      + '<div class="bb-three"><span>' + r.points_earned + ' earned</span><span>' + r.points_unverified + ' to prove</span><span>' + lost + ' lost</span></div>'
      + '<p class="bb-why">' + whyHtml(r) + '</p></div>';
  }

  function dogHtml(v, r) {
    var esc = v.esc;
    var bands = r.bands.slice().sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); });
    /* previous and next follow the list as it is filtered and sorted now (mock-up header, 12 Nov 2026) */
    var list = shownRows(compute(v)), at = -1;
    list.forEach(function (x, i) { if (x.subject_id === r.subject_id) at = i; });
    var prev = at > 0 ? list[at - 1] : null, next = at > -1 && at < list.length - 1 ? list[at + 1] : null;
    var nav = '<div class="bb-nav"><button type="button" class="bb-f" data-bb-back="1">' + ic('M15 6l-6 6l6 6', 18) + 'Back</button>'
      + (list.length > 1 ? '<span class="bb-pn">'
        + '<button type="button" class="bb-f" data-bb-open="' + esc(prev ? prev.subject_id : '') + '"' + (prev ? ' aria-label="Previous: ' + esc(prev.name) + '"' : ' disabled') + '>' + ic('M15 6l-6 6l6 6', 18) + 'Previous</button>'
        + '<span class="bb-pts">' + (at + 1) + ' of ' + list.length + '</span>'
        + '<button type="button" class="bb-f" data-bb-open="' + esc(next ? next.subject_id : '') + '"' + (next ? ' aria-label="Next: ' + esc(next.name) + '"' : ' disabled') + '>Next' + ic('M9 6l6 6l-6 6', 18) + '</button></span>' : '')
      + '</div>';
    return nav
      + '<div class="bb-head"><h3>' + esc(r.name) + '</h3>' + pill(r) + '<span class="bb-pts">' + total(r) + unv(r) + dueCount(r) + '</span></div>'
      + infoHtml(v, r) + verdictHtml(r)
      + (Dna ? Dna.card(v.T, r.subject_id, esc).replace('data-bb-band="__dna"', 'data-bb-band="__dna"' + (state.open.__dna ? ' open' : '')) : '')
      + bands.map(function (b) {
        var lines = r.lines.filter(function (l) { return l.band_id === b.id; });
        if (!lines.length) return '';
        var res = secResult(lines);
        return '<details class="card bb-band" style="--bb:' + bandColour(b) + '" data-bb-band="' + esc(b.id) + '"' + (state.open[b.id] ? ' open' : '') + '><summary>'
          + '<span class="bb-sic">' + ic(secIcon(b), 18, bandColour(b)) + '</span>' + esc(b.label)
          + (res ? ' <span class="bb-res" style="color:var(' + VTEXT[res] + ')">' + ic(ICON[res], 16, 'var(' + VTEXT[res] + ')') + esc((r.words || words)[res] || '') + '</span>' : '')
          + ' <span class="cnt"' + (res ? ' style="border-color:var(' + VTEXT[res] + ')"' : '') + '>' + lines.length + '</span></summary>'
          + lines.map(function (l) { return lineHtml(v, l, r.words); }).join('') + '</details>';
      }).join('');
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

  function cap(s) { s = t(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function lineHtml(v, l, w) {
    var esc = v.esc, res;
    w = w || words;
    if (l.kind === 'gate') res = vpill(l.gate_outcome, w);
    else if (l.kind === 'status') res = '<span class="bb-pts">' + esc(l.answer_then) + '</span>';
    else res = l.points === '' ? vpill('unverified', w) : '<span class="bb-pts">' + l.points + ' of ' + l.points_max + '</span>';
    var when = l.date_then ? ' \u00b7 ' + esc(day(l.date_then)) : '';
    if (l.rules_then) when += ' \u00b7 rules then';
    if (l.weight !== undefined && l.weight < 1) when += ' \u00b7 at ' + l.age_months + ' months, ' + (l.weight === 0.5 ? 'half' : Math.round(l.weight * 100) + '%') + ' points';
    /* a held-back record says what it holds, in the record's own word: "Preliminary" */
    var why = l.unknown_reason === 'not_accepted' && l.held_then ? esc(cap(l.held_then)) + (l.answer_then ? ': ' + esc(l.answer_then) : '') + when
      : l.unknown_reason ? (REASON[l.unknown_reason] || '') + when : (l.answer_then ? 'Recorded: ' + esc(l.answer_then) + when : '');
    if (l.due_date && !l.due) why += ' \u00b7 due ' + esc(day(l.due_date));
    res += dueHtml(l);
    /* Open stays on this page. data-go would be caught by the hub and sent back to the dog list. */
    var openBtn = l.criterion_id ? ' <button type="button" class="bb-src" data-bb-edit="' + esc(l.criterion_id) + '">Open</button>' : '';
    return '<div class="bb-line"><span class="bb-l">' + (l.kind === 'gate' ? star() : '') + esc(l.label_then) + '</span>' + res
      + '<span class="bb-why">' + why + openBtn + '</span></div>';
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

  /* ---- Calendar, More, My system and Archive (mock-up, 12 Nov 2026). Read only. ---- */
  var TABS = [['dogs', 'Dogs', 'M9 6h11 M9 12h11 M9 18h11 M5 6v.01 M5 12v.01 M5 18v.01'],
    ['cal', 'Calendar', 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z M16 3v4 M8 3v4 M4 11h16'],
    ['more', 'More', 'M5 12l0 .01 M12 12l0 .01 M19 12l0 .01']];
  function tabsHtml(v) {
    var many = v ? spWords(v).many : 'Dogs', on = state.tab === 'system' || state.tab === 'archive' || state.tab === 'dna' ? 'more' : state.tab;
    return '<nav class="bb-tabs" aria-label="Breed Better">' + TABS.map(function (x) {
      return '<button type="button" class="bb-tab" data-bb-tab="' + x[0] + '"' + (on === x[0] ? ' aria-current="page"' : '') + '><span>' + ic(x[2], 18) + '</span>' + (x[0] === 'dogs' ? v.esc(many) : x[1]) + '</button>';
    }).join('') + '</nav>';
  }
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  /** Every dated next step across the enrolled animals: the due dates the rules already give each line. */
  function dueItems(c) {
    var out = [];
    c.results.forEach(function (r) {
      r.lines.forEach(function (l) { if (l.due_date) out.push({ id: r.subject_id, dog: r.name, check: l.label_then, date: l.due_date, due: l.due }); });
    });
    return out.sort(function (a, b) { return a.date.localeCompare(b.date) || a.dog.localeCompare(b.dog); });
  }
  function calHtml(v, c) {
    var esc = v.esc, today = v.today, month = state.month || today.slice(0, 7);
    var all = dueItems(c), soon = addDays(today, 30);
    var modes = [['all', 'All'], ['overdue', 'Overdue'], ['next', 'Next 30 days']];
    var pick = {
      all: function (x) { return x.date.slice(0, 7) === month; },
      overdue: function (x) { return x.date < today; },
      next: function (x) { return x.date >= today && x.date <= soon; }
    };
    var n = {}; modes.forEach(function (m) { n[m[0]] = all.filter(m[0] === 'all' ? function () { return true; } : pick[m[0]]).length; });
    var rows = all.filter(pick[state.cal] || pick.all);
    var y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
    var first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var has = {}; all.forEach(function (x) { if (x.date.slice(0, 7) === month) has[Number(x.date.slice(8, 10))] = (has[Number(x.date.slice(8, 10))] || 0) + 1; });
    var cells = '';
    for (var i = 0; i < lead; i++) cells += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var iso = month + '-' + (d < 10 ? '0' : '') + d;
      cells += '<span class="bb-day' + (iso === today ? ' bb-today' : '') + '" aria-label="' + day(iso) + (has[d] ? ', ' + has[d] + ' due' : '') + '">' + d + (has[d] ? '<i></i>' : '') + '</span>';
    }
    var prev = addDays(month + '-01', -1).slice(0, 7), next = addDays(month + '-28', 7).slice(0, 7);
    return '<h3 class="bb-h">Calendar</h3><p class="bb-pts">' + n.next + ' due in the next 30 days. Dates come from each check\'s rules.</p>'
      + '<div class="bb-filt" role="group" aria-label="Show">' + modes.map(function (x) {
        return '<button type="button" class="bb-f" data-bb-cal="' + x[0] + '" aria-pressed="' + (state.cal === x[0]) + '">' + x[1] + ' <span class="cnt">' + n[x[0]] + '</span></button>';
      }).join('') + '</div>'
      + '<div class="card bb-month"><div class="bb-mhead"><button type="button" class="bb-f" data-bb-month="' + prev + '" aria-label="Previous month">' + ic('M15 6l-6 6l6 6', 18) + '</button>'
      + '<span class="bb-strong">' + MON[m - 1] + ' ' + y + '</span><button type="button" class="bb-f" data-bb-month="' + next + '" aria-label="Next month">' + ic('M9 6l6 6l-6 6', 18) + '</button></div>'
      + '<div class="bb-grid bb-wd"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class="bb-grid">' + cells + '</div></div>'
      + (rows.length ? rows.map(function (x) {
        var late = x.date < today;
        return '<button type="button" class="bb-dog bb-calrow" data-bb-open="' + esc(x.id) + '" style="--v:var(' + (late ? '--ljr-3-text' : '--line') + ')"><span class="bb-info"><span class="bb-l1"><span class="bb-name">' + esc(x.dog) + ', ' + esc(x.check) + '</span></span>'
          + '<span class="bb-l2"><span>' + day(x.date) + '</span><span>' + (late ? 'Overdue' : 'Due') + '</span></span></span></button>';
      }).join('') : '<p class="mut">Nothing here.</p>');
  }
  /* Inspector links are made on the owner's own page (the host gives its address as ownerPage); with none, say where to set it up */
  function inspectorHtml(v) {
    var u = t(v.ownerPage);
    return /^https:\/\//.test(u)
      ? '<a class="bb-dog" href="' + v.esc(u) + '" target="_blank" rel="noopener"><span class="bb-name">Inspector links</span><span class="bb-pts">Make, copy or stop a read-only link (owner page)</span></a>'
      : '<div class="bb-dog" aria-disabled="true"><span class="bb-name">Inspector links</span><span class="bb-pts">Set up saving first, then links are made on the owner page.</span></div>';
  }
  function moreHtml(v, c) {
    return '<h3 class="bb-h">More</h3>'
      + '<button type="button" class="bb-dog" data-bb-tab="system"><span class="bb-name">My system</span><span class="bb-pts">Sections, checks and points</span></button>'
      + '<button type="button" class="bb-dog" data-bb-tab="archive"><span class="bb-name">Archive</span><span class="cnt">' + c.ended.length + '</span></button>'
      + (Dna ? '<button type="button" class="bb-dog" data-bb-tab="dna"><span class="bb-name">DNA: probability per puppy</span><span class="bb-pts">Sire and dam, per test</span></button>' : '')
      + inspectorHtml(v);
  }
  function backMore() { return '<button type="button" class="bb-f" data-bb-tab="more">' + ic('M15 6l-6 6l6 6', 18) + 'More</button>'; }
  function archiveHtml(v, c) {
    var esc = v.esc;
    return backMore() + '<h3 class="bb-h">Archive</h3><p class="bb-pts">Animals whose scoring has ended. Their records stay.</p>'
      + (c.ended.length ? c.ended.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (x) {
        return '<div class="card bb-arch"><span class="bb-strong">' + esc(x.name) + '</span><span class="bb-pts">' + (x.from ? 'From ' + day(x.from) : '') + (x.to ? (x.from ? ', to ' : 'To ') + day(x.to) : '') + (x.reason ? ': ' + esc(x.reason) : '') + '</span>'
          + '<span class="bb-acts">' + enrolBtn(v, c, x.id) + '</span></div>';
      }).join('') : '<p class="mut">None.</p>');
  }
  /* Owner setting (Lisa, 15 Nov 2026): enrol young of an enrolled parent from their birth date. One dated rule row in the
     link-kind family (agreed with STAFF, 15 Nov 2026), the same for any scheme, course or certification:
     link_kind.enrolled_in.inherit_at_birth = a pipe list of scheme ids, or * for all; "none" = none. No row = off.
     The save script copies the parent's open links of this kind when a birth is recorded; this page only shows and changes it. */
  var AUTO_KEY = 'link_kind.enrolled_in.inherit_at_birth';
  function autoKey() { return AUTO_KEY; }
  function autoIds(r) { return r ? t(r.value).split('|').map(t).filter(Boolean) : []; }
  function autoOn(T, scId, day) {
    var ids = autoIds(ruleOn(T, AUTO_KEY, day));
    return ids.indexOf('*') >= 0 || ids.indexOf(t(scId)) >= 0;
  }
  /* the value to save when one scheme is turned on or off; every other scheme keeps its setting */
  function autoNext(T, day, scId, on) {
    var ids = autoIds(ruleOn(T, AUTO_KEY, day)).filter(function (x) { return x !== 'none'; });
    if (ids.indexOf('*') >= 0) {
      if (on) return '*';
      ids = (T['BLD-score_scheme.csv'] || []).map(function (r) { return t(r.id); }).filter(Boolean);
    }
    ids = ids.filter(function (x) { return x !== t(scId); });
    if (on) ids.push(t(scId));
    return ids.length ? ids.join('|') : 'none';
  }
  function ruleOn(T, key, day) {
    var best = null;
    (T['BLD-breeding_rule.csv'] || []).forEach(function (r) {
      if (t(r.rule_key) !== key) return;
      var from = t(r.effective_from), to = t(r.to_date);
      if (!from || from > day || (to && to < day)) return;
      if (!best || from >= t(best.effective_from)) best = r;
    });
    return best;
  }
  function autoHtml(v, sc) {
    var r = ruleOn(v.T, AUTO_KEY, v.today), on = autoOn(v.T, sc.id, v.today), id = 'auto:' + sc.id, esc = v.esc;
    var can = !!(v.canWrite && v.canWrite() && v.setRule);
    return '<div class="bb-auto"><span class="bb-name">Enrol young of an enrolled parent at birth</span>'
      + '<span class="bb-filt" role="group" aria-label="Enrol young at birth">'
      + ['on', 'off'].map(function (x) {
        return '<button type="button" class="bb-f" data-bb-auto="' + esc(sc.id) + '" data-bb-auto-v="' + x + '" aria-pressed="' + ((x === 'on') === on) + '"' + (can ? '' : ' disabled') + '>' + (x === 'on' ? 'On' : 'Off') + '</button>';
      }).join('') + '</span>'
      + '<span class="bb-pts">' + (r ? 'Since ' + day(t(r.effective_from)) + (t(r.source) ? '. ' + esc(r.source) : '') : 'Not set: off') + '</span>'
      + (can ? '' : ' <span class="bb-pts">' + NOSAVE + '</span>') + msgHtml(id) + '</div>';
  }

  /** The rules in force today, read only: sections, checks, must pass, answers and points, target, and where each rule came from. */
  function systemHtml(v) {
    var esc = v.esc, T = v.T, today = v.today, schemes = (T['BLD-score_scheme.csv'] || []);
    var ids = {}; enrolments(T).forEach(function (e) { ids[e.scheme_id] = 1; });
    var shown = schemes.filter(function (s) { return ids[s.id] && /^active$/i.test(t(s.status)) && (!t(s.to_date) || s.to_date >= today); });
    if (!shown.length) return backMore() + '<p class="mut">No scheme in force today.</p>';
    return backMore() + '<h3 class="bb-h">My system</h3><p class="bb-pts">Rules are read only here. A star means must pass. Rules today; past records keep the rules of their own date.</p>'
      + shown.map(function (sc) {
        var bands = (T['BLD-score_band.csv'] || []).filter(function (b) { return b.scheme_id === sc.id && t(b.kind); })
          .sort(function (a, b) { return Number(a.sort_order) - Number(b.sort_order); });
        var crit = (T['BLD-score_criterion.csv'] || []).filter(function (x) { return x.scheme_id === sc.id && Score.inForce(x, today); });
        var pts = T['BLD-score_point.csv'] || [];
        return '<div class="card"><span class="bb-strong">' + esc(t(sc.name) || 'Scheme') + (t(sc.breed) ? ', ' + esc(sc.breed) : '') + (t(sc.version) ? ', version ' + esc(sc.version) : '') + '</span>'
          + autoHtml(v, sc)
          + '<p class="bb-pts">' + (t(sc.target_points) ? 'Target ' + esc(sc.target_points) + (t(sc.target_is) ? ' (' + esc(sc.target_is) + ')' : '') + '. ' : '') + (t(sc.source) ? 'Source: ' + esc(sc.source) : '') + '</p>'
          + bands.map(function (b) {
            var cs = crit.filter(function (x) { return x.band_id === b.id; });
            if (!cs.length) return '';
            return '<details class="card bb-band" style="--bb:' + bandColour(b) + '" data-bb-band="sys-' + esc(b.id) + '"' + (state.open['sys-' + b.id] ? ' open' : '') + '><summary>' + esc(b.label) + ' <span class="cnt">' + cs.length + '</span></summary>'
              + cs.map(function (x) {
                var rows = pts.filter(function (p) { return p.criterion_id === x.id && Score.inForce(p, today); });
                return '<div class="bb-line"><span class="bb-l">' + (t(b.kind) === 'gate' ? star() : '') + esc(x.label) + '</span>'
                  + '<span class="bb-why">' + rows.map(function (p) {
                    return esc(t(p.answer_match)) + ': ' + (t(p.gate_outcome) ? esc((words[t(p.gate_outcome)] || p.gate_outcome)) : esc(t(p.points)) + ' points');
                  }).join(' \u00b7 ') + (t(x.valid_months) ? ' \u00b7 lasts ' + esc(x.valid_months) + ' months' : '') + (t(x.authority) ? ' \u00b7 ' + esc(x.authority) : '') + '</span></div>';
              }).join('') + '</details>';
          }).join('') + '</div>';
      }).join('');
  }

  function inner(v) { return fromHtml(v) + innerBody(v); }
  function innerBody(v) {
    var c = compute(v);
    if (!c.setUp) return '<p class="mut">Not set up yet.</p>';
    var err = c.error ? '<div class="card acc2"><p>' + v.esc(c.error) + '</p></div>' : '';
    var dog = state.dog && c.byId[state.dog];
    if (dog && state.edit) {
      var screen = editHtml(v, dog, state.edit);
      if (screen) return err + screen;
      state.edit = '';
    }
    if (dog) return err + dogHtml(v, dog);
    words = c.words || VERDICT;
    var body = state.tab === 'cal' ? calHtml(v, c) : state.tab === 'more' ? moreHtml(v, c) : state.tab === 'archive' ? archiveHtml(v, c)
      : state.tab === 'system' ? systemHtml(v) : state.tab === 'dna' && Dna ? backMore() + Dna.key() + Dna.calc(v.T, state.calc, v.esc) : listHtml(v, c);
    return err + tabsHtml(v) + body;
  }

  function css() {
    if (typeof document === 'undefined' || document.getElementById('bbStyle')) return;
    var s = document.createElement('style'); s.id = 'bbStyle';
    s.textContent = [
      '.bb-v{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:var(--radius);border:1px solid;font-size:var(--fs-small);font-weight:500;white-space:nowrap;background:transparent}',
      '.bb-pass{border-color:var(--ljr-5);color:var(--ink)}.bb-below_target{border-color:var(--ljr-3);color:var(--ink)}.bb-unverified{border-color:var(--ljr-6);color:var(--ink)}.bb-fail{border-color:var(--ljr-2);color:var(--ink)}',
      '.bb-due{font-size:var(--fs-small);color:var(--muted);white-space:nowrap}.bb-overdue{color:var(--ljr-3-text)}',
      '.bb-test{border-color:var(--ljr-7);color:var(--ink)}',
      '.bb-filt{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}',
      '.bb-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin:0 0 12px}',
      '.bb-lab{display:flex;flex-direction:column;gap:4px;font-size:var(--fs-small);color:var(--muted);min-width:0}',
      '.bb-lab input,.bb-lab select{min-height:44px;width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:var(--radius);padding:6px 10px;background:var(--card);color:var(--ink);font-size:var(--fs-input,16px)}',
      '.bb-f,.bb-dog,.bb-src,.bb-chip{font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:var(--radius);cursor:pointer}',
      '.bb-f{min-height:44px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;font-weight:500}',
      /* the house selected look (Lisa, 15 Nov 2026). #main #bbRoot outranks the hub's own grey button hover, which still fills */
      '.bb-f:hover,.bb-dog:hover,.bb-src:hover,.bb-chip:hover,.bb-f:active,.bb-dog:active,.bb-src:active,.bb-chip:active,'
        + '#main #bbRoot .bb-f:hover,#main #bbRoot .bb-dog:hover,#main #bbRoot .bb-src:hover,#main #bbRoot .bb-tab:hover,#main #bbRoot .bb-f:active,#main #bbRoot .bb-dog:active'
        + '{background:var(--card);outline:1px solid var(--hc,var(--v,var(--ink)));outline-offset:-1px}',
      '#main #bbRoot .bb-f:disabled,#main #bbRoot .bb-f:disabled:hover{background:var(--card);outline:none}',
      '.bb-f[aria-pressed=true],.bb-tab[aria-current=page],#main #bbRoot .bb-f[aria-pressed=true],#main #bbRoot .bb-tab[aria-current=page]{background:var(--card);box-shadow:inset 3px 0 0 var(--hc,var(--ink))}.bb-f[aria-pressed=true]::before,.bb-tab[aria-current=page]>span::after{content:"\\2713";font-weight:600;color:var(--hc,var(--ink))}',
      '.bb-tab[aria-current=page]>span{position:relative}.bb-tab[aria-current=page]>span::after{position:absolute;right:-4px;top:-4px;font-size:12px}',
      '.bb-f:disabled{opacity:.45;cursor:default;outline:none}.bb-nav{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}.bb-pn{display:inline-flex;align-items:center;gap:8px}',
      '.bb-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.bb-top .bb-logo{width:40px;height:40px}',
      '.bb-rb{height:3px;margin:8px 0 12px;border-radius:2px;background:linear-gradient(90deg,var(--ljr-7) 0 16.66%,var(--ljr-2) 0 33.33%,var(--ljr-3) 0 50%,var(--ljr-4) 0 66.66%,var(--ljr-5) 0 83.33%,var(--ljr-6) 0 100%)}',
      '.bb-f:focus-visible,.bb-dog:focus-visible,.bb-src:focus-visible,.bb-chip:focus-visible{border-color:var(--ink);outline:none}',
      '.bb-dog{display:flex;flex-wrap:wrap;align-items:center;gap:8px;width:100%;min-height:44px;padding:8px 12px;margin:0 0 8px;text-align:left}',
      'a.bb-dog,div.bb-dog{box-sizing:border-box;border:1px solid var(--line);border-radius:var(--radius,12px);background:var(--card,transparent);color:inherit;text-decoration:none}a.bb-dog:hover,#main #bbRoot a.bb-dog:hover{background:var(--card);outline:1px solid var(--ink);outline-offset:-1px}',
      '.bb-name{font-weight:500;flex:1 1 auto}.bb-pts,.bb-why{color:var(--muted);font-size:var(--fs-small)}',
      '.bb-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0}.bb-head h3{margin:0;font-weight:500}',
      '.bb-band{border-left:3px solid var(--bb,var(--line))}.bb-band summary{cursor:pointer;font-weight:500;display:flex;align-items:center;gap:8px;min-height:44px}',
      '.bb-band{--hc:var(--bb,var(--ink))}.bb-band>summary:hover{outline:1px solid var(--hc);outline-offset:-1px;border-radius:inherit}.bb-band summary .cnt{margin-left:auto}.bb-band summary::-webkit-details-marker{display:none}.bb-band summary{list-style:none}',
      '.bb-sic{width:30px;height:30px;flex:none;border:1px solid var(--line);border-radius:50%;display:inline-grid;place-items:center}',
      '.bb-res{display:inline-flex;align-items:center;gap:3px;font-size:var(--fs-small);font-weight:500}',
      '.bb-secs{display:flex;flex-wrap:wrap;gap:4px;flex:1 1 100%}.bb-secs i{width:26px;height:26px;border:1px solid var(--line);border-radius:50%;display:inline-grid;place-items:center}',
      '.bb-c-red{--bb:var(--ljr-2)}.bb-c-orange{--bb:var(--ljr-3)}.bb-c-yellow{--bb:var(--ljr-4)}.bb-c-green{--bb:var(--ljr-5)}.bb-c-blue{--bb:var(--ljr-6)}.bb-c-purple{--bb:var(--ljr-7)}.bb-c-white{--bb:var(--line)}.bb-c-black{--bb:var(--ink)}',
      '.bb-line{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:8px 0}.bb-l{flex:1 1 60%}.bb-why{flex:1 1 100%}',
      '.bb-src{min-height:24px;padding:0 8px;font-size:var(--fs-small);color:var(--ink)}',
      '.bb-chip{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;margin-top:4px}',
      /* list row and dog page (mock-up and Style, 12 Nov 2026): colour sits in lines and icons, never a fill at rest */
      '.bb-dog{position:relative;flex-wrap:nowrap;gap:12px;padding:12px 12px 12px 15px;overflow:hidden}',
      '.bb-dog::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--v,var(--line))}',
      '.bb-ph{width:84px;height:84px;flex-shrink:0;position:relative}.bb-ring{position:absolute;inset:0}',
      '.bb-pic{position:absolute;inset:9px;border-radius:50%;background:var(--hov);overflow:hidden;display:block}',
      '.bb-pic img{width:100%;height:100%;object-fit:cover;display:block}.bb-pic img.off{display:none}',
      '.bb-pic88{position:relative;inset:auto;width:88px;height:88px;flex-shrink:0;border-radius:var(--radius)}',
      '.bb-info{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.bb-l1,.bb-l2{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.bb-l2{font-size:var(--fs-small);color:var(--muted)}',
      '.bb-l1 .bb-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bb-big{font-weight:600;font-size:18px;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.bb-vw{display:inline-flex;align-items:center;gap:4px;color:var(--ink);font-weight:500;white-space:nowrap}',
      '.bb-star{flex-shrink:0;fill:var(--ljr-2);stroke:var(--ljr-2);stroke-width:1.5;stroke-linejoin:round;vertical-align:-2px;margin-right:4px}',
      '.bb-infobox summary{cursor:pointer;display:flex;align-items:center;gap:8px;min-height:44px}.bb-strong{font-weight:500}',
      '.bb-infobd{display:flex;gap:12px;align-items:center;margin:8px 0}',
      '.bb-chips{display:flex;flex-wrap:wrap;gap:6px}.bb-tag{border:1px solid var(--line);border-radius:var(--radius);padding:2px 10px;font-size:var(--fs-small)}',
      '.bb-vbox{position:relative;display:flex;flex-direction:column;gap:10px;border-left:3px solid var(--v,var(--line))}',
      '.bb-vtop{display:flex;justify-content:space-between;align-items:center;gap:12px}.bb-vl{display:flex;align-items:center;gap:10px}',
      '.bb-vword{font-size:18px;font-weight:600}.bb-vr{text-align:right}.bb-huge{font-size:28px;font-weight:600;line-height:1}',
      '.bb-barw{position:relative;height:10px}.bb-bar{display:flex;height:10px;border:1px solid var(--line);box-sizing:border-box;background:var(--hov);border-radius:var(--radius);overflow:hidden}',
      '.bb-tp{background:repeating-linear-gradient(45deg,var(--c) 0 2px,transparent 2px 6px);opacity:.6}',
      '.bb-tmark{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--ink)}',
      '.bb-three{display:flex;justify-content:space-between;gap:8px;font-size:var(--fs-small);color:var(--muted)}',
      '.bb-vbox .bb-why{margin:0;color:var(--ink)}',
      '.bb-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 12px}',
      '.bb-tab{font:inherit;font-size:var(--fs-small);color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:var(--radius);min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}',
      '.bb-tab:hover,.bb-tab:active{background:none;outline:1px solid var(--ink);outline-offset:-1px}.bb-tab[aria-current=page]{color:var(--ink);font-weight:600}.bb-tab:focus-visible{border-color:var(--ink);outline:none}',
      '.bb-h{margin:0 0 4px;font-weight:600}',
      '.bb-edit{display:flex;flex-direction:column;gap:8px;align-items:flex-start}',
      '.bb-edit form{display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box}',
      '.bb-month{margin:12px 0}.bb-mhead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}',
      '.bb-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;text-align:center}.bb-wd{font-size:var(--fs-small);color:var(--muted)}',
      '.bb-day{position:relative;min-height:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--radius)}',
      '.bb-day i{width:6px;height:6px;border-radius:50%;background:var(--ljr-6);margin-top:2px}.bb-today{border:1px solid var(--ink)}',
      '.bb-calrow .bb-name{white-space:normal}',
      '.bb-arch{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}',
      '.bb-sec{border-top:1px solid var(--line);padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px}',
      '.bb-sec .bb-sechd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;width:100%;min-height:44px;padding:6px 8px;margin:0;border:1px solid var(--line);border-radius:8px;text-align:left;cursor:pointer;list-style:none}',
      '.bb-sec .bb-sechd::-webkit-details-marker{display:none}.bb-sec .bb-sechd:hover{background:none;outline:1px solid var(--hc,var(--ink));outline-offset:-1px}',
      '.bb-secf>.bb-sechd>svg:last-child{transition:transform .15s}.bb-secf:not([open])>.bb-sechd>svg:last-child{transform:rotate(-90deg)}',
      '.bb-auto{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:8px 0}',
      '.bb-done{display:flex;align-items:center;gap:6px;margin:0;font-size:var(--fs-small)}.bb-err{margin:0}',
      '.bb-acts{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.bb-unf{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}.bb-odds{margin:0;padding:0;list-style:none;display:grid;gap:4px}.bb-odds li{display:flex;flex-wrap:wrap;gap:4px 8px}.bb-arch{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.bb-sec{display:flex;flex-direction:column;gap:8px}.bb-misshd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;min-height:44px;padding:4px 8px;border:1px solid var(--line);border-radius:8px;cursor:pointer;list-style:none}.bb-misshd::-webkit-details-marker{display:none}.bb-misshd>svg:last-child{margin-left:auto;transition:transform .15s}.bb-miss:not([open])>.bb-misshd>svg:last-child{transform:rotate(-90deg)}.bb-miss>.bb-gates{margin-top:6px}.bb-ret{margin-bottom:8px}',
      '.bb-secbd{display:flex;flex-direction:column;gap:8px;padding-top:8px}.bb-secgo{align-self:flex-start;min-height:44px;display:inline-flex;align-items:center;gap:4px}',
      '.bb-logo{flex:none;width:32px;height:32px}.bb-sect{font-weight:600;font-size:var(--fs-body)}.bb-secpts{margin-left:auto;white-space:nowrap}',
      '.bb-secbar{display:flex;flex-direction:column;gap:4px}.bb-secbar .bb-bar span{display:block;height:100%}',
      '.bb-gates{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}',
      '.bb-gates li{display:flex;align-items:center;gap:8px;min-height:32px;border-top:1px solid var(--line);font-size:var(--fs-small)}.bb-gates li:first-child{border-top:0}',
      '.bb-gl{flex:1;min-width:0}.bb-gw{color:var(--muted)}.bb-gates li[data-gate=fail] .bb-gw{color:var(--ljr-2-text)}'
    ].join('') + (Dna ? Dna.css() : '');
    document.head.appendChild(s);
  }

  /** The whole page. v = { T, today, esc } */
  function page(v) {
    last = v; css();
    /* the heading drops the label only when every scored animal's scheme is signed off; nothing scored keeps it */
    var res = compute(v).results, done = res.length && res.every(function (r) { return signedOff(r, v.today); });
    return '<h2 class="bb-top">' + LOGO + '<span>Breed Better</span>' + (done ? '' : ' ' + TESTING) + '</h2><div class="bb-rb" aria-hidden="true"></div><div id="bbRoot">' + inner(v) + '</div>';
  }

  /** The score on a dog card. Empty when that animal is not enrolled. */
  function chip(v, id) {
    last = v; css();
    var r = compute(v).byId[id];
    if (!r) return '';
    var off = signedOff(r, v.today);
    return '<button type="button" class="bb-chip" data-go="breed" data-bb-dog="' + v.esc(id) + '" aria-label="Breed Better score' + (off ? '' : ', testing: trial scores, not yet signed off') + '">' + pill(r) + '<span class="bb-pts">' + total(r) + '</span>' + (off ? '' : TESTING) + '</button>';
  }

  /* The Breed Better logo, as drawn in Lisa's mock-up (12 Nov 2026). No logo file is in the repo, so the mock-up's own SVG is used. */
  // the logo file sits beside this script (bb-logo.svg, drawn from the mock-up's own SVG: no logo file existed)
  var LOGO_SRC = (function () { try { var c = document.currentScript && document.currentScript.src; return c ? c.replace(/[^/]*$/, '') + 'bb-logo.svg' : 'bb-logo.svg'; } catch (e) { return 'bb-logo.svg'; } }());
  var LOGO = '<img class="bb-logo" src="' + LOGO_SRC + '" width="32" height="32" alt="Breed Better logo">';
  var GATE_WORD = { pass: 'Passed', fail: 'Failed', unverified: 'Missing' };
  var GATE_ICON = { pass: ICON.pass, fail: ICON.fail, unverified: 'M12 8v5 M12 16h.01 M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' };

  /** The Breed Better section on a dog card (Lisa, 12 Nov 2026): logo heading, verdict and Testing badges, score bar
   *  against the target, the must-pass checks one per line, and a tap through to the dog's Breed Better page. */
  function section(v, id) {
    last = v; css();
    var c = compute(v), r = c.byId[id];
    if (!r) return notInHtml(v, c, id);
    var esc = v.esc, all = r.points_available || 0, hasT = r.target !== '' && r.target !== undefined;
    var pc = all ? Math.min(100, 100 * r.points_earned / all) : 0, tp = hasT && all ? Math.min(100, 100 * r.target / all) : null;
    var gates = r.lines.filter(function (l) { return l.kind === 'gate'; });
    /* Lisa, 15 Nov 2026 (later): the score is a normal part of the card and always shows; the must-pass list is folded
       behind one line ("3 missing"), as it may grow long; open or folded is remembered per dog on this device.
       A tap on the heading opens this dog's Breed Better entry; "Back to <dog>" there returns to this card. */
    var cnt = { fail: 0, unverified: 0, pass: 0 }, k = verdictOf(r);
    gates.forEach(function (l) { var o = l.gate_outcome || 'unverified'; cnt[o] = (cnt[o] || 0) + 1; });
    var miss = [cnt.unverified ? cnt.unverified + ' missing' : '', cnt.fail ? cnt.fail + ' failed' : ''].filter(Boolean).join(' · ')
      || 'All ' + gates.length + ' passed';
    var acts = unenrolHtml(v, c.enrol[id]), off = signedOff(r, v.today);
    return '<section class="bb-sec" data-k="bb" aria-label="Breed Better">'
      + '<button type="button" class="bb-chip bb-sechd" data-go="breed" data-bb-dog="' + esc(id) + '" aria-label="Breed Better: ' + esc((r.words && r.words[k]) || VERDICT[k] || '') + ', ' + total(r) + (off ? '' : '. Testing') + '. Open the Breed Better page">'
      + LOGO + '<span class="bb-sect">Breed Better</span>' + pill(r) + (off ? '' : TESTING)
      + '<span class="bb-pts bb-secpts">' + total(r) + '</span>' + ic('M9 6l6 6l-6 6', 16) + '</button>'
      + (all ? '<div class="bb-secbar"><div class="bb-barw"><div class="bb-bar" role="img" aria-label="' + r.points_earned + ' of ' + all + ' points' + (hasT ? ', target ' + r.target : '') + '">'
        + '<span style="width:' + pc.toFixed(1) + '%;background:var(' + VTEXT[k] + ')"></span></div>'
        + (tp !== null ? '<span class="bb-tmark" style="left:' + tp.toFixed(1) + '%" title="Target ' + r.target + '"></span>' : '') + '</div>'
        + '<div class="bb-three"><span>' + r.points_earned + ' of ' + all + '</span>' + (hasT ? '<span>target ' + r.target + ' (' + Math.round(tp) + '%)</span>' : '') + '</div></div>' : '')
      + (gates.length ? '<details class="bb-secf bb-miss" data-bb-sec="' + esc(id) + '"' + (secOpen(id) ? ' open' : '') + '>'
        + '<summary class="bb-misshd"><span class="bb-strong">Must pass</span><span class="bb-pts bb-misscnt">' + miss + '</span>' + ic('M6 9l6 6l6 -6', 16) + '</summary>'
        + '<ul class="bb-gates">' + gates.map(function (l) {
          var o = l.gate_outcome || 'unverified';
          return '<li data-gate="' + esc(o) + '">' + ic(GATE_ICON[o] || GATE_ICON.unverified, 16, 'var(' + (VTEXT[o] || '--muted') + ')')
            + '<span class="bb-gl">' + esc(l.label_then) + '</span><span class="bb-gw">' + (GATE_WORD[o] || o) + '</span></li>';
        }).join('') + '</ul></details>' : '')
      + (acts ? '<span class="bb-acts">' + acts + '</span>' : '')
      + '</section>';
  }

  /* Back to where Lisa came from (15 Nov 2026): a tap on a dog card's Breed Better heading keeps that card and its place.
     The hub pushes a real history entry for #/breed (HubNav.back, NAV #610), so the phone's Back works too; this button
     is HubNav's own "\u2190 Back to <dog>" (data-hub-back: HubNav steps back). Only a dog card sets the dog (from.id);
     the hub's menu leaves it blank, so no button then. A cold link has no entry and shows none. */
  function nav() { return typeof window !== 'undefined' && window.HubNav && window.HubNav.back ? window.HubNav.back : null; }
  function fromHtml(v) {
    var f = state.from || fromHistory();
    if (!f || !f.id) return '';
    if (!state.from) state.from = f;
    var inHistory = fromHistory();
    /* the history entry is ours: HubNav's button and Back. Otherwise (no entry yet), the old way back by address. */
    if (nav() && inHistory) return '<button type="button" class="cb hback bb-ret" data-hub-back>\u2190 Back to ' + v.esc(f.label || 'the dog card') + '</button>';
    return '<button type="button" class="bb-f bb-ret hback" data-bb-return="1">' + ic('M15 6l-6 6l6 6', 18) + 'Back to ' + v.esc(f.label || 'the dog card') + '</button>';
  }
  function fromHistory() {
    var h = null, n = nav();
    try { h = n ? n.from() : (history.state && history.state.from); } catch (err) { h = null; }
    return h && h.hash && h.id && location.hash === '#/breed' ? { id: h.id, label: h.label, hash: h.hash, y: h.y, top: null } : null;
  }
  function cameFrom(b) {
    var card = b.closest && b.closest('article.dc'), id = b.getAttribute('data-bb-dog'), v = last || {};
    if (!card) { state.from = null; return; }
    var d = (v.dogs || {})[id] || {}, r = v.T ? compute(v).byId[id] || {} : {};
    var from = { id: card.getAttribute('data-dog') || id, label: t(d.name) || t(r.name), hash: location.hash || '#/dogs', y: window.scrollY };
    state.from = { id: from.id, label: from.label, hash: from.hash, y: from.y, top: card.getBoundingClientRect().top };
    state.tab = 'dogs';
    /* the hub pushes #/breed on this same click; then its entry carries where we came from */
    setTimeout(function () { try { if (location.hash === '#/breed') history.replaceState(Object.assign({}, history.state || {}, { from: from }), '', location.href); } catch (err) { /* no history: the button still works */ } }, 0);
  }
  function backToCard() {
    var f = state.from;
    if (!f) return;
    if (location.hash !== f.hash) { if (location.hash !== '#/breed') state.from = null; return; }
    state.from = null;
    setTimeout(function () {   /* after the hub has drawn the page again */
      var card = f.top === null ? null : document.querySelector('article.dc[data-dog="' + (window.CSS && CSS.escape ? CSS.escape(f.id) : f.id) + '"]');
      window.scrollTo(0, card ? card.getBoundingClientRect().top + window.scrollY - f.top : f.y);
    }, 0);
  }

  /* ---- Enrol and un-enrol on every animal's card (Lisa, 15 Nov 2026). Saves go through the host: v.canWrite(),
     v.enrol(subjectId, schemeId, fromDate), v.unenrol(enrolment, reason, toDate), then v.refresh(). Nothing is deleted:
     un-enrol fills the enrolment's to date with a reason; the animal moves to the Archive, where Enrol brings it back. ---- */
  var enrolMsg = {};
  function canSave(v) { return !!(v.canWrite && v.canWrite() && v.enrol && v.unenrol); }
  function msgHtml(id) {
    var m = enrolMsg[id];
    if (!m) return '';
    return m.ok ? '<p class="bb-done" role="status" data-bb-enrol-msg>' + ic('M5 12l5 5l10 -10', 16, 'var(--ljr-5-text)') + last.esc(m.text) + '</p>'
      : '<p class="bb-err" role="alert" data-bb-enrol-msg>' + last.esc(m.text) + '</p>';
  }
  function refresh() { memo = null; if (last && typeof last.refresh === 'function') last.refresh(); else redraw(); }
  function hhmm() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  /* un-enrol ends the enrolment yesterday, so today it is already out; an enrolment that began today ends today */
  function endDay(e, today) { var y = addDays(today, -1); return e.from && y < e.from ? today : y; }
  function enrolClick(b) {
    var v = last, id;
    if (!v) return false;
    if (b.hasAttribute('data-bb-unenrol')) { state.unenrol = b.getAttribute('data-bb-unenrol'); delete enrolMsg[state.unenrol]; refresh(); return true; }
    if (b.hasAttribute('data-bb-unenrol-x')) { state.unenrol = ''; refresh(); return true; }
    if (b.hasAttribute('data-bb-unenrol-go')) {
      id = b.getAttribute('data-bb-unenrol-go');
      var box = b.closest('.bb-unf'), inp = box && box.querySelector('[data-bb-reason]'), reason = inp ? t(inp.value) : '';
      var en = compute(v).enrol[id];
      if (!reason) { enrolMsg[id] = { ok: false, text: 'Add a reason.' }; refresh(); return true; }
      if (!en) { state.unenrol = ''; refresh(); return true; }
      b.disabled = true;
      Promise.resolve(v.unenrol(en, reason, endDay(en, v.today))).then(function () {
        state.unenrol = ''; enrolMsg[id] = { ok: true, text: 'Un-enrolled ' + hhmm() + '. It is in the Archive.' }; refresh();
      }, function (err) { enrolMsg[id] = { ok: false, text: (err && err.message) || 'Not saved.' }; refresh(); });
      return true;
    }
    if (b.hasAttribute('data-bb-auto')) {
      var sid = b.getAttribute('data-bb-auto'), val = b.getAttribute('data-bb-auto-v');
      id = 'auto:' + sid; b.disabled = true;
      Promise.resolve(v.setRule(AUTO_KEY, autoNext(v.T, v.today, sid, val === 'on'), v.today, 'Owner setting, Breed Better My system')).then(function () {
        enrolMsg[id] = { ok: true, text: 'Saved ' + hhmm() }; refresh();
      }, function (err) { enrolMsg[id] = { ok: false, text: (err && err.message) || 'Not saved.' }; refresh(); });
      return true;
    }
    if (b.hasAttribute('data-bb-enrol')) {
      id = b.getAttribute('data-bb-enrol');
      b.disabled = true;
      Promise.resolve(v.enrol(id, b.getAttribute('data-bb-scheme'), v.today)).then(function () {
        enrolMsg[id] = { ok: true, text: 'Enrolled ' + hhmm() }; refresh();
      }, function (err) { enrolMsg[id] = { ok: false, text: (err && err.message) || 'Not saved.' }; refresh(); });
      return true;
    }
    return false;
  }
  function unenrolHtml(v, e) {
    if (!e) return '';
    var esc = v.esc, id = e.subject_id;
    if (state.unenrol !== id) return '<button type="button" class="bb-f" data-bb-unenrol="' + esc(id) + '"' + (canSave(v) ? '' : ' disabled') + '>Un-enrol</button>'
      + (canSave(v) ? '' : ' <span class="bb-pts">' + NOSAVE + '</span>') + msgHtml(id);
    return '<span class="bb-unf"><label class="bb-lab">Reason<input type="text" data-bb-reason="' + esc(id) + '" autocomplete="off" maxlength="200" placeholder="e.g. Rehomed, retired"></label>'
      + '<button type="button" class="bb-f" data-bb-unenrol-go="' + esc(id) + '">Un-enrol</button><button type="button" class="bb-f" data-bb-unenrol-x="1">Cancel</button></span>' + msgHtml(id);
  }
  var NOSAVE = 'Saving is not set up yet.';
  /* the scheme to enrol into: the one this animal was last in, else the one scheme in force today (newest if several) */
  function enrolScheme(v, c, id) {
    var was = c.ended.filter(function (x) { return x.id === id; })[0];
    if (was && was.scheme_id) return was.scheme_id;
    var on = (v.T['BLD-score_scheme.csv'] || []).filter(function (s) { return /^active$/i.test(t(s.status)) && (!t(s.to_date) || s.to_date >= v.today) && (!t(s.effective_from) || s.effective_from <= v.today); });
    on.sort(function (a, b) { return t(b.effective_from).localeCompare(t(a.effective_from)); });
    return on[0] ? on[0].id : '';
  }
  function enrolBtn(v, c, id) {
    var sch = enrolScheme(v, c, id);
    if (!sch) return '<span class="bb-pts">No scheme in force to enrol into.</span>';
    return '<button type="button" class="bb-f" data-bb-enrol="' + v.esc(id) + '" data-bb-scheme="' + v.esc(sch) + '"' + (canSave(v) ? '' : ' disabled') + '>Enrol</button>'
      + (canSave(v) ? '' : ' <span class="bb-pts">' + NOSAVE + '</span>') + msgHtml(id);
  }
  /** The folded section on a card whose animal is not enrolled: why (if it ended), the pup's DNA chances from its parents, and Enrol. */
  function notInHtml(v, c, id) {
    var T = v.T, esc = v.esc;
    if (!(T['BLD-score_scheme.csv'] || []).length) return '';   /* no scheme rows: Breed Better is not set up, or this reader cannot see it */
    var sub = (T['BLD-subject.csv'] || []).filter(function (x) { return x.id === id; })[0] || hubDog(v, id);
    if (!sub) return '';
    var was = c.ended.filter(function (x) { return x.id === id; })[0];
    var lit = t(sub.birth_litter_id) && (T['BLD-litter.csv'] || []).filter(function (l) { return l.id === t(sub.birth_litter_id); })[0];
    var odds = lit && Dna && Dna.pupOdds ? Dna.pupOdds(T, t(lit.sire_subject_id), t(lit.dam_subject_id)) : [];
    var body = (was ? '<p class="bb-pts">Ended' + (was.to ? ' ' + day(was.to) : '') + (was.reason ? ': ' + esc(was.reason) : '') + '</p>' : '')
      + (odds.length ? '<p class="bb-pts">DNA chances from the parents</p><ul class="bb-odds">' + odds.map(function (o) {
        return '<li><span class="bb-gl">' + esc(o.name) + '</span><span class="bb-pts">' + o.kinds.clear + '% clear, ' + o.kinds.carrier + '% carrier, ' + o.kinds.affected + '% affected or at risk</span></li>';
      }).join('') + '</ul>' : '')
      + '<span class="bb-acts">' + enrolBtn(v, c, id) + '</span>';
    return '<section class="bb-sec bb-out" data-k="bb" aria-label="Breed Better"><details class="bb-secf" data-bb-sec="' + esc(id) + '"' + (secOpen(id) || enrolMsg[id] ? ' open' : '') + '>'
      + '<summary class="bb-chip bb-sechd">' + LOGO + '<span class="bb-sect">Not in Breed Better</span><span class="bb-pts">' + (was ? 'Archived' : 'Enrol') + '</span>'
      + ic('M6 9l6 6l6 -6', 16) + '</summary><div class="bb-secbd">' + body + '</div></details></section>';
  }

  /* remembered open sections: { animal id: 1 }, newest last, at most SEC_MAX; a private window simply forgets */
  var SEC_KEY = 'bb-sec-open', SEC_MAX = 200, secMem = null;
  function secStore() {
    if (secMem) return secMem;
    try { secMem = JSON.parse(localStorage.getItem(SEC_KEY) || '{}'); } catch (e) { secMem = {}; }
    if (!secMem || typeof secMem !== 'object' || Array.isArray(secMem)) secMem = {};
    return secMem;
  }
  function secOpen(id) { return typeof localStorage !== 'undefined' && !!secStore()[id]; }
  function secSave(id, open) {
    var m = secStore(); delete m[id]; if (open) m[id] = 1;
    var ks = Object.keys(m); while (ks.length > SEC_MAX) delete m[ks.shift()];
    try { localStorage.setItem(SEC_KEY, JSON.stringify(m)); } catch (e) { /* not kept; the fold still works now */ }
  }

  /* typing or a new sort redraws the rows only, so the search box keeps focus */
  /* the hub loads the photos after each draw */
  function after() { if (last && typeof last.after === 'function') last.after(); }
  function redrawRows() { var el = document.getElementById('bbList'); if (el && last && memo) { el.innerHTML = rowsHtml(last, memo); after(); } }
  function redraw() { var el = document.getElementById('bbRoot'); if (el && last) { el.innerHTML = inner(last); after(); } }

  if (typeof document !== 'undefined') {
    /* remember which sections are open, so a redraw keeps them */
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (d && d.getAttribute && d.hasAttribute('data-bb-band')) state.open[d.getAttribute('data-bb-band')] = d.open;
      if (d && d.getAttribute && d.hasAttribute('data-bb-sec')) secSave(d.getAttribute('data-bb-sec'), d.open);
    }, true);
    document.addEventListener('input', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-bb-search')) { state.q = e.target.value.trim(); redrawRows(); }
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-bb-sort')) { state.sort = e.target.value; redrawRows(); }
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-bb-calc-test')) { state.calc = { code: e.target.value }; redraw(); }
    });
    /* capture, so the chosen dog is set before the hub's own click handler opens the page */
    document.addEventListener('click', function (e) {
      var eb = e.target.closest && e.target.closest('[data-bb-enrol],[data-bb-unenrol],[data-bb-unenrol-go],[data-bb-unenrol-x],[data-bb-auto]');
      if (eb && !eb.disabled) { e.preventDefault(); e.stopPropagation(); enrolClick(eb); return; }
      var hubGo = e.target.closest && e.target.closest('[data-go]');
      if (hubGo && !hubGo.hasAttribute('data-bb-dog') && !(hubGo.closest && hubGo.closest('#bbRoot'))) state.from = null;   /* left by the hub's own menu */
      var b = e.target.closest && e.target.closest('[data-bb-dog],[data-bb-return],[data-bb-filter],[data-bb-open],[data-bb-back],[data-bb-tab],[data-bb-sex],[data-bb-age],[data-bb-cal],[data-bb-month],[data-bb-calc],[data-bb-edit],[data-bb-edit-back]');
      if (!b) return;
      if (b.hasAttribute('data-bb-dog')) { cameFrom(b); state.dog = b.getAttribute('data-bb-dog'); state.edit = ''; return; }
      if (b.hasAttribute('data-bb-return')) {
        e.preventDefault(); e.stopPropagation();
        var hs = history.state;
        if (hs && hs.id === 'breed') history.back(); else if (state.from) location.hash = state.from.hash;
        return;
      }
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
      } else if (b.hasAttribute('data-bb-filter')) state.filter = b.getAttribute('data-bb-filter');
      else if (b.hasAttribute('data-bb-open')) state.dog = b.getAttribute('data-bb-open');
      else if (b.hasAttribute('data-bb-back')) { state.dog = ''; state.edit = ''; }
      else if (b.hasAttribute('data-bb-tab')) { state.tab = b.getAttribute('data-bb-tab'); state.dog = ''; state.edit = ''; }
      else if (b.hasAttribute('data-bb-sex')) state.sex = b.getAttribute('data-bb-sex');
      else if (b.hasAttribute('data-bb-age')) state.age = b.getAttribute('data-bb-age');
      else if (b.hasAttribute('data-bb-cal')) state.cal = b.getAttribute('data-bb-cal');
      else if (b.hasAttribute('data-bb-calc')) { var cv = b.getAttribute('data-bb-calc').split(':'); state.calc[cv[0]] = Number(cv[1]); }
      else if (b.hasAttribute('data-bb-month')) { state.month = b.getAttribute('data-bb-month'); state.cal = 'all'; }
      redraw();
    }, true);
    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f || !f.getAttribute || !f.hasAttribute('data-bb-result')) return;
      e.preventDefault();
      var msg = f.querySelector('[data-bb-edit-msg]');
      if (msg) msg.textContent = 'The result is entered here. It is saved when this check\'s table is on the save script.';
    }, true);
    window.addEventListener('popstate', backToCard);
    window.addEventListener('hashchange', backToCard);
    window.addEventListener('popstate', function () {
      if (!state.editPushed) return;
      state.edit = '';
      state.editPushed = false;
    });
  }

  /** Open one animal's page next time the page is drawn: the hub's #/breed/<id> address. */
  function open(id) { state.dog = t(id); state.edit = ''; state.editPushed = false; }
  function setTab(k) { state.tab = k; state.dog = ''; state.edit = ''; }

  return { withValues: withValues, ruleOn: ruleOn, autoKey: autoKey, autoOn: autoOn, autoNext: autoNext, enrolments: enrolments, endDay: endDay, FILES: FILES, bandColour: bandColour, secResult: secResult, secIcon: secIcon, compute: compute, page: page, chip: chip, section: section, open: open, setTab: setTab, age: age, months: months, ageGroups: ageGroups, inAge: inAge, bandStats: bandStats, day: day, lineHtml: lineHtml, wordsFor: wordsFor, SORTS: SORTS, sortRows: function (rows, k) { return rows.slice().sort(SORT_FN[k] || SORT_FN.verdict); } };
}));
